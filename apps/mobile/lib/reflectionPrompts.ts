type Stage = 'early' | 'building' | 'established' | 'thriving'

function stageFor(days: number): Stage {
  if (days <= 7)  return 'early'
  if (days <= 30) return 'building'
  if (days <= 90) return 'established'
  return 'thriving'
}

const PROMPTS: Record<Stage, string[]> = {
  early: [
    "What's one small thing you did today to take care of yourself?",
    "What does getting through today feel like?",
    "Who or what helped you get through the last 24 hours?",
    "What does this first step mean to you?",
    "What's one thing you want to remember about today?",
  ],
  building: [
    "What's getting easier compared to week one?",
    "What moment this week are you most proud of?",
    "What does your support system look like right now?",
    "What's one habit that's starting to feel natural?",
    "What would you tell yourself from 30 days ago?",
  ],
  established: [
    "What's one thing that felt easier today than a month ago?",
    "When did you feel most like yourself this week?",
    "What's a challenge you navigated that you wouldn't have before?",
    "How has your relationship with yourself changed?",
    "What are you building toward right now?",
  ],
  thriving: [
    "What does your life look like that you couldn't have imagined at day one?",
    "Who in your life has noticed a difference in you?",
    "What does thriving mean to you today?",
    "What do you want the next 90 days to look like?",
    "What would you tell someone on day one?",
  ],
}

export function getPromptForDay(days: number): string {
  const safeDays = Math.max(0, days)
  const stage = stageFor(safeDays)
  const pool = PROMPTS[stage]
  return pool[safeDays % pool.length]
}
