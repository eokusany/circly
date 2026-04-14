import { Router } from 'express'
import { requireAuth } from '../middleware/auth'
import { supabase } from '../lib/supabase'

export const pushTokenRouter = Router()

pushTokenRouter.post('/push-token', requireAuth, async (req, res) => {
  const userId = req.user!.id
  const { token } = req.body as { token?: string }

  if (!token || typeof token !== 'string') {
    return res.status(400).json({ error: 'token is required' })
  }

  // Upsert so we don't duplicate tokens per user
  const { error } = await supabase
    .from('push_tokens')
    .upsert(
      { user_id: userId, token, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,token' },
    )

  if (error) {
    return res.status(500).json({ error: 'token_upsert_failed' })
  }

  return res.json({ ok: true })
})

pushTokenRouter.delete('/push-token', requireAuth, async (req, res) => {
  const userId = req.user!.id
  const { token } = req.body as { token?: string }

  if (!token || typeof token !== 'string') {
    return res.status(400).json({ error: 'token is required' })
  }

  await supabase
    .from('push_tokens')
    .delete()
    .eq('user_id', userId)
    .eq('token', token)

  return res.json({ ok: true })
})
