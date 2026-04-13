import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: vi.fn(),
    },
    from: vi.fn(),
  },
}))

import { supabase } from '../lib/supabase'
import { _clearTokenCache } from '../middleware/auth'
import { app } from '../app'

function mockUser(user: { id: string; email: string | null } | null) {
  vi.mocked(supabase.auth.getUser).mockResolvedValueOnce({
    data: user ? { user: user as never } : { user: null },
    error: user ? null : ({ message: 'bad' } as never),
  } as never)
}

describe('GET /api/me', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    _clearTokenCache()
  })

  it('returns 401 without any Authorization header', async () => {
    const res = await request(app).get('/api/me')
    expect(res.status).toBe(401)
    expect(res.body).toEqual({ error: 'missing_token' })
  })

  it('returns 401 for a Bearer header with no token', async () => {
    const res = await request(app).get('/api/me').set('Authorization', 'Bearer')
    expect(res.status).toBe(401)
  })

  it('returns 401 for a non-Bearer scheme', async () => {
    const res = await request(app).get('/api/me').set('Authorization', 'Token xyz')
    expect(res.status).toBe(401)
  })

  it('returns 401 when supabase rejects the token', async () => {
    mockUser(null)
    const res = await request(app)
      .get('/api/me')
      .set('Authorization', 'Bearer bad')
    expect(res.status).toBe(401)
    expect(res.body).toEqual({ error: 'invalid_token' })
  })

  it('returns id and email for a valid token', async () => {
    mockUser({ id: 'abc-123', email: 'me@example.com' })
    const res = await request(app)
      .get('/api/me')
      .set('Authorization', 'Bearer valid')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ id: 'abc-123', email: 'me@example.com' })
  })

  it('returns email: null when the supabase user lacks an email', async () => {
    mockUser({ id: 'u-1', email: null })
    const res = await request(app)
      .get('/api/me')
      .set('Authorization', 'Bearer valid')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ id: 'u-1', email: null })
  })

  it('does not leak any other fields from the supabase user', async () => {
    vi.mocked(supabase.auth.getUser).mockResolvedValueOnce({
      data: {
        user: {
          id: 'u-2',
          email: 'secret@example.com',
          app_metadata: { role: 'admin' },
          user_metadata: { secret: 'x' },
        } as never,
      },
      error: null,
    } as never)
    const res = await request(app)
      .get('/api/me')
      .set('Authorization', 'Bearer valid')
    expect(res.body).toEqual({ id: 'u-2', email: 'secret@example.com' })
    expect(res.body).not.toHaveProperty('app_metadata')
    expect(res.body).not.toHaveProperty('user_metadata')
  })

  it('rejects POST /api/me (only GET is defined)', async () => {
    const res = await request(app).post('/api/me')
    expect(res.status).toBe(404)
  })
})
