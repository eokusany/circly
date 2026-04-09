import {
  parseISODate,
  toISODate,
  daysBetween,
  streakDays,
  isMilestoneReached,
  nextMilestone,
  MILESTONES,
  type Milestone,
} from './streak'

describe('parseISODate', () => {
  it('parses a standard ISO YYYY-MM-DD', () => {
    const d = parseISODate('2024-03-15')
    expect(d.getFullYear()).toBe(2024)
    expect(d.getMonth()).toBe(2) // March = index 2
    expect(d.getDate()).toBe(15)
  })

  it('creates a local midnight Date (no UTC shift)', () => {
    const d = parseISODate('2024-01-01')
    expect(d.getHours()).toBe(0)
    expect(d.getMinutes()).toBe(0)
  })

  it('handles single-digit-padded months and days', () => {
    const d = parseISODate('2024-01-05')
    expect(d.getMonth()).toBe(0)
    expect(d.getDate()).toBe(5)
  })

  it('handles leap year Feb 29', () => {
    const d = parseISODate('2024-02-29')
    expect(d.getMonth()).toBe(1)
    expect(d.getDate()).toBe(29)
  })

  it('handles December 31', () => {
    const d = parseISODate('2024-12-31')
    expect(d.getMonth()).toBe(11)
    expect(d.getDate()).toBe(31)
  })

  it('handles January 1', () => {
    const d = parseISODate('2024-01-01')
    expect(d.getMonth()).toBe(0)
    expect(d.getDate()).toBe(1)
  })
})

describe('toISODate', () => {
  it('formats a basic date', () => {
    expect(toISODate(new Date(2024, 2, 15))).toBe('2024-03-15')
  })

  it('pads single-digit months', () => {
    expect(toISODate(new Date(2024, 0, 1))).toBe('2024-01-01')
  })

  it('pads single-digit days', () => {
    expect(toISODate(new Date(2024, 8, 5))).toBe('2024-09-05')
  })

  it('handles December', () => {
    expect(toISODate(new Date(2024, 11, 31))).toBe('2024-12-31')
  })

  it('round-trips with parseISODate', () => {
    const iso = '2024-07-04'
    expect(toISODate(parseISODate(iso))).toBe(iso)
  })

  it('round-trips through many dates', () => {
    for (const iso of ['2020-02-29', '1999-12-31', '2026-04-09', '2000-01-01']) {
      expect(toISODate(parseISODate(iso))).toBe(iso)
    }
  })
})

describe('daysBetween', () => {
  it('returns 0 for the same date', () => {
    const d = new Date(2024, 0, 1)
    expect(daysBetween(d, d)).toBe(0)
  })

  it('returns 1 for consecutive days', () => {
    expect(daysBetween(new Date(2024, 0, 1), new Date(2024, 0, 2))).toBe(1)
  })

  it('returns 7 for one week', () => {
    expect(daysBetween(new Date(2024, 0, 1), new Date(2024, 0, 8))).toBe(7)
  })

  it('returns 30 across a month boundary', () => {
    expect(daysBetween(new Date(2024, 0, 1), new Date(2024, 0, 31))).toBe(30)
  })

  it('returns 365 for a non-leap year', () => {
    expect(daysBetween(new Date(2023, 0, 1), new Date(2024, 0, 1))).toBe(365)
  })

  it('returns 366 for a leap year', () => {
    expect(daysBetween(new Date(2024, 0, 1), new Date(2025, 0, 1))).toBe(366)
  })

  it('ignores the time-of-day component', () => {
    const a = new Date(2024, 0, 1, 23, 59, 59)
    const b = new Date(2024, 0, 2, 0, 0, 1)
    expect(daysBetween(a, b)).toBe(1)
  })

  it('returns a negative number when end precedes start', () => {
    expect(daysBetween(new Date(2024, 0, 5), new Date(2024, 0, 1))).toBe(-4)
  })

  it('returns whole-day counts for multi-week spans', () => {
    expect(daysBetween(new Date(2024, 5, 1), new Date(2024, 5, 22))).toBe(21)
  })

  it('ignores fractional seconds', () => {
    const a = new Date(2024, 0, 1, 0, 0, 0, 500)
    const b = new Date(2024, 0, 2, 0, 0, 0, 0)
    expect(daysBetween(a, b)).toBe(1)
  })
})

describe('streakDays', () => {
  it('returns 1 on the start day itself', () => {
    const start = '2024-06-01'
    const today = new Date(2024, 5, 1)
    expect(streakDays(start, today)).toBe(1)
  })

  it('returns 2 the day after the start day', () => {
    expect(streakDays('2024-06-01', new Date(2024, 5, 2))).toBe(2)
  })

  it('returns 7 after one week', () => {
    expect(streakDays('2024-06-01', new Date(2024, 5, 7))).toBe(7)
  })

  it('returns 31 after 30 days (inclusive of start)', () => {
    expect(streakDays('2024-06-01', new Date(2024, 6, 1))).toBe(31)
  })

  it('never goes negative when today is before the start', () => {
    expect(streakDays('2024-06-01', new Date(2024, 4, 15))).toBe(0)
  })

  it('returns 0 for exactly one day before the start', () => {
    expect(streakDays('2024-06-01', new Date(2024, 4, 31))).toBe(0)
  })

  it('defaults to today() when no reference date is given', () => {
    const todayIso = toISODate(new Date())
    expect(streakDays(todayIso)).toBe(1)
  })

  it('returns 366 for a full leap year', () => {
    expect(streakDays('2024-01-01', new Date(2024, 11, 31))).toBe(366)
  })
})

describe('isMilestoneReached', () => {
  const day: Milestone = { type: '1d', label: '1 day', days: 1 }
  const week: Milestone = { type: '7d', label: '1 week', days: 7 }

  it('returns true when days equals the milestone', () => {
    expect(isMilestoneReached(1, day)).toBe(true)
    expect(isMilestoneReached(7, week)).toBe(true)
  })

  it('returns true when days exceeds the milestone', () => {
    expect(isMilestoneReached(100, week)).toBe(true)
  })

  it('returns false when days is below the milestone', () => {
    expect(isMilestoneReached(0, day)).toBe(false)
    expect(isMilestoneReached(6, week)).toBe(false)
  })

  it('is inclusive at the boundary', () => {
    expect(isMilestoneReached(7, week)).toBe(true)
    expect(isMilestoneReached(7 - 0.001, week)).toBe(false)
  })
})

describe('nextMilestone', () => {
  it('returns 1d for a brand new streak', () => {
    expect(nextMilestone(0)?.type).toBe('1d')
  })

  it('returns 7d after 1 day reached', () => {
    expect(nextMilestone(1)?.type).toBe('7d')
  })

  it('returns 7d at day 6', () => {
    expect(nextMilestone(6)?.type).toBe('7d')
  })

  it('returns 30d at day 7', () => {
    expect(nextMilestone(7)?.type).toBe('30d')
  })

  it('returns 90d at day 30', () => {
    expect(nextMilestone(30)?.type).toBe('90d')
  })

  it('returns 1y at day 90', () => {
    expect(nextMilestone(90)?.type).toBe('1y')
  })

  it('returns null when every milestone has been reached', () => {
    expect(nextMilestone(365)).toBeNull()
    expect(nextMilestone(10_000)).toBeNull()
  })
})

describe('MILESTONES constant', () => {
  it('is sorted ascending by days', () => {
    for (let i = 1; i < MILESTONES.length; i++) {
      expect(MILESTONES[i].days).toBeGreaterThan(MILESTONES[i - 1].days)
    }
  })

  it('has unique types', () => {
    const types = MILESTONES.map((m) => m.type)
    expect(new Set(types).size).toBe(types.length)
  })

  it('includes 1d, 7d, 30d, 90d, 1y', () => {
    const types = MILESTONES.map((m) => m.type)
    expect(types).toEqual(['1d', '7d', '30d', '90d', '1y'])
  })

  it('every milestone has a positive days count', () => {
    for (const m of MILESTONES) {
      expect(m.days).toBeGreaterThan(0)
    }
  })
})
