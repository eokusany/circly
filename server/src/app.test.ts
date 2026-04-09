import { describe, it, expect, vi } from 'vitest'
import request from 'supertest'

// app imports routes which import supabase; stub it so nothing touches the net.
vi.mock('./lib/supabase', () => ({
  supabase: {
    auth: { getUser: vi.fn() },
    from: vi.fn(),
  },
}))

import { app } from './app'

describe('GET /health', () => {
  it('returns 200 with status ok', async () => {
    const res = await request(app).get('/health')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ status: 'ok' })
  })

  it('responds with JSON content type', async () => {
    const res = await request(app).get('/health')
    expect(res.headers['content-type']).toMatch(/application\/json/)
  })

  it('does not require authorization', async () => {
    const res = await request(app).get('/health')
    // No Authorization header sent; should still succeed.
    expect(res.status).toBe(200)
  })
})

describe('app routing', () => {
  it('returns 404 for unknown routes', async () => {
    const res = await request(app).get('/does-not-exist')
    expect(res.status).toBe(404)
  })

  it('returns 404 for unknown /api routes', async () => {
    const res = await request(app).get('/api/does-not-exist')
    expect(res.status).toBe(404)
  })

  it('rejects GET on /api/emergency (only POST is defined)', async () => {
    const res = await request(app).get('/api/emergency')
    expect(res.status).toBe(404)
  })

  it('rejects POST on /health (only GET is defined)', async () => {
    const res = await request(app).post('/health')
    expect(res.status).toBe(404)
  })
})

describe('CORS middleware', () => {
  it('sets access-control-allow-origin on responses', async () => {
    const res = await request(app)
      .get('/health')
      .set('Origin', 'http://localhost:8081')
    expect(res.headers['access-control-allow-origin']).toBeDefined()
  })

  it('answers preflight OPTIONS for /api/emergency', async () => {
    const res = await request(app)
      .options('/api/emergency')
      .set('Origin', 'http://localhost:8081')
      .set('Access-Control-Request-Method', 'POST')
    expect([200, 204]).toContain(res.status)
    expect(res.headers['access-control-allow-methods']).toBeDefined()
  })
})

describe('JSON body parsing', () => {
  it('parses JSON bodies for POST endpoints', async () => {
    // hit a route that requires auth — we expect 401 but that proves the body
    // parser ran without choking on the payload.
    const res = await request(app)
      .post('/api/encouragements')
      .send({ relationship_id: 'r', message: 'hi' })
    expect(res.status).toBe(401)
  })

  it('accepts empty JSON body without crashing', async () => {
    const res = await request(app)
      .post('/api/encouragements')
      .set('Content-Type', 'application/json')
      .send('{}')
    expect([400, 401]).toContain(res.status)
  })
})
