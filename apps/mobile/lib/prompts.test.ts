import { getPromptForToday } from './prompts'

describe('getPromptForToday', () => {
  it('returns a non-empty string', () => {
    const prompt = getPromptForToday()
    expect(typeof prompt).toBe('string')
    expect(prompt.length).toBeGreaterThan(0)
  })

  it('returns the same prompt when called twice on the same day', () => {
    const first = getPromptForToday()
    const second = getPromptForToday()
    expect(first).toBe(second)
  })

  it('returns a prompt that ends with a period or question mark', () => {
    const prompt = getPromptForToday()
    expect(prompt).toMatch(/[.?]$/)
  })
})
