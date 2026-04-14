import { Router } from 'express'
import { requireAuth } from '../middleware/auth'
import { supabase } from '../lib/supabase'
import { sendPushToUsers } from '../services/pushNotifications'

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

  const { count, error: countErr } = await supabase
    .from('warm_pings')
    .select('id', { count: 'exact', head: true })
    .eq('sender_id', senderId)
    .eq('recipient_id', recipientId)
    .gte('created_at', todayStart.toISOString())

  if (countErr) {
    res.status(500).json({ error: 'count_lookup_failed' })
    return
  }

  if ((count ?? 0) >= DAILY_LIMIT) {
    res.status(429).json({ error: 'daily_limit_reached' })
    return
  }

  // Look up sender's display name in parallel with the insert.
  const [insertResult, senderResult] = await Promise.all([
    supabase
      .from('warm_pings')
      .insert({ sender_id: senderId, recipient_id: recipientId }),
    supabase
      .from('users')
      .select('display_name')
      .eq('id', senderId)
      .single(),
  ])

  if (insertResult.error) {
    res.status(500).json({ error: 'insert_failed' })
    return
  }

  const displayName = (senderResult.data as { display_name: string } | null)?.display_name ?? 'someone'

  // Insert notification for the recipient.
  await supabase.from('notifications').insert({
    recipient_id: recipientId,
    type: 'warm_ping',
    payload: {
      from_user_id: senderId,
      from_display_name: displayName,
    },
  })

  void sendPushToUsers([recipientId], {
    type: 'warm_ping',
    payload: { from_display_name: displayName },
  })

  res.json({ ok: true })
})
