import { Router } from 'express'
import { requireAuth } from '../middleware/auth'
import { encouragementLimiter } from '../middleware/rateLimit'
import { supabase } from '../lib/supabase'

export const encouragementsRouter = Router()

const MAX_MESSAGE_LEN = 500

encouragementsRouter.post(
  '/encouragements',
  requireAuth,
  encouragementLimiter,
  async (req, res) => {
    const relationshipId = req.body?.relationship_id
    const rawMessage = req.body?.message

    if (typeof relationshipId !== 'string' || typeof rawMessage !== 'string') {
      res.status(400).json({ error: 'missing_fields' })
      return
    }
    const message = rawMessage.trim()
    if (!relationshipId || !message) {
      res.status(400).json({ error: 'missing_fields' })
      return
    }
    if (message.length > MAX_MESSAGE_LEN) {
      res.status(400).json({ error: 'message_too_long' })
      return
    }

    // Look up the relationship and confirm the caller is the supporter on it.
    const { data: rel, error: relErr } = await supabase
      .from('relationships')
      .select('id, recovery_user_id, supporter_id, status')
      .eq('id', relationshipId)
      .maybeSingle()

    if (relErr) {
      res.status(500).json({ error: 'relationship_lookup_failed' })
      return
    }

    const relRow = rel as {
      id: string
      recovery_user_id: string
      supporter_id: string
      status: string
    } | null

    if (!relRow || relRow.supporter_id !== req.user!.id) {
      res.status(404).json({ error: 'relationship_not_found' })
      return
    }
    if (relRow.status !== 'active') {
      res.status(400).json({ error: 'relationship_inactive' })
      return
    }

    // Look up the supporter's display name for the notification payload.
    const { data: supporter, error: supErr } = await supabase
      .from('users')
      .select('display_name')
      .eq('id', req.user!.id)
      .single()

    if (supErr || !supporter) {
      res.status(500).json({ error: 'user_lookup_failed' })
      return
    }

    const { error: insertErr } = await supabase.from('notifications').insert({
      recipient_id: relRow.recovery_user_id,
      type: 'encouragement',
      payload: {
        from_display_name: (supporter as { display_name: string }).display_name,
        message,
      },
    })

    if (insertErr) {
      res.status(500).json({ error: 'notification_insert_failed' })
      return
    }

    res.json({ ok: true })
  },
)
