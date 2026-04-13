import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'

const { getUserMock, fromMock } = vi.hoisted(() => ({
  getUserMock: vi.fn(),
  fromMock: vi.fn(),
}))

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: { getUser: getUserMock },
    from: (...args: unknown[]) => fromMock(...args),
  },
}))

import { _clearTokenCache } from '../middleware/auth'
import { app } from '../app'

let uidCounter = 0
function authedAs(id?: string) {
  const userId = id ?? `u-${uidCounter++}-${Date.now()}`
  getUserMock.mockResolvedValueOnce({
    data: { user: { id: userId, email: 'test@example.com' } },
    error: null,
  })
  return userId
}

// Chainable mock helpers per table
interface TableMocks {
  relationships?: { data: unknown; error?: unknown }
  warm_pings_count?: { count: number; error?: unknown }
  warm_pings_insert?: { error?: unknown }
  users?: { data: unknown; error?: unknown }
  notifications_insert?: { error?: unknown }
}

function wireMocks(setup: TableMocks) {
  const notifInsert = vi.fn().mockResolvedValue({
    error: setup.notifications_insert?.error ?? null,
  })

  fromMock.mockImplementation((table: string) => {
    if (table === 'relationships') {
      const result = setup.relationships ?? { data: null, error: null }
      return {
        select: () => ({
          or: () => ({
            eq: () => ({
              limit: () => ({
                maybeSingle: () => Promise.resolve(result),
              }),
            }),
          }),
        }),
      }
    }

    if (table === 'warm_pings') {
      // Could be a SELECT (count) or INSERT
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              gte: () =>
                Promise.resolve(
                  setup.warm_pings_count ?? { count: 0, error: null },
                ),
            }),
          }),
        }),
        insert: vi
          .fn()
          .mockResolvedValue({ error: setup.warm_pings_insert?.error ?? null }),
      }
    }

    if (table === 'users') {
      return {
        select: () => ({
          eq: () => ({
            single: () =>
              Promise.resolve(
                setup.users ?? {
                  data: { display_name: 'Test User' },
                  error: null,
                },
              ),
          }),
        }),
      }
    }

    if (table === 'notifications') {
      return {
        insert: vi
          .fn()
          .mockResolvedValue({
            error: setup.notifications_insert?.error ?? null,
          }),
      }
    }

    throw new Error(`unexpected table: ${table}`)
  })
}

describe('POST /api/warm-ping', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    _clearTokenCache()
  })

  it('returns 401 without a token', async () => {
    const res = await request(app).post('/api/warm-ping')
    expect(res.status).toBe(401)
  })

  it('returns 400 when recipient_id is missing', async () => {
    authedAs()
    const res = await request(app)
      .post('/api/warm-ping')
      .set('Authorization', 'Bearer v')
      .send({})
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('missing_recipient_id')
  })

  it('returns 400 when pinging self', async () => {
    const uid = authedAs('self-user')
    const res = await request(app)
      .post('/api/warm-ping')
      .set('Authorization', 'Bearer v')
      .send({ recipient_id: uid })
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('cannot_ping_self')
  })

  it('returns 404 when no active relationship exists', async () => {
    authedAs()
    wireMocks({
      relationships: { data: null },
    })
    const res = await request(app)
      .post('/api/warm-ping')
      .set('Authorization', 'Bearer v')
      .send({ recipient_id: 'recipient-1' })
    expect(res.status).toBe(404)
    expect(res.body.error).toBe('no_active_relationship')
  })

  it('returns 500 when relationship lookup fails', async () => {
    authedAs()
    wireMocks({
      relationships: { data: null, error: { message: 'boom' } },
    })
    const res = await request(app)
      .post('/api/warm-ping')
      .set('Authorization', 'Bearer v')
      .send({ recipient_id: 'recipient-1' })
    expect(res.status).toBe(500)
    expect(res.body.error).toBe('relationship_lookup_failed')
  })

  it('returns 429 when daily limit is reached', async () => {
    authedAs()
    wireMocks({
      relationships: { data: { id: 'r1', status: 'active' } },
      warm_pings_count: {
        count: 3,
      },
    })
    const res = await request(app)
      .post('/api/warm-ping')
      .set('Authorization', 'Bearer v')
      .send({ recipient_id: 'recipient-1' })
    expect(res.status).toBe(429)
    expect(res.body.error).toBe('daily_limit_reached')
  })

  it('sends a warm ping successfully', async () => {
    authedAs()
    wireMocks({
      relationships: { data: { id: 'r1', status: 'active' } },
      warm_pings_count: { count: 0 },
    })
    const res = await request(app)
      .post('/api/warm-ping')
      .set('Authorization', 'Bearer v')
      .send({ recipient_id: 'recipient-1' })
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ ok: true })
  })

  it('returns 500 when warm_pings insert fails', async () => {
    authedAs()
    wireMocks({
      relationships: { data: { id: 'r1', status: 'active' } },
      warm_pings_count: { count: 0 },
      warm_pings_insert: { error: { message: 'boom' } },
    })
    const res = await request(app)
      .post('/api/warm-ping')
      .set('Authorization', 'Bearer v')
      .send({ recipient_id: 'recipient-1' })
    expect(res.status).toBe(500)
    expect(res.body.error).toBe('insert_failed')
  })

  it('returns 500 when count lookup fails', async () => {
    authedAs()
    wireMocks({
      relationships: { data: { id: 'r1', status: 'active' } },
      warm_pings_count: { count: 0, error: { message: 'boom' } },
    })
    const res = await request(app)
      .post('/api/warm-ping')
      .set('Authorization', 'Bearer v')
      .send({ recipient_id: 'recipient-1' })
    expect(res.status).toBe(500)
    expect(res.body.error).toBe('count_lookup_failed')
  })
})
