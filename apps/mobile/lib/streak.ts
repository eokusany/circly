// Sobriety streak + milestone math.
// Dates are stored as ISO YYYY-MM-DD strings in Supabase (`date` column).

export type MilestoneType = '1d' | '7d' | '30d' | '90d' | '1y'

export interface Milestone {
  type: MilestoneType
  label: string
  days: number
}

export const MILESTONES: Milestone[] = [
  { type: '1d', label: '1 day', days: 1 },
  { type: '7d', label: '1 week', days: 7 },
  { type: '30d', label: '1 month', days: 30 },
  { type: '90d', label: '3 months', days: 90 },
  { type: '1y', label: '1 year', days: 365 },
]

/** Parse an ISO YYYY-MM-DD string into a local Date at midnight. */
export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** Format a local Date as ISO YYYY-MM-DD (no timezone shift). */
export function toISODate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Whole days between two dates (ignoring time of day). Uses UTC arithmetic
 * so DST transitions don't introduce 23h/25h "days" that would make the
 * streak silently lose a day twice a year. */
export function daysBetween(start: Date, end: Date): number {
  const ms = 24 * 60 * 60 * 1000
  const a = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate())
  const b = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate())
  return Math.floor((b - a) / ms)
}

/** Days sober today, inclusive of the start day. Never negative. */
export function streakDays(sobrietyStartISO: string, today: Date = new Date()): number {
  const start = parseISODate(sobrietyStartISO)
  return Math.max(0, daysBetween(start, today) + 1)
}

export function isMilestoneReached(days: number, milestone: Milestone): boolean {
  return days >= milestone.days
}

/** Next milestone that hasn't been reached yet, or null if all reached. */
export function nextMilestone(days: number): Milestone | null {
  return MILESTONES.find((m) => days < m.days) ?? null
}
