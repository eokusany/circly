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

let uidCounter = 0
function authedAs(id?: string) {
  const userId = id ?? `u-${uidCounter++}-${Date.now()}`
  getUserMock.mockResolvedValueOnce({
    data: { user: { id: userId, email: 'test@example.com' } },
    error: null,
  })
  return userId
}

interface MockSetup {
  conversation?: { data: unknown; error?: unknown }
  relationships?: { data: unknown; error?: unknown }
  messageInsert?: { data: unknown; error?: unknown }
  users?: { data: unknown; error?: unknown }
  notificationsInsert?: { error?: unknown }
}

function wireMocks(setup: MockSetup) {
  fromMock.mockImplementation((table: string) => {
    if (table === 'conversations') {
      const result = setup.conversation ?? { data: null, error: null }
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: () => Promise.resolve(result),
          }),
        }),
      }
    }

    if (table === 'relationships') {
      const result = setup.relationships ?? { data: null, error: null }
      return {
        select: () => ({
          or: () => Promise.resolve(result),
        }),
      }
    }

    if (table === 'messages') {
      const result = setup.messageInsert ?? {
        data: { id: 'msg-1', conversation_id: 'c1', sender_id: 's1', body: 'hi', created_at: new Date().toISOString() },
        error: null,
      }
      return {
        insert: () => ({
          select: () => ({
            single: () => Promise.resolve(result),
          }),
        }),
      }
    }

    if (table === 'users') {
      return {
        select: () => ({
          eq: () => ({
            single: () =>
              Promise.resolve(
                setup.users ?? { data: { display_name: 'Test User' }, error: null },
              ),
          }),
        }),
      }
    }

    if (table === 'notifications') {
      return {
        insert: vi.fn().mockResolvedValue({
          error: setup.notificationsInsert?.error ?? null,
        }),
      }
    }

    throw new Error(`unexpected table: ${table}`)
  })
}

describe('POST /api/messages', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 without a token', async () => {
    const res = await request(app).post('/api/messages')
    expect(res.status).toBe(401)
  })

  it('returns 400 when fields are missing', async () => {
    authedAs()
    const res = await request(app)
      .post('/api/messages')
      .set('Authorization', 'Bearer v')
      .send({})
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('missing_fields')
  })

  it('returns 400 when body is empty string', async () => {
    authedAs()
    const res = await request(app)
      .post('/api/messages')
      .set('Authorization', 'Bearer v')
      .send({ conversation_id: 'c1', body: '   ' })
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('missing_fields')
  })

  it('returns 400 when body is too long', async () => {
    authedAs()
    const res = await request(app)
      .post('/api/messages')
      .set('Authorization', 'Bearer v')
      .send({ conversation_id: 'c1', body: 'x'.repeat(2001) })
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('message_too_long')
  })

  it('returns 404 when conversation does not exist', async () => {
    authedAs()
    wireMocks({ conversation: { data: null } })
    const res = await request(app)
      .post('/api/messages')
      .set('Authorization', 'Bearer v')
      .send({ conversation_id: 'c1', body: 'hello' })
    expect(res.status).toBe(404)
    expect(res.body.error).toBe('conversation_not_found')
  })

  it('returns 500 when conversation lookup fails', async () => {
    authedAs()
    wireMocks({ conversation: { data: null, error: { message: 'boom' } } })
    const res = await request(app)
      .post('/api/messages')
      .set('Authorization', 'Bearer v')
      .send({ conversation_id: 'c1', body: 'hello' })
    expect(res.status).toBe(500)
    expect(res.body.error).toBe('conversation_lookup_failed')
  })

  it('returns 403 when user is not a participant', async () => {
    authedAs('user-a')
    wireMocks({
      conversation: {
        data: { id: 'c1', participant_ids: ['user-b', 'user-c'] },
      },
    })
    const res = await request(app)
      .post('/api/messages')
      .set('Authorization', 'Bearer v')
      .send({ conversation_id: 'c1', body: 'hello' })
    expect(res.status).toBe(403)
    expect(res.body.error).toBe('not_a_participant')
  })

  it('returns 403 when messaging is disabled by privacy setting', async () => {
    const uid = authedAs('user-a')
    wireMocks({
      conversation: {
        data: { id: 'c1', participant_ids: [uid, 'user-b'] },
      },
      relationships: {
        data: [{ permissions: { messages: false }, status: 'active' }],
      },
    })
    const res = await request(app)
      .post('/api/messages')
      .set('Authorization', 'Bearer v')
      .send({ conversation_id: 'c1', body: 'hello' })
    expect(res.status).toBe(403)
    expect(res.body.error).toBe('messaging_disabled')
  })

  it('sends a message successfully', async () => {
    const uid = authedAs('user-a')
    wireMocks({
      conversation: {
        data: { id: 'c1', participant_ids: [uid, 'user-b'] },
      },
      relationships: {
        data: [{ permissions: { messages: true }, status: 'active' }],
      },
    })
    const res = await request(app)
      .post('/api/messages')
      .set('Authorization', 'Bearer v')
      .send({ conversation_id: 'c1', body: 'hello' })
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
    expect(res.body.message).toBeDefined()
  })

  it('sends when no relationship exists (e.g. same user in multiple contexts)', async () => {
    const uid = authedAs('user-a')
    wireMocks({
      conversation: {
        data: { id: 'c1', participant_ids: [uid, 'user-b'] },
      },
      relationships: { data: [] },
    })
    const res = await request(app)
      .post('/api/messages')
      .set('Authorization', 'Bearer v')
      .send({ conversation_id: 'c1', body: 'hello' })
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })

  it('returns 500 when message insert fails', async () => {
    const uid = authedAs('user-a')
    wireMocks({
      conversation: {
        data: { id: 'c1', participant_ids: [uid, 'user-b'] },
      },
      relationships: { data: [] },
      messageInsert: { data: null, error: { message: 'boom' } },
    })
    const res = await request(app)
      .post('/api/messages')
      .set('Authorization', 'Bearer v')
      .send({ conversation_id: 'c1', body: 'hello' })
    expect(res.status).toBe(500)
    expect(res.body.error).toBe('message_insert_failed')
  })
})
