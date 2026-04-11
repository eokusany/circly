import rateLimit, { ipKeyGenerator, type Options } from 'express-rate-limit'
import type { Request, Response } from 'express'

// Per-user rate limits. `requireAuth` must run before these so req.user is
// populated — keying on user id (not IP) means multiple users behind one NAT
// don't collide and a signed-out attacker hits the IPv6-safe IP fallback.
//
// Budgets were picked to be generous for real humans and hostile for bots:
//   emergency     — 10 / hour  (a real crisis shouldn't require more)
//   encouragement — 30 / hour  (one per linked person, many times a day)
//   invites       — 20 / day   (a recovery user rarely needs more)
//   invite accept — 10 / min   (blocks brute-force against the 6-char space)
function userKey(req: Request, res: Response): string {
  return req.user?.id ?? ipKeyGenerator(req.ip ?? '', res as unknown as never)
}

function make(options: Partial<Options> & Pick<Options, 'windowMs' | 'limit'>) {
  return rateLimit({
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    keyGenerator: userKey,
    handler: (_req, res) => {
      res.status(429).json({ error: 'rate_limited' })
    },
    ...options,
  })
}

export const emergencyLimiter = make({
  windowMs: 60 * 60 * 1000,
  limit: 10,
})

export const encouragementLimiter = make({
  windowMs: 60 * 60 * 1000,
  limit: 30,
})

export const inviteGenerateLimiter = make({
  windowMs: 24 * 60 * 60 * 1000,
  limit: 20,
})

export const inviteAcceptLimiter = make({
  windowMs: 60 * 1000,
  limit: 10,
})

export const okayTapLimiter = make({
  windowMs: 24 * 60 * 60 * 1000,
  limit: 20,
})
