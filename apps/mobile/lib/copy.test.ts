// Mock the auth store so copy.ts doesn't pull in zustand + supabase at import.
jest.mock('../store/auth', () => ({
  useAuthStore: jest.fn(() => null),
}))

import { COPY, DEFAULT_CONTEXT, useCopy } from './copy'

describe('COPY map', () => {
  it('has exactly the expected contexts', () => {
    expect(Object.keys(COPY).sort()).toEqual(['family', 'recovery'])
  })

  it('default context is recovery', () => {
    expect(DEFAULT_CONTEXT).toBe('recovery')
  })

  describe('recovery context', () => {
    const rc = COPY.recovery

    it('exposes all three roles', () => {
      expect(rc.roles).toEqual(['recovery', 'supporter', 'sponsor'])
    })

    it('has a label, description, and emoji for every role', () => {
      for (const role of rc.roles) {
        expect(rc.roleCopy[role].label).toBeTruthy()
        expect(rc.roleCopy[role].description).toBeTruthy()
        expect(rc.roleCopy[role].icon).toBeTruthy()
      }
    })

    it('uses "sober for" as the streak label', () => {
      expect(rc.dashboard.streakLabel).toBe('sober for')
    })

    it('has the three check-in statuses', () => {
      const statuses = Object.keys(rc.dashboard.checkInStatuses).sort()
      expect(statuses).toEqual(['good_day', 'sober', 'struggling'])
    })

    it('journalLabel is "journal"', () => {
      expect(rc.dashboard.journalLabel).toBe('journal')
    })

    it('contextCard has label/description/emoji', () => {
      expect(rc.contextCard.label).toBeTruthy()
      expect(rc.contextCard.description).toBeTruthy()
      expect(rc.contextCard.icon).toBeTruthy()
    })
  })

  describe('family context', () => {
    const fc = COPY.family

    it('exposes only recovery + supporter (no sponsor)', () => {
      expect(fc.roles).toEqual(['recovery', 'supporter'])
    })

    it('uses "connected for" as the streak label', () => {
      expect(fc.dashboard.streakLabel).toBe('connected for')
    })

    it('uses "reflections" as the journal label', () => {
      expect(fc.dashboard.journalLabel).toBe('reflections')
    })

    it('still has sponsor copy for type safety even though it is not surfaced', () => {
      expect(fc.roleCopy.sponsor).toBeDefined()
      expect(fc.roleCopy.sponsor.label).toBeTruthy()
    })

    it('relabels recovery role as "the person at the center"', () => {
      expect(fc.roleCopy.recovery.label).toBe('the person at the center')
    })

    it('relabels supporter role as "family member"', () => {
      expect(fc.roleCopy.supporter.label).toBe('family member')
    })

    it('has distinct check-in labels from recovery', () => {
      expect(fc.dashboard.checkInStatuses.good_day.label).not.toBe(
        COPY.recovery.dashboard.checkInStatuses.good_day.label,
      )
    })
  })

  describe('shape invariants across contexts', () => {
    for (const ctx of ['recovery', 'family'] as const) {
      it(`${ctx} has a non-empty roleSelect title and subtitle`, () => {
        expect(COPY[ctx].roleSelect.title).toBeTruthy()
        expect(COPY[ctx].roleSelect.subtitle).toBeTruthy()
      })

      it(`${ctx} has a non-empty signUpSubtitle`, () => {
        expect(COPY[ctx].signUpSubtitle).toBeTruthy()
      })

      it(`${ctx} has all three checkInStatuses`, () => {
        const s = COPY[ctx].dashboard.checkInStatuses
        expect(s.good_day).toBeDefined()
        expect(s.sober).toBeDefined()
        expect(s.struggling).toBeDefined()
      })

      it(`${ctx} has a getSupportLabel`, () => {
        expect(COPY[ctx].dashboard.getSupportLabel).toBe('get support')
      })
    }
  })
})

describe('useCopy', () => {
  it('falls back to the default (recovery) copy when user context is null', () => {
    const copy = useCopy()
    expect(copy).toBe(COPY.recovery)
  })
})
