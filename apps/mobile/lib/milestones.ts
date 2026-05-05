export interface SubstanceMilestone {
  days: number
  label: string
}

export interface LifeMilestone {
  checkins: number
  label: string
}

export const MILESTONES_SUBSTANCE: SubstanceMilestone[] = [
  { days: 1, label: '1 day' },
  { days: 3, label: '3 days' },
  { days: 7, label: '1 week' },
  { days: 14, label: '2 weeks' },
  { days: 30, label: '1 month' },
  { days: 90, label: '3 months' },
  { days: 180, label: '6 months' },
  { days: 365, label: '1 year' },
  { days: 730, label: '2 years' },
  { days: 1095, label: '3 years' },
  { days: 1460, label: '4 years' },
  { days: 1825, label: '5 years' },
]

export const MILESTONES_LIFE: LifeMilestone[] = [
  { checkins: 10, label: '10 check-ins' },
  { checkins: 25, label: '25 check-ins' },
  { checkins: 50, label: '50 check-ins' },
  { checkins: 100, label: '100 check-ins' },
  { checkins: 250, label: '250 check-ins' },
  { checkins: 500, label: '500 check-ins' },
  { checkins: 750, label: '750 check-ins' },
  { checkins: 1000, label: '1000 check-ins' },
  { checkins: 1250, label: '1250 check-ins' },
  { checkins: 1500, label: '1500 check-ins' },
]

export function nextSubstanceMilestone(days: number): SubstanceMilestone | null {
  return MILESTONES_SUBSTANCE.find((m) => days < m.days) ?? null
}

export function nextLifeMilestone(checkins: number): LifeMilestone | null {
  return MILESTONES_LIFE.find((m) => checkins < m.checkins) ?? null
}

export function highestReachedSubstanceDays(days: number): number {
  let highest = 0
  for (const m of MILESTONES_SUBSTANCE) {
    if (days >= m.days) highest = m.days
    else break
  }
  return highest
}

export function highestReachedLifeCheckins(checkins: number): number {
  let highest = 0
  for (const m of MILESTONES_LIFE) {
    if (checkins >= m.checkins) highest = m.checkins
    else break
  }
  return highest
}

export function shouldCelebrateSubstance(
  streakDays: number,
  lastCelebratedDays: number,
): SubstanceMilestone | null {
  if (streakDays <= 0) return null
  const highest = highestReachedSubstanceDays(streakDays)
  if (highest === 0) return null
  if (highest <= lastCelebratedDays) return null
  return MILESTONES_SUBSTANCE.find((m) => m.days === highest) ?? null
}

export function shouldCelebrateLife(
  totalCheckins: number,
  lastCelebratedCheckins: number,
): LifeMilestone | null {
  if (totalCheckins <= 0) return null
  const highest = highestReachedLifeCheckins(totalCheckins)
  if (highest === 0) return null
  if (highest <= lastCelebratedCheckins) return null
  return MILESTONES_LIFE.find((m) => m.checkins === highest) ?? null
}
