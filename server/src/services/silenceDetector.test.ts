import { describe, it, expect, vi, beforeEach } from 'vitest'

const fromMock = vi.hoisted(() => vi.fn())

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: (...args: unknown[]) => fromMock(...args),
  },
}))

import { detectSilentUsers } from './silenceDetector'

// Helper to build chainable Supabase query mocks.
function listChain(data: unknown[], error: unknown = null) {
  const chain: Record<string, unknown> = {
    select: () => chain,
    eq: () => chain,
    in: () => chain,
    or: () => chain,
    gte: () => chain,
    order: () => chain,
    // Terminal: resolve
    then: (resolve: (v: unknown) => void) => resolve({ data, error }),
  }
  // Make the chain thenable so await works
  return chain
}

function insertMock(error: unknown = null) {
  return { insert: vi.fn().mockResolvedValue({ error }) }
}

// Converts a chain-builder to a Promise-like by wrapping it
function promisify(chain: Record<string, unknown>) {
  return {
    ...chain,
    then: (resolve: (v: unknown) => void, reject?: (v: unknown) => void) => {
      try {
        // Walk the chain
        return Promise.resolve({ data: (chain as { _data: unknown })._data, error: null }).then(resolve, reject)
      } catch (err) {
        if (reject) return reject(err)
        throw err
      }
    },
  }
}

// Simpler approach: mock fromMock to return appropriate data per table
interface TableSetup {
  silence_settings?: unknown[]
  okay_taps?: unknown[]
  check_ins?: unknown[]
  messages?: unknown[]
  relationships?: unknown[]
  notifications_recent?: unknown[]
  notifications_insert_error?: unknown
  users?: unknown[]
}

function wireDetector(setup: TableSetup) {
  const notifInsert = vi.fn().mockResolvedValue({
    error: setup.notifications_insert_error ?? null,
  })

  fromMock.mockImplementation((table: string) => {
    const makeChain = (data: unknown[]) => {
      const result = { data, error: null }
      const chain: Record<string, (...args: unknown[]) => unknown> = {}
      const self = () => chain
      chain.select = self
      chain.eq = self
      chain.in = self
      chain.or = self
      chain.gte = self
      chain.order = self
      // When awaited, resolve with the data
      ;(chain as unknown as { then: (r: (v: unknown) => void) => void }).then = (r) => r(result)
      return chain
    }

    if (table === 'silence_settings') return makeChain(setup.silence_settings ?? [])
    if (table === 'okay_taps') return makeChain(setup.okay_taps ?? [])
    if (table === 'check_ins') return makeChain(setup.check_ins ?? [])
    if (table === 'messages') return makeChain(setup.messages ?? [])
    if (table === 'relationships') return makeChain(setup.relationships ?? [])
    if (table === 'users') return makeChain(setup.users ?? [])
    if (table === 'notifications') {
      // Could be a SELECT (for cooldown check) or INSERT (for sending nudges)
      const chain: Record<string, unknown> = {}
      const self = () => chain
      chain.select = self
      chain.eq = self
      chain.gte = self
      ;(chain as unknown as { then: (r: (v: unknown) => void) => void }).then = (r) =>
        r({ data: setup.notifications_recent ?? [], error: null })
      chain.insert = notifInsert
      return chain
    }
    throw new Error(`unexpected table: ${table}`)
  })

  return { notifInsert }
}

const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
const oneDayAgo = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
const justNow = new Date().toISOString()

describe('detectSilentUsers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns zero when no silence_settings rows exist', async () => {
    wireDetector({ silence_settings: [] })
    const result = await detectSilentUsers()
    expect(result).toEqual({ users_detected: 0, nudges_sent: 0 })
  })

  it('does not flag a user with recent activity', async () => {
    wireDetector({
      silence_settings: [{ user_id: 'u1', silence_threshold_days: 2 }],
      okay_taps: [{ user_id: 'u1', tapped_at: justNow }],
    })
    const result = await detectSilentUsers()
    expect(result).toEqual({ users_detected: 0, nudges_sent: 0 })
  })

  it('flags a user whose last signal is older than their threshold', async () => {
    const { notifInsert } = wireDetector({
      silence_settings: [{ user_id: 'u1', silence_threshold_days: 2 }],
      okay_taps: [{ user_id: 'u1', tapped_at: threeDaysAgo }],
      relationships: [{ recovery_user_id: 'u1', supporter_id: 's1' }],
      users: [{ id: 'u1', display_name: 'Test User' }],
    })
    const result = await detectSilentUsers()
    expect(result.users_detected).toBe(1)
    expect(result.nudges_sent).toBe(1)
    expect(notifInsert).toHaveBeenCalledTimes(1)

    const rows = notifInsert.mock.calls[0][0] as Array<{
      recipient_id: string
      type: string
      payload: Record<string, unknown>
    }>
    expect(rows[0].recipient_id).toBe('s1')
    expect(rows[0].type).toBe('silence_nudge')
    expect(rows[0].payload.from_display_name).toBe('Test User')
    expect(rows[0].payload.for_user_id).toBe('u1')
  })

  it('does not flag a user with no signals (new user)', async () => {
    wireDetector({
      silence_settings: [{ user_id: 'u1', silence_threshold_days: 2 }],
      // No taps, check-ins, or messages
    })
    const result = await detectSilentUsers()
    expect(result).toEqual({ users_detected: 0, nudges_sent: 0 })
  })

  it('respects the 48h cooldown per supporter', async () => {
    const { notifInsert } = wireDetector({
      silence_settings: [{ user_id: 'u1', silence_threshold_days: 2 }],
      okay_taps: [{ user_id: 'u1', tapped_at: threeDaysAgo }],
      relationships: [{ recovery_user_id: 'u1', supporter_id: 's1' }],
      users: [{ id: 'u1', display_name: 'Test' }],
      notifications_recent: [
        { recipient_id: 's1', payload: { for_user_id: 'u1' } },
      ],
    })
    const result = await detectSilentUsers()
    expect(result.users_detected).toBe(1)
    expect(result.nudges_sent).toBe(0)
    expect(notifInsert).not.toHaveBeenCalled()
  })

  it('nudges multiple supporters for one silent user', async () => {
    const { notifInsert } = wireDetector({
      silence_settings: [{ user_id: 'u1', silence_threshold_days: 2 }],
      check_ins: [{ user_id: 'u1', created_at: threeDaysAgo }],
      relationships: [
        { recovery_user_id: 'u1', supporter_id: 's1' },
        { recovery_user_id: 'u1', supporter_id: 's2' },
      ],
      users: [{ id: 'u1', display_name: 'Test' }],
    })
    const result = await detectSilentUsers()
    expect(result.nudges_sent).toBe(2)
    const rows = notifInsert.mock.calls[0][0] as unknown[]
    expect(rows).toHaveLength(2)
  })

  it('returns zero nudges when silent user has no supporters', async () => {
    wireDetector({
      silence_settings: [{ user_id: 'u1', silence_threshold_days: 2 }],
      okay_taps: [{ user_id: 'u1', tapped_at: threeDaysAgo }],
      relationships: [],
      users: [{ id: 'u1', display_name: 'Test' }],
    })
    const result = await detectSilentUsers()
    expect(result.users_detected).toBe(1)
    expect(result.nudges_sent).toBe(0)
  })

  it('uses the most recent signal across all three tables', async () => {
    // Check-in is 3 days ago (past threshold), but message is recent
    wireDetector({
      silence_settings: [{ user_id: 'u1', silence_threshold_days: 2 }],
      check_ins: [{ user_id: 'u1', created_at: threeDaysAgo }],
      messages: [{ sender_id: 'u1', created_at: justNow }],
    })
    const result = await detectSilentUsers()
    expect(result.users_detected).toBe(0)
  })
})
