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

  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data?.user) {
    res.status(401).json({ error: 'invalid_token' })
    return
  }

  req.user = {
    id: data.user.id,
    email: data.user.email ?? null,
  }
  next()
}
