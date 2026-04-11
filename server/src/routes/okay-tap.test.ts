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

// okay_taps insert chain: .insert().select().single()
function insertChain(data: unknown, error: unknown = null) {
  return {
    insert: vi.fn().mockReturnValue({
      select: () => ({
        single: () => Promise.resolve({ data, error }),
      }),
    }),
  }
}

// okay_taps today check: .select().eq().gte().limit()
function todayChain(data: unknown[], error: unknown = null) {
  return {
    select: () => ({
      eq: () => ({
        gte: () => ({
          limit: () => Promise.resolve({ data, error }),
        }),
      }),
    }),
  }
}

// -----------------------------------------------------------------------------
// POST /api/okay-tap
// -----------------------------------------------------------------------------

describe('POST /api/okay-tap', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 without a token', async () => {
    const res = await request(app).post('/api/okay-tap')
    expect(res.status).toBe(401)
  })

  it('inserts a tap and returns ok + tapped_at', async () => {
    authedAs()
    const now = new Date().toISOString()
    fromMock.mockImplementation((table: string) => {
      if (table === 'okay_taps')
        return insertChain({ tapped_at: now })
      throw new Error(`unexpected table: ${table}`)
    })
    const res = await request(app)
      .post('/api/okay-tap')
      .set('Authorization', 'Bearer v')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ ok: true, tapped_at: now })
  })

  it('returns 500 when insert fails', async () => {
    authedAs()
    fromMock.mockImplementation((table: string) => {
      if (table === 'okay_taps')
        return insertChain(null, { message: 'boom' })
      throw new Error(`unexpected table: ${table}`)
    })
    const res = await request(app)
      .post('/api/okay-tap')
      .set('Authorization', 'Bearer v')
    expect(res.status).toBe(500)
    expect(res.body).toEqual({ error: 'insert_failed' })
  })

  it('returns 500 when insert returns no data', async () => {
    authedAs()
    fromMock.mockImplementation((table: string) => {
      if (table === 'okay_taps') return insertChain(null)
      throw new Error(`unexpected table: ${table}`)
    })
    const res = await request(app)
      .post('/api/okay-tap')
      .set('Authorization', 'Bearer v')
    expect(res.status).toBe(500)
    expect(res.body).toEqual({ error: 'insert_failed' })
  })
})

// -----------------------------------------------------------------------------
// GET /api/okay-tap/today
// -----------------------------------------------------------------------------

describe('GET /api/okay-tap/today', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 without a token', async () => {
    const res = await request(app).get('/api/okay-tap/today')
    expect(res.status).toBe(401)
  })

  it('returns tapped: true when a tap exists today', async () => {
    authedAs()
    fromMock.mockImplementation((table: string) => {
      if (table === 'okay_taps')
        return todayChain([{ id: 'tap-1' }])
      throw new Error(`unexpected table: ${table}`)
    })
    const res = await request(app)
      .get('/api/okay-tap/today')
      .set('Authorization', 'Bearer v')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ tapped: true })
  })

  it('returns tapped: false when no tap exists today', async () => {
    authedAs()
    fromMock.mockImplementation((table: string) => {
      if (table === 'okay_taps') return todayChain([])
      throw new Error(`unexpected table: ${table}`)
    })
    const res = await request(app)
      .get('/api/okay-tap/today')
      .set('Authorization', 'Bearer v')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ tapped: false })
  })

  it('returns 500 when lookup fails', async () => {
    authedAs()
    fromMock.mockImplementation((table: string) => {
      if (table === 'okay_taps')
        return todayChain([], { message: 'boom' })
      throw new Error(`unexpected table: ${table}`)
    })
    const res = await request(app)
      .get('/api/okay-tap/today')
      .set('Authorization', 'Bearer v')
    expect(res.status).toBe(500)
    expect(res.body).toEqual({ error: 'lookup_failed' })
  })

  it('returns tapped: false when data is null', async () => {
    authedAs()
    fromMock.mockImplementation((table: string) => {
      if (table === 'okay_taps') {
        return {
          select: () => ({
            eq: () => ({
              gte: () => ({
                limit: () => Promise.resolve({ data: null, error: null }),
              }),
            }),
          }),
        }
      }
      throw new Error(`unexpected table: ${table}`)
    })
    const res = await request(app)
      .get('/api/okay-tap/today')
      .set('Authorization', 'Bearer v')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ tapped: false })
  })
})
