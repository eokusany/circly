import { pickEncouragement, lines } from './encouragements'

describe('encouragements', () => {
  it('same input always returns same string', () => {
    const first = pickEncouragement(42)
    const second = pickEncouragement(42)
    expect(first).toBe(second)
  })

  it('cycles through all lines and wraps', () => {
    // Test that we cycle through all lines in order, then wrap back to the start
    for (let i = 0; i < lines.length + 5; i++) {
      const current = pickEncouragement(i)
      const wrapped = pickEncouragement(i + lines.length)
      expect(current).toBe(wrapped)
    }
  })

  it('never returns undefined', () => {
    const testValues = [0, 364, 365, 999, 10000]
    for (const value of testValues) {
      const result = pickEncouragement(value)
      expect(result).toBeDefined()
      expect(typeof result).toBe('string')
    }
  })
})
