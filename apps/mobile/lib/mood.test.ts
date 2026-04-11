import { MOODS, findMood, type Mood } from './mood'

describe('MOODS constant', () => {
  it('exposes exactly 6 moods', () => {
    expect(MOODS).toHaveLength(6)
  })

  it('every mood has a tag, emoji, and label', () => {
    for (const m of MOODS) {
      expect(m.tag).toBeTruthy()
      expect(m.icon).toBeTruthy()
      expect(m.label).toBeTruthy()
    }
  })

  it('has unique tags', () => {
    const tags = MOODS.map((m) => m.tag)
    expect(new Set(tags).size).toBe(tags.length)
  })

  it('includes the expected core moods', () => {
    const tags = MOODS.map((m) => m.tag)
    expect(tags).toEqual([
      'grateful',
      'hopeful',
      'calm',
      'anxious',
      'sad',
      'angry',
    ])
  })

  it('labels match tags (single-word vocabulary)', () => {
    for (const m of MOODS) {
      expect(m.label).toBe(m.tag)
    }
  })
})

describe('findMood', () => {
  it('returns the mood when the tag matches', () => {
    const m = findMood('grateful')
    expect(m).not.toBeNull()
    expect((m as Mood).tag).toBe('grateful')
    expect((m as Mood).icon).toBe('sun')
  })

  it('matches each mood in the list', () => {
    for (const mood of MOODS) {
      expect(findMood(mood.tag)).toEqual(mood)
    }
  })

  it('returns null for an unknown tag', () => {
    expect(findMood('ecstatic')).toBeNull()
  })

  it('returns null for null input', () => {
    expect(findMood(null)).toBeNull()
  })

  it('returns null for undefined input', () => {
    expect(findMood(undefined)).toBeNull()
  })

  it('returns null for empty string', () => {
    expect(findMood('')).toBeNull()
  })

  it('is case-sensitive', () => {
    expect(findMood('Grateful')).toBeNull()
    expect(findMood('GRATEFUL')).toBeNull()
  })

  it('does not match partial strings', () => {
    expect(findMood('grat')).toBeNull()
    expect(findMood('gratefull')).toBeNull()
  })
})
