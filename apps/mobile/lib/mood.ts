import type { IconName } from '../components/Icon'

export interface Mood {
  tag: string
  icon: IconName
  label: string
  /** Lower bound on the 0–100 mood slider scale */
  min: number
  /** Upper bound on the 0–100 mood slider scale */
  max: number
}

/**
 * Ordered from lowest (struggling) to highest (grateful).
 * Ranges are contiguous and cover 0–100.
 */
export const MOODS: Mood[] = [
  { tag: 'struggling', icon: 'alert-circle', label: 'struggling', min: 0, max: 14 },
  { tag: 'anxious',    icon: 'cloud',        label: 'anxious',    min: 15, max: 28 },
  { tag: 'sad',        icon: 'cloud-rain',    label: 'sad',        min: 29, max: 42 },
  { tag: 'neutral',    icon: 'minus',         label: 'neutral',    min: 43, max: 57 },
  { tag: 'calm',       icon: 'wind',          label: 'calm',       min: 58, max: 71 },
  { tag: 'hopeful',    icon: 'trending-up',   label: 'hopeful',    min: 72, max: 85 },
  { tag: 'grateful',   icon: 'sun',           label: 'grateful',   min: 86, max: 100 },
]

/** Legacy mood tags that were removed — map to nearest equivalent. */
const LEGACY_MAP: Record<string, string> = {
  angry: 'struggling',
}

export function findMood(tag: string | null | undefined): Mood | null {
  if (!tag) return null
  const resolved = LEGACY_MAP[tag] ?? tag
  return MOODS.find((m) => m.tag === resolved) ?? null
}

/** Derive a mood tag from a 0–100 slider value. */
export function moodFromValue(value: number): Mood {
  const clamped = Math.max(0, Math.min(100, Math.round(value)))
  return MOODS.find((m) => clamped >= m.min && clamped <= m.max) ?? MOODS[3]
}

/** Get the center value for a mood tag (useful for initializing the slider from legacy data). */
export function valueFromTag(tag: string | null | undefined): number | null {
  const mood = findMood(tag)
  if (!mood) return null
  return Math.round((mood.min + mood.max) / 2)
}
