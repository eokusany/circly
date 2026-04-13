export type TimeOfDay = 'morning' | 'day' | 'evening' | 'night'

/** Returns the current time-of-day period for ambient theming. */
export function useTimeOfDay(): TimeOfDay {
  const hour = new Date().getHours()

  if (hour >= 5 && hour < 11) return 'morning'
  if (hour >= 11 && hour < 17) return 'day'
  if (hour >= 17 && hour < 21) return 'evening'
  return 'night'
}

/**
 * Returns a subtle RGBA tint color to overlay on the journal entry surface.
 * Very low opacity (3–5%) so it's felt more than seen.
 */
export function getTimeTint(period: TimeOfDay): string {
  switch (period) {
    case 'morning':
      return 'rgba(214, 146, 58, 0.04)'   // warm golden
    case 'day':
      return 'rgba(0, 0, 0, 0)'            // no tint
    case 'evening':
      return 'rgba(197, 138, 63, 0.035)'   // soft amber
    case 'night':
      return 'rgba(100, 120, 160, 0.04)'   // cool blue
  }
}
