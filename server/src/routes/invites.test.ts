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

// Unique user id per test — inviteGenerateLimiter = 20/day, inviteAcceptLimiter
// = 10/min. The in-memory store persists across tests in a single run, so
// reusing an id would make later tests 429. Each test claims a fresh id.
let uid = 0
function authedAs(prefix = 'u'): string {
  const id = `${prefix}-${uid++}-${Date.now()}`
  getUserMock.mockResolvedValueOnce({
    data: { user: { id, email: `${id}@example.com` } },
    error: null,
  })
  return id
}

function userRoleLookup(
  role: 'recovery' | 'supporter' | 'sponsor' | null,
  error: unknown = null,
) {
  return {
    select: () => ({
      eq: () => ({
        single: () =>
          Promise.resolve({
            data: role !== null ? { role } : null,
            error,
          }),
      }),
    }),
  }
}

// Builds a chainable stub for the atomic-claim update. The claim call shape:
//   from('invite_codes').update(...).eq(...).is(...).gt(...).select(...).maybeSingle()
function claimStub(claimed: unknown, error: unknown = null) {
  const chain: Record<string, unknown> = {
    update: () => chain,
    eq: () => chain,
    is: () => chain,
    gt: () => chain,
    select: () => chain,
    maybeSingle: () => Promise.resolve({ data: claimed, error }),
  }
  return chain
}

function singleInsert(
  result: { data: unknown; error: unknown } = { data: null, error: null },
) {
  const fn = vi.fn().mockReturnValue({
    select: () => ({ single: () => Promise.resolve(result) }),
  })
  return fn
}

// -----------------------------------------------------------------------------
// POST /api/invites
// -----------------------------------------------------------------------------

describe('POST /api/invites', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('authentication', () => {
    it('returns 401 without a token', async () => {
      const res = await request(app).post('/api/invites')
      expect(res.status).toBe(401)
    })

    it('returns 401 when supabase rejects the token', async () => {
      getUserMock.mockResolvedValueOnce({
        data: { user: null },
        error: { message: 'bad' },
      })
      const res = await request(app)
        .post('/api/invites')
        .set('Authorization', 'Bearer bad')
      expect(res.status).toBe(401)
    })
  })

  describe('role enforcement', () => {
    it('returns 403 when the caller is a supporter', async () => {
      authedAs('sup')
      fromMock.mockImplementation((table: string) => {
        if (table === 'users') return userRoleLookup('supporter')
        throw new Error(`unexpected table: ${table}`)
      })
      const res = await request(app)
        .post('/api/invites')
        .set('Authorization', 'Bearer v')
      expect(res.status).toBe(403)
      expect(res.body).toEqual({ error: 'only_recovery_users_can_invite' })
    })

    it('returns 403 when the caller is a sponsor', async () => {
      authedAs('spn')
      fromMock.mockImplementation((table: string) => {
        if (table === 'users') return userRoleLookup('sponsor')
        throw new Error(`unexpected table: ${table}`)
      })
      const res = await request(app)
        .post('/api/invites')
        .set('Authorization', 'Bearer v')
      expect(res.status).toBe(403)
      expect(res.body).toEqual({ error: 'only_recovery_users_can_invite' })
    })

    it('returns 500 when the user-role lookup errors', async () => {
      authedAs('rec')
      fromMock.mockImplementation((table: string) => {
        if (table === 'users')
          return userRoleLookup(null, { message: 'boom' })
        throw new Error(`unexpected table: ${table}`)
      })
      const res = await request(app)
        .post('/api/invites')
        .set('Authorization', 'Bearer v')
      expect(res.status).toBe(500)
      expect(res.body).toEqual({ error: 'user_lookup_failed' })
    })

    it('returns 500 when the user row is missing', async () => {
      authedAs('rec')
      fromMock.mockImplementation((table: string) => {
        if (table === 'users') return userRoleLookup(null)
        throw new Error(`unexpected table: ${table}`)
      })
      const res = await request(app)
        .post('/api/invites')
        .set('Authorization', 'Bearer v')
      expect(res.status).toBe(500)
      expect(res.body).toEqual({ error: 'user_lookup_failed' })
    })

    it('does NOT call invite_codes when the caller is not recovery', async () => {
      authedAs('sup')
      fromMock.mockImplementation((table: string) => {
        if (table === 'users') return userRoleLookup('supporter')
        throw new Error(`unexpected table: ${table}`)
      })
      await request(app)
        .post('/api/invites')
        .set('Authorization', 'Bearer v')
      const tables = fromMock.mock.calls.map((c) => c[0])
      expect(tables).not.toContain('invite_codes')
    })
  })

  describe('code generation', () => {
    function wireGenerate(): { insertMock: ReturnType<typeof vi.fn> } {
      const insertMock = vi.fn().mockResolvedValue({ error: null })
      fromMock.mockImplementation((table: string) => {
        if (table === 'users') return userRoleLookup('recovery')
        if (table === 'invite_codes') return { insert: insertMock }
        throw new Error(`unexpected table: ${table}`)
      })
      return { insertMock }
    }

    it('returns a 6-character code from the uppercase alphanumeric alphabet', async () => {
      authedAs('rec')
      wireGenerate()
      const res = await request(app)
        .post('/api/invites')
        .set('Authorization', 'Bearer v')
      expect(res.status).toBe(200)
      expect(res.body.code).toMatch(/^[A-Z0-9]{6}$/)
    })

    it('returns an ISO expires_at ~24h in the future', async () => {
      authedAs('rec')
      wireGenerate()
      const before = Date.now()
      const res = await request(app)
        .post('/api/invites')
        .set('Authorization', 'Bearer v')
      const after = Date.now()
      const expiresAt = new Date(res.body.expires_at).getTime()
      expect(expiresAt).toBeGreaterThanOrEqual(before + 24 * 60 * 60 * 1000 - 1000)
      expect(expiresAt).toBeLessThanOrEqual(after + 24 * 60 * 60 * 1000 + 1000)
    })

    it('persists the same code that it returns', async () => {
      const recId = authedAs('rec')
      const { insertMock } = wireGenerate()
      const res = await request(app)
        .post('/api/invites')
        .set('Authorization', 'Bearer v')
      const row = insertMock.mock.calls[0][0] as {
        code: string
        recovery_user_id: string
        expires_at: string
      }
      expect(row.code).toBe(res.body.code)
      expect(row.recovery_user_id).toBe(recId)
      expect(row.expires_at).toBe(res.body.expires_at)
    })

    it('generates statistically distinct codes across many calls', async () => {
      const seen = new Set<string>()
      for (let i = 0; i < 15; i++) {
        authedAs('rec')
        const insertMock = vi.fn().mockResolvedValue({ error: null })
        fromMock.mockImplementation((table: string) => {
          if (table === 'users') return userRoleLookup('recovery')
          if (table === 'invite_codes') return { insert: insertMock }
          throw new Error(`unexpected table: ${table}`)
        })
        // eslint-disable-next-line no-await-in-loop
        const res = await request(app)
          .post('/api/invites')
          .set('Authorization', 'Bearer v')
        seen.add(res.body.code)
      }
      // A 6-char 36-alphabet space has 2.2B options — collisions across 15
      // draws would be a strong signal of a broken PRNG.
      expect(seen.size).toBe(15)
    })

    it('every generated code character is in the declared alphabet', async () => {
      const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
      for (let i = 0; i < 20; i++) {
        authedAs('rec')
        wireGenerate()
        // eslint-disable-next-line no-await-in-loop
        const res = await request(app)
          .post('/api/invites')
          .set('Authorization', 'Bearer v')
        const code: string = res.body.code
        for (const ch of code) {
          expect(alphabet).toContain(ch)
        }
      }
    })

    it('returns 500 when the invite_codes insert fails', async () => {
      authedAs('rec')
      fromMock.mockImplementation((table: string) => {
        if (table === 'users') return userRoleLookup('recovery')
        if (table === 'invite_codes')
          return {
            insert: vi.fn().mockResolvedValue({ error: { message: 'boom' } }),
          }
        throw new Error(`unexpected table: ${table}`)
      })
      const res = await request(app)
        .post('/api/invites')
        .set('Authorization', 'Bearer v')
      expect(res.status).toBe(500)
      expect(res.body).toEqual({ error: 'invite_insert_failed' })
    })
  })
})

// -----------------------------------------------------------------------------
// POST /api/invites/accept
// -----------------------------------------------------------------------------

describe('POST /api/invites/accept', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('authentication', () => {
    it('returns 401 without a token', async () => {
      const res = await request(app)
        .post('/api/invites/accept')
        .send({ code: 'ABC123' })
      expect(res.status).toBe(401)
    })

    it('returns 401 when supabase rejects the token', async () => {
      getUserMock.mockResolvedValueOnce({
        data: { user: null },
        error: { message: 'bad' },
      })
      const res = await request(app)
        .post('/api/invites/accept')
        .set('Authorization', 'Bearer bad')
        .send({ code: 'ABC123' })
      expect(res.status).toBe(401)
    })
  })

  describe('input validation', () => {
    it('returns 400 when body is empty', async () => {
      authedAs()
      const res = await request(app)
        .post('/api/invites/accept')
        .set('Authorization', 'Bearer v')
        .send({})
      expect(res.status).toBe(400)
      expect(res.body).toEqual({ error: 'missing_code' })
    })

    it('returns 400 when code is a number', async () => {
      authedAs()
      const res = await request(app)
        .post('/api/invites/accept')
        .set('Authorization', 'Bearer v')
        .send({ code: 12345 })
      expect(res.status).toBe(400)
      expect(res.body).toEqual({ error: 'missing_code' })
    })

    it('returns 400 when code is null', async () => {
      authedAs()
      const res = await request(app)
        .post('/api/invites/accept')
        .set('Authorization', 'Bearer v')
        .send({ code: null })
      expect(res.status).toBe(400)
      expect(res.body).toEqual({ error: 'missing_code' })
    })

    it('returns 400 when code is an empty string', async () => {
      authedAs()
      const res = await request(app)
        .post('/api/invites/accept')
        .set('Authorization', 'Bearer v')
        .send({ code: '' })
      expect(res.status).toBe(400)
      expect(res.body).toEqual({ error: 'missing_code' })
    })

    it('returns 400 when code is whitespace only', async () => {
      authedAs()
      const res = await request(app)
        .post('/api/invites/accept')
        .set('Authorization', 'Bearer v')
        .send({ code: '     ' })
      expect(res.status).toBe(400)
      expect(res.body).toEqual({ error: 'missing_code' })
    })

    it('normalizes the code to uppercase before claim', async () => {
      authedAs('sup')
      const chain = claimStub(null)
      const eqSpy = vi.fn().mockReturnValue(chain)
      ;(chain as Record<string, unknown>).update = () => ({
        eq: eqSpy,
      })
      // Rewire chain so eq is observable.
      fromMock.mockImplementation((table: string) => {
        if (table === 'invite_codes') {
          // Build a fresh observable chain where the first .eq receives the code.
          const ch: Record<string, unknown> = {
            update: () => ch,
            eq: (col: string, val: string) => {
              if (col === 'code') eqSpy(col, val)
              return ch
            },
            is: () => ch,
            gt: () => ch,
            select: () => ch,
            maybeSingle: () => Promise.resolve({ data: null, error: null }),
          }
          return ch
        }
        throw new Error(`unexpected table: ${table}`)
      })
      await request(app)
        .post('/api/invites/accept')
        .set('Authorization', 'Bearer v')
        .send({ code: 'abc123' })
      expect(eqSpy).toHaveBeenCalledWith('code', 'ABC123')
    })

    it('trims whitespace around the code before claim', async () => {
      authedAs('sup')
      const eqSpy = vi.fn()
      fromMock.mockImplementation((table: string) => {
        if (table === 'invite_codes') {
          const ch: Record<string, unknown> = {
            update: () => ch,
            eq: (col: string, val: string) => {
              if (col === 'code') eqSpy(col, val)
              return ch
            },
            is: () => ch,
            gt: () => ch,
            select: () => ch,
            maybeSingle: () => Promise.resolve({ data: null, error: null }),
          }
          return ch
        }
        throw new Error(`unexpected table: ${table}`)
      })
      await request(app)
        .post('/api/invites/accept')
        .set('Authorization', 'Bearer v')
        .send({ code: '  ABC123  ' })
      expect(eqSpy).toHaveBeenCalledWith('code', 'ABC123')
    })
  })

  describe('claim outcome', () => {
    it('returns 400 invalid_or_used_code when the atomic claim returns no row', async () => {
      authedAs('sup')
      fromMock.mockImplementation((table: string) => {
        if (table === 'invite_codes') return claimStub(null)
        throw new Error(`unexpected table: ${table}`)
      })
      const res = await request(app)
        .post('/api/invites/accept')
        .set('Authorization', 'Bearer v')
        .send({ code: 'NOPE99' })
      expect(res.status).toBe(400)
      expect(res.body).toEqual({ error: 'invalid_or_used_code' })
    })

    it('returns 500 when the claim query errors', async () => {
      authedAs('sup')
      fromMock.mockImplementation((table: string) => {
        if (table === 'invite_codes')
          return claimStub(null, { message: 'db fail' })
        throw new Error(`unexpected table: ${table}`)
      })
      const res = await request(app)
        .post('/api/invites/accept')
        .set('Authorization', 'Bearer v')
        .send({ code: 'ABC123' })
      expect(res.status).toBe(500)
      expect(res.body).toEqual({ error: 'claim_failed' })
    })

    it('collapses "invalid" and "used" into the same error to avoid code enumeration', async () => {
      // Both a totally-unknown code and a previously-used code should fail
      // atomically via the null-from-maybeSingle path, returning the same body.
      authedAs('sup')
      fromMock.mockImplementation((table: string) => {
        if (table === 'invite_codes') return claimStub(null)
        throw new Error(`unexpected table: ${table}`)
      })
      const res1 = await request(app)
        .post('/api/invites/accept')
        .set('Authorization', 'Bearer v')
        .send({ code: 'GHOST1' })

      authedAs('sup')
      fromMock.mockImplementation((table: string) => {
        if (table === 'invite_codes') return claimStub(null)
        throw new Error(`unexpected table: ${table}`)
      })
      const res2 = await request(app)
        .post('/api/invites/accept')
        .set('Authorization', 'Bearer v')
        .send({ code: 'USEDUP' })

      expect(res1.body).toEqual(res2.body)
      expect(res1.status).toBe(res2.status)
    })
  })

  describe('self-invite prevention', () => {
    it('rolls back the claim and returns 400 self_invite when the caller is the recovery user', async () => {
      const recId = authedAs('rec')
      const rollback = vi.fn().mockReturnValue({
        eq: () => Promise.resolve({ error: null }),
      })
      let call = 0
      fromMock.mockImplementation((table: string) => {
        if (table !== 'invite_codes') {
          throw new Error(`unexpected table: ${table}`)
        }
        call++
        if (call === 1) return claimStub({ recovery_user_id: recId })
        return { update: rollback }
      })
      const res = await request(app)
        .post('/api/invites/accept')
        .set('Authorization', 'Bearer v')
        .send({ code: 'SELFIE' })
      expect(res.status).toBe(400)
      expect(res.body).toEqual({ error: 'self_invite' })
      expect(rollback).toHaveBeenCalledWith({ used_at: null })
    })

    it('does NOT create a relationship when self-inviting', async () => {
      const recId = authedAs('rec')
      let call = 0
      const tables: string[] = []
      fromMock.mockImplementation((table: string) => {
        tables.push(table)
        if (table === 'invite_codes') {
          call++
          if (call === 1) return claimStub({ recovery_user_id: recId })
          return {
            update: () => ({
              eq: () => Promise.resolve({ error: null }),
            }),
          }
        }
        throw new Error(`unexpected table: ${table}`)
      })
      await request(app)
        .post('/api/invites/accept')
        .set('Authorization', 'Bearer v')
        .send({ code: 'SELFIE' })
      expect(tables).not.toContain('relationships')
      expect(tables).not.toContain('conversations')
    })
  })

  describe('successful acceptance', () => {
    function wireHappy(recoveryId: string) {
      const relationshipInsert = singleInsert({
        data: { id: 'rel-1' },
        error: null,
      })
      const conversationInsert = singleInsert({
        data: { id: 'conv-1' },
        error: null,
      })
      fromMock.mockImplementation((table: string) => {
        if (table === 'invite_codes')
          return claimStub({ recovery_user_id: recoveryId })
        if (table === 'relationships') return { insert: relationshipInsert }
        if (table === 'conversations') return { insert: conversationInsert }
        throw new Error(`unexpected table: ${table}`)
      })
      return { relationshipInsert, conversationInsert }
    }

    it('creates a relationship + conversation and returns both ids', async () => {
      const supId = authedAs('sup')
      const { relationshipInsert, conversationInsert } = wireHappy('rec-1')
      const res = await request(app)
        .post('/api/invites/accept')
        .set('Authorization', 'Bearer v')
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
      expect(relRow).toEqual({
        recovery_user_id: 'rec-1',
        supporter_id: supId,
        status: 'active',
      })

      const convRow = conversationInsert.mock.calls[0][0] as {
        type: string
        participant_ids: string[]
      }
      expect(convRow.type).toBe('direct')
      expect(convRow.participant_ids).toHaveLength(2)
      expect(convRow.participant_ids).toContain('rec-1')
      expect(convRow.participant_ids).toContain(supId)
    })

    it('always inserts relationship with status=active', async () => {
      authedAs('sup')
      const { relationshipInsert } = wireHappy('rec-1')
      await request(app)
        .post('/api/invites/accept')
        .set('Authorization', 'Bearer v')
        .send({ code: 'GOOD12' })
      const row = relationshipInsert.mock.calls[0][0] as { status: string }
      expect(row.status).toBe('active')
    })

    it('always inserts conversation with type=direct', async () => {
      authedAs('sup')
      const { conversationInsert } = wireHappy('rec-1')
      await request(app)
        .post('/api/invites/accept')
        .set('Authorization', 'Bearer v')
        .send({ code: 'GOOD12' })
      const row = conversationInsert.mock.calls[0][0] as { type: string }
      expect(row.type).toBe('direct')
    })

    it('returns 500 relationship_insert_failed when relationship insert errors', async () => {
      authedAs('sup')
      const relationshipInsert = singleInsert({
        data: null,
        error: { message: 'boom' },
      })
      fromMock.mockImplementation((table: string) => {
        if (table === 'invite_codes')
          return claimStub({ recovery_user_id: 'rec-1' })
        if (table === 'relationships') return { insert: relationshipInsert }
        throw new Error(`unexpected table: ${table}`)
      })
      const res = await request(app)
        .post('/api/invites/accept')
        .set('Authorization', 'Bearer v')
        .send({ code: 'GOOD12' })
      expect(res.status).toBe(500)
      expect(res.body).toEqual({ error: 'relationship_insert_failed' })
    })

    it('returns 500 relationship_insert_failed when relationship insert returns no data', async () => {
      authedAs('sup')
      const relationshipInsert = singleInsert({ data: null, error: null })
      fromMock.mockImplementation((table: string) => {
        if (table === 'invite_codes')
          return claimStub({ recovery_user_id: 'rec-1' })
        if (table === 'relationships') return { insert: relationshipInsert }
        throw new Error(`unexpected table: ${table}`)
      })
      const res = await request(app)
        .post('/api/invites/accept')
        .set('Authorization', 'Bearer v')
        .send({ code: 'GOOD12' })
      expect(res.status).toBe(500)
      expect(res.body).toEqual({ error: 'relationship_insert_failed' })
    })

    it('returns 500 conversation_insert_failed when conversation insert errors', async () => {
      authedAs('sup')
      const relationshipInsert = singleInsert({
        data: { id: 'rel-1' },
        error: null,
      })
      const conversationInsert = singleInsert({
        data: null,
        error: { message: 'boom' },
      })
      fromMock.mockImplementation((table: string) => {
        if (table === 'invite_codes')
          return claimStub({ recovery_user_id: 'rec-1' })
        if (table === 'relationships') return { insert: relationshipInsert }
        if (table === 'conversations') return { insert: conversationInsert }
        throw new Error(`unexpected table: ${table}`)
      })
      const res = await request(app)
        .post('/api/invites/accept')
        .set('Authorization', 'Bearer v')
        .send({ code: 'GOOD12' })
      expect(res.status).toBe(500)
      expect(res.body).toEqual({ error: 'conversation_insert_failed' })
    })

    it('participant_ids contains exactly the two distinct user ids', async () => {
      const supId = authedAs('sup')
      const { conversationInsert } = wireHappy('rec-xyz')
      await request(app)
        .post('/api/invites/accept')
        .set('Authorization', 'Bearer v')
        .send({ code: 'GOOD12' })
      const row = conversationInsert.mock.calls[0][0] as {
        participant_ids: string[]
      }
      expect(new Set(row.participant_ids).size).toBe(2)
      expect(row.participant_ids).toEqual(
        expect.arrayContaining(['rec-xyz', supId]),
      )
    })
  })
})
