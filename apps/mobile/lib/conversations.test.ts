import {
  formatConversationTime,
  buildConversationRows,
  type RawConversation,
  type RawMessage,
  type RawParticipant,
} from './conversations'

describe('formatConversationTime', () => {
  // Use a fixed "now" for deterministic tests. Wed Apr 09 2026 14:30:00 local.
  const now = new Date(2026, 3, 9, 14, 30, 0)

  it('formats same-day timestamps as HH:MM', () => {
    const t = new Date(2026, 3, 9, 9, 5, 0).toISOString()
    expect(formatConversationTime(t, now)).toBe('09:05')
  })

  it('formats same-day afternoon as 24h HH:MM', () => {
    const t = new Date(2026, 3, 9, 14, 29, 30).toISOString()
    expect(formatConversationTime(t, now)).toBe('14:29')
  })

  it('formats midnight as 00:00 on same day', () => {
    const t = new Date(2026, 3, 9, 0, 0, 0).toISOString()
    expect(formatConversationTime(t, now)).toBe('00:00')
  })

  it('formats yesterday as "yesterday"', () => {
    const t = new Date(2026, 3, 8, 23, 59, 0).toISOString()
    expect(formatConversationTime(t, now)).toBe('yesterday')
  })

  it('formats yesterday morning as "yesterday"', () => {
    const t = new Date(2026, 3, 8, 0, 5, 0).toISOString()
    expect(formatConversationTime(t, now)).toBe('yesterday')
  })

  it('formats older timestamps as "Mmm D"', () => {
    const t = new Date(2026, 2, 15, 12, 0, 0).toISOString()
    expect(formatConversationTime(t, now)).toBe('Mar 15')
  })

  it('formats a week ago as "Mmm D"', () => {
    const t = new Date(2026, 3, 2, 12, 0, 0).toISOString()
    expect(formatConversationTime(t, now)).toBe('Apr 2')
  })

  it('returns empty string when timestamp is null', () => {
    expect(formatConversationTime(null, now)).toBe('')
  })

  it('returns empty string when timestamp is undefined', () => {
    expect(formatConversationTime(undefined, now)).toBe('')
  })

  it('uses new Date() as default now', () => {
    // If no now is passed, a same-minute timestamp should still format as HH:MM
    // (not throw). Loose assertion — format check only.
    const t = new Date().toISOString()
    expect(formatConversationTime(t)).toMatch(/^\d{2}:\d{2}$/)
  })
})

describe('buildConversationRows', () => {
  const me = 'me-id'
  const alice: RawParticipant = { id: 'alice-id', display_name: 'Alice' }
  const bob: RawParticipant = { id: 'bob-id', display_name: 'Bob' }

  const convAlice: RawConversation = {
    id: 'conv-1',
    participant_ids: [me, alice.id],
  }
  const convBob: RawConversation = {
    id: 'conv-2',
    participant_ids: [me, bob.id],
  }

  it('returns [] for no conversations', () => {
    expect(buildConversationRows([], [], [], me)).toEqual([])
  })

  it('renders a conversation with no messages yet', () => {
    const rows = buildConversationRows([convAlice], [], [alice], me)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      id: 'conv-1',
      otherName: 'Alice',
      lastMessageBody: '',
      lastMessageAt: null,
    })
  })

  it('attaches the latest message body and time', () => {
    const msg: RawMessage = {
      id: 'm-1',
      conversation_id: 'conv-1',
      sender_id: alice.id,
      body: 'hey',
      created_at: '2026-04-09T10:00:00.000Z',
    }
    const rows = buildConversationRows([convAlice], [msg], [alice], me)
    expect(rows[0].lastMessageBody).toBe('hey')
    expect(rows[0].lastMessageAt).toBe('2026-04-09T10:00:00.000Z')
  })

  it('picks the most recent message when multiple exist', () => {
    const older: RawMessage = {
      id: 'm-1',
      conversation_id: 'conv-1',
      sender_id: alice.id,
      body: 'first',
      created_at: '2026-04-08T10:00:00.000Z',
    }
    const newer: RawMessage = {
      id: 'm-2',
      conversation_id: 'conv-1',
      sender_id: me,
      body: 'latest',
      created_at: '2026-04-09T10:00:00.000Z',
    }
    const rows = buildConversationRows([convAlice], [older, newer], [alice], me)
    expect(rows[0].lastMessageBody).toBe('latest')
    expect(rows[0].lastMessageAt).toBe('2026-04-09T10:00:00.000Z')
  })

  it('sorts conversations by most recent message, newest first', () => {
    const msgAlice: RawMessage = {
      id: 'm-a',
      conversation_id: 'conv-1',
      sender_id: alice.id,
      body: 'a',
      created_at: '2026-04-07T10:00:00.000Z',
    }
    const msgBob: RawMessage = {
      id: 'm-b',
      conversation_id: 'conv-2',
      sender_id: bob.id,
      body: 'b',
      created_at: '2026-04-09T10:00:00.000Z',
    }
    const rows = buildConversationRows(
      [convAlice, convBob],
      [msgAlice, msgBob],
      [alice, bob],
      me,
    )
    expect(rows.map((r) => r.id)).toEqual(['conv-2', 'conv-1'])
  })

  it('puts empty conversations at the bottom', () => {
    const msgAlice: RawMessage = {
      id: 'm-a',
      conversation_id: 'conv-1',
      sender_id: alice.id,
      body: 'hi',
      created_at: '2026-04-09T10:00:00.000Z',
    }
    const rows = buildConversationRows(
      [convBob, convAlice],
      [msgAlice],
      [alice, bob],
      me,
    )
    expect(rows.map((r) => r.id)).toEqual(['conv-1', 'conv-2'])
  })

  it('falls back to "unknown" when the other participant is missing', () => {
    const rows = buildConversationRows([convAlice], [], [], me)
    expect(rows[0].otherName).toBe('unknown')
  })

  it('picks the non-me participant as "other" regardless of array order', () => {
    const reversed: RawConversation = {
      id: 'conv-3',
      participant_ids: [alice.id, me],
    }
    const rows = buildConversationRows([reversed], [], [alice], me)
    expect(rows[0].otherName).toBe('Alice')
  })

  it('ignores messages that belong to other conversations', () => {
    const stray: RawMessage = {
      id: 'stray',
      conversation_id: 'conv-99',
      sender_id: 'someone',
      body: 'noise',
      created_at: '2026-04-09T10:00:00.000Z',
    }
    const rows = buildConversationRows([convAlice], [stray], [alice], me)
    expect(rows[0].lastMessageBody).toBe('')
    expect(rows[0].lastMessageAt).toBeNull()
  })

  it('handles a conversation where I am the only participant', () => {
    const selfOnly: RawConversation = {
      id: 'conv-self',
      participant_ids: [me],
    }
    const rows = buildConversationRows([selfOnly], [], [], me)
    expect(rows[0].otherName).toBe('unknown')
  })

  it('preserves unique conversation ids', () => {
    const rows = buildConversationRows(
      [convAlice, convBob],
      [],
      [alice, bob],
      me,
    )
    const ids = rows.map((r) => r.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
