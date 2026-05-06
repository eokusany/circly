import { supabase } from './supabase'
import { toISODate } from './streak'

export type CheckInStatus = 'sober' | 'struggling' | 'good_day'

export interface CheckInRow {
  id: string
  status: CheckInStatus
  note: string | null
  check_in_date: string
}

export async function loadTodayCheckIn(userId: string): Promise<CheckInRow | null> {
  const todayISO = toISODate(new Date())
  const { data, error } = await supabase
    .from('check_ins')
    .select('id, status, note, check_in_date')
    .eq('user_id', userId)
    .eq('check_in_date', todayISO)
    .maybeSingle<CheckInRow>()
  if (error) throw new Error(error.message)
  return data ?? null
}

export interface SaveTodayCheckInInput {
  userId: string
  status: CheckInStatus
  note: string
}

export async function saveTodayCheckIn(
  input: SaveTodayCheckInInput,
): Promise<CheckInRow> {
  const todayISO = toISODate(new Date())
  const { data, error } = await supabase
    .from('check_ins')
    .upsert(
      {
        user_id: input.userId,
        status: input.status,
        note: input.note.trim() || null,
        check_in_date: todayISO,
        source: 'in_app',
      },
      { onConflict: 'user_id,check_in_date' },
    )
    .select('id, status, note, check_in_date')
    .single<CheckInRow>()
  if (error || !data) throw new Error(error?.message ?? 'check-in save failed')
  return data
}
