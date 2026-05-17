import { Router } from 'express'
import { requireAuth } from '../middleware/auth'
import { supabase } from '../lib/supabase'
import { isExpoPushToken } from '../lib/validators'

export const pushTokenRouter = Router()

// Cap the number of registered tokens per user. A real human has at most a
// handful of devices; anything beyond this is either bot abuse or a stale
// token leak that would inflate the fan-out scan.
const MAX_TOKENS_PER_USER = 10

pushTokenRouter.post('/push-token', requireAuth, async (req, res) => {
  const userId = req.user!.id
  const { token } = req.body as { token?: string }

  if (!isExpoPushToken(token)) {
    return res.status(400).json({ error: 'invalid_token_format' })
  }

  // Trim down to the cap before upserting. Delete oldest first so a legitimate
  // device rotation doesn't get evicted by stale entries.
  const { data: existing, error: countErr } = await supabase
    .from('push_tokens')
    .select('id, token, updated_at')
    .eq('user_id', userId)
    .order('updated_at', { ascending: true })

  if (countErr) {
    return res.status(500).json({ error: 'token_upsert_failed' })
  }

  const rows = (existing as { id: string; token: string; updated_at: string }[]) ?? []
  const alreadyRegistered = rows.some((r) => r.token === token)
  const idsToDelete = alreadyRegistered
    ? rows.slice(0, Math.max(0, rows.length - MAX_TOKENS_PER_USER)).map((r) => r.id)
    : rows.slice(0, Math.max(0, rows.length + 1 - MAX_TOKENS_PER_USER)).map((r) => r.id)

  if (idsToDelete.length > 0) {
    await supabase.from('push_tokens').delete().in('id', idsToDelete)
  }

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

  if (!isExpoPushToken(token)) {
    return res.status(400).json({ error: 'invalid_token_format' })
  }

  await supabase
    .from('push_tokens')
    .delete()
    .eq('user_id', userId)
    .eq('token', token)

  return res.json({ ok: true })
})
