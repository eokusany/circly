import { Router } from 'express'
import { requireAuth } from '../middleware/auth'
import { supabase } from '../lib/supabase'

export const invitesRouter = Router()

const CODE_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
const CODE_LENGTH = 6
const INVITE_TTL_MS = 24 * 60 * 60 * 1000

function generateCode(): string {
  let out = ''
  for (let i = 0; i < CODE_LENGTH; i++) {
    out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]
  }
  return out
}

// Generate a fresh invite code for the authenticated recovery user.
invitesRouter.post('/invites', requireAuth, async (req, res) => {
  const code = generateCode()
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS).toISOString()

  const { error } = await supabase.from('invite_codes').insert({
    code,
    recovery_user_id: req.user!.id,
    expires_at: expiresAt,
  })

  if (error) {
    res.status(500).json({ error: 'invite_insert_failed' })
    return
  }

  res.json({ code, expires_at: expiresAt })
})

// Accept an invite code: creates the relationship + direct conversation,
// marks the code as used. Service-role bypasses RLS so both writes land.
invitesRouter.post('/invites/accept', requireAuth, async (req, res) => {
  const code = String(req.body?.code ?? '').trim().toUpperCase()
  if (!code) {
    res.status(400).json({ error: 'missing_code' })
    return
  }

  const { data: invite, error: lookupErr } = await supabase
    .from('invite_codes')
    .select('code, recovery_user_id, expires_at, used_at')
    .eq('code', code)
    .maybeSingle()

  if (lookupErr) {
    res.status(500).json({ error: 'lookup_failed' })
    return
  }
  if (!invite) {
    res.status(400).json({ error: 'invalid_code' })
    return
  }

  const inviteRow = invite as {
    code: string
    recovery_user_id: string
    expires_at: string
    used_at: string | null
  }

  if (inviteRow.used_at) {
    res.status(400).json({ error: 'code_used' })
    return
  }
  if (new Date(inviteRow.expires_at).getTime() < Date.now()) {
    res.status(400).json({ error: 'code_expired' })
    return
  }
  if (inviteRow.recovery_user_id === req.user!.id) {
    res.status(400).json({ error: 'self_invite' })
    return
  }

  const supporterId = req.user!.id
  const recoveryUserId = inviteRow.recovery_user_id

  // Create the relationship.
  const relInsert = (await supabase
    .from('relationships')
    .insert({
      recovery_user_id: recoveryUserId,
      supporter_id: supporterId,
      status: 'active',
    })
    .select()
    .single()) as { data: { id: string } | null; error: { message: string } | null }

  if (relInsert.error || !relInsert.data) {
    res.status(500).json({ error: 'relationship_insert_failed' })
    return
  }

  // Create the direct conversation.
  const convInsert = (await supabase
    .from('conversations')
    .insert({
      type: 'direct',
      participant_ids: [recoveryUserId, supporterId],
    })
    .select()
    .single()) as { data: { id: string } | null; error: { message: string } | null }

  if (convInsert.error || !convInsert.data) {
    res.status(500).json({ error: 'conversation_insert_failed' })
    return
  }

  // Mark the invite as used.
  const { error: updateErr } = await supabase
    .from('invite_codes')
    .update({ used_at: new Date().toISOString() })
    .eq('code', code)

  if (updateErr) {
    res.status(500).json({ error: 'invite_update_failed' })
    return
  }

  res.json({
    relationship_id: relInsert.data.id,
    conversation_id: convInsert.data.id,
  })
})
