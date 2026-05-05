export interface AlertItem {
  id: string
  type: string
  payload: Record<string, unknown>
  read_at: string | null
  created_at: string
}

export interface GroupedAlert {
  item: AlertItem
  extras: AlertItem[]
}

export function isNew(item: AlertItem): boolean {
  if (item.read_at) return false
  const now = new Date()
  const created = new Date(item.created_at)
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfYesterday = new Date(startOfToday)
  startOfYesterday.setDate(startOfYesterday.getDate() - 1)
  return created >= startOfYesterday
}

export function partitionByRead(items: AlertItem[]): { new: AlertItem[]; earlier: AlertItem[] } {
  const newer: AlertItem[] = []
  const earlier: AlertItem[] = []
  for (const item of items) {
    if (isNew(item)) newer.push(item)
    else earlier.push(item)
  }
  return { new: newer, earlier }
}

export function groupRepeats(items: AlertItem[]): GroupedAlert[] {
  const out: GroupedAlert[] = []
  let i = 0
  while (i < items.length) {
    const head = items[i]
    let j = i + 1
    while (
      j < items.length &&
      items[j].type === head.type &&
      (items[j].payload as { from_user_id?: string }).from_user_id ===
        (head.payload as { from_user_id?: string }).from_user_id
    ) {
      j++
    }
    const runLength = j - i
    if (runLength >= 3) {
      out.push({ item: head, extras: items.slice(i + 1, j) })
    } else {
      for (let k = i; k < j; k++) out.push({ item: items[k], extras: [] })
    }
    i = j
  }
  return out
}

const PALETTE = [
  '#C58A3F',
  '#4ca8a8',
  '#8b5cf6',
  '#5C9E7A',
  '#D6923A',
  '#C65D52',
  '#5B7FBF',
  '#B57BC8',
] as const

export function colorForUserId(id: string): string {
  if (!id) return PALETTE[0]
  let hash = 0
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0
  }
  return PALETTE[hash % PALETTE.length]
}

export function formatTimeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}
