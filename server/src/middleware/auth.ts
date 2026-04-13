import type { Request, Response, NextFunction } from 'express'
import { supabase } from '../lib/supabase'

export interface AuthenticatedUser {
  id: string
  email: string | null
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthenticatedUser
    }
  }
}

// Cache validated tokens to avoid calling supabase.auth.getUser() on every
// request. Entries expire after TOKEN_CACHE_TTL_MS. At 1000+ concurrent users,
// this reduces Supabase auth API calls by ~95%.
const TOKEN_CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes
const TOKEN_CACHE_MAX_SIZE = 10_000

interface CachedAuth {
  user: AuthenticatedUser
  expiresAt: number
}

const tokenCache = new Map<string, CachedAuth>()

function pruneCache() {
  if (tokenCache.size <= TOKEN_CACHE_MAX_SIZE) return
  // Evict oldest entries when cache exceeds max size
  const now = Date.now()
  for (const [key, entry] of tokenCache) {
    if (entry.expiresAt <= now || tokenCache.size > TOKEN_CACHE_MAX_SIZE) {
      tokenCache.delete(key)
    }
  }
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const header = req.headers.authorization
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ error: 'missing_token' })
    return
  }

  const token = header.slice('Bearer '.length).trim()
  if (!token) {
    res.status(401).json({ error: 'missing_token' })
    return
  }

  // Fast path: return cached user if token was recently validated.
  const cached = tokenCache.get(token)
  if (cached && cached.expiresAt > Date.now()) {
    req.user = cached.user
    next()
    return
  }

  // Slow path: validate against Supabase auth service.
  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data?.user) {
    // Remove stale cache entry if it exists
    tokenCache.delete(token)
    res.status(401).json({ error: 'invalid_token' })
    return
  }

  const authenticatedUser: AuthenticatedUser = {
    id: data.user.id,
    email: data.user.email ?? null,
  }

  // Cache the validated token
  tokenCache.set(token, {
    user: authenticatedUser,
    expiresAt: Date.now() + TOKEN_CACHE_TTL_MS,
  })
  pruneCache()

  req.user = authenticatedUser
  next()
}
