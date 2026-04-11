import { supabase } from '../lib/supabase'

export interface DetectionResult {
  users_detected: number
  nudges_sent: number
}

/**
 * Scans for recovery/family users who have gone silent beyond their
 * configured threshold and inserts `silence_nudge` notifications for
 * their active supporters.
 *
 * Rules:
 *   1. Only users with a `silence_settings` row are checked (lazy-created).
 *   2. Users with an active snooze (`snooze_until >= today`) are skipped.
 *   3. "Last signal" = MAX(last okay_tap, last check_in, last message sent).
 *      If a user has never generated any signal, they are not flagged (new user).
 *   4. A supporter is only nudged once per 48 hours per silent user.
 */
export async function detectSilentUsers(): Promise<DetectionResult> {
  const now = new Date()
  const todayISO = now.toISOString().split('T')[0]

  // 1. Fetch all silence_settings rows where snooze is inactive.
  const { data: settingsRows, error: settingsErr } = await supabase
    .from('silence_settings')
    .select('user_id, silence_threshold_days')
    .or(`snooze_until.is.null,snooze_until.lt.${todayISO}`)

  if (settingsErr || !settingsRows || settingsRows.length === 0) {
    return { users_detected: 0, nudges_sent: 0 }
  }

  const settings = settingsRows as Array<{
    user_id: string
    silence_threshold_days: number
  }>
  const userIds = settings.map((s) => s.user_id)

  // 2. For each user, find their most recent signal across three tables.
  const [tapsRes, checkInsRes, messagesRes] = await Promise.all([
    supabase
      .from('okay_taps')
      .select('user_id, tapped_at')
      .in('user_id', userIds)
      .order('tapped_at', { ascending: false }),
    supabase
      .from('check_ins')
      .select('user_id, created_at')
      .in('user_id', userIds)
      .order('created_at', { ascending: false }),
    supabase
      .from('messages')
      .select('sender_id, created_at')
      .in('sender_id', userIds)
      .order('created_at', { ascending: false }),
  ])

  // Build a map: user_id -> latest signal timestamp
  const latestSignal = new Map<string, string>()

  function updateLatest(userId: string, timestamp: string) {
    const current = latestSignal.get(userId)
    if (!current || timestamp > current) {
      latestSignal.set(userId, timestamp)
    }
  }

  for (const row of (tapsRes.data ?? []) as Array<{ user_id: string; tapped_at: string }>) {
    updateLatest(row.user_id, row.tapped_at)
  }
  for (const row of (checkInsRes.data ?? []) as Array<{ user_id: string; created_at: string }>) {
    updateLatest(row.user_id, row.created_at)
  }
  for (const row of (messagesRes.data ?? []) as Array<{ sender_id: string; created_at: string }>) {
    updateLatest(row.sender_id, row.created_at)
  }

  // 3. Identify users who are past their threshold.
  const silentUsers: Array<{ userId: string; daysSince: number }> = []

  for (const s of settings) {
    const last = latestSignal.get(s.user_id)
    if (!last) continue // new user with no signals — don't flag

    const lastDate = new Date(last)
    const diffMs = now.getTime() - lastDate.getTime()
    const daysSince = Math.floor(diffMs / (24 * 60 * 60 * 1000))

    if (daysSince >= s.silence_threshold_days) {
      silentUsers.push({ userId: s.user_id, daysSince })
    }
  }

  if (silentUsers.length === 0) {
    return { users_detected: 0, nudges_sent: 0 }
  }

  // 4. For each silent user, find their active supporters.
  const silentUserIds = silentUsers.map((u) => u.userId)
  const { data: relRows } = await supabase
    .from('relationships')
    .select('recovery_user_id, supporter_id')
    .in('recovery_user_id', silentUserIds)
    .eq('status', 'active')

  if (!relRows || relRows.length === 0) {
    return { users_detected: silentUsers.length, nudges_sent: 0 }
  }

  const relationships = relRows as Array<{
    recovery_user_id: string
    supporter_id: string
  }>

  // 5. Check 48h cooldown: skip supporters who were already nudged recently.
  const cooldownCutoff = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString()
  const { data: recentNudges } = await supabase
    .from('notifications')
    .select('recipient_id, payload')
    .eq('type', 'silence_nudge')
    .gte('created_at', cooldownCutoff)

  const recentNudgeSet = new Set<string>()
  for (const n of (recentNudges ?? []) as Array<{ recipient_id: string; payload: { for_user_id?: string } }>) {
    if (n.payload?.for_user_id) {
      recentNudgeSet.add(`${n.recipient_id}:${n.payload.for_user_id}`)
    }
  }

  // 6. Fetch display names for the silent users.
  const { data: userRows } = await supabase
    .from('users')
    .select('id, display_name')
    .in('id', silentUserIds)

  const nameMap = new Map<string, string>()
  for (const u of (userRows ?? []) as Array<{ id: string; display_name: string }>) {
    nameMap.set(u.id, u.display_name)
  }

  // 7. Build notification rows.
  const daysSinceMap = new Map(silentUsers.map((u) => [u.userId, u.daysSince]))
  const notifications: Array<{
    recipient_id: string
    type: string
    payload: Record<string, unknown>
  }> = []

  for (const rel of relationships) {
    const key = `${rel.supporter_id}:${rel.recovery_user_id}`
    if (recentNudgeSet.has(key)) continue // cooldown active

    notifications.push({
      recipient_id: rel.supporter_id,
      type: 'silence_nudge',
      payload: {
        for_user_id: rel.recovery_user_id,
        from_display_name: nameMap.get(rel.recovery_user_id) ?? 'someone',
        days_since_last_signal: daysSinceMap.get(rel.recovery_user_id) ?? 0,
      },
    })
  }

  if (notifications.length === 0) {
    return { users_detected: silentUsers.length, nudges_sent: 0 }
  }

  const { error: insertErr } = await supabase
    .from('notifications')
    .insert(notifications)

  if (insertErr) {
    return { users_detected: silentUsers.length, nudges_sent: 0 }
  }

  return {
    users_detected: silentUsers.length,
    nudges_sent: notifications.length,
  }
}
