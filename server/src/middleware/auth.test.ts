import { describe, it, expect, vi, beforeEach } from 'vitest'
import express from 'express'
import request from 'supertest'

// Mock the supabase client before importing the middleware
vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: vi.fn(),
    },
  },
}))

import { supabase } from '../lib/supabase'
import { requireAuth } from './auth'

function buildApp() {
  const app = express()
  app.get('/protected', requireAuth, (req, res) => {
    res.json({ user: req.user })
  })
  return app
}

describe('requireAuth middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when Authorization header is missing', async () => {
    const res = await request(buildApp()).get('/protected')
    expect(res.status).toBe(401)
    expect(res.body).toEqual({ error: 'missing_token' })
  })

  it('returns 401 when token is invalid', async () => {
    vi.mocked(supabase.auth.getUser).mockResolvedValueOnce({
      data: { user: null },
      error: { message: 'bad token', name: 'AuthError', status: 401 } as never,
    } as never)

    const res = await request(buildApp())
      .get('/protected')
      .set('Authorization', 'Bearer not-a-real-token')

    expect(res.status).toBe(401)
    expect(res.body).toEqual({ error: 'invalid_token' })
  })

  it('passes and attaches req.user when token is valid', async () => {
    vi.mocked(supabase.auth.getUser).mockResolvedValueOnce({
      data: {
        user: {
          id: 'user-123',
          email: 'test@example.com',
        } as never,
      },
      error: null,
    } as never)

    const res = await request(buildApp())
      .get('/protected')
      .set('Authorization', 'Bearer valid-token')

    expect(res.status).toBe(200)
    expect(res.body.user).toMatchObject({
      id: 'user-123',
      email: 'test@example.com',
    })
    expect(vi.mocked(supabase.auth.getUser)).toHaveBeenCalledWith('valid-token')
  })
})
