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

function authedAs(userId = 'rec-1') {
  getUserMock.mockResolvedValueOnce({
    data: { user: { id: userId, email: `${userId}@example.com` } },
    error: null,
  })
}

describe('POST /api/invites', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 without a token', async () => {
    const res = await request(app).post('/api/invites')
    expect(res.status).toBe(401)
  })

  it('generates a 6-char uppercase code with a 24h expiry', async () => {
    authedAs('rec-1')

    const insertMock = vi.fn().mockResolvedValue({ error: null })
    fromMock.mockImplementation((table: string) => {
      if (table === 'invite_codes') {
        return { insert: insertMock }
      }
      throw new Error(`unexpected table: ${table}`)
    })

    const before = Date.now()
    const res = await request(app)
      .post('/api/invites')
      .set('Authorization', 'Bearer valid')
    const after = Date.now()

    expect(res.status).toBe(200)
    expect(res.body.code).toMatch(/^[A-Z0-9]{6}$/)
    const expiresAt = new Date(res.body.expires_at).getTime()
    // should be ~24h out (allow generous slack for test timing)
    expect(expiresAt).toBeGreaterThanOrEqual(before + 24 * 60 * 60 * 1000 - 1000)
    expect(expiresAt).toBeLessThanOrEqual(after + 24 * 60 * 60 * 1000 + 1000)

    expect(insertMock).toHaveBeenCalledTimes(1)
    const row = insertMock.mock.calls[0][0] as {
      code: string
      recovery_user_id: string
      expires_at: string
    }
    expect(row.code).toBe(res.body.code)
    expect(row.recovery_user_id).toBe('rec-1')
  })
})

describe('POST /api/invites/accept', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 without a token', async () => {
    const res = await request(app)
      .post('/api/invites/accept')
      .send({ code: 'ABC123' })
    expect(res.status).toBe(401)
  })

  it('returns 400 for an unknown code', async () => {
    authedAs('sup-1')

    fromMock.mockImplementation((table: string) => {
      if (table === 'invite_codes') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () => Promise.resolve({ data: null, error: null }),
            }),
          }),
        }
      }
      throw new Error(`unexpected table: ${table}`)
    })

    const res = await request(app)
      .post('/api/invites/accept')
      .set('Authorization', 'Bearer valid')
      .send({ code: 'NOPE99' })

    expect(res.status).toBe(400)
    expect(res.body).toEqual({ error: 'invalid_code' })
  })

  it('returns 400 for an expired code', async () => {
    authedAs('sup-1')

    fromMock.mockImplementation((table: string) => {
      if (table === 'invite_codes') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () =>
                Promise.resolve({
                  data: {
                    code: 'EXPIRE',
                    recovery_user_id: 'rec-1',
                    expires_at: new Date(Date.now() - 1000).toISOString(),
                    used_at: null,
                  },
                  error: null,
                }),
            }),
          }),
        }
      }
      throw new Error(`unexpected table: ${table}`)
    })

    const res = await request(app)
      .post('/api/invites/accept')
      .set('Authorization', 'Bearer valid')
      .send({ code: 'EXPIRE' })

    expect(res.status).toBe(400)
    expect(res.body).toEqual({ error: 'code_expired' })
  })

  it('returns 400 when the code was already used', async () => {
    authedAs('sup-1')

    fromMock.mockImplementation((table: string) => {
      if (table === 'invite_codes') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () =>
                Promise.resolve({
                  data: {
                    code: 'USED12',
                    recovery_user_id: 'rec-1',
                    expires_at: new Date(Date.now() + 60_000).toISOString(),
                    used_at: new Date().toISOString(),
                  },
                  error: null,
                }),
            }),
          }),
        }
      }
      throw new Error(`unexpected table: ${table}`)
    })

    const res = await request(app)
      .post('/api/invites/accept')
      .set('Authorization', 'Bearer valid')
      .send({ code: 'USED12' })

    expect(res.status).toBe(400)
    expect(res.body).toEqual({ error: 'code_used' })
  })

  it('returns 400 when the code belongs to the caller', async () => {
    authedAs('rec-1')

    fromMock.mockImplementation((table: string) => {
      if (table === 'invite_codes') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () =>
                Promise.resolve({
                  data: {
                    code: 'SELFIE',
                    recovery_user_id: 'rec-1',
                    expires_at: new Date(Date.now() + 60_000).toISOString(),
                    used_at: null,
                  },
                  error: null,
                }),
            }),
          }),
        }
      }
      throw new Error(`unexpected table: ${table}`)
    })

    const res = await request(app)
      .post('/api/invites/accept')
      .set('Authorization', 'Bearer valid')
      .send({ code: 'SELFIE' })

    expect(res.status).toBe(400)
    expect(res.body).toEqual({ error: 'self_invite' })
  })

  it('creates a relationship + conversation and marks the code used', async () => {
    authedAs('sup-1')

    const relationshipInsert = vi.fn().mockReturnValue({
      select: () => ({
        single: () =>
          Promise.resolve({ data: { id: 'rel-1' }, error: null }),
      }),
    })
    const conversationInsert = vi.fn().mockReturnValue({
      select: () => ({
        single: () =>
          Promise.resolve({ data: { id: 'conv-1' }, error: null }),
      }),
    })
    const inviteUpdate = vi.fn().mockReturnValue({
      eq: () => Promise.resolve({ error: null }),
    })

    fromMock.mockImplementation((table: string) => {
      if (table === 'invite_codes') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () =>
                Promise.resolve({
                  data: {
                    code: 'GOOD12',
                    recovery_user_id: 'rec-1',
                    expires_at: new Date(Date.now() + 60_000).toISOString(),
                    used_at: null,
                  },
                  error: null,
                }),
            }),
          }),
          update: inviteUpdate,
        }
      }
      if (table === 'relationships') {
        return { insert: relationshipInsert }
      }
      if (table === 'conversations') {
        return { insert: conversationInsert }
      }
      throw new Error(`unexpected table: ${table}`)
    })

    const res = await request(app)
      .post('/api/invites/accept')
      .set('Authorization', 'Bearer valid')
      .send({ code: 'GOOD12' })

    expect(res.status).toBe(200)
    expect(res.body).toEqual({
      relationship_id: 'rel-1',
      conversation_id: 'conv-1',
    })

    const relRow = relationshipInsert.mock.calls[0][0] as {
      recovery_user_id: string
      supporter_id: string
      status: string
    }
    expect(relRow).toMatchObject({
      recovery_user_id: 'rec-1',
      supporter_id: 'sup-1',
      status: 'active',
    })

    const convRow = conversationInsert.mock.calls[0][0] as {
      type: string
      participant_ids: string[]
    }
    expect(convRow.type).toBe('direct')
    expect(convRow.participant_ids).toEqual(
      expect.arrayContaining(['rec-1', 'sup-1']),
    )
    expect(convRow.participant_ids).toHaveLength(2)

    expect(inviteUpdate).toHaveBeenCalledTimes(1)
    const updateArg = inviteUpdate.mock.calls[0][0] as { used_at: string }
    expect(updateArg.used_at).toBeTruthy()
  })
})
