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

function userRoleLookup(role: 'recovery' | 'supporter' | 'sponsor') {
  return {
    select: () => ({
      eq: () => ({
        single: () => Promise.resolve({ data: { role }, error: null }),
      }),
    }),
  }
}

// Builds a chainable stub for the atomic-claim update, where .maybeSingle()
// returns whatever `claimed` we hand it. The claim call shape is:
//   from('invite_codes').update(...).eq(...).is(...).gt(...).select(...).maybeSingle()
function claimStub(claimed: unknown) {
  const chain: Record<string, unknown> = {
    update: () => chain,
    eq: () => chain,
    is: () => chain,
    gt: () => chain,
    select: () => chain,
    maybeSingle: () => Promise.resolve({ data: claimed, error: null }),
  }
  return chain
}

describe('POST /api/invites', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 without a token', async () => {
    const res = await request(app).post('/api/invites')
    expect(res.status).toBe(401)
  })

  it('returns 403 when the caller is not a recovery user', async () => {
    authedAs('sup-1')
    fromMock.mockImplementation((table: string) => {
      if (table === 'users') return userRoleLookup('supporter')
      throw new Error(`unexpected table: ${table}`)
    })

    const res = await request(app)
      .post('/api/invites')
      .set('Authorization', 'Bearer valid')

    expect(res.status).toBe(403)
    expect(res.body).toEqual({ error: 'only_recovery_users_can_invite' })
  })

  it('generates a 6-char uppercase code with a 24h expiry', async () => {
    authedAs('rec-1')

    const insertMock = vi.fn().mockResolvedValue({ error: null })
    fromMock.mockImplementation((table: string) => {
      if (table === 'users') return userRoleLookup('recovery')
      if (table === 'invite_codes') return { insert: insertMock }
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

  it('returns 400 for a missing or non-string code', async () => {
    authedAs('sup-1')
    const res = await request(app)
      .post('/api/invites/accept')
      .set('Authorization', 'Bearer valid')
      .send({})
    expect(res.status).toBe(400)
    expect(res.body).toEqual({ error: 'missing_code' })
  })

  it('returns 400 when the code cannot be atomically claimed', async () => {
    authedAs('sup-1')

    fromMock.mockImplementation((table: string) => {
      if (table === 'invite_codes') return claimStub(null)
      throw new Error(`unexpected table: ${table}`)
    })

    const res = await request(app)
      .post('/api/invites/accept')
      .set('Authorization', 'Bearer valid')
      .send({ code: 'NOPE99' })

    expect(res.status).toBe(400)
    expect(res.body).toEqual({ error: 'invalid_or_used_code' })
  })

  it('rolls back the claim and returns 400 on self-invite', async () => {
    authedAs('rec-1')

    const rollback = vi.fn().mockReturnValue({
      eq: () => Promise.resolve({ error: null }),
    })

    // First call = claim (maybeSingle returns our own id).
    // Second call = rollback (update().eq()).
    let call = 0
    fromMock.mockImplementation((table: string) => {
      if (table !== 'invite_codes') {
        throw new Error(`unexpected table: ${table}`)
      }
      call++
      if (call === 1) {
        return claimStub({ recovery_user_id: 'rec-1' })
      }
      return { update: rollback }
    })

    const res = await request(app)
      .post('/api/invites/accept')
      .set('Authorization', 'Bearer valid')
      .send({ code: 'SELFIE' })

    expect(res.status).toBe(400)
    expect(res.body).toEqual({ error: 'self_invite' })
    expect(rollback).toHaveBeenCalledWith({ used_at: null })
  })

  it('creates a relationship + conversation on a successful claim', async () => {
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

    fromMock.mockImplementation((table: string) => {
      if (table === 'invite_codes') {
        return claimStub({ recovery_user_id: 'rec-1' })
      }
      if (table === 'relationships') return { insert: relationshipInsert }
      if (table === 'conversations') return { insert: conversationInsert }
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
  })
})
