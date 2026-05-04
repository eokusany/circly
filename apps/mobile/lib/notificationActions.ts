export const NOTIFICATION_CATEGORY_ID = 'daily-checkin'

export type CheckInStatus = 'good_day' | 'sober' | 'struggling'

const ACTION_TO_STATUS: Record<string, CheckInStatus> = {
  'mood-good': 'good_day',
  'mood-okay': 'sober',
  'mood-struggling': 'struggling',
}

export function actionToStatus(actionIdentifier: string): CheckInStatus | null {
  return ACTION_TO_STATUS[actionIdentifier] ?? null
}

export interface ConfirmationCopy {
  body: string
  tappable: boolean
  tapRoute?: string
}

const CONFIRMATIONS: Record<CheckInStatus, ConfirmationCopy> = {
  good_day: {
    body: 'logged. have a good one. ✓',
    tappable: false,
  },
  sober: {
    body: 'logged. one foot in front of the other. ✓',
    tappable: false,
  },
  struggling: {
    body: 'logged. your circle has been notified. tap to talk →',
    tappable: true,
    tapRoute: '/(recovery)/chat',
  },
}

export function confirmationFor(status: CheckInStatus): ConfirmationCopy {
  return CONFIRMATIONS[status]
}

import AsyncStorage from '@react-native-async-storage/async-storage'

export const PENDING_QUEUE_KEY = 'pending_notification_checkins'

export interface PendingCheckIn {
  userId: string
  status: CheckInStatus
  checkInDate: string
}

export async function readPending(): Promise<PendingCheckIn[]> {
  const raw = await AsyncStorage.getItem(PENDING_QUEUE_KEY)
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as PendingCheckIn[]) : []
  } catch {
    return []
  }
}

export async function enqueuePending(entry: PendingCheckIn): Promise<void> {
  const current = await readPending()
  current.push(entry)
  await AsyncStorage.setItem(PENDING_QUEUE_KEY, JSON.stringify(current))
}

export async function clearPending(): Promise<void> {
  await AsyncStorage.removeItem(PENDING_QUEUE_KEY)
}

import type { SupabaseClient } from '@supabase/supabase-js'

export interface RecordCheckInArgs {
  userId: string
  status: CheckInStatus
  todayISO: string
}

export interface RecordCheckInDeps {
  supabase: SupabaseClient
}

export async function recordNotificationCheckIn(
  args: RecordCheckInArgs,
  deps: RecordCheckInDeps,
): Promise<'ok' | 'failed'> {
  try {
    const { error } = await deps.supabase
      .from('check_ins')
      .upsert(
        {
          user_id: args.userId,
          status: args.status,
          note: null,
          check_in_date: args.todayISO,
          source: 'notification',
        },
        { onConflict: 'user_id,check_in_date' },
      )
      .select('id')
      .single()
    return error ? 'failed' : 'ok'
  } catch {
    return 'failed'
  }
}

export interface FlushResult {
  attempted: number
  succeeded: number
  remaining: number
}

export async function flushPending(deps: RecordCheckInDeps): Promise<FlushResult> {
  const queue = await readPending()
  if (queue.length === 0) {
    return { attempted: 0, succeeded: 0, remaining: 0 }
  }

  const stillPending: PendingCheckIn[] = []
  let succeeded = 0
  for (const entry of queue) {
    const result = await recordNotificationCheckIn(
      { userId: entry.userId, status: entry.status, todayISO: entry.checkInDate },
      deps,
    )
    if (result === 'ok') {
      succeeded += 1
    } else {
      stillPending.push(entry)
    }
  }

  if (stillPending.length === 0) {
    await clearPending()
  } else {
    await AsyncStorage.setItem(PENDING_QUEUE_KEY, JSON.stringify(stillPending))
  }

  return { attempted: queue.length, succeeded, remaining: stillPending.length }
}
