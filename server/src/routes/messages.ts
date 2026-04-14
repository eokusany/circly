import { Router } from 'express'
import { requireAuth } from '../middleware/auth'
import { messageLimiter } from '../middleware/rateLimit'
import { supabase } from '../lib/supabase'
import { sendPushToUsers } from '../services/pushNotifications'

export const messagesRouter = Router()

const MAX_BODY_LEN = 2000

messagesRouter.post(
  '/messages',
  requireAuth,
  messageLimiter,
  async (req, res) => {
    const conversationId = req.body?.conversation_id
    const rawBody = req.body?.body

    if (typeof conversationId !== 'string' || typeof rawBody !== 'string') {
      res.status(400).json({ error: 'missing_fields' })
      return
    }

    const body = rawBody.trim()
    if (!conversationId || !body) {
      res.status(400).json({ error: 'missing_fields' })
      return
    }

    if (body.length > MAX_BODY_LEN) {
      res.status(400).json({ error: 'message_too_long' })
      return
    }

    // Verify the sender is a participant in the conversation.
    const { data: convo, error: convoErr } = await supabase
      .from('conversations')
      .select('id, participant_ids')
      .eq('id', conversationId)
      .maybeSingle()

    if (convoErr) {
      res.status(500).json({ error: 'conversation_lookup_failed' })
      return
    }

    const convoRow = convo as { id: string; participant_ids: string[] } | null

    if (!convoRow) {
      res.status(404).json({ error: 'conversation_not_found' })
      return
    }

    if (!convoRow.participant_ids.includes(req.user!.id)) {
      res.status(403).json({ error: 'not_a_participant' })
      return
    }

    // Check if messaging is allowed. Look up any relationship between
    // the participants and check the messages permission.
    const otherIds = convoRow.participant_ids.filter((p) => p !== req.user!.id)
    if (otherIds.length > 0) {
      const { data: rels } = await supabase
        .from('relationships')
        .select('permissions, status')
        .or(
          `and(recovery_user_id.eq.${req.user!.id},supporter_id.in.(${otherIds.join(',')})),` +
          `and(supporter_id.eq.${req.user!.id},recovery_user_id.in.(${otherIds.join(',')}))`
        )

      const activeRel = (rels as { permissions: Record<string, boolean>; status: string }[] | null)
        ?.find((r) => r.status === 'active')

      if (activeRel && activeRel.permissions?.messages === false) {
        res.status(403).json({ error: 'messaging_disabled' })
        return
      }
    }

    // Insert the message.
    const { data: msg, error: insertErr } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        sender_id: req.user!.id,
        body,
      })
      .select('id, conversation_id, sender_id, body, created_at')
      .single()

    if (insertErr || !msg) {
      res.status(500).json({ error: 'message_insert_failed' })
      return
    }

    // Respond immediately — don't block on notifications
    res.json({ ok: true, message: msg })

    // Fire notifications async (best-effort)
    const senderId = req.user!.id
    ;(async () => {
      try {
        const { data: sender } = await supabase
          .from('users')
          .select('display_name')
          .eq('id', senderId)
          .single()

        const senderName = (sender as { display_name: string } | null)?.display_name ?? 'someone'

        const notifications = otherIds.map((recipientId) => ({
          recipient_id: recipientId,
          type: 'message',
          payload: {
            from_display_name: senderName,
            conversation_id: conversationId,
            preview: body.length > 100 ? body.slice(0, 100) + '...' : body,
          },
        }))

        if (notifications.length > 0) {
          const { error } = await supabase.from('notifications').insert(notifications)
          if (error) console.warn('notification insert failed:', error)

          void sendPushToUsers(otherIds, {
            type: 'message',
            payload: { from_display_name: senderName, conversation_id: conversationId },
          })
        }
      } catch (err) {
        console.warn('notification flow failed:', err)
      }
    })()
  },
)
