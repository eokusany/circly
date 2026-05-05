import {
  MILESTONES_SUBSTANCE,
  MILESTONES_LIFE,
  nextSubstanceMilestone,
  nextLifeMilestone,
  shouldCelebrateSubstance,
  shouldCelebrateLife,
  highestReachedSubstanceDays,
  highestReachedLifeCheckins,
  type SubstanceMilestone,
  type LifeMilestone,
} from './milestones'

describe('MILESTONES_SUBSTANCE', () => {
  it('matches the spec schedule (1d, 3d, 1w, 2w, 1m, 3m, 6m, 1y, then yearly)', () => {
    expect(MILESTONES_SUBSTANCE.map((m) => m.days)).toEqual([
      1, 3, 7, 14, 30, 90, 180, 365, 730, 1095, 1460, 1825,
    ])
  })

  it('is sorted ascending', () => {
    for (let i = 1; i < MILESTONES_SUBSTANCE.length; i++) {
      expect(MILESTONES_SUBSTANCE[i].days).toBeGreaterThan(
        MILESTONES_SUBSTANCE[i - 1].days,
      )
    }
  })

  it('every entry has a non-empty label', () => {
    for (const m of MILESTONES_SUBSTANCE) {
      expect(m.label.length).toBeGreaterThan(0)
    }
  })
})

describe('MILESTONES_LIFE', () => {
  it('matches the spec schedule (10, 25, 50, 100, 250, 500, then +250)', () => {
    expect(MILESTONES_LIFE.map((m) => m.checkins)).toEqual([
      10, 25, 50, 100, 250, 500, 750, 1000, 1250, 1500,
    ])
  })

  it('is sorted ascending', () => {
    for (let i = 1; i < MILESTONES_LIFE.length; i++) {
      expect(MILESTONES_LIFE[i].checkins).toBeGreaterThan(
        MILESTONES_LIFE[i - 1].checkins,
      )
    }
  })
})

describe('nextSubstanceMilestone', () => {
  it('returns 1d at day 0', () => {
    expect(nextSubstanceMilestone(0)?.days).toBe(1)
  })
  it('returns 3d at day 1', () => {
    expect(nextSubstanceMilestone(1)?.days).toBe(3)
  })
  it('returns 7d at day 3', () => {
    expect(nextSubstanceMilestone(3)?.days).toBe(7)
  })
  it('returns null past the last entry in the static list', () => {
    expect(nextSubstanceMilestone(99999)).toBeNull()
  })
})

describe('nextLifeMilestone', () => {
  it('returns 10 for a brand-new user (0 check-ins)', () => {
    expect(nextLifeMilestone(0)?.checkins).toBe(10)
  })
  it('returns 25 right after 10 is hit', () => {
    expect(nextLifeMilestone(10)?.checkins).toBe(25)
  })
  it('returns 100 at 50', () => {
    expect(nextLifeMilestone(50)?.checkins).toBe(100)
  })
  it('returns null past the last entry in the static list', () => {
    expect(nextLifeMilestone(99999)).toBeNull()
  })
})

describe('shouldCelebrateSubstance', () => {
  it('returns null when streak is 0', () => {
    expect(shouldCelebrateSubstance(0, 0)).toBeNull()
  })

  it('returns the 1d milestone on day 1 when nothing celebrated yet', () => {
    const m = shouldCelebrateSubstance(1, 0)
    expect(m?.days).toBe(1)
  })

  it('returns the 7d milestone at day 7 when last celebrated was 3', () => {
    const m = shouldCelebrateSubstance(7, 3)
    expect(m?.days).toBe(7)
  })

  it('returns null when the highest applicable milestone has already been celebrated', () => {
    expect(shouldCelebrateSubstance(7, 7)).toBeNull()
  })

  it('returns the highest reached but not yet celebrated when several were skipped', () => {
    const m = shouldCelebrateSubstance(30, 1)
    expect(m?.days).toBe(30)
  })

  it('is not triggered between milestones', () => {
    expect(shouldCelebrateSubstance(15, 14)).toBeNull()
  })

  it('handles a year boundary cleanly', () => {
    expect(shouldCelebrateSubstance(365, 180)?.days).toBe(365)
    expect(shouldCelebrateSubstance(365, 365)).toBeNull()
  })
})

describe('shouldCelebrateLife', () => {
  it('returns null at 0 check-ins', () => {
    expect(shouldCelebrateLife(0, 0)).toBeNull()
  })

  it('returns null at 9 check-ins', () => {
    expect(shouldCelebrateLife(9, 0)).toBeNull()
  })

  it('returns the 10-checkin milestone at exactly 10', () => {
    expect(shouldCelebrateLife(10, 0)?.checkins).toBe(10)
  })

  it('returns null when 10 has already been celebrated', () => {
    expect(shouldCelebrateLife(10, 10)).toBeNull()
  })

  it('returns the highest reached but not yet celebrated when several were skipped', () => {
    expect(shouldCelebrateLife(110, 25)?.checkins).toBe(100)
  })

  it('returns 750 at 750 check-ins (the +250 cadence after 500)', () => {
    expect(shouldCelebrateLife(750, 500)?.checkins).toBe(750)
  })
})

describe('highestReachedSubstanceDays', () => {
  it('returns 0 at day 0', () => {
    expect(highestReachedSubstanceDays(0)).toBe(0)
  })
  it('returns 1 at day 1', () => {
    expect(highestReachedSubstanceDays(1)).toBe(1)
  })
  it('returns 3 at day 5', () => {
    expect(highestReachedSubstanceDays(5)).toBe(3)
  })
  it('returns 30 at day 60', () => {
    expect(highestReachedSubstanceDays(60)).toBe(30)
  })
})

describe('highestReachedLifeCheckins', () => {
  it('returns 0 at 0 check-ins', () => {
    expect(highestReachedLifeCheckins(0)).toBe(0)
  })
  it('returns 0 at 9 check-ins', () => {
    expect(highestReachedLifeCheckins(9)).toBe(0)
  })
  it('returns 10 at 24 check-ins', () => {
    expect(highestReachedLifeCheckins(24)).toBe(10)
  })
  it('returns 500 at 600 check-ins', () => {
    expect(highestReachedLifeCheckins(600)).toBe(500)
  })
})

describe('SubstanceMilestone and LifeMilestone types are exported', () => {
  it('compile-time check (smoke)', () => {
    const a: SubstanceMilestone = { days: 1, label: '1 day' }
    const b: LifeMilestone = { checkins: 10, label: '10 check-ins' }
    expect(a.days).toBe(1)
    expect(b.checkins).toBe(10)
  })
})
