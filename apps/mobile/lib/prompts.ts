const PROMPTS = [
  "what's one thing you're proud of today?",
  "what felt hard today, and how did you get through it?",
  "write a letter to your future self.",
  "what does your support system mean to you?",
  "describe a moment of peace from today.",
  "what's something you're grateful for right now?",
  "what would you tell someone just starting their journey?",
  "what triggered you today, and what did you do instead?",
  "write about a person who believes in you.",
  "what does recovery mean to you today?",
  "what's a small win you want to remember?",
  "how did you take care of yourself today?",
  "what's something you've forgiven yourself for?",
  "describe how you feel right now in three words, then expand.",
  "what's one boundary you're proud of setting?",
]

/** Returns a deterministic prompt for the given date (same prompt all day). */
export function getPromptForToday(): string {
  const now = new Date()
  const start = new Date(now.getFullYear(), 0, 0)
  const dayOfYear = Math.floor((now.getTime() - start.getTime()) / 86_400_000)
  return PROMPTS[dayOfYear % PROMPTS.length]
}
