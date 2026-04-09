import { describe, it, expect } from 'vitest'
import express, { type Request, type Response, type NextFunction } from 'express'
import request from 'supertest'
import {
  emergencyLimiter,
  encouragementLimiter,
  inviteGenerateLimiter,
  inviteAcceptLimiter,
} from './rateLimit'

// Rate limiters are keyed on req.user.id (falling back to IP). We stub auth
// with a tiny middleware so tests can toggle user identity via a header.
function stubAuth(req: Request, _res: Response, next: NextFunction): void {
  const headerId = req.headers['x-test-user']
  if (typeof headerId === 'string' && headerId.length > 0) {
    req.user = { id: headerId, email: null }
  }
  next()
}

function buildApp(
  limiter: express.RequestHandler,
  path = '/t',
): express.Express {
  const app = express()
  app.use(express.json())
  app.post(path, stubAuth, limiter, (_req, res) => {
    res.json({ ok: true })
  })
  return app
}

async function hammer(
  app: express.Express,
  count: number,
  userId?: string,
  path = '/t',
): Promise<number[]> {
  const statuses: number[] = []
  for (let i = 0; i < count; i++) {
    const req = request(app).post(path)
    if (userId) req.set('x-test-user', userId)
    // eslint-disable-next-line no-await-in-loop
    const res = await req
    statuses.push(res.status)
  }
  return statuses
}

describe('emergencyLimiter (10 per hour per user)', () => {
  it('allows the first 10 requests from the same user', async () => {
    const app = buildApp(emergencyLimiter)
    const statuses = await hammer(app, 10, 'emg-user-1')
    expect(statuses.every((s) => s === 200)).toBe(true)
  })

  it('returns 429 with rate_limited error on the 11th request', async () => {
    const app = buildApp(emergencyLimiter)
    await hammer(app, 10, 'emg-user-2')
    const res = await request(app)
      .post('/t')
      .set('x-test-user', 'emg-user-2')
    expect(res.status).toBe(429)
    expect(res.body).toEqual({ error: 'rate_limited' })
  })

  it('isolates budgets per user id', async () => {
    const app = buildApp(emergencyLimiter)
    await hammer(app, 10, 'emg-user-3')
    // A different user should still get through.
    const res = await request(app)
      .post('/t')
      .set('x-test-user', 'emg-user-4')
    expect(res.status).toBe(200)
  })

  it('sets the RateLimit standard draft-7 headers', async () => {
    const app = buildApp(emergencyLimiter)
    const res = await request(app)
      .post('/t')
      .set('x-test-user', 'emg-user-headers')
    expect(res.headers['ratelimit']).toBeDefined()
  })

  it('falls back to IP-based keying for unauthenticated requests', async () => {
    const app = buildApp(emergencyLimiter)
    // No x-test-user header → falls back to ipKeyGenerator
    const statuses = await hammer(app, 10)
    expect(statuses.every((s) => s === 200)).toBe(true)
    const blocked = await request(app).post('/t')
    expect(blocked.status).toBe(429)
  })
})

describe('encouragementLimiter (30 per hour per user)', () => {
  it('allows 30 requests then blocks the 31st', async () => {
    const app = buildApp(encouragementLimiter)
    const statuses = await hammer(app, 30, 'enc-user-1')
    expect(statuses.every((s) => s === 200)).toBe(true)
    const blocked = await request(app)
      .post('/t')
      .set('x-test-user', 'enc-user-1')
    expect(blocked.status).toBe(429)
    expect(blocked.body).toEqual({ error: 'rate_limited' })
  })

  it('allows a different user after one is exhausted', async () => {
    const app = buildApp(encouragementLimiter)
    await hammer(app, 30, 'enc-user-2')
    const res = await request(app)
      .post('/t')
      .set('x-test-user', 'enc-user-3')
    expect(res.status).toBe(200)
  })

  it('counts each request once (not twice for one POST)', async () => {
    const app = buildApp(encouragementLimiter)
    // Exactly 30 should pass; if we were double-counting the 16th would 429.
    const statuses = await hammer(app, 30, 'enc-user-count')
    expect(statuses.filter((s) => s === 200)).toHaveLength(30)
  })
})

describe('inviteGenerateLimiter (20 per day per user)', () => {
  it('allows 20 then blocks the 21st', async () => {
    const app = buildApp(inviteGenerateLimiter)
    const statuses = await hammer(app, 20, 'inv-gen-1')
    expect(statuses.every((s) => s === 200)).toBe(true)
    const blocked = await request(app)
      .post('/t')
      .set('x-test-user', 'inv-gen-1')
    expect(blocked.status).toBe(429)
  })

  it('per-user isolation across multiple distinct users', async () => {
    const app = buildApp(inviteGenerateLimiter)
    const users = ['a', 'b', 'c', 'd', 'e']
    for (const u of users) {
      // eslint-disable-next-line no-await-in-loop
      const res = await request(app).post('/t').set('x-test-user', u)
      expect(res.status).toBe(200)
    }
  })
})

describe('inviteAcceptLimiter (10 per minute per user)', () => {
  it('allows 10 then blocks the 11th', async () => {
    const app = buildApp(inviteAcceptLimiter)
    const statuses = await hammer(app, 10, 'inv-acc-1')
    expect(statuses.every((s) => s === 200)).toBe(true)
    const blocked = await request(app)
      .post('/t')
      .set('x-test-user', 'inv-acc-1')
    expect(blocked.status).toBe(429)
  })

  it('returns the shared rate_limited error shape', async () => {
    const app = buildApp(inviteAcceptLimiter)
    await hammer(app, 10, 'inv-acc-2')
    const blocked = await request(app)
      .post('/t')
      .set('x-test-user', 'inv-acc-2')
    expect(blocked.body).toEqual({ error: 'rate_limited' })
  })

  it('does not share a budget with inviteGenerateLimiter', async () => {
    // Two separate limiter instances on two separate routes.
    const app = express()
    app.use(express.json())
    app.post('/gen', stubAuth, inviteGenerateLimiter, (_req, res) => {
      res.json({ ok: true })
    })
    app.post('/acc', stubAuth, inviteAcceptLimiter, (_req, res) => {
      res.json({ ok: true })
    })

    // Exhaust accept budget.
    for (let i = 0; i < 10; i++) {
      // eslint-disable-next-line no-await-in-loop
      await request(app).post('/acc').set('x-test-user', 'isolate-1')
    }
    const blockedAcc = await request(app)
      .post('/acc')
      .set('x-test-user', 'isolate-1')
    expect(blockedAcc.status).toBe(429)

    // Generate is still fresh for the same user.
    const gen = await request(app)
      .post('/gen')
      .set('x-test-user', 'isolate-1')
    expect(gen.status).toBe(200)
  })
})
