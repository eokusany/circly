import type { IconName } from '../components/Icon'

export interface Mood {
  tag: string
  icon: IconName
  label: string
}

export const MOODS: Mood[] = [
  { tag: 'grateful', icon: 'sun', label: 'grateful' },
  { tag: 'hopeful', icon: 'trending-up', label: 'hopeful' },
  { tag: 'calm', icon: 'wind', label: 'calm' },
  { tag: 'anxious', icon: 'cloud', label: 'anxious' },
  { tag: 'sad', icon: 'cloud-rain', label: 'sad' },
  { tag: 'angry', icon: 'zap', label: 'angry' },
]

export function findMood(tag: string | null | undefined): Mood | null {
  if (!tag) return null
  return MOODS.find((m) => m.tag === tag) ?? null
}
