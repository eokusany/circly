import { MOODS, moodFromValue, valueFromTag, findMood } from './mood'

describe('MOODS array', () => {
  it('has 7 moods', () => {
    expect(MOODS).toHaveLength(7)
  })

  it('every mood has a tag, icon, label, min, and max', () => {
    for (const m of MOODS) {
      expect(m.tag).toBeTruthy()
      expect(m.icon).toBeTruthy()
      expect(m.label).toBeTruthy()
      expect(typeof m.min).toBe('number')
      expect(typeof m.max).toBe('number')
    }
  })

  it('has unique tags', () => {
    const tags = MOODS.map((m) => m.tag)
    expect(new Set(tags).size).toBe(tags.length)
  })

  it('covers 0–100 contiguously with no gaps or overlaps', () => {
    expect(MOODS[0].min).toBe(0)
    for (let i = 1; i < MOODS.length; i++) {
      expect(MOODS[i].min).toBe(MOODS[i - 1].max + 1)
    }
    expect(MOODS[MOODS.length - 1].max).toBe(100)
  })

  it('includes the expected tags in order', () => {
    const tags = MOODS.map((m) => m.tag)
    expect(tags).toEqual([
      'struggling',
      'anxious',
      'sad',
      'neutral',
      'calm',
      'hopeful',
      'grateful',
    ])
  })
})

describe('moodFromValue', () => {
  it.each([
    [0, 'struggling'],
    [14, 'struggling'],
    [15, 'anxious'],
    [28, 'anxious'],
    [29, 'sad'],
    [42, 'sad'],
    [43, 'neutral'],
    [57, 'neutral'],
    [58, 'calm'],
    [71, 'calm'],
    [72, 'hopeful'],
    [85, 'hopeful'],
    [86, 'grateful'],
    [100, 'grateful'],
  ])('maps %d to %s', (value, expectedTag) => {
    expect(moodFromValue(value).tag).toBe(expectedTag)
  })

  it('clamps values below 0 to struggling', () => {
    expect(moodFromValue(-10).tag).toBe('struggling')
  })

  it('clamps values above 100 to grateful', () => {
    expect(moodFromValue(150).tag).toBe('grateful')
  })

  it('rounds fractional values before lookup', () => {
    // 14.4 rounds to 14 → struggling; 14.6 rounds to 15 → anxious
    expect(moodFromValue(14.4).tag).toBe('struggling')
    expect(moodFromValue(14.6).tag).toBe('anxious')
  })
})

describe('findMood', () => {
  it('returns the mood for a known tag', () => {
    const mood = findMood('calm')
    expect(mood).not.toBeNull()
    expect(mood!.tag).toBe('calm')
  })

  it('matches each mood in the list', () => {
    for (const mood of MOODS) {
      expect(findMood(mood.tag)).toEqual(mood)
    }
  })

  it('maps legacy tag "angry" to "struggling"', () => {
    const mood = findMood('angry')
    expect(mood).not.toBeNull()
    expect(mood!.tag).toBe('struggling')
  })

  it('returns null for an unknown tag', () => {
    expect(findMood('nonexistent')).toBeNull()
  })

  it('returns null for null or undefined', () => {
    expect(findMood(null)).toBeNull()
    expect(findMood(undefined)).toBeNull()
  })

  it('returns null for empty string', () => {
    expect(findMood('')).toBeNull()
  })

  it('is case-sensitive', () => {
    expect(findMood('Calm')).toBeNull()
  })
})

describe('valueFromTag', () => {
  it('returns center value for each mood tag', () => {
    for (const mood of MOODS) {
      const expected = Math.round((mood.min + mood.max) / 2)
      expect(valueFromTag(mood.tag)).toBe(expected)
    }
  })

  it('resolves legacy tags before computing value', () => {
    // angry → struggling (0–14), center = 7
    expect(valueFromTag('angry')).toBe(7)
  })

  it('returns null for unknown tag', () => {
    expect(valueFromTag('unknown')).toBeNull()
  })

  it('returns null for null or undefined', () => {
    expect(valueFromTag(null)).toBeNull()
    expect(valueFromTag(undefined)).toBeNull()
  })
})
