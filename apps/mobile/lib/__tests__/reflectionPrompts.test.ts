import { getPromptForDay } from '../reflectionPrompts'

describe('getPromptForDay', () => {
  it('returns a string for day 1', () => {
    const prompt = getPromptForDay(1)
    expect(typeof prompt).toBe('string')
    expect(prompt.length).toBeGreaterThan(10)
  })

  it('returns different prompts for early vs late recovery', () => {
    const early = getPromptForDay(3)
    const late = getPromptForDay(120)
    expect(early).not.toBe(late)
  })

  it('always returns a prompt regardless of day count', () => {
    expect(() => getPromptForDay(0)).not.toThrow()
    expect(() => getPromptForDay(999)).not.toThrow()
  })

  it('returns the same prompt for the same day on repeated calls', () => {
    expect(getPromptForDay(5)).toBe(getPromptForDay(5))
    expect(getPromptForDay(45)).toBe(getPromptForDay(45))
  })

  it('uses early stage for days 1-7 and building for days 8-30', () => {
    const day7 = getPromptForDay(7)
    const day8 = getPromptForDay(8)
    // day 7 is 'early', day 8 is 'building' — they draw from different pools
    // Just verify they come from different pools by checking at least one differs
    // across all 5 prompts in each pool (days 0-4 for early, days 8-12 for building)
    const earlyPrompts = [0,1,2,3,4,5,6].map(d => getPromptForDay(d))
    const buildingPrompts = [8,9,10,11,12,13,14].map(d => getPromptForDay(d))
    expect(earlyPrompts.every(p => !buildingPrompts.includes(p))).toBe(true)
  })

  it('uses established stage for days 31-90 and thriving for day 91+', () => {
    const establishedPrompts = [31,32,33,34,35].map(d => getPromptForDay(d))
    const thrivingPrompts = [91,92,93,94,95].map(d => getPromptForDay(d))
    expect(establishedPrompts.every(p => !thrivingPrompts.includes(p))).toBe(true)
  })
})
