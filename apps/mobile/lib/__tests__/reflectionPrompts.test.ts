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
})
