import { describe, it, expect } from 'vitest'
import { moodFromValue, findMood, MOODS } from '../mood'

describe('mood scale', () => {
  it('top end tag is thriving', () => {
    expect(MOODS[MOODS.length - 1].tag).toBe('thriving')
  })

  it('moodFromValue(100) returns thriving', () => {
    expect(moodFromValue(100).tag).toBe('thriving')
  })

  it('moodFromValue(0) returns struggling', () => {
    expect(moodFromValue(0).tag).toBe('struggling')
  })

  it('legacy grateful tag resolves to thriving', () => {
    expect(findMood('grateful')?.tag).toBe('thriving')
  })

  it('ranges are contiguous from 0 to 100', () => {
    for (let i = 0; i < MOODS.length - 1; i++) {
      expect(MOODS[i].max + 1).toBe(MOODS[i + 1].min)
    }
    expect(MOODS[0].min).toBe(0)
    expect(MOODS[MOODS.length - 1].max).toBe(100)
  })
})
