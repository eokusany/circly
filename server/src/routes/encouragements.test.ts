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

import { app } from '../app'

function authedAs(userId = 'sup-1') {
  getUserMock.mockResolvedValueOnce({
    data: { user: { id: userId, email: `${userId}@example.com` } },
    error: null,
  })
}

function relationshipLookup(row: unknown) {
  return {
    select: () => ({
      eq: () => ({
        maybeSingle: () => Promise.resolve({ data: row, error: null }),
      }),
    }),
  }
}

function userLookup(displayName: string) {
  return {
    select: () => ({
      eq: () => ({
        single: () =>
          Promise.resolve({ data: { display_name: displayName }, error: null }),
      }),
    }),
  }
}

describe('POST /api/encouragements', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 without a token', async () => {
    const res = await request(app).post('/api/encouragements')
    expect(res.status).toBe(401)
  })

  it('returns 400 when relationship_id or message is missing', async () => {
    authedAs('sup-1')
    const res = await request(app)
      .post('/api/encouragements')
      .set('Authorization', 'Bearer valid')
      .send({ relationship_id: 'rel-1' })
    expect(res.status).toBe(400)
    expect(res.body).toEqual({ error: 'missing_fields' })
  })

  it('returns 400 when the message exceeds 500 characters', async () => {
    authedAs('sup-1')
    const res = await request(app)
      .post('/api/encouragements')
      .set('Authorization', 'Bearer valid')
      .send({ relationship_id: 'rel-1', message: 'a'.repeat(501) })
    expect(res.status).toBe(400)
    expect(res.body).toEqual({ error: 'message_too_long' })
  })

  it('returns 404 when the relationship does not belong to the caller', async () => {
    authedAs('sup-1')

    fromMock.mockImplementation((table: string) => {
      if (table === 'relationships') {
        return relationshipLookup(null)
      }
      throw new Error(`unexpected table: ${table}`)
    })

    const res = await request(app)
      .post('/api/encouragements')
      .set('Authorization', 'Bearer valid')
      .send({ relationship_id: 'rel-x', message: 'hi' })

    expect(res.status).toBe(404)
    expect(res.body).toEqual({ error: 'relationship_not_found' })
  })

  it('returns 400 when the relationship is not active', async () => {
    authedAs('sup-1')

    fromMock.mockImplementation((table: string) => {
      if (table === 'relationships') {
        return relationshipLookup({
          id: 'rel-1',
          recovery_user_id: 'rec-1',
          supporter_id: 'sup-1',
          status: 'removed',
        })
      }
      throw new Error(`unexpected table: ${table}`)
    })

    const res = await request(app)
      .post('/api/encouragements')
      .set('Authorization', 'Bearer valid')
      .send({ relationship_id: 'rel-1', message: 'thinking of you' })

    expect(res.status).toBe(400)
    expect(res.body).toEqual({ error: 'relationship_inactive' })
  })

  it('inserts a notification for the recovery user on success', async () => {
    authedAs('sup-1')

    const insertMock = vi.fn().mockResolvedValue({ error: null })

    fromMock.mockImplementation((table: string) => {
      if (table === 'relationships') {
        return relationshipLookup({
          id: 'rel-1',
          recovery_user_id: 'rec-1',
          supporter_id: 'sup-1',
          status: 'active',
        })
      }
      if (table === 'users') {
        return userLookup('Jamie')
      }
      if (table === 'notifications') {
        return { insert: insertMock }
      }
      throw new Error(`unexpected table: ${table}`)
    })

    const res = await request(app)
      .post('/api/encouragements')
      .set('Authorization', 'Bearer valid')
      .send({ relationship_id: 'rel-1', message: 'proud of you' })

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ ok: true })

    expect(insertMock).toHaveBeenCalledTimes(1)
    const row = insertMock.mock.calls[0][0] as {
      recipient_id: string
      type: string
      payload: { from_display_name: string; message: string }
    }
    expect(row).toMatchObject({
      recipient_id: 'rec-1',
      type: 'encouragement',
      payload: { from_display_name: 'Jamie', message: 'proud of you' },
    })
  })
})
