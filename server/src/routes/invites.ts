import { Router } from 'express'
import { randomInt } from 'node:crypto'
import { requireAuth } from '../middleware/auth'
import {
  inviteGenerateLimiter,
  inviteAcceptLimiter,
} from '../middleware/rateLimit'
import { supabase } from '../lib/supabase'

export const invitesRouter = Router()

const CODE_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
const CODE_LENGTH = 6
const INVITE_TTL_MS = 24 * 60 * 60 * 1000

// Crypto-random code generator. Using node:crypto's randomInt avoids the
// v8 Math.random PRNG state-recovery attack, which matters because a
// redeemed code grants a full supporter relationship.
function generateCode(): string {
  let out = ''
  for (let i = 0; i < CODE_LENGTH; i++) {
    out += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]
  }
  return out
}

// Generate a fresh invite code for the authenticated recovery user.
invitesRouter.post(
  '/invites',
  requireAuth,
  inviteGenerateLimiter,
  async (req, res) => {
    // Only recovery-role users can generate invite codes. Otherwise a
    // supporter could pose as the "recovery" side of a relationship.
    const { data: me, error: meErr } = await supabase
      .from('users')
      .select('role')
      .eq('id', req.user!.id)
      .single()

    if (meErr || !me) {
      res.status(500).json({ error: 'user_lookup_failed' })
      return
    }
    if ((me as { role: string }).role !== 'recovery') {
      res.status(403).json({ error: 'only_recovery_users_can_invite' })
      return
    }

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
  },
)

// Accept an invite code. Uses an atomic update-and-return to "claim" the
// code: the update only succeeds if used_at is still null and the code
// hasn't expired. This closes the TOCTOU race where two concurrent accepts
// both pass a separate check. The claim happens BEFORE any other writes, so
// a failed claim short-circuits the whole request.
invitesRouter.post(
  '/invites/accept',
  requireAuth,
  inviteAcceptLimiter,
  async (req, res) => {
    const raw = req.body?.code
    if (typeof raw !== 'string') {
      res.status(400).json({ error: 'missing_code' })
      return
    }
    const code = raw.trim().toUpperCase()
    if (!code) {
      res.status(400).json({ error: 'missing_code' })
      return
    }

    // Atomic claim: only one concurrent caller can flip used_at from null.
    // gt('expires_at', now) folds the expiry check into the same statement.
    const nowIso = new Date().toISOString()
    const { data: claimed, error: claimErr } = await supabase
      .from('invite_codes')
      .update({ used_at: nowIso })
      .eq('code', code)
      .is('used_at', null)
      .gt('expires_at', nowIso)
      .select('recovery_user_id')
      .maybeSingle()

    if (claimErr) {
      res.status(500).json({ error: 'claim_failed' })
      return
    }
    if (!claimed) {
      // Either the code doesn't exist, was already used, or has expired.
      // We deliberately collapse these into one error to avoid leaking
      // which codes are valid vs used to a brute-force attacker.
      res.status(400).json({ error: 'invalid_or_used_code' })
      return
    }

    const recoveryUserId = (claimed as { recovery_user_id: string }).recovery_user_id
    const supporterId = req.user!.id

    if (recoveryUserId === supporterId) {
      // Roll back the claim so the code stays usable by its intended recipient.
      await supabase
        .from('invite_codes')
        .update({ used_at: null })
        .eq('code', code)
      res.status(400).json({ error: 'self_invite' })
      return
    }

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

    res.json({
      relationship_id: relInsert.data.id,
      conversation_id: convInsert.data.id,
    })
  },
)
