import { describe, it, expect, vi, beforeEach } from 'vitest'
import express from 'express'
import request from 'supertest'

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: vi.fn(),
    },
  },
}))

import { supabase } from '../lib/supabase'
import { requireAuth, _clearTokenCache } from './auth'

function buildApp() {
  const app = express()
  app.get('/protected', requireAuth, (req, res) => {
    res.json({ user: req.user })
  })
  return app
}

function mockValidUser(id = 'user-123', email: string | null = 'test@example.com') {
  vi.mocked(supabase.auth.getUser).mockResolvedValueOnce({
    data: { user: { id, email } as never },
    error: null,
  } as never)
}

function mockInvalidToken() {
  vi.mocked(supabase.auth.getUser).mockResolvedValueOnce({
    data: { user: null },
    error: { message: 'bad token', name: 'AuthError', status: 401 } as never,
  } as never)
}

describe('requireAuth middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    _clearTokenCache()
  })

  describe('missing / malformed Authorization header', () => {
    it('returns 401 when header is absent', async () => {
      const res = await request(buildApp()).get('/protected')
      expect(res.status).toBe(401)
      expect(res.body).toEqual({ error: 'missing_token' })
    })

    it('returns 401 when header is empty string', async () => {
      const res = await request(buildApp())
        .get('/protected')
        .set('Authorization', '')
      expect(res.status).toBe(401)
      expect(res.body).toEqual({ error: 'missing_token' })
    })

    it('returns 401 when scheme is not Bearer', async () => {
      const res = await request(buildApp())
        .get('/protected')
        .set('Authorization', 'Basic abc123')
      expect(res.status).toBe(401)
      expect(res.body).toEqual({ error: 'missing_token' })
    })

    it('returns 401 when scheme is lowercase "bearer"', async () => {
      const res = await request(buildApp())
        .get('/protected')
        .set('Authorization', 'bearer abc123')
      expect(res.status).toBe(401)
      expect(res.body).toEqual({ error: 'missing_token' })
    })

    it('returns 401 when only "Bearer" prefix is sent (no token)', async () => {
      const res = await request(buildApp())
        .get('/protected')
        .set('Authorization', 'Bearer')
      expect(res.status).toBe(401)
      expect(res.body).toEqual({ error: 'missing_token' })
    })

    it('returns 401 when token portion is only whitespace', async () => {
      const res = await request(buildApp())
        .get('/protected')
        .set('Authorization', 'Bearer    ')
      expect(res.status).toBe(401)
      expect(res.body).toEqual({ error: 'missing_token' })
    })

    it('returns 401 when header is "Bearer " with nothing after', async () => {
      const res = await request(buildApp())
        .get('/protected')
        .set('Authorization', 'Bearer ')
      expect(res.status).toBe(401)
      expect(res.body).toEqual({ error: 'missing_token' })
    })

    it('does NOT call supabase.auth.getUser for a missing token', async () => {
      await request(buildApp()).get('/protected')
      expect(vi.mocked(supabase.auth.getUser)).not.toHaveBeenCalled()
    })
  })

  describe('invalid token', () => {
    it('returns 401 when supabase reports an error', async () => {
      mockInvalidToken()
      const res = await request(buildApp())
        .get('/protected')
        .set('Authorization', 'Bearer not-a-real-token')
      expect(res.status).toBe(401)
      expect(res.body).toEqual({ error: 'invalid_token' })
    })

    it('returns 401 when supabase returns no user even without error', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValueOnce({
        data: { user: null },
        error: null,
      } as never)
      const res = await request(buildApp())
        .get('/protected')
        .set('Authorization', 'Bearer stale')
      expect(res.status).toBe(401)
      expect(res.body).toEqual({ error: 'invalid_token' })
    })

    it('returns 401 when supabase returns empty data object', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValueOnce({
        data: {},
        error: null,
      } as never)
      const res = await request(buildApp())
        .get('/protected')
        .set('Authorization', 'Bearer weird')
      expect(res.status).toBe(401)
      expect(res.body).toEqual({ error: 'invalid_token' })
    })
  })

  describe('valid token happy paths', () => {
    it('attaches req.user and 200s on a valid token', async () => {
      mockValidUser('user-123', 'test@example.com')
      const res = await request(buildApp())
        .get('/protected')
        .set('Authorization', 'Bearer valid-token')
      expect(res.status).toBe(200)
      expect(res.body.user).toMatchObject({
        id: 'user-123',
        email: 'test@example.com',
      })
    })

    it('passes the bare token (no "Bearer ") to supabase.auth.getUser', async () => {
      mockValidUser()
      await request(buildApp())
        .get('/protected')
        .set('Authorization', 'Bearer valid-token')
      expect(vi.mocked(supabase.auth.getUser)).toHaveBeenCalledWith('valid-token')
    })

    it('trims trailing whitespace before passing token to supabase', async () => {
      mockValidUser()
      await request(buildApp())
        .get('/protected')
        .set('Authorization', 'Bearer   padded-token   ')
      expect(vi.mocked(supabase.auth.getUser)).toHaveBeenCalledWith('padded-token')
    })

    it('sets req.user.email to null when supabase user has no email', async () => {
      mockValidUser('user-456', null)
      const res = await request(buildApp())
        .get('/protected')
        .set('Authorization', 'Bearer t')
      expect(res.status).toBe(200)
      expect(res.body.user).toEqual({ id: 'user-456', email: null })
    })

    it('sets req.user.email to null when supabase user has undefined email', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValueOnce({
        data: { user: { id: 'u' } as never },
        error: null,
      } as never)
      const res = await request(buildApp())
        .get('/protected')
        .set('Authorization', 'Bearer t')
      expect(res.status).toBe(200)
      expect(res.body.user).toEqual({ id: 'u', email: null })
    })

    it('only calls supabase.auth.getUser once per request', async () => {
      mockValidUser()
      await request(buildApp())
        .get('/protected')
        .set('Authorization', 'Bearer valid')
      expect(vi.mocked(supabase.auth.getUser)).toHaveBeenCalledTimes(1)
    })

    it('preserves the full user id even if it contains dashes', async () => {
      mockValidUser('abcd-1234-efgh-5678', 'x@y.z')
      const res = await request(buildApp())
        .get('/protected')
        .set('Authorization', 'Bearer t')
      expect(res.body.user.id).toBe('abcd-1234-efgh-5678')
    })
  })
})
