export const lines = [
  "You showed up today.",
  "One day at a time still counts.",
  "Small streaks become new lives.",
  "You made it through today.",
  "Every moment of strength matters.",
  "Progress isn't always linear, and that's okay.",
  "You're exactly where you need to be.",
  "Your effort today is enough.",
  "Showing up is the hardest part, and you did it.",
  "This day is one of many you'll survive.",
] as const

export function pickEncouragement(dayOfYear: number): string {
  return lines[dayOfYear % lines.length]
}
