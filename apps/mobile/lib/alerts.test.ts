import {
  partitionByRead,
  groupRepeats,
  colorForUserId,
  formatTimeAgo,
  isNew,
  type AlertItem,
} from './alerts'

const base: AlertItem = {
  id: 'n1',
  type: 'encouragement',
  payload: { from_user_id: 'u1', from_display_name: 'Sam' },
  read_at: null,
  created_at: new Date().toISOString(),
}

function withTime(id: string, daysAgo: number, extra: Partial<AlertItem> = {}): AlertItem {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  return { ...base, id, created_at: d.toISOString(), ...extra }
}

describe('isNew', () => {
  it('returns true for an unread alert created today', () => {
    expect(isNew(withTime('a', 0))).toBe(true)
  })
  it('returns true for an unread alert created yesterday', () => {
    expect(isNew(withTime('a', 1))).toBe(true)
  })
  it('returns false for an unread alert older than yesterday', () => {
    expect(isNew(withTime('a', 2))).toBe(false)
  })
  it('returns false when the alert is read', () => {
    expect(isNew(withTime('a', 0, { read_at: new Date().toISOString() }))).toBe(false)
  })
})

describe('partitionByRead', () => {
  it('puts unread today/yesterday in `new`, everything else in `earlier`', () => {
    const items = [
      withTime('today-unread', 0),
      withTime('yesterday-unread', 1),
      withTime('older-unread', 5),
      withTime('today-read', 0, { read_at: new Date().toISOString() }),
    ]
    const out = partitionByRead(items)
    expect(out.new.map((i) => i.id)).toEqual(['today-unread', 'yesterday-unread'])
    expect(out.earlier.map((i) => i.id).sort()).toEqual(['older-unread', 'today-read'])
  })

  it('returns empty arrays when input is empty', () => {
    expect(partitionByRead([])).toEqual({ new: [], earlier: [] })
  })
})

describe('groupRepeats', () => {
  it('leaves singletons untouched', () => {
    const items = [
      withTime('a', 0, { type: 'warm_ping', payload: { from_user_id: 'u1' } }),
      withTime('b', 0, { type: 'encouragement', payload: { from_user_id: 'u1' } }),
    ]
    const out = groupRepeats(items)
    expect(out).toHaveLength(2)
    expect(out[0].extras).toEqual([])
    expect(out[1].extras).toEqual([])
  })

  it('collapses 3+ same-sender same-type runs into one row with extras', () => {
    const items = [
      withTime('a', 0, { type: 'warm_ping', payload: { from_user_id: 'u1' } }),
      withTime('b', 0, { type: 'warm_ping', payload: { from_user_id: 'u1' } }),
      withTime('c', 0, { type: 'warm_ping', payload: { from_user_id: 'u1' } }),
      withTime('d', 0, { type: 'encouragement', payload: { from_user_id: 'u1' } }),
    ]
    const out = groupRepeats(items)
    expect(out).toHaveLength(2)
    expect(out[0].item.id).toBe('a')
    expect(out[0].extras.map((e) => e.id)).toEqual(['b', 'c'])
    expect(out[1].item.id).toBe('d')
  })

  it('does not collapse runs of 2', () => {
    const items = [
      withTime('a', 0, { type: 'warm_ping', payload: { from_user_id: 'u1' } }),
      withTime('b', 0, { type: 'warm_ping', payload: { from_user_id: 'u1' } }),
    ]
    const out = groupRepeats(items)
    expect(out).toHaveLength(2)
    expect(out[0].extras).toEqual([])
  })

  it('breaks the run when sender changes', () => {
    const items = [
      withTime('a', 0, { type: 'warm_ping', payload: { from_user_id: 'u1' } }),
      withTime('b', 0, { type: 'warm_ping', payload: { from_user_id: 'u2' } }),
      withTime('c', 0, { type: 'warm_ping', payload: { from_user_id: 'u1' } }),
    ]
    const out = groupRepeats(items)
    expect(out).toHaveLength(3)
  })
})

describe('colorForUserId', () => {
  it('returns the same color for the same id every call', () => {
    expect(colorForUserId('u1')).toBe(colorForUserId('u1'))
  })
  it('returns a hex color string', () => {
    expect(colorForUserId('u1')).toMatch(/^#[0-9a-f]{6}$/i)
  })
  it('returns different colors for distinct ids in the common case', () => {
    const c1 = colorForUserId('alice')
    const c2 = colorForUserId('bob')
    expect(c1).not.toBe(c2)
  })
  it('returns a stable fallback for empty id', () => {
    expect(colorForUserId('')).toMatch(/^#[0-9a-f]{6}$/i)
  })
})

describe('formatTimeAgo', () => {
  it('returns "just now" for under a minute', () => {
    const d = new Date(Date.now() - 30 * 1000).toISOString()
    expect(formatTimeAgo(d)).toBe('just now')
  })
  it('returns minutes for under an hour', () => {
    const d = new Date(Date.now() - 5 * 60 * 1000).toISOString()
    expect(formatTimeAgo(d)).toBe('5m ago')
  })
  it('returns hours for under a day', () => {
    const d = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString()
    expect(formatTimeAgo(d)).toBe('3h ago')
  })
  it('returns days otherwise', () => {
    const d = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString()
    expect(formatTimeAgo(d)).toBe('4d ago')
  })
})
