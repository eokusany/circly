import { Router } from 'express'
import { requireAuth } from '../middleware/auth'
import { supabase } from '../lib/supabase'

export const warmPingRouter = Router()

const DAILY_LIMIT = 3

warmPingRouter.post('/warm-ping', requireAuth, async (req, res) => {
  const recipientId = req.body?.recipient_id
  if (typeof recipientId !== 'string' || !recipientId) {
    res.status(400).json({ error: 'missing_recipient_id' })
    return
  }

  const senderId = req.user!.id

  if (senderId === recipientId) {
    res.status(400).json({ error: 'cannot_ping_self' })
    return
  }

  // Verify active relationship exists between sender and recipient.
  const { data: rel, error: relErr } = await supabase
    .from('relationships')
    .select('id, status')
    .or(
      `and(supporter_id.eq.${senderId},recovery_user_id.eq.${recipientId}),` +
        `and(recovery_user_id.eq.${senderId},supporter_id.eq.${recipientId})`,
    )
    .eq('status', 'active')
    .limit(1)
    .maybeSingle()

  if (relErr) {
    res.status(500).json({ error: 'relationship_lookup_failed' })
    return
  }

  if (!rel) {
    res.status(404).json({ error: 'no_active_relationship' })
    return
  }

  // Check daily limit (3 pings per sender→recipient pair per day).
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  const { data: todayPings, error: countErr } = await supabase
    .from('warm_pings')
    .select('id')
    .eq('sender_id', senderId)
    .eq('recipient_id', recipientId)
    .gte('created_at', todayStart.toISOString())

  if (countErr) {
    res.status(500).json({ error: 'count_lookup_failed' })
    return
  }

  if ((todayPings ?? []).length >= DAILY_LIMIT) {
    res.status(429).json({ error: 'daily_limit_reached' })
    return
  }

  // Insert the warm ping.
  const { error: insertErr } = await supabase
    .from('warm_pings')
    .insert({ sender_id: senderId, recipient_id: recipientId })

  if (insertErr) {
    res.status(500).json({ error: 'insert_failed' })
    return
  }

  // Look up sender's display name for the notification.
  const { data: sender } = await supabase
    .from('users')
    .select('display_name')
    .eq('id', senderId)
    .single()

  const displayName = (sender as { display_name: string } | null)?.display_name ?? 'someone'

  // Insert notification for the recipient.
  await supabase.from('notifications').insert({
    recipient_id: recipientId,
    type: 'warm_ping',
    payload: {
      from_user_id: senderId,
      from_display_name: displayName,
    },
  })

  res.json({ ok: true })
})
