// Pure helpers for the conversations list screen. Kept separate from the
// React component so they can be tested without jest-expo renders.

export interface RawConversation {
  id: string
  participant_ids: string[]
}

export interface RawMessage {
  id: string
  conversation_id: string
  sender_id: string
  body: string
  created_at: string
}

export interface RawParticipant {
  id: string
  display_name: string
}

export interface ConversationRow {
  id: string
  otherId: string | null
  otherName: string
  lastMessageBody: string
  lastMessageAt: string | null
  unread?: boolean
}

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

/** Format a message timestamp for the conversation list row:
 *   - same day    → "HH:MM" (24h)
 *   - yesterday   → "yesterday"
 *   - older       → "Mmm D"
 *   - null/undef  → ""
 * All comparisons are local-time so the label matches the user's clock. */
export function formatConversationTime(
  iso: string | null | undefined,
  now: Date = new Date(),
): string {
  if (!iso) return ''
  const d = new Date(iso)

  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()

  if (sameDay) {
    const hh = String(d.getHours()).padStart(2, '0')
    const mm = String(d.getMinutes()).padStart(2, '0')
    return `${hh}:${mm}`
  }

  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)
  const isYesterday =
    d.getFullYear() === yesterday.getFullYear() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getDate() === yesterday.getDate()

  if (isYesterday) return 'yesterday'

  return `${MONTHS[d.getMonth()]} ${d.getDate()}`
}

/** Transform raw DB rows into display-ready conversation rows, sorted by
 * most recent message (empty conversations sink to the bottom). */
export function buildConversationRows(
  conversations: RawConversation[],
  messages: RawMessage[],
  participants: RawParticipant[],
  meId: string,
): ConversationRow[] {
  const participantById = new Map<string, RawParticipant>()
  for (const p of participants) participantById.set(p.id, p)

  // For each conversation, find the latest message.
  const latestByConvo = new Map<string, RawMessage>()
  for (const m of messages) {
    const prev = latestByConvo.get(m.conversation_id)
    if (!prev || prev.created_at < m.created_at) {
      latestByConvo.set(m.conversation_id, m)
    }
  }

  const rows: ConversationRow[] = conversations.map((c) => {
    const otherId = c.participant_ids.find((id) => id !== meId) ?? null
    const other = otherId ? participantById.get(otherId) : undefined
    const latest = latestByConvo.get(c.id)
    return {
      id: c.id,
      otherId,
      otherName: other?.display_name ?? 'unknown',
      lastMessageBody: latest?.body ?? '',
      lastMessageAt: latest?.created_at ?? null,
    }
  })

  rows.sort((a, b) => {
    if (a.lastMessageAt && b.lastMessageAt) {
      return b.lastMessageAt.localeCompare(a.lastMessageAt)
    }
    if (a.lastMessageAt) return -1
    if (b.lastMessageAt) return 1
    return 0
  })

  return rows
}
