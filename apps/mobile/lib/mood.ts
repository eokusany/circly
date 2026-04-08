export interface Mood {
  tag: string
  emoji: string
  label: string
}

export const MOODS: Mood[] = [
  { tag: 'grateful', emoji: '🌿', label: 'grateful' },
  { tag: 'hopeful', emoji: '🌟', label: 'hopeful' },
  { tag: 'calm', emoji: '🌊', label: 'calm' },
  { tag: 'anxious', emoji: '☁️', label: 'anxious' },
  { tag: 'sad', emoji: '🌧', label: 'sad' },
  { tag: 'angry', emoji: '🔥', label: 'angry' },
]

export function findMood(tag: string | null | undefined): Mood | null {
  if (!tag) return null
  return MOODS.find((m) => m.tag === tag) ?? null
}
