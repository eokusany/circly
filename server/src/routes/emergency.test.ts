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

// Each test must use a fresh user id — emergencyLimiter is 10/hour per user
// and the in-memory store persists across tests inside a single run.
let uidCounter = 0
function authedAs(email = 'rec@example.com') {
  const userId = `rec-${uidCounter++}-${Date.now()}`
  getUserMock.mockResolvedValueOnce({
    data: { user: { id: userId, email } },
    error: null,
  })
  return userId
}

// Builders for the three table shapes the emergency route touches.
function userSingle(data: unknown, error: unknown = null) {
  return {
    select: () => ({
      eq: () => ({
        single: () => Promise.resolve({ data, error }),
      }),
    }),
  }
}

function relationshipsDoubleEq(data: unknown, error: unknown = null) {
  return {
    select: () => ({
      eq: () => ({
        eq: () => Promise.resolve({ data, error }),
      }),
    }),
  }
}

function notificationsInsert(result: { data?: unknown; error?: unknown } = { data: null, error: null }) {
  return { insert: vi.fn().mockResolvedValue(result) }
}

interface Wiring {
  user?: { data: unknown; error?: unknown }
  relationships?: { data: unknown; error?: unknown }
  notificationsResult?: { data?: unknown; error?: unknown }
}

function wire({ user, relationships, notificationsResult }: Wiring) {
  const notifs = notificationsInsert(notificationsResult)
  fromMock.mockImplementation((table: string) => {
    if (table === 'users')
      return userSingle(user?.data, user?.error ?? null)
    if (table === 'relationships')
      return relationshipsDoubleEq(
        relationships?.data,
        relationships?.error ?? null,
      )
    if (table === 'notifications') return notifs
    throw new Error(`unexpected table: ${table}`)
  })
  return { notifs }
}

describe('POST /api/emergency', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    _clearTokenCache()
  })

  describe('authentication', () => {
    it('returns 401 without a token', async () => {
      const res = await request(app).post('/api/emergency')
      expect(res.status).toBe(401)
    })

    it('returns 401 when the token is invalid', async () => {
      getUserMock.mockResolvedValueOnce({
        data: { user: null },
        error: { message: 'bad' },
      })
      const res = await request(app)
        .post('/api/emergency')
        .set('Authorization', 'Bearer bad')
      expect(res.status).toBe(401)
    })
  })

  describe('happy paths', () => {
    it('inserts one notification per active supporter and returns the count', async () => {
      authedAs('rec-1')
      const { notifs } = wire({
        user: { data: { display_name: 'Sam' } },
        relationships: {
          data: [{ supporter_id: 'sup-1' }, { supporter_id: 'sup-2' }],
        },
      })

      const res = await request(app)
        .post('/api/emergency')
        .set('Authorization', 'Bearer valid')

      expect(res.status).toBe(200)
      expect(res.body).toEqual({ supporters_notified: 2 })
      expect(notifs.insert).toHaveBeenCalledTimes(1)
      const rows = notifs.insert.mock.calls[0][0] as Array<{
        recipient_id: string
        type: string
        payload: { from_display_name: string }
      }>
      expect(rows).toHaveLength(2)
      expect(rows.map((r) => r.recipient_id)).toEqual(['sup-1', 'sup-2'])
      rows.forEach((r) => {
        expect(r.type).toBe('emergency')
        expect(r.payload).toEqual({ from_display_name: 'Sam' })
      })
    })

    it('handles a single supporter', async () => {
      authedAs('rec-1')
      wire({
        user: { data: { display_name: 'Alex' } },
        relationships: { data: [{ supporter_id: 'only-sup' }] },
      })
      const res = await request(app)
        .post('/api/emergency')
        .set('Authorization', 'Bearer valid')
      expect(res.status).toBe(200)
      expect(res.body).toEqual({ supporters_notified: 1 })
    })

    it('handles ten supporters', async () => {
      authedAs('rec-1')
      const supporters = Array.from({ length: 10 }, (_, i) => ({
        supporter_id: `sup-${i}`,
      }))
      const { notifs } = wire({
        user: { data: { display_name: 'Jordan' } },
        relationships: { data: supporters },
      })
      const res = await request(app)
        .post('/api/emergency')
        .set('Authorization', 'Bearer valid')
      expect(res.status).toBe(200)
      expect(res.body).toEqual({ supporters_notified: 10 })
      const rows = notifs.insert.mock.calls[0][0] as unknown[]
      expect(rows).toHaveLength(10)
    })

    it('returns supporters_notified: 0 and skips insert when there are no supporters', async () => {
      authedAs('rec-1')
      const { notifs } = wire({
        user: { data: { display_name: 'Alex' } },
        relationships: { data: [] },
      })
      const res = await request(app)
        .post('/api/emergency')
        .set('Authorization', 'Bearer valid')
      expect(res.status).toBe(200)
      expect(res.body).toEqual({ supporters_notified: 0 })
      expect(notifs.insert).not.toHaveBeenCalled()
    })

    it('treats null relationships data as empty', async () => {
      authedAs('rec-1')
      const { notifs } = wire({
        user: { data: { display_name: 'Alex' } },
        relationships: { data: null },
      })
      const res = await request(app)
        .post('/api/emergency')
        .set('Authorization', 'Bearer valid')
      expect(res.status).toBe(200)
      expect(res.body).toEqual({ supporters_notified: 0 })
      expect(notifs.insert).not.toHaveBeenCalled()
    })

    it('passes the exact display_name from the DB into the payload', async () => {
      authedAs('rec-1')
      const { notifs } = wire({
        user: { data: { display_name: 'Niamh O’Connor' } },
        relationships: { data: [{ supporter_id: 'sup-unicode' }] },
      })
      await request(app)
        .post('/api/emergency')
        .set('Authorization', 'Bearer valid')
      const rows = notifs.insert.mock.calls[0][0] as Array<{
        payload: { from_display_name: string }
      }>
      expect(rows[0].payload.from_display_name).toBe('Niamh O’Connor')
    })
  })

  describe('error paths', () => {
    it('returns 500 when the user lookup errors', async () => {
      authedAs('rec-1')
      wire({
        user: { data: null, error: { message: 'boom' } },
        relationships: { data: [] },
      })
      const res = await request(app)
        .post('/api/emergency')
        .set('Authorization', 'Bearer valid')
      expect(res.status).toBe(500)
      expect(res.body).toEqual({ error: 'user_lookup_failed' })
    })

    it('returns 500 when the user lookup returns no row', async () => {
      authedAs('rec-1')
      wire({
        user: { data: null },
        relationships: { data: [] },
      })
      const res = await request(app)
        .post('/api/emergency')
        .set('Authorization', 'Bearer valid')
      expect(res.status).toBe(500)
      expect(res.body).toEqual({ error: 'user_lookup_failed' })
    })

    it('returns 500 when the relationships lookup errors', async () => {
      authedAs('rec-1')
      wire({
        user: { data: { display_name: 'Sam' } },
        relationships: { data: null, error: { message: 'rel-boom' } },
      })
      const res = await request(app)
        .post('/api/emergency')
        .set('Authorization', 'Bearer valid')
      expect(res.status).toBe(500)
      expect(res.body).toEqual({ error: 'relationships_lookup_failed' })
    })

    it('returns 500 when the notifications insert errors', async () => {
      authedAs('rec-1')
      wire({
        user: { data: { display_name: 'Sam' } },
        relationships: { data: [{ supporter_id: 'sup-1' }] },
        notificationsResult: { data: null, error: { message: 'boom' } },
      })
      const res = await request(app)
        .post('/api/emergency')
        .set('Authorization', 'Bearer valid')
      expect(res.status).toBe(500)
      expect(res.body).toEqual({ error: 'notification_insert_failed' })
    })
  })

  describe('query shape', () => {
    it('parallelizes user + relationships lookups (both called)', async () => {
      authedAs('rec-1')
      wire({
        user: { data: { display_name: 'Sam' } },
        relationships: { data: [] },
      })
      await request(app)
        .post('/api/emergency')
        .set('Authorization', 'Bearer valid')
      const tables = fromMock.mock.calls.map((c) => c[0])
      expect(tables).toContain('users')
      expect(tables).toContain('relationships')
    })

    it('does not query notifications when there are zero supporters', async () => {
      authedAs('rec-1')
      wire({
        user: { data: { display_name: 'Sam' } },
        relationships: { data: [] },
      })
      await request(app)
        .post('/api/emergency')
        .set('Authorization', 'Bearer valid')
      const tables = fromMock.mock.calls.map((c) => c[0])
      expect(tables).not.toContain('notifications')
    })
  })
})
