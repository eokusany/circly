import { Router } from 'express'
import { requireAuth } from '../middleware/auth'
import { okayTapLimiter } from '../middleware/rateLimit'
import { supabase } from '../lib/supabase'

export const okayTapRouter = Router()

// Record an "I'm okay" tap for the authenticated user.
okayTapRouter.post(
  '/okay-tap',
  requireAuth,
  okayTapLimiter,
  async (req, res) => {
    const { error, data } = await supabase
      .from('okay_taps')
      .insert({ user_id: req.user!.id })
      .select('tapped_at')
      .single()

    if (error || !data) {
      res.status(500).json({ error: 'insert_failed' })
      return
    }

    res.json({ ok: true, tapped_at: (data as { tapped_at: string }).tapped_at })
  },
)

// Check if the authenticated user has tapped today.
okayTapRouter.get(
  '/okay-tap/today',
  requireAuth,
  async (req, res) => {
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    const { count, error } = await supabase
      .from('okay_taps')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', req.user!.id)
      .gte('tapped_at', todayStart.toISOString())

    if (error) {
      res.status(500).json({ error: 'lookup_failed' })
      return
    }

    res.json({ tapped: (count ?? 0) > 0 })
  },
)
