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

// Unique user id per test — encouragementLimiter is 30/hour per user. Even
// though we don't hit the cap today, using fresh ids keeps the suite
// future-proof and isolates tests from each other.
let uid = 0
function authedAs(): string {
  const userId = `sup-${uid++}-${Date.now()}`
  getUserMock.mockResolvedValueOnce({
    data: { user: { id: userId, email: `${userId}@example.com` } },
    error: null,
  })
  return userId
}

function relationshipLookup(row: unknown, error: unknown = null) {
  return {
    select: () => ({
      eq: () => ({
        maybeSingle: () => Promise.resolve({ data: row, error }),
      }),
    }),
  }
}

function userLookup(displayName: string | null, error: unknown = null) {
  return {
    select: () => ({
      eq: () => ({
        single: () =>
          Promise.resolve({
            data: displayName !== null ? { display_name: displayName } : null,
            error,
          }),
      }),
    }),
  }
}

function notificationsInsert(result: { error?: unknown } = { error: null }) {
  return { insert: vi.fn().mockResolvedValue(result) }
}

interface Wiring {
  relationship?: { row: unknown; error?: unknown }
  user?: { displayName: string | null; error?: unknown }
  notifications?: { error?: unknown }
}

function wire({ relationship, user, notifications }: Wiring) {
  const notifs = notificationsInsert(notifications)
  fromMock.mockImplementation((table: string) => {
    if (table === 'relationships')
      return relationshipLookup(relationship?.row, relationship?.error ?? null)
    if (table === 'users') {
      // Preserve an explicit null displayName (treated as "no row found").
      const name = user === undefined ? 'Jamie' : user.displayName
      return userLookup(name, user?.error ?? null)
    }
    if (table === 'notifications') return notifs
    throw new Error(`unexpected table: ${table}`)
  })
  return { notifs }
}

function activeRel(supporterId: string, relId = 'rel-1', recoveryId = 'rec-1') {
  return {
    id: relId,
    recovery_user_id: recoveryId,
    supporter_id: supporterId,
    status: 'active',
  }
}

describe('POST /api/encouragements', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    _clearTokenCache()
  })

  describe('authentication', () => {
    it('returns 401 without a token', async () => {
      const res = await request(app).post('/api/encouragements')
      expect(res.status).toBe(401)
    })

    it('returns 401 when the supabase token is rejected', async () => {
      getUserMock.mockResolvedValueOnce({
        data: { user: null },
        error: { message: 'bad' },
      })
      const res = await request(app)
        .post('/api/encouragements')
        .set('Authorization', 'Bearer bad')
      expect(res.status).toBe(401)
    })
  })

  describe('field validation', () => {
    it('returns 400 with missing_fields when body is empty', async () => {
      authedAs()
      const res = await request(app)
        .post('/api/encouragements')
        .set('Authorization', 'Bearer v')
        .send({})
      expect(res.status).toBe(400)
      expect(res.body).toEqual({ error: 'missing_fields' })
    })

    it('returns 400 when relationship_id is missing', async () => {
      authedAs()
      const res = await request(app)
        .post('/api/encouragements')
        .set('Authorization', 'Bearer v')
        .send({ message: 'hi' })
      expect(res.status).toBe(400)
      expect(res.body).toEqual({ error: 'missing_fields' })
    })

    it('returns 400 when message is missing', async () => {
      authedAs()
      const res = await request(app)
        .post('/api/encouragements')
        .set('Authorization', 'Bearer v')
        .send({ relationship_id: 'r1' })
      expect(res.status).toBe(400)
      expect(res.body).toEqual({ error: 'missing_fields' })
    })

    it('returns 400 when relationship_id is a number', async () => {
      authedAs()
      const res = await request(app)
        .post('/api/encouragements')
        .set('Authorization', 'Bearer v')
        .send({ relationship_id: 42, message: 'hi' })
      expect(res.status).toBe(400)
      expect(res.body).toEqual({ error: 'missing_fields' })
    })

    it('returns 400 when message is a number', async () => {
      authedAs()
      const res = await request(app)
        .post('/api/encouragements')
        .set('Authorization', 'Bearer v')
        .send({ relationship_id: 'r1', message: 99 })
      expect(res.status).toBe(400)
      expect(res.body).toEqual({ error: 'missing_fields' })
    })

    it('returns 400 when message is null', async () => {
      authedAs()
      const res = await request(app)
        .post('/api/encouragements')
        .set('Authorization', 'Bearer v')
        .send({ relationship_id: 'r1', message: null })
      expect(res.status).toBe(400)
      expect(res.body).toEqual({ error: 'missing_fields' })
    })

    it('returns 400 when relationship_id is an empty string', async () => {
      authedAs()
      const res = await request(app)
        .post('/api/encouragements')
        .set('Authorization', 'Bearer v')
        .send({ relationship_id: '', message: 'hi' })
      expect(res.status).toBe(400)
      expect(res.body).toEqual({ error: 'missing_fields' })
    })

    it('returns 400 when message is an empty string', async () => {
      authedAs()
      const res = await request(app)
        .post('/api/encouragements')
        .set('Authorization', 'Bearer v')
        .send({ relationship_id: 'r1', message: '' })
      expect(res.status).toBe(400)
      expect(res.body).toEqual({ error: 'missing_fields' })
    })

    it('returns 400 when message is only whitespace', async () => {
      authedAs()
      const res = await request(app)
        .post('/api/encouragements')
        .set('Authorization', 'Bearer v')
        .send({ relationship_id: 'r1', message: '    \n\t  ' })
      expect(res.status).toBe(400)
      expect(res.body).toEqual({ error: 'missing_fields' })
    })

    it('accepts a message at exactly 500 characters', async () => {
      const supId = authedAs()
      wire({
        relationship: { row: activeRel(supId) },
        user: { displayName: 'Jamie' },
      })
      const res = await request(app)
        .post('/api/encouragements')
        .set('Authorization', 'Bearer v')
        .send({ relationship_id: 'rel-1', message: 'a'.repeat(500) })
      expect(res.status).toBe(200)
    })

    it('returns 400 message_too_long at 501 characters', async () => {
      authedAs()
      const res = await request(app)
        .post('/api/encouragements')
        .set('Authorization', 'Bearer v')
        .send({ relationship_id: 'rel-1', message: 'a'.repeat(501) })
      expect(res.status).toBe(400)
      expect(res.body).toEqual({ error: 'message_too_long' })
    })

    it('returns 400 message_too_long at 1000 characters', async () => {
      authedAs()
      const res = await request(app)
        .post('/api/encouragements')
        .set('Authorization', 'Bearer v')
        .send({ relationship_id: 'rel-1', message: 'a'.repeat(1000) })
      expect(res.status).toBe(400)
      expect(res.body).toEqual({ error: 'message_too_long' })
    })

    it('counts length AFTER trimming (whitespace pad does not push over 500)', async () => {
      const supId = authedAs()
      wire({
        relationship: { row: activeRel(supId) },
        user: { displayName: 'Jamie' },
      })
      const res = await request(app)
        .post('/api/encouragements')
        .set('Authorization', 'Bearer v')
        .send({ relationship_id: 'rel-1', message: `  ${'a'.repeat(500)}  ` })
      expect(res.status).toBe(200)
    })
  })

  describe('authorization on the relationship', () => {
    it('returns 404 when the relationship does not exist', async () => {
      authedAs()
      wire({ relationship: { row: null } })
      const res = await request(app)
        .post('/api/encouragements')
        .set('Authorization', 'Bearer v')
        .send({ relationship_id: 'rel-x', message: 'hi' })
      expect(res.status).toBe(404)
      expect(res.body).toEqual({ error: 'relationship_not_found' })
    })

    it('returns 404 when the caller is not the supporter on the relationship', async () => {
      authedAs() // our caller is some sup-N
      wire({
        relationship: {
          row: {
            id: 'rel-1',
            recovery_user_id: 'rec-1',
            supporter_id: 'different-supporter',
            status: 'active',
          },
        },
      })
      const res = await request(app)
        .post('/api/encouragements')
        .set('Authorization', 'Bearer v')
        .send({ relationship_id: 'rel-1', message: 'hi' })
      expect(res.status).toBe(404)
      expect(res.body).toEqual({ error: 'relationship_not_found' })
    })

    it('returns 400 relationship_inactive when status = removed', async () => {
      const supId = authedAs()
      wire({
        relationship: {
          row: {
            id: 'rel-1',
            recovery_user_id: 'rec-1',
            supporter_id: supId,
            status: 'removed',
          },
        },
      })
      const res = await request(app)
        .post('/api/encouragements')
        .set('Authorization', 'Bearer v')
        .send({ relationship_id: 'rel-1', message: 'hi' })
      expect(res.status).toBe(400)
      expect(res.body).toEqual({ error: 'relationship_inactive' })
    })

    it('returns 400 relationship_inactive when status = pending', async () => {
      const supId = authedAs()
      wire({
        relationship: {
          row: {
            id: 'rel-1',
            recovery_user_id: 'rec-1',
            supporter_id: supId,
            status: 'pending',
          },
        },
      })
      const res = await request(app)
        .post('/api/encouragements')
        .set('Authorization', 'Bearer v')
        .send({ relationship_id: 'rel-1', message: 'hi' })
      expect(res.status).toBe(400)
      expect(res.body).toEqual({ error: 'relationship_inactive' })
    })

    it('returns 500 when the relationship lookup errors', async () => {
      authedAs()
      wire({ relationship: { row: null, error: { message: 'db down' } } })
      const res = await request(app)
        .post('/api/encouragements')
        .set('Authorization', 'Bearer v')
        .send({ relationship_id: 'rel-1', message: 'hi' })
      expect(res.status).toBe(500)
      expect(res.body).toEqual({ error: 'relationship_lookup_failed' })
    })
  })

  describe('user display_name lookup', () => {
    it('returns 500 when the user lookup errors', async () => {
      const supId = authedAs()
      wire({
        relationship: { row: activeRel(supId) },
        user: { displayName: null, error: { message: 'u-boom' } },
      })
      const res = await request(app)
        .post('/api/encouragements')
        .set('Authorization', 'Bearer v')
        .send({ relationship_id: 'rel-1', message: 'hi' })
      expect(res.status).toBe(500)
      expect(res.body).toEqual({ error: 'user_lookup_failed' })
    })

    it('returns 500 when the user lookup returns no row', async () => {
      const supId = authedAs()
      wire({
        relationship: { row: activeRel(supId) },
        user: { displayName: null },
      })
      const res = await request(app)
        .post('/api/encouragements')
        .set('Authorization', 'Bearer v')
        .send({ relationship_id: 'rel-1', message: 'hi' })
      expect(res.status).toBe(500)
      expect(res.body).toEqual({ error: 'user_lookup_failed' })
    })
  })

  describe('notification insert', () => {
    it('inserts an encouragement notification for the recovery user on success', async () => {
      const supId = authedAs()
      const { notifs } = wire({
        relationship: { row: activeRel(supId) },
        user: { displayName: 'Jamie' },
      })
      const res = await request(app)
        .post('/api/encouragements')
        .set('Authorization', 'Bearer v')
        .send({ relationship_id: 'rel-1', message: 'proud of you' })
      expect(res.status).toBe(200)
      expect(res.body).toEqual({ ok: true })
      expect(notifs.insert).toHaveBeenCalledTimes(1)
      expect(notifs.insert).toHaveBeenCalledWith({
        recipient_id: 'rec-1',
        type: 'encouragement',
        payload: { from_display_name: 'Jamie', message: 'proud of you' },
      })
    })

    it('trims the message before persisting it', async () => {
      const supId = authedAs()
      const { notifs } = wire({
        relationship: { row: activeRel(supId) },
        user: { displayName: 'Jamie' },
      })
      await request(app)
        .post('/api/encouragements')
        .set('Authorization', 'Bearer v')
        .send({ relationship_id: 'rel-1', message: '  hi  ' })
      const row = notifs.insert.mock.calls[0][0] as { payload: { message: string } }
      expect(row.payload.message).toBe('hi')
    })

    it('returns 500 when the notification insert errors', async () => {
      const supId = authedAs()
      wire({
        relationship: { row: activeRel(supId) },
        user: { displayName: 'Jamie' },
        notifications: { error: { message: 'insert fail' } },
      })
      const res = await request(app)
        .post('/api/encouragements')
        .set('Authorization', 'Bearer v')
        .send({ relationship_id: 'rel-1', message: 'hi' })
      expect(res.status).toBe(500)
      expect(res.body).toEqual({ error: 'notification_insert_failed' })
    })

    it('preserves unicode in the message payload', async () => {
      const supId = authedAs()
      const { notifs } = wire({
        relationship: { row: activeRel(supId) },
        user: { displayName: 'Jamie' },
      })
      await request(app)
        .post('/api/encouragements')
        .set('Authorization', 'Bearer v')
        .send({ relationship_id: 'rel-1', message: '你好 🌿' })
      const row = notifs.insert.mock.calls[0][0] as { payload: { message: string } }
      expect(row.payload.message).toBe('你好 🌿')
    })

    it('uses the supporter display_name (not the caller email) in payload', async () => {
      const supId = authedAs()
      const { notifs } = wire({
        relationship: { row: activeRel(supId) },
        user: { displayName: 'Jamie Smith' },
      })
      await request(app)
        .post('/api/encouragements')
        .set('Authorization', 'Bearer v')
        .send({ relationship_id: 'rel-1', message: 'hi' })
      const row = notifs.insert.mock.calls[0][0] as {
        payload: { from_display_name: string }
      }
      expect(row.payload.from_display_name).toBe('Jamie Smith')
    })
  })
})
