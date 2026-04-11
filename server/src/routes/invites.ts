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
    // Only recovery-role users can generate invite codes via this endpoint.
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

// Generate a fresh invite code for the authenticated supporter user.
// The recovery user accepts this code to form the relationship.
invitesRouter.post(
  '/invites/supporter',
  requireAuth,
  inviteGenerateLimiter,
  async (req, res) => {
    const { data: me, error: meErr } = await supabase
      .from('users')
      .select('role')
      .eq('id', req.user!.id)
      .single()

    if (meErr || !me) {
      res.status(500).json({ error: 'user_lookup_failed' })
      return
    }
    if ((me as { role: string }).role !== 'supporter') {
      res.status(403).json({ error: 'only_supporters_can_use_this_endpoint' })
      return
    }

    const code = generateCode()
    const expiresAt = new Date(Date.now() + INVITE_TTL_MS).toISOString()

    const { error } = await supabase.from('invite_codes').insert({
      code,
      supporter_user_id: req.user!.id,
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
      .select('recovery_user_id, supporter_user_id')
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

    const claimedRow = claimed as {
      recovery_user_id: string | null
      supporter_user_id: string | null
    }
    // Determine which direction this invite goes.
    // recovery_user_id set  => a recovery user generated it, acceptor is supporter
    // supporter_user_id set => a supporter generated it, acceptor is recovery user
    let recoveryUserId: string
    let supporterId: string

    if (claimedRow.recovery_user_id) {
      recoveryUserId = claimedRow.recovery_user_id
      supporterId = req.user!.id
    } else {
      supporterId = claimedRow.supporter_user_id!
      recoveryUserId = req.user!.id
    }

    if (recoveryUserId === supporterId) {
      // Roll back the claim so the code stays usable by its intended recipient.
      await supabase
        .from('invite_codes')
        .update({ used_at: null })
        .eq('code', code)
      res.status(400).json({ error: 'self_invite' })
      return
    }

    // Check if these two users are already linked.
    const { data: existing } = await supabase
      .from('relationships')
      .select('id, status')
      .eq('recovery_user_id', recoveryUserId)
      .eq('supporter_id', supporterId)
      .maybeSingle()

    if (existing) {
      if ((existing as { status: string }).status === 'active') {
        // Already connected — roll back the code so it isn't wasted.
        await supabase
          .from('invite_codes')
          .update({ used_at: null })
          .eq('code', code)
        res.status(400).json({ error: 'already_linked' })
        return
      }

      // Reactivate a previously removed relationship.
      await supabase
        .from('relationships')
        .update({ status: 'active', updated_at: new Date().toISOString() })
        .eq('id', (existing as { id: string }).id)

      // Ensure a conversation exists (may have been from the original link).
      const { data: existingConvo } = await supabase
        .from('conversations')
        .select('id')
        .contains('participant_ids', [recoveryUserId, supporterId])
        .maybeSingle()

      let conversationId: string
      if (existingConvo) {
        conversationId = (existingConvo as { id: string }).id
      } else {
        const convInsert = (await supabase
          .from('conversations')
          .insert({ type: 'direct', participant_ids: [recoveryUserId, supporterId] })
          .select()
          .single()) as { data: { id: string } | null; error: { message: string } | null }
        if (convInsert.error || !convInsert.data) {
          res.status(500).json({ error: 'conversation_insert_failed' })
          return
        }
        conversationId = convInsert.data.id
      }

      res.json({
        relationship_id: (existing as { id: string }).id,
        conversation_id: conversationId,
      })
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
