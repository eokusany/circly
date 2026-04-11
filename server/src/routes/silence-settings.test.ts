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
function authedAs(email = 'rec@example.com') {
  const userId = `rec-${uidCounter++}-${Date.now()}`
  getUserMock.mockResolvedValueOnce({
    data: { user: { id: userId, email } },
    error: null,
  })
  return userId
}

// GET chain: .select().eq().maybeSingle()
function getChain(data: unknown, error: unknown = null) {
  return {
    select: () => ({
      eq: () => ({
        maybeSingle: () => Promise.resolve({ data, error }),
      }),
    }),
  }
}

// PATCH chain: .upsert()
function upsertChain(error: unknown = null) {
  return { upsert: vi.fn().mockResolvedValue({ error }) }
}

// -----------------------------------------------------------------------------
// GET /api/silence-settings
// -----------------------------------------------------------------------------

describe('GET /api/silence-settings', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns 401 without a token', async () => {
    const res = await request(app).get('/api/silence-settings')
    expect(res.status).toBe(401)
  })

  it('returns saved settings when they exist', async () => {
    authedAs()
    const saved = {
      okay_tap_enabled: false,
      okay_tap_time: '10:00',
      silence_threshold_days: 3,
      snooze_until: '2026-04-15',
    }
    fromMock.mockImplementation((table: string) => {
      if (table === 'silence_settings') return getChain(saved)
      throw new Error(`unexpected table: ${table}`)
    })
    const res = await request(app)
      .get('/api/silence-settings')
      .set('Authorization', 'Bearer v')
    expect(res.status).toBe(200)
    expect(res.body).toEqual(saved)
  })

  it('returns defaults when no row exists', async () => {
    authedAs()
    fromMock.mockImplementation((table: string) => {
      if (table === 'silence_settings') return getChain(null)
      throw new Error(`unexpected table: ${table}`)
    })
    const res = await request(app)
      .get('/api/silence-settings')
      .set('Authorization', 'Bearer v')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({
      okay_tap_enabled: true,
      okay_tap_time: '09:00',
      silence_threshold_days: 2,
      snooze_until: null,
    })
  })

  it('returns 500 on lookup error', async () => {
    authedAs()
    fromMock.mockImplementation((table: string) => {
      if (table === 'silence_settings') return getChain(null, { message: 'boom' })
      throw new Error(`unexpected table: ${table}`)
    })
    const res = await request(app)
      .get('/api/silence-settings')
      .set('Authorization', 'Bearer v')
    expect(res.status).toBe(500)
    expect(res.body).toEqual({ error: 'lookup_failed' })
  })
})

// -----------------------------------------------------------------------------
// PATCH /api/silence-settings
// -----------------------------------------------------------------------------

describe('PATCH /api/silence-settings', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns 401 without a token', async () => {
    const res = await request(app)
      .patch('/api/silence-settings')
      .send({ silence_threshold_days: 3 })
    expect(res.status).toBe(401)
  })

  it('upserts valid fields and returns ok', async () => {
    authedAs()
    const chain = upsertChain()
    fromMock.mockImplementation((table: string) => {
      if (table === 'silence_settings') return chain
      throw new Error(`unexpected table: ${table}`)
    })
    const res = await request(app)
      .patch('/api/silence-settings')
      .set('Authorization', 'Bearer v')
      .send({ silence_threshold_days: 5, okay_tap_time: '08:30' })
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ ok: true })
    expect(chain.upsert).toHaveBeenCalledTimes(1)
    const upserted = chain.upsert.mock.calls[0][0] as Record<string, unknown>
    expect(upserted.silence_threshold_days).toBe(5)
    expect(upserted.okay_tap_time).toBe('08:30')
  })

  it('returns 400 when no updates are provided', async () => {
    authedAs()
    const res = await request(app)
      .patch('/api/silence-settings')
      .set('Authorization', 'Bearer v')
      .send({})
    expect(res.status).toBe(400)
    expect(res.body).toEqual({ error: 'no_updates' })
  })

  it('rejects threshold out of range (0)', async () => {
    authedAs()
    const res = await request(app)
      .patch('/api/silence-settings')
      .set('Authorization', 'Bearer v')
      .send({ silence_threshold_days: 0 })
    expect(res.status).toBe(400)
    expect(res.body).toEqual({ error: 'invalid_silence_threshold_days' })
  })

  it('rejects threshold out of range (8)', async () => {
    authedAs()
    const res = await request(app)
      .patch('/api/silence-settings')
      .set('Authorization', 'Bearer v')
      .send({ silence_threshold_days: 8 })
    expect(res.status).toBe(400)
    expect(res.body).toEqual({ error: 'invalid_silence_threshold_days' })
  })

  it('rejects non-numeric threshold', async () => {
    authedAs()
    const res = await request(app)
      .patch('/api/silence-settings')
      .set('Authorization', 'Bearer v')
      .send({ silence_threshold_days: 'three' })
    expect(res.status).toBe(400)
    expect(res.body).toEqual({ error: 'invalid_silence_threshold_days' })
  })

  it('rejects invalid time format', async () => {
    authedAs()
    const res = await request(app)
      .patch('/api/silence-settings')
      .set('Authorization', 'Bearer v')
      .send({ okay_tap_time: '9am' })
    expect(res.status).toBe(400)
    expect(res.body).toEqual({ error: 'invalid_okay_tap_time' })
  })

  it('allows setting snooze_until to null (cancel snooze)', async () => {
    authedAs()
    const chain = upsertChain()
    fromMock.mockImplementation((table: string) => {
      if (table === 'silence_settings') return chain
      throw new Error(`unexpected table: ${table}`)
    })
    const res = await request(app)
      .patch('/api/silence-settings')
      .set('Authorization', 'Bearer v')
      .send({ snooze_until: null })
    expect(res.status).toBe(200)
    const upserted = chain.upsert.mock.calls[0][0] as Record<string, unknown>
    expect(upserted.snooze_until).toBeNull()
  })

  it('allows okay_tap_enabled toggle', async () => {
    authedAs()
    const chain = upsertChain()
    fromMock.mockImplementation((table: string) => {
      if (table === 'silence_settings') return chain
      throw new Error(`unexpected table: ${table}`)
    })
    const res = await request(app)
      .patch('/api/silence-settings')
      .set('Authorization', 'Bearer v')
      .send({ okay_tap_enabled: false })
    expect(res.status).toBe(200)
    const upserted = chain.upsert.mock.calls[0][0] as Record<string, unknown>
    expect(upserted.okay_tap_enabled).toBe(false)
  })

  it('returns 500 on upsert failure', async () => {
    authedAs()
    fromMock.mockImplementation((table: string) => {
      if (table === 'silence_settings') return upsertChain({ message: 'boom' })
      throw new Error(`unexpected table: ${table}`)
    })
    const res = await request(app)
      .patch('/api/silence-settings')
      .set('Authorization', 'Bearer v')
      .send({ silence_threshold_days: 3 })
    expect(res.status).toBe(500)
    expect(res.body).toEqual({ error: 'upsert_failed' })
  })
})
