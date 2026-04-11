import { Router } from 'express'
import { requireAuth } from '../middleware/auth'
import { supabase } from '../lib/supabase'

export const silenceSettingsRouter = Router()

const DEFAULTS = {
  okay_tap_enabled: true,
  okay_tap_time: '09:00',
  silence_threshold_days: 2,
  snooze_until: null,
}

// Return the user's silence settings, or defaults if none exist yet.
silenceSettingsRouter.get(
  '/silence-settings',
  requireAuth,
  async (req, res) => {
    const { data, error } = await supabase
      .from('silence_settings')
      .select('okay_tap_enabled, okay_tap_time, silence_threshold_days, snooze_until')
      .eq('user_id', req.user!.id)
      .maybeSingle()

    if (error) {
      res.status(500).json({ error: 'lookup_failed' })
      return
    }

    res.json(data ?? DEFAULTS)
  },
)

// Upsert silence settings for the authenticated user.
silenceSettingsRouter.patch(
  '/silence-settings',
  requireAuth,
  async (req, res) => {
    const updates: Record<string, unknown> = {}

    if (req.body.okay_tap_enabled !== undefined) {
      if (typeof req.body.okay_tap_enabled !== 'boolean') {
        res.status(400).json({ error: 'invalid_okay_tap_enabled' })
        return
      }
      updates.okay_tap_enabled = req.body.okay_tap_enabled
    }

    if (req.body.okay_tap_time !== undefined) {
      if (typeof req.body.okay_tap_time !== 'string' || !/^\d{2}:\d{2}$/.test(req.body.okay_tap_time)) {
        res.status(400).json({ error: 'invalid_okay_tap_time' })
        return
      }
      updates.okay_tap_time = req.body.okay_tap_time
    }

    if (req.body.silence_threshold_days !== undefined) {
      const d = req.body.silence_threshold_days
      if (typeof d !== 'number' || !Number.isInteger(d) || d < 1 || d > 7) {
        res.status(400).json({ error: 'invalid_silence_threshold_days' })
        return
      }
      updates.silence_threshold_days = d
    }

    if (req.body.snooze_until !== undefined) {
      if (req.body.snooze_until === null) {
        updates.snooze_until = null
      } else {
        const parsed = new Date(req.body.snooze_until)
        if (isNaN(parsed.getTime())) {
          res.status(400).json({ error: 'invalid_snooze_until' })
          return
        }
        // Snooze must be in the future and at most 7 days out.
        const now = new Date()
        const maxSnooze = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7)
        if (parsed <= now || parsed > maxSnooze) {
          res.status(400).json({ error: 'snooze_out_of_range' })
          return
        }
        updates.snooze_until = req.body.snooze_until
      }
    }

    if (Object.keys(updates).length === 0) {
      res.status(400).json({ error: 'no_updates' })
      return
    }

    updates.updated_at = new Date().toISOString()

    const { error } = await supabase
      .from('silence_settings')
      .upsert(
        { user_id: req.user!.id, ...DEFAULTS, ...updates },
        { onConflict: 'user_id' },
      )

    if (error) {
      res.status(500).json({ error: 'upsert_failed' })
      return
    }

    res.json({ ok: true })
  },
)
