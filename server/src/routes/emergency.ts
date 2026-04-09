import { Router } from 'express'
import { requireAuth } from '../middleware/auth'
import { emergencyLimiter } from '../middleware/rateLimit'
import { supabase } from '../lib/supabase'

export const emergencyRouter = Router()

emergencyRouter.post(
  '/emergency',
  requireAuth,
  emergencyLimiter,
  async (req, res) => {
    const userId = req.user!.id

    // User lookup and relationships lookup are independent — fire in parallel.
    const [userResult, relResult] = await Promise.all([
      supabase
        .from('users')
        .select('display_name')
        .eq('id', userId)
        .single(),
      supabase
        .from('relationships')
        .select('supporter_id')
        .eq('recovery_user_id', userId)
        .eq('status', 'active'),
    ])

    if (userResult.error || !userResult.data) {
      res.status(500).json({ error: 'user_lookup_failed' })
      return
    }
    if (relResult.error) {
      res.status(500).json({ error: 'relationships_lookup_failed' })
      return
    }

    const userRow = userResult.data as { display_name: string }
    const supporters = (relResult.data ?? []) as Array<{ supporter_id: string }>

    if (supporters.length === 0) {
      res.json({ supporters_notified: 0 })
      return
    }

    const rows = supporters.map((r) => ({
      recipient_id: r.supporter_id,
      type: 'emergency',
      payload: { from_display_name: userRow.display_name },
    }))

    const { error: insertErr } = await supabase
      .from('notifications')
      .insert(rows)
    if (insertErr) {
      res.status(500).json({ error: 'notification_insert_failed' })
      return
    }

    res.json({ supporters_notified: supporters.length })
  },
)
