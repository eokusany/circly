import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: vi.fn(),
    },
  },
}))

import { supabase } from '../lib/supabase'
import { app } from '../app'

describe('GET /api/me', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 without a token', async () => {
    const res = await request(app).get('/api/me')
    expect(res.status).toBe(401)
  })

  it('returns the authenticated user id and email', async () => {
    vi.mocked(supabase.auth.getUser).mockResolvedValueOnce({
      data: {
        user: {
          id: 'abc-123',
          email: 'me@example.com',
        } as never,
      },
      error: null,
    } as never)

    const res = await request(app)
      .get('/api/me')
      .set('Authorization', 'Bearer valid')

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ id: 'abc-123', email: 'me@example.com' })
  })
})
