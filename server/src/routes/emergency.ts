import { Router } from 'express'
import { requireAuth } from '../middleware/auth'
import { supabase } from '../lib/supabase'

export const emergencyRouter = Router()

emergencyRouter.post('/emergency', requireAuth, async (req, res) => {
  const userId = req.user!.id

  // Look up the requester's display name so supporters see who needs help.
  const { data: userRow, error: userErr } = await supabase
    .from('users')
    .select('display_name')
    .eq('id', userId)
    .single()

  if (userErr || !userRow) {
    res.status(500).json({ error: 'user_lookup_failed' })
    return
  }

  // Find active supporters.
  const { data: relationships, error: relErr } = await supabase
    .from('relationships')
    .select('supporter_id')
    .eq('recovery_user_id', userId)
    .eq('status', 'active')

  if (relErr) {
    res.status(500).json({ error: 'relationships_lookup_failed' })
    return
  }

  const supporters = (relationships ?? []) as Array<{ supporter_id: string }>

  if (supporters.length === 0) {
    res.json({ supporters_notified: 0 })
    return
  }

  const rows = supporters.map((r) => ({
    recipient_id: r.supporter_id,
    type: 'emergency',
    payload: { from_display_name: userRow.display_name },
  }))

  const { error: insertErr } = await supabase.from('notifications').insert(rows)
  if (insertErr) {
    res.status(500).json({ error: 'notification_insert_failed' })
    return
  }

  res.json({ supporters_notified: supporters.length })
})
