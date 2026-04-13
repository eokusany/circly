import { getTimeTint, TimeOfDay } from './useTimeOfDay'

describe('getTimeTint', () => {
  const periods: TimeOfDay[] = ['morning', 'day', 'evening', 'night']

  it.each(periods)('returns a valid rgba string for "%s"', (period) => {
    const tint = getTimeTint(period)
    expect(tint).toMatch(/^rgba\(\d+,\s*\d+,\s*\d+,\s*[\d.]+\)$/)
  })

  it('returns fully transparent for "day"', () => {
    expect(getTimeTint('day')).toBe('rgba(0, 0, 0, 0)')
  })

  it('returns distinct values for morning, evening, and night', () => {
    const tints = new Set([
      getTimeTint('morning'),
      getTimeTint('evening'),
      getTimeTint('night'),
    ])
    expect(tints.size).toBe(3)
  })
})
