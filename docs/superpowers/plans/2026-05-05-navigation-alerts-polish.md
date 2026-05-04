# Navigation, Alerts, and Profile Picture Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Spec:** [`docs/superpowers/specs/2026-05-04-navigation-alerts-polish-design.md`](../specs/2026-05-04-navigation-alerts-polish-design.md)

**Goal:** Rebalance the recovery and supporter tab bars (5/4 items, center floating check-in for recovery), introduce an `AppHeader` with avatar/wordmark/right-icons, redesign the alerts screen (sender avatars, type-colored borders, NEW/EARLIER sections, grouped repeats, tap-to-read), and wire profile picture support (display + upload) on top of the existing `users.avatar_url` column.

**Architecture:** Three new shared components (`Avatar`, `AppHeader`, plus a tab bar `CenterCheckInButton`) own the visual layer. A new pure helper module (`lib/alerts.ts`) handles unread/read partitioning, NEW/EARLIER section grouping, repeat collapsing, and per-user color hashing — all unit tested. The notifications query is widened to embed `users(display_name, avatar_url)` for the sender (joined through `payload.from_user_id`). A new migration creates a public `avatars` storage bucket with per-user RLS for upload/read. A new profile screen ("edit photo") uses `expo-image-picker` to pick/upload and update `users.avatar_url`.

**Tech Stack:** React Native 0.81, Expo SDK 54, Expo Router 6, TypeScript, Supabase JS 2, Zustand, jest-expo, `@testing-library/react-native`, Feather icons (via `@expo/vector-icons`), `expo-image-picker` (to be added).

---

## Spec → Code Translation Notes

The spec references `AppHeader.tsx`, `CheckInActivityCard`, `SilenceAlertCard`, and `SharedIntentionCard`. None of these exist in the current codebase. The actual situation:

- There is **no** shared `AppHeader.tsx` today. The greeting/avatar/icon row lives inline at the top of `apps/mobile/app/(recovery)/index.tsx` and `apps/mobile/app/(supporter)/index.tsx`. This plan **creates** `apps/mobile/components/AppHeader.tsx` and adopts it on both home screens.
- The supporter feed cards mentioned in spec section 5.2 are actually `PersonCard`, `EmergencyCard`, and `NudgeCard` defined inline in `apps/mobile/app/(supporter)/index.tsx`. `PersonCard` already renders an initials avatar (lines 477-479). This plan replaces those initials blobs with the new `<Avatar />` component so that profile pictures appear automatically.
- The recovery tab bar currently has five visible tabs: `index` (home), `journal`, `chat` (messages), `notifications` (alerts), `profile`. The spec's target is `Home · Journal · [check-in] · Alerts · Add`. So this plan: hides `chat` and `profile` from the tab bar, adds a `check-in` tab in the center (rendered by a custom `tabBarButton`), and adds an `add` tab that pushes to `/(recovery)/settings`. Messages move to the header (Messages icon).
- The supporter tab bar currently has: `index` (home), `chat` (messages), `notifications` (alerts), `profile`. The spec's target is `Home · Connections · Alerts · Add`. There is no separate "connections" route today — the `index` screen is the connections list. This plan keeps `index` labeled `home` per spec section 2.2 ("Home · Connections · Alerts · Add" lists Home and Connections separately, but the supporter index screen IS the connections list, so the spec wording is a four-item layout = home/connections/alerts/add). To stay literal, we relabel `index` to "circle" (matches the existing "your circle" copy) and add the `add` tab pointing at `/(supporter)/invite`. Messages and Profile move out of the tab bar (messages → header, profile → header avatar).
- The notifications table has `read_at timestamptz` (not `is_read boolean`) per `001_initial_schema.sql:140`. The existing `NotificationList.tsx` already calls `markAsRead()` on tap (line 326). This plan reuses that path; the spec's "tap = mark as read" is already in place and only needs the new visual states.
- The spec mentions "Encouragement → amber, Warm ping → teal, Message → purple". Today the `NotificationList` uses `accent` (amber) for both. This plan introduces `TYPE_COLOR` mapping with explicit hex values for teal (`#4ca8a8`) and purple (`#8b5cf6`) per spec.
- `expo-image-picker` is **not** in `apps/mobile/package.json`. Task 11 installs it via `npx expo install expo-image-picker`.
- The notifications payload contains `from_display_name` but not `from_user_id` for all types today. Migration `015` adds nothing to the schema (the avatar lookup uses `payload->>'from_user_id'` if present, falling back to initials). To make sender avatars reliable, server-side notification creation must include `from_user_id` going forward — this plan **does not** modify the server (out of scope per spec section 6 "no new backend routes"), so older notifications without `from_user_id` will fall back to the initials avatar. New notifications already include the field for `warm_ping`, `encouragement`, `emergency`, and `silence_nudge` (verify by inspecting the relevant `apps/mobile/app/api/...` routes if they exist locally, otherwise the fallback is the documented behavior).

---

## File Structure

**New files (with sibling tests where applicable):**

- `supabase/migrations/017_avatars_storage.sql` — creates the `avatars` storage bucket and RLS
- `apps/mobile/lib/alerts.ts` — pure helpers (`partitionByRead`, `groupRepeats`, `colorForUserId`, `formatTimeAgo`)
- `apps/mobile/lib/alerts.test.ts` — unit tests
- `apps/mobile/components/Avatar.tsx` — image-or-initials avatar
- `apps/mobile/components/Avatar.test.tsx` — unit tests
- `apps/mobile/components/AppHeader.tsx` — avatar + wordmark + right slot header
- `apps/mobile/components/AppHeader.test.tsx` — unit tests
- `apps/mobile/components/CenterCheckInButton.tsx` — floating amber tab button (recovery)
- `apps/mobile/components/CenterCheckInButton.test.tsx` — unit tests
- `apps/mobile/lib/uploadAvatar.ts` — wraps Supabase Storage upload + `users.avatar_url` update
- `apps/mobile/lib/uploadAvatar.test.ts` — unit tests
- `apps/mobile/app/(profile)/edit-photo.tsx` — pick/upload screen

**Modified files:**

- `apps/mobile/package.json` — add `expo-image-picker`
- `apps/mobile/app/(recovery)/_layout.tsx` — hide chat/profile, add check-in (center) + add tabs
- `apps/mobile/app/(supporter)/_layout.tsx` — hide chat/profile, add invite tab as `add`
- `apps/mobile/app/(recovery)/index.tsx` — replace inline header with `<AppHeader />`
- `apps/mobile/app/(supporter)/index.tsx` — replace inline header with `<AppHeader />`, swap `PersonCard`'s initials View for `<Avatar />`
- `apps/mobile/components/NotificationList.tsx` — sender avatars, type-colored borders, NEW/EARLIER sections (using `lib/alerts.ts`), grouped repeats, read dimming
- `apps/mobile/app/(profile)/index.tsx` — add "profile photo" SettingRow → `/(profile)/edit-photo`

---

### Task 1: Migration — `avatars` storage bucket and RLS

**Files:**
- Create: `supabase/migrations/017_avatars_storage.sql`

- [ ] **Step 1: Write the migration SQL**

Create `supabase/migrations/017_avatars_storage.sql` with exactly:

```sql
-- 014: avatars storage bucket
--
-- Creates a public bucket named `avatars` for profile pictures. Filenames are
-- of the form `<user_id>/avatar.jpg`. The bucket is public-read so that
-- supporter clients can render images via the URL stored in `users.avatar_url`
-- without per-request signing. RLS on `storage.objects` restricts uploads,
-- updates, and deletes to the owning user.

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- Anyone authenticated can read avatar files (the bucket is public anyway,
-- this policy is for completeness so RLS doesn't block authenticated clients).
create policy "avatars: read all"
  on storage.objects for select
  using (bucket_id = 'avatars');

-- A user can insert/update/delete only files inside a folder matching their uid.
-- Filename convention: `<auth.uid()>/avatar.jpg` (or .png).
create policy "avatars: owner insert"
  on storage.objects for insert
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "avatars: owner update"
  on storage.objects for update
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "avatars: owner delete"
  on storage.objects for delete
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
```

- [ ] **Step 2: Apply the migration locally**

Run (from repo root):

```bash
psql "$SUPABASE_DB_URL" -f supabase/migrations/017_avatars_storage.sql
```

Expected: `INSERT 0 1` (or `INSERT 0 0` if the bucket already exists), then four `CREATE POLICY` lines, no errors.

- [ ] **Step 3: Verify bucket exists**

Run:

```bash
psql "$SUPABASE_DB_URL" -c "select id, public from storage.buckets where id = 'avatars';"
```

Expected output contains a row with `id = avatars` and `public = t`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/017_avatars_storage.sql
git commit -m "add avatars storage bucket and owner-scoped rls"
```

---

### Task 2: Pure helpers — `lib/alerts.ts` (TDD)

**Files:**
- Create: `apps/mobile/lib/alerts.test.ts`
- Create: `apps/mobile/lib/alerts.ts`

- [ ] **Step 1: Write the failing test file**

Create `apps/mobile/lib/alerts.test.ts` with:

```ts
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
cd apps/mobile && npx jest lib/alerts.test.ts
```

Expected: jest exits with non-zero status; the failure message includes `Cannot find module './alerts' from 'lib/alerts.test.ts'`.

- [ ] **Step 3: Write the implementation**

Create `apps/mobile/lib/alerts.ts` with:

```ts
// Pure helpers for the alerts/notifications screen. Kept side-effect-free so
// they're trivial to unit test. UI rendering lives in NotificationList.

export interface AlertItem {
  id: string
  type: string
  payload: Record<string, unknown>
  read_at: string | null
  created_at: string
}

export interface GroupedAlert {
  item: AlertItem
  extras: AlertItem[] // 2nd, 3rd, ... entries collapsed into the run
}

/** "today" or "yesterday" + unread = NEW. Everything else = EARLIER. */
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

/**
 * Collapses runs of 3+ consecutive alerts that share both sender and type into
 * a single row whose `extras` carries the rest. Order is preserved (input is
 * assumed to already be sorted newest-first).
 */
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

// 8-color stable palette — readable on both light and dark surfaces.
const PALETTE = [
  '#C58A3F', // amber
  '#4ca8a8', // teal
  '#8b5cf6', // purple
  '#5C9E7A', // sage
  '#D6923A', // honey
  '#C65D52', // soft red
  '#5B7FBF', // dusk blue
  '#B57BC8', // lavender
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run:

```bash
cd apps/mobile && npx jest lib/alerts.test.ts
```

Expected: `PASS  lib/alerts.test.ts` with all tests green; jest exits 0.

- [ ] **Step 5: Lint and typecheck**

Run:

```bash
cd apps/mobile && npm run lint && npm run typecheck
```

Expected: both commands exit 0 with no output other than completion lines.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/lib/alerts.ts apps/mobile/lib/alerts.test.ts
git commit -m "add alerts helpers for partitioning grouping and color hashing"
```

---

### Task 3: Shared `<Avatar />` component (TDD)

**Files:**
- Create: `apps/mobile/components/Avatar.test.tsx`
- Create: `apps/mobile/components/Avatar.tsx`

- [ ] **Step 1: Write the failing test**

Create `apps/mobile/components/Avatar.test.tsx` with:

```tsx
import { render } from '@testing-library/react-native'
import { Image, Text } from 'react-native'
import { Avatar } from './Avatar'

describe('<Avatar />', () => {
  it('renders an Image when avatarUrl is provided', () => {
    const { UNSAFE_getByType, queryByText } = render(
      <Avatar userId="u1" displayName="Sam Smith" avatarUrl="https://x/y.jpg" />,
    )
    const img = UNSAFE_getByType(Image)
    expect(img.props.source).toEqual({ uri: 'https://x/y.jpg' })
    expect(queryByText('SS')).toBeNull()
  })

  it('renders initials when avatarUrl is null', () => {
    const { getByText } = render(
      <Avatar userId="u1" displayName="Sam Smith" avatarUrl={null} />,
    )
    expect(getByText('SS')).toBeTruthy()
  })

  it('uses a single initial for one-word names', () => {
    const { getByText } = render(
      <Avatar userId="u1" displayName="sam" avatarUrl={null} />,
    )
    expect(getByText('S')).toBeTruthy()
  })

  it('falls back to "?" when displayName is empty', () => {
    const { getByText } = render(
      <Avatar userId="u1" displayName="" avatarUrl={null} />,
    )
    expect(getByText('?')).toBeTruthy()
  })

  it('renders the same background color for the same userId', () => {
    const a = render(<Avatar userId="stable-id" displayName="A" avatarUrl={null} />)
    const b = render(<Avatar userId="stable-id" displayName="B" avatarUrl={null} />)
    const aColor = (a.UNSAFE_getByType(Text).parent?.props.style as { backgroundColor: string }[])
      .find?.((s) => s?.backgroundColor)?.backgroundColor
    const bColor = (b.UNSAFE_getByType(Text).parent?.props.style as { backgroundColor: string }[])
      .find?.((s) => s?.backgroundColor)?.backgroundColor
    expect(aColor).toBe(bColor)
  })

  it('respects the size prop', () => {
    const { UNSAFE_getByType } = render(
      <Avatar userId="u1" displayName="A" avatarUrl={null} size={64} />,
    )
    const txt = UNSAFE_getByType(Text)
    const wrapStyle = txt.parent?.props.style as Array<{ width?: number; height?: number; borderRadius?: number }>
    const flat = Array.isArray(wrapStyle) ? Object.assign({}, ...wrapStyle) : wrapStyle
    expect(flat.width).toBe(64)
    expect(flat.height).toBe(64)
    expect(flat.borderRadius).toBe(32)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
cd apps/mobile && npx jest components/Avatar.test.tsx
```

Expected: failure with `Cannot find module './Avatar' from 'components/Avatar.test.tsx'`.

- [ ] **Step 3: Write the implementation**

Create `apps/mobile/components/Avatar.tsx` with:

```tsx
import { View, Text, Image, StyleSheet } from 'react-native'
import { colorForUserId } from '../lib/alerts'

interface Props {
  userId: string
  displayName: string
  avatarUrl: string | null | undefined
  size?: number
}

function getInitials(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) return '?'
  const parts = trimmed.split(/\s+/).filter(Boolean)
  if (parts.length === 1) return parts[0][0].toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function Avatar({ userId, displayName, avatarUrl, size = 40 }: Props) {
  const radius = size / 2
  const wrapper = { width: size, height: size, borderRadius: radius }

  if (avatarUrl) {
    return (
      <Image
        source={{ uri: avatarUrl }}
        style={[styles.image, wrapper]}
        accessibilityIgnoresInvertColors
      />
    )
  }

  const bg = colorForUserId(userId)
  const initials = getInitials(displayName)
  const fontSize = Math.max(10, Math.round(size * 0.4))

  return (
    <View style={[styles.fallback, wrapper, { backgroundColor: bg }]}>
      <Text style={[styles.initials, { fontSize }]}>{initials}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  image: {
    backgroundColor: '#0000',
  },
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    color: '#fff',
    fontWeight: '700',
    letterSpacing: 0.5,
  },
})
```

- [ ] **Step 4: Run the test to verify it passes**

Run:

```bash
cd apps/mobile && npx jest components/Avatar.test.tsx
```

Expected: `PASS  components/Avatar.test.tsx`; jest exits 0.

- [ ] **Step 5: Lint and typecheck**

Run:

```bash
cd apps/mobile && npm run lint && npm run typecheck
```

Expected: both exit 0.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/components/Avatar.tsx apps/mobile/components/Avatar.test.tsx
git commit -m "add avatar component with image fallback to colored initials"
```

---

### Task 4: `<AppHeader />` component (TDD)

**Files:**
- Create: `apps/mobile/components/AppHeader.test.tsx`
- Create: `apps/mobile/components/AppHeader.tsx`

- [ ] **Step 1: Write the failing test**

Create `apps/mobile/components/AppHeader.test.tsx` with:

```tsx
import { render, fireEvent } from '@testing-library/react-native'
import { AppHeader } from './AppHeader'

describe('<AppHeader />', () => {
  const baseProps = {
    user: { id: 'u1', displayName: 'Sam', avatarUrl: null as string | null },
    onAvatarPress: jest.fn(),
  }

  beforeEach(() => baseProps.onAvatarPress.mockReset())

  it('renders the wordmark text', () => {
    const { getByText } = render(<AppHeader {...baseProps} />)
    expect(getByText('circly')).toBeTruthy()
  })

  it('renders the user avatar (initials fallback)', () => {
    const { getByText } = render(<AppHeader {...baseProps} />)
    expect(getByText('S')).toBeTruthy()
  })

  it('fires onAvatarPress when the avatar is tapped', () => {
    const { getByLabelText } = render(<AppHeader {...baseProps} />)
    fireEvent.press(getByLabelText('open profile'))
    expect(baseProps.onAvatarPress).toHaveBeenCalledTimes(1)
  })

  it('renders the messages icon button when onMessagesPress is provided', () => {
    const onMessagesPress = jest.fn()
    const { getByLabelText } = render(
      <AppHeader {...baseProps} onMessagesPress={onMessagesPress} />,
    )
    fireEvent.press(getByLabelText('open messages'))
    expect(onMessagesPress).toHaveBeenCalledTimes(1)
  })

  it('renders the SOS button when onSosPress is provided', () => {
    const onSosPress = jest.fn()
    const { getByLabelText } = render(
      <AppHeader {...baseProps} onSosPress={onSosPress} />,
    )
    fireEvent.press(getByLabelText('alert your supporters'))
    expect(onSosPress).toHaveBeenCalledTimes(1)
  })

  it('omits the SOS button when onSosPress is undefined', () => {
    const { queryByLabelText } = render(<AppHeader {...baseProps} />)
    expect(queryByLabelText('alert your supporters')).toBeNull()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
cd apps/mobile && npx jest components/AppHeader.test.tsx
```

Expected: failure with `Cannot find module './AppHeader' from 'components/AppHeader.test.tsx'`.

- [ ] **Step 3: Write the implementation**

Create `apps/mobile/components/AppHeader.tsx` with:

```tsx
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { useColors } from '../hooks/useColors'
import { Avatar } from './Avatar'
import { Icon } from './Icon'
import { spacing, type as t } from '../constants/theme'

interface Props {
  user: { id: string; displayName: string; avatarUrl: string | null | undefined }
  onAvatarPress: () => void
  onMessagesPress?: () => void
  onSosPress?: () => void
  unreadMessages?: number
}

/**
 * Persistent screen header used on the recovery and supporter home tabs.
 * Layout: [avatar] ─ [circly wordmark, centered] ─ [optional SOS] [optional messages]
 */
export function AppHeader({
  user,
  onAvatarPress,
  onMessagesPress,
  onSosPress,
  unreadMessages,
}: Props) {
  const colors = useColors()
  return (
    <View style={styles.row}>
      <Pressable
        onPress={onAvatarPress}
        accessibilityRole="button"
        accessibilityLabel="open profile"
        hitSlop={8}
        style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
      >
        <Avatar
          userId={user.id}
          displayName={user.displayName}
          avatarUrl={user.avatarUrl}
          size={36}
        />
      </Pressable>

      <Text style={[styles.wordmark, { color: colors.accent }]}>circly</Text>

      <View style={styles.actions}>
        {onSosPress && (
          <Pressable
            onPress={onSosPress}
            accessibilityRole="button"
            accessibilityLabel="alert your supporters"
            hitSlop={8}
            style={({ pressed }) => [
              styles.iconBtn,
              {
                backgroundColor: colors.dangerSoft,
                borderColor: colors.danger,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <Icon name="alert-triangle" size={16} color={colors.danger} />
          </Pressable>
        )}
        {onMessagesPress && (
          <Pressable
            onPress={onMessagesPress}
            accessibilityRole="button"
            accessibilityLabel="open messages"
            hitSlop={8}
            style={({ pressed }) => [
              styles.iconBtn,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <Icon name="message-circle" size={16} color={colors.textPrimary} />
            {unreadMessages !== undefined && unreadMessages > 0 && (
              <View style={[styles.badge, { backgroundColor: colors.accent }]}>
                <Text style={styles.badgeText}>
                  {unreadMessages > 9 ? '9+' : String(unreadMessages)}
                </Text>
              </View>
            )}
          </Pressable>
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  wordmark: {
    ...t.h3,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
})
```

- [ ] **Step 4: Run the test to verify it passes**

Run:

```bash
cd apps/mobile && npx jest components/AppHeader.test.tsx
```

Expected: `PASS  components/AppHeader.test.tsx`; jest exits 0.

- [ ] **Step 5: Lint and typecheck**

Run:

```bash
cd apps/mobile && npm run lint && npm run typecheck
```

Expected: both exit 0.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/components/AppHeader.tsx apps/mobile/components/AppHeader.test.tsx
git commit -m "add appheader with avatar wordmark and right slot icons"
```

---

### Task 5: `<CenterCheckInButton />` (TDD)

**Files:**
- Create: `apps/mobile/components/CenterCheckInButton.test.tsx`
- Create: `apps/mobile/components/CenterCheckInButton.tsx`

- [ ] **Step 1: Write the failing test**

Create `apps/mobile/components/CenterCheckInButton.test.tsx` with:

```tsx
import { render, fireEvent } from '@testing-library/react-native'
import { CenterCheckInButton } from './CenterCheckInButton'

describe('<CenterCheckInButton />', () => {
  it('calls onPress when tapped', () => {
    const onPress = jest.fn()
    const { getByLabelText } = render(<CenterCheckInButton onPress={onPress} />)
    fireEvent.press(getByLabelText('check in'))
    expect(onPress).toHaveBeenCalledTimes(1)
  })

  it('renders the check-in icon', () => {
    const { getByLabelText } = render(<CenterCheckInButton onPress={() => {}} />)
    // Icon is found via the parent Pressable accessibility label
    expect(getByLabelText('check in')).toBeTruthy()
  })

  it('passes accessibilityState.disabled when accessibilityState.selected is true', () => {
    const { getByLabelText } = render(
      <CenterCheckInButton onPress={() => {}} accessibilityState={{ selected: true }} />,
    )
    const node = getByLabelText('check in')
    expect(node.props.accessibilityState).toEqual({ selected: true })
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
cd apps/mobile && npx jest components/CenterCheckInButton.test.tsx
```

Expected: failure with `Cannot find module './CenterCheckInButton'`.

- [ ] **Step 3: Write the implementation**

Create `apps/mobile/components/CenterCheckInButton.tsx` with:

```tsx
import { Pressable, View, StyleSheet, Platform } from 'react-native'
import type { AccessibilityState } from 'react-native'
import { useColors } from '../hooks/useColors'
import { Icon } from './Icon'

interface Props {
  onPress: () => void
  accessibilityState?: AccessibilityState
}

/**
 * Floating circular check-in tab button. Wired into a Tabs.Screen via
 * `tabBarButton={(props) => <CenterCheckInButton onPress={props.onPress} />}`.
 * The raised height is achieved with negative top margin and elevation/shadow.
 */
export function CenterCheckInButton({ onPress, accessibilityState }: Props) {
  const colors = useColors()
  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel="check in"
        accessibilityState={accessibilityState}
        style={({ pressed }) => [
          styles.button,
          {
            backgroundColor: colors.accent,
            shadowColor: colors.accent,
            opacity: pressed ? 0.85 : 1,
          },
        ]}
      >
        <Icon name="check" size={24} color="#fff" />
      </Pressable>
    </View>
  )
}

const SIZE = 56

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  button: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -20,
    ...Platform.select({
      ios: {
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
    }),
  },
})
```

- [ ] **Step 4: Run the test to verify it passes**

Run:

```bash
cd apps/mobile && npx jest components/CenterCheckInButton.test.tsx
```

Expected: `PASS  components/CenterCheckInButton.test.tsx`.

- [ ] **Step 5: Lint and typecheck**

Run:

```bash
cd apps/mobile && npm run lint && npm run typecheck
```

Expected: both exit 0.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/components/CenterCheckInButton.tsx apps/mobile/components/CenterCheckInButton.test.tsx
git commit -m "add floating check-in tab button for the center slot"
```

---

### Task 6: Recovery tab bar — 5 items with center check-in (manual smoke)

**Files:**
- Modify: `apps/mobile/app/(recovery)/_layout.tsx`

- [ ] **Step 1: Replace the file contents**

Open `apps/mobile/app/(recovery)/_layout.tsx` and replace the entire file with:

```tsx
import { useEffect } from 'react'
import { Tabs, router } from 'expo-router'
import { useColors } from '../../hooks/useColors'
import { Icon } from '../../components/Icon'
import { CenterCheckInButton } from '../../components/CenterCheckInButton'
import { useAuthStore } from '../../store/auth'
import { useNotificationStore } from '../../store/notifications'
import { supabase } from '../../lib/supabase'
import { scheduleOkayReminder, cancelOkayReminder, parseTime } from '../../lib/notifications'
import { usePushToken } from '../../hooks/usePushToken'
import { useRealtimeNotifications } from '../../hooks/useRealtimeNotifications'

export default function RecoveryLayout() {
  const colors = useColors()
  const user = useAuthStore((s) => s.user)
  usePushToken(user?.id)
  useRealtimeNotifications(user?.id)
  const unreadCount = useNotificationStore((s) => s.unreadCount)

  // Schedule daily "I'm okay" reminder based on user's silence settings.
  useEffect(() => {
    if (!user) return

    let cancelled = false

    async function setupReminder() {
      const { data } = await supabase
        .from('silence_settings')
        .select('okay_tap_enabled, okay_tap_time, snooze_until')
        .eq('user_id', user!.id)
        .maybeSingle()

      if (cancelled) return

      const settings = data as {
        okay_tap_enabled: boolean
        okay_tap_time: string
        snooze_until: string | null
      } | null

      const snoozed = settings?.snooze_until && settings.snooze_until >= new Date().toISOString().split('T')[0]
      if (!settings?.okay_tap_enabled || snoozed) {
        await cancelOkayReminder()
        return
      }

      const { hour, minute } = parseTime(settings?.okay_tap_time ?? '09:00')
      await scheduleOkayReminder(hour, minute)
    }

    setupReminder()
    return () => { cancelled = true }
  }, [user])

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.background },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          paddingBottom: 8,
          height: 64,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
          letterSpacing: 0.2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'home',
          tabBarIcon: ({ color, size }) => <Icon name="home" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="journal"
        options={{
          title: 'journal',
          tabBarIcon: ({ color, size }) => <Icon name="book-open" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="check-in"
        options={{
          title: '',
          tabBarButton: () => (
            <CenterCheckInButton onPress={() => router.push('/(recovery)/check-in')} />
          ),
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: 'alerts',
          tabBarIcon: ({ color, size }) => <Icon name="bell" size={size} color={color} />,
          tabBarBadge: unreadCount > 0 ? unreadCount : undefined,
          tabBarBadgeStyle: { backgroundColor: colors.danger, fontSize: 10 },
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'add',
          tabBarIcon: ({ color, size }) => <Icon name="user-plus" size={size} color={color} />,
        }}
      />
      {/* Hidden routes — still navigable but not in the tab bar. */}
      <Tabs.Screen name="chat" options={{ href: null }} />
      <Tabs.Screen name="profile" options={{ href: null }} />
      <Tabs.Screen name="journal-entry" options={{ href: null }} />
      <Tabs.Screen name="supporter-settings" options={{ href: null }} />
      <Tabs.Screen name="silence-settings" options={{ href: null }} />
    </Tabs>
  )
}
```

- [ ] **Step 2: Typecheck**

Run:

```bash
cd apps/mobile && npm run typecheck
```

Expected: exits 0 with no errors.

- [ ] **Step 3: Lint**

Run:

```bash
cd apps/mobile && npm run lint
```

Expected: exits 0.

- [ ] **Step 4: Manual smoke test**

Start the app:

```bash
cd apps/mobile && npx expo start
```

Open on the iOS simulator and sign in as a recovery user. Verify each item below by visual inspection / tap:

- [ ] The bottom tab bar shows exactly five slots in this order: home, journal, [center floating button], alerts, add.
- [ ] The center button is amber, circular, raised above the bar with a subtle shadow, no label underneath.
- [ ] Tapping the center button navigates to the check-in screen (you see the mood/intent picker UI).
- [ ] Tapping `add` navigates to `/(recovery)/settings` (the supporter-settings screen).
- [ ] The home screen still renders without errors.
- [ ] There is no `messages` or `profile` tab visible in the bar.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/app/(recovery)/_layout.tsx
git commit -m "rebalance recovery tab bar to five items with center check-in"
```

---

### Task 7: Supporter tab bar — 4 items including add (manual smoke)

**Files:**
- Modify: `apps/mobile/app/(supporter)/_layout.tsx`

- [ ] **Step 1: Replace the file contents**

Open `apps/mobile/app/(supporter)/_layout.tsx` and replace with:

```tsx
import { Tabs } from 'expo-router'
import { useColors } from '../../hooks/useColors'
import { Icon } from '../../components/Icon'
import { useAuthStore } from '../../store/auth'
import { useNotificationStore } from '../../store/notifications'
import { usePushToken } from '../../hooks/usePushToken'
import { useRealtimeNotifications } from '../../hooks/useRealtimeNotifications'

export default function SupporterLayout() {
  const colors = useColors()
  const user = useAuthStore((s) => s.user)
  usePushToken(user?.id)
  useRealtimeNotifications(user?.id)
  const unreadCount = useNotificationStore((s) => s.unreadCount)

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.background },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          paddingBottom: 8,
          height: 64,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
          letterSpacing: 0.2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'home',
          tabBarIcon: ({ color, size }) => <Icon name="home" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: 'alerts',
          tabBarIcon: ({ color, size }) => <Icon name="bell" size={size} color={color} />,
          tabBarBadge: unreadCount > 0 ? unreadCount : undefined,
          tabBarBadgeStyle: { backgroundColor: colors.danger, fontSize: 10 },
        }}
      />
      <Tabs.Screen
        name="invite"
        options={{
          title: 'add',
          tabBarIcon: ({ color, size }) => <Icon name="user-plus" size={size} color={color} />,
        }}
      />
      {/* Hidden routes */}
      <Tabs.Screen name="chat" options={{ href: null }} />
      <Tabs.Screen name="profile" options={{ href: null }} />
    </Tabs>
  )
}
```

- [ ] **Step 2: Typecheck and lint**

Run:

```bash
cd apps/mobile && npm run typecheck && npm run lint
```

Expected: both exit 0.

- [ ] **Step 3: Manual smoke test**

Sign in as a supporter (or use Profile → switch context). Verify:

- [ ] The bottom tab bar shows exactly three visible labels: home, alerts, add.
- [ ] Tapping `add` navigates to `/(supporter)/invite`.
- [ ] Tapping `home` shows the existing supporter dashboard (your circle).
- [ ] No `messages` or `profile` tab is visible.

(Three visible tabs is what the four-item spec produces once we drop chat/profile — the fourth "Connections" item in the spec is the home screen itself. Header now owns messages and the avatar opens profile.)

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/app/(supporter)/_layout.tsx
git commit -m "rebalance supporter tab bar to home alerts add"
```

---

### Task 8: Adopt `<AppHeader />` on recovery home (manual smoke)

**Files:**
- Modify: `apps/mobile/app/(recovery)/index.tsx`

- [ ] **Step 1: Replace the inline header block**

In `apps/mobile/app/(recovery)/index.tsx`, add this import at the top of the imports section (alongside the other component imports):

```tsx
import { AppHeader } from '../../components/AppHeader'
```

Then locate the existing inline header (lines 223-246, the `<View style={styles.header}>...</View>` block ending after the first `<Pressable ... accessibilityLabel="invite supporters">...</Pressable>`) and replace those lines with:

```tsx
<AppHeader
  user={{
    id: user?.id ?? '',
    displayName: user?.displayName ?? 'friend',
    avatarUrl: user?.avatarUrl ?? null,
  }}
  onAvatarPress={() => router.push('/(profile)')}
  onMessagesPress={() => router.push('/(recovery)/chat')}
  onSosPress={handleGetSupport}
/>
```

The `getGreeting()` block and "good morning, name" text are no longer rendered (the wordmark replaces them per spec section 3.1).

- [ ] **Step 2: Add `avatarUrl` to the auth store user type**

Open `apps/mobile/store/auth.ts` and update the `AppUser` interface to add `avatarUrl`:

```ts
export interface AppUser {
  id: string
  email: string
  displayName: string
  avatarUrl: string | null
  role: UserRole
  context: AppContext | null
  sobrietyStartDate: string | null
}
```

Then update the `mockUser` literal in `apps/mobile/store/auth.test.ts` (around lines 12-19) to include the new field so the existing test keeps compiling. Replace its body with:

```ts
const mockUser: AppUser = {
  id: 'user-1',
  email: 'test@circly.app',
  displayName: 'Test User',
  avatarUrl: null,
  role: 'recovery',
  context: 'recovery',
  sobrietyStartDate: '2026-01-01',
}
```

Then search the codebase for `AppUser`/user-construction sites to ensure `avatarUrl` is populated:

```bash
cd apps/mobile && grep -rn "displayName:" --include="*.ts" --include="*.tsx" app store lib hooks
```

For every site that constructs an `AppUser`-shaped object (typically `app/(auth)/...` and `app/_layout.tsx`), add `avatarUrl: row.avatar_url ?? null` (or `null` if the source row does not include it). The compiler will list each unfixed site in the next step — fix them by adding `avatarUrl: null` until the typecheck passes if you can't immediately fetch the column.

- [ ] **Step 3: Typecheck**

Run:

```bash
cd apps/mobile && npm run typecheck
```

Expected: exits 0. If it fails, add `avatarUrl: null` to each construction site reported, then re-run until clean.

- [ ] **Step 4: Lint**

Run:

```bash
cd apps/mobile && npm run lint
```

Expected: exits 0.

- [ ] **Step 5: Manual smoke test**

Open the app, sign in as recovery user. Verify:

- [ ] The recovery home screen shows the new header at the top: avatar (left), `circly` wordmark (center, amber), then the SOS triangle and the messages bubble (right).
- [ ] Tapping the avatar opens the profile screen.
- [ ] Tapping the SOS triangle opens the existing "alert your supporters" confirm dialog.
- [ ] Tapping the messages bubble opens the chat list.
- [ ] The greeting "good morning, name" text is gone (intentional — replaced by wordmark per spec).
- [ ] The rest of the dashboard (streak card, milestone path, today section) renders normally.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/app/(recovery)/index.tsx apps/mobile/store/auth.ts
git commit -m "use appheader on recovery home and add avatar_url to auth user"
```

---

### Task 9: Adopt `<AppHeader />` on supporter home (manual smoke)

**Files:**
- Modify: `apps/mobile/app/(supporter)/index.tsx`

- [ ] **Step 1: Add the import**

In `apps/mobile/app/(supporter)/index.tsx` add to the import block:

```tsx
import { AppHeader } from '../../components/AppHeader'
import { Avatar } from '../../components/Avatar'
```

- [ ] **Step 2: Replace the inline header**

Locate the inline header (the `<View style={styles.header}>...</View>` block currently containing the greeting, name, summary, and the `user-plus` Pressable button — lines 292-323). Replace the entire block with:

```tsx
<AppHeader
  user={{
    id: user?.id ?? '',
    displayName: user?.displayName ?? 'friend',
    avatarUrl: user?.avatarUrl ?? null,
  }}
  onAvatarPress={() => router.push('/(profile)')}
  onMessagesPress={() => router.push('/(supporter)/chat')}
/>

{people.length > 0 && (
  <Text style={[styles.summary, { color: colors.textMuted }]}>
    {people.length} {people.length === 1 ? 'person' : 'people'} in your circle
    {checkedInCount > 0 ? ` · ${checkedInCount} checked in today` : ''}
  </Text>
)}
```

(No SOS — supporters don't get an SOS button per spec section 3.2.)

- [ ] **Step 3: Replace `PersonCard`'s initials avatar with `<Avatar />`**

In the same file, find the `PersonCard` component. Locate the inline avatar block:

```tsx
<View style={[styles.avatar, { backgroundColor: statusAvatarBg }]}>
  <Text style={[styles.avatarText, { color: statusAvatarColor }]}>{initial}</Text>
</View>
```

Replace it with:

```tsx
<Avatar
  userId={person.recovery_user_id}
  displayName={person.display_name}
  avatarUrl={person.avatar_url ?? null}
  size={44}
/>
```

Then update the `LinkedPerson` interface (lines 38-45) to add `avatar_url`:

```tsx
interface LinkedPerson {
  relationship_id: string
  recovery_user_id: string
  display_name: string
  avatar_url: string | null
  sobriety_start_date: string | null
  today_check_in: CheckInStatus | null
  latest_milestone: MilestoneType | null
}
```

In the `load()` function, update the supabase select string (around line 113) from:

```tsx
'id, recovery_user_id, users:recovery_user_id(display_name, profiles(sobriety_start_date))',
```

to:

```tsx
'id, recovery_user_id, users:recovery_user_id(display_name, avatar_url, profiles(sobriety_start_date))',
```

And update the cast type and the `base.map(...)` block to include `avatar_url`:

```tsx
const base = (rels as unknown as Array<{
  id: string
  recovery_user_id: string
  users: {
    display_name: string
    avatar_url: string | null
    profiles: { sobriety_start_date: string | null } | null
  } | null
}>).map((r) => ({
  relationship_id: r.id,
  recovery_user_id: r.recovery_user_id,
  display_name: r.users?.display_name ?? 'friend',
  avatar_url: r.users?.avatar_url ?? null,
  sobriety_start_date: r.users?.profiles?.sobriety_start_date ?? null,
  today_check_in: null as CheckInStatus | null,
  latest_milestone: null as MilestoneType | null,
}))
```

The `initial`, `styles.avatar`, `styles.avatarText`, `statusAvatarBg`, and `statusAvatarColor` locals are no longer used inside the new block — remove the `initial`, `statusAvatarBg`, and `statusAvatarColor` variable declarations (lines 446 + 455-467) but keep `statusBorder` (still used for the card border). Leave `styles.avatar` / `styles.avatarText` definitions in the StyleSheet harmless or delete them.

- [ ] **Step 4: Typecheck and lint**

Run:

```bash
cd apps/mobile && npm run typecheck && npm run lint
```

Expected: both exit 0. Fix any unused-variable warnings reported by ESLint.

- [ ] **Step 5: Manual smoke test**

Sign in as a supporter who has at least one linked person. Verify:

- [ ] Header shows: avatar, `circly` wordmark, messages icon (no SOS).
- [ ] Tapping the avatar opens profile; tapping messages opens supporter chat.
- [ ] Each `PersonCard` shows the linked person's avatar — photo if they uploaded one, otherwise colored initials. The same person renders the same color across reloads.
- [ ] Card border still reflects today's check-in status (green / amber-warning / default).

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/app/(supporter)/index.tsx
git commit -m "use appheader and avatar component on supporter home"
```

---

### Task 10: Alerts screen redesign (manual smoke)

**Files:**
- Modify: `apps/mobile/components/NotificationList.tsx`

- [ ] **Step 1: Replace the file**

Open `apps/mobile/components/NotificationList.tsx` and replace the entire file with:

```tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  SectionList,
  Pressable,
  RefreshControl,
  Animated,
  PanResponder,
  Dimensions,
} from 'react-native'
import { router, useFocusEffect } from 'expo-router'
import { useColors } from '../hooks/useColors'
import { useAuthStore } from '../store/auth'
import { supabase } from '../lib/supabase'
import { Icon } from './Icon'
import { Avatar } from './Avatar'
import { SkeletonCard } from './SkeletonCard'
import { useNotificationStore } from '../store/notifications'
import { api } from '../lib/api'
import { notifySuccess } from '../lib/haptics'
import { spacing, radii, type as t, layout } from '../constants/theme'
import {
  partitionByRead,
  groupRepeats,
  formatTimeAgo,
  type AlertItem,
  type GroupedAlert,
} from '../lib/alerts'

interface Section {
  title: 'NEW' | 'EARLIER'
  data: GroupedAlert[]
}

const TYPE_LABEL: Record<string, string> = {
  warm_ping: 'warm ping',
  encouragement: 'encouragement',
  emergency: 'emergency',
  silence_nudge: 'silence nudge',
  milestone: 'milestone',
  message: 'message',
}

// Spec section 4.1 — colored left border per type.
function typeColor(
  type: string,
  colors: ReturnType<typeof useColors>,
): string {
  switch (type) {
    case 'encouragement':
      return colors.accent // amber
    case 'warm_ping':
      return '#4ca8a8' // teal
    case 'message':
      return '#8b5cf6' // purple
    case 'emergency':
      return colors.danger
    case 'milestone':
      return colors.success
    default:
      return colors.accent
  }
}

function notificationBody(n: AlertItem): string {
  const p = n.payload
  const name = (p.from_display_name as string) ?? 'someone'

  switch (n.type) {
    case 'warm_ping':
      return `${name} is with you.`
    case 'encouragement':
      return `${name}: "${(p.message as string) ?? ''}"`
    case 'emergency':
      return `${name} needs support right now.`
    case 'silence_nudge': {
      const days = (p.days_since_last_signal as number) ?? 0
      return `it's been ${days} ${days === 1 ? 'day' : 'days'} since ${name} checked in.`
    }
    case 'milestone':
      return `${name} reached a milestone!`
    case 'message':
      return `${name}: "${(p.preview as string) ?? ''}"`
    default:
      return 'new notification'
  }
}

function senderInfo(n: AlertItem): { id: string; name: string; avatarUrl: string | null } {
  const p = n.payload as Record<string, unknown>
  return {
    id: (p.from_user_id as string) ?? n.id, // fall back to notification id so initials color is stable
    name: (p.from_display_name as string) ?? 'someone',
    avatarUrl: (p.from_avatar_url as string | null) ?? null,
  }
}

const SCREEN_WIDTH = Dimensions.get('window').width
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.3

function SwipeableCard({
  children,
  index,
  onDismiss,
}: {
  children: React.ReactNode
  index: number
  onDismiss: () => void
}) {
  const colors = useColors()
  const entryOpacity = useMemo(() => new Animated.Value(0), [])
  const entryY = useMemo(() => new Animated.Value(12), [])
  const translateX = useMemo(() => new Animated.Value(0), [])
  useEffect(() => {
    const delay = Math.min(index * 50, 300)
    Animated.parallel([
      Animated.timing(entryOpacity, { toValue: 1, duration: 250, delay, useNativeDriver: true }),
      Animated.spring(entryY, { toValue: 0, delay, useNativeDriver: true, friction: 8 }),
    ]).start()
  }, [entryOpacity, entryY, index])

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) =>
        Math.abs(gesture.dx) > 10 && Math.abs(gesture.dy) < 20,
      onPanResponderMove: (_, gesture) => {
        if (gesture.dx < 0) translateX.setValue(gesture.dx)
      },
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dx < -SWIPE_THRESHOLD) {
          Animated.timing(translateX, {
            toValue: -SCREEN_WIDTH,
            duration: 200,
            useNativeDriver: true,
          }).start(onDismiss)
        } else {
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
            friction: 8,
          }).start()
        }
      },
    }),
  ).current

  const swipeOpacity = translateX.interpolate({
    inputRange: [-SWIPE_THRESHOLD, 0],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  })

  return (
    <Animated.View style={{ opacity: entryOpacity, transform: [{ translateY: entryY }] }}>
      <Animated.View style={[styles.swipeBehind, { opacity: swipeOpacity }]}>
        <Icon name="check" size={16} color={colors.textMuted} />
        <Text style={[t.small, { color: colors.textMuted }]}>dismiss</Text>
      </Animated.View>
      <Animated.View {...panResponder.panHandlers} style={{ transform: [{ translateX }] }}>
        {children}
      </Animated.View>
    </Animated.View>
  )
}

function AnimatedEmptyState({ emptyBody }: { emptyBody: string }) {
  const colors = useColors()
  const bellRotation = useMemo(() => new Animated.Value(0), [])

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>
    let cancelled = false

    const swing = () => Animated.sequence([
      Animated.timing(bellRotation, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.timing(bellRotation, { toValue: -1, duration: 300, useNativeDriver: true }),
      Animated.timing(bellRotation, { toValue: 0, duration: 200, useNativeDriver: true }),
    ])

    const loop = () => {
      swing().start(() => {
        if (cancelled) return
        timeoutId = setTimeout(loop, 3000)
      })
    }

    loop()

    return () => {
      cancelled = true
      clearTimeout(timeoutId)
      bellRotation.stopAnimation()
    }
  }, [bellRotation])

  const rotate = bellRotation.interpolate({
    inputRange: [-1, 1],
    outputRange: ['-15deg', '15deg'],
  })

  return (
    <View style={styles.empty}>
      <Animated.View
        style={[
          styles.emptyIcon,
          { backgroundColor: colors.surfaceRaised, transform: [{ rotate }] },
        ]}
      >
        <Icon name="bell" size={28} color={colors.textMuted} />
      </Animated.View>
      <Text style={[t.h3, { color: colors.textPrimary, textAlign: 'center' }]}>all quiet</Text>
      <Text style={[t.small, { color: colors.textSecondary, textAlign: 'center', lineHeight: 20 }]}>
        {emptyBody}
      </Text>
    </View>
  )
}

interface Props {
  emptyBody: string
}

export function NotificationList({ emptyBody }: Props) {
  const colors = useColors()
  const user = useAuthStore((s) => s.user)
  const decrementBadge = useNotificationStore((s) => s.decrement)
  const resetBadge = useNotificationStore((s) => s.reset)
  const setBadge = useNotificationStore((s) => s.setUnreadCount)
  const [notifications, setNotifications] = useState<AlertItem[]>([])
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    if (!user) return
    const { data } = await supabase
      .from('notifications')
      .select('id, type, payload, read_at, created_at')
      .eq('recipient_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50)

    if (data) {
      const items = data as AlertItem[]
      setNotifications(items)
      setBadge(items.filter((n) => !n.read_at).length)
    }
    setLoading(false)
  }, [user, setBadge])

  useFocusEffect(
    useCallback(() => { load() }, [load]),
  )

  const sections = useMemo<Section[]>(() => {
    const { new: newer, earlier } = partitionByRead(notifications)
    const result: Section[] = []
    if (newer.length > 0) result.push({ title: 'NEW', data: groupRepeats(newer) })
    if (earlier.length > 0) result.push({ title: 'EARLIER', data: groupRepeats(earlier) })
    return result
  }, [notifications])

  const hasUnread = useMemo(() => notifications.some((n) => !n.read_at), [notifications])

  const markAsRead = useCallback(async (id: string) => {
    const wasUnread = notifications.find((n) => n.id === id && !n.read_at)
    await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', id)
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n)),
    )
    if (wasUnread) decrementBadge()
  }, [notifications, decrementBadge])

  async function markAllRead() {
    const unreadIds = notifications.filter((n) => !n.read_at).map((n) => n.id)
    if (unreadIds.length === 0) return

    const now = new Date().toISOString()
    await supabase
      .from('notifications')
      .update({ read_at: now })
      .in('id', unreadIds)
    setNotifications((prev) =>
      prev.map((n) => (unreadIds.includes(n.id) ? { ...n, read_at: now } : n)),
    )
    resetBadge()
  }

  const handleAction = useCallback(async (n: AlertItem) => {
    if (n.type === 'silence_nudge') {
      const forUserId = n.payload.for_user_id as string | undefined
      if (forUserId) {
        try {
          await api('/api/warm-ping', {
            method: 'POST',
            body: JSON.stringify({ recipient_id: forUserId }),
          })
          notifySuccess()
        } catch {
          // silent
        }
      }
      await markAsRead(n.id)
      return
    }

    if (!n.read_at) markAsRead(n.id)

    if (n.type === 'message' && n.payload.conversation_id) {
      router.push(`/(chat)/${n.payload.conversation_id as string}`)
    }
  }, [markAsRead])

  const renderItem = useCallback(({ item: g, index }: { item: GroupedAlert; index: number }) => {
    const item = g.item
    const sender = senderInfo(item)
    const color = typeColor(item.type, colors)
    const isUnread = !item.read_at
    const dimmed = !isUnread

    return (
      <SwipeableCard index={index} onDismiss={() => markAsRead(item.id)}>
        <Pressable
          onPress={() => handleAction(item)}
          accessibilityRole="button"
          accessibilityLabel={`${TYPE_LABEL[item.type] ?? 'notification'}: ${notificationBody(item)}`}
          style={({ pressed }) => [
            styles.card,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderLeftColor: dimmed ? colors.border : color,
              borderLeftWidth: 3,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <View style={{ opacity: dimmed ? 0.55 : 1 }}>
            <Avatar
              userId={sender.id}
              displayName={sender.name}
              avatarUrl={sender.avatarUrl}
              size={36}
            />
          </View>
          <View style={styles.cardBody}>
            <View style={styles.cardTopRow}>
              <Text
                style={[
                  styles.senderName,
                  { color: colors.textPrimary, opacity: dimmed ? 0.55 : 1 },
                ]}
                numberOfLines={1}
              >
                {sender.name}
              </Text>
              <View style={[styles.pill, { backgroundColor: dimmed ? colors.surfaceRaised : color + '22' }]}>
                <Text style={[styles.pillText, { color: dimmed ? colors.textMuted : color }]}>
                  {TYPE_LABEL[item.type] ?? 'notification'}
                </Text>
              </View>
              <Text style={[t.small, { color: colors.textMuted }]}>
                {formatTimeAgo(item.created_at)}
              </Text>
            </View>
            <Text
              style={[
                t.body,
                { color: colors.textPrimary, opacity: dimmed ? 0.55 : 1 },
                isUnread && { fontWeight: '500' },
              ]}
            >
              {notificationBody(item)}
            </Text>
            {g.extras.length > 0 && (
              <Pressable
                onPress={() => setExpanded((e) => ({ ...e, [item.id]: !e[item.id] }))}
                hitSlop={6}
                style={{ paddingTop: spacing.xs }}
                accessibilityRole="button"
                accessibilityLabel={
                  expanded[item.id]
                    ? 'collapse repeated alerts'
                    : `show ${g.extras.length} more from ${sender.name}`
                }
              >
                <Text style={[t.small, { color: colors.accent }]}>
                  {expanded[item.id]
                    ? 'show less'
                    : `+ ${g.extras.length} more from ${sender.name} ›`}
                </Text>
              </Pressable>
            )}
            {expanded[item.id] && g.extras.length > 0 && (
              <View style={styles.extras}>
                {g.extras.map((ex) => (
                  <Text
                    key={ex.id}
                    style={[t.small, { color: colors.textSecondary }]}
                    numberOfLines={2}
                  >
                    · {notificationBody(ex)} · {formatTimeAgo(ex.created_at)}
                  </Text>
                ))}
              </View>
            )}
          </View>
          {isUnread && <View style={[styles.unreadDot, { backgroundColor: color }]} />}
        </Pressable>
      </SwipeableCard>
    )
  }, [colors, handleAction, markAsRead, expanded])

  const renderSectionHeader = useCallback(({ section }: { section: Section }) => (
    <View style={styles.sectionHeader}>
      <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>
        {section.title}
      </Text>
    </View>
  ), [colors])

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>alerts</Text>
        </View>
        <View style={styles.skeletonWrap}>
          <SkeletonCard count={4} height={80} />
        </View>
      </View>
    )
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>alerts</Text>
        {hasUnread && (
          <Pressable
            onPress={markAllRead}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Mark all as read"
            style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
          >
            <Text style={[styles.markAllRead, { color: colors.accent }]}>mark all read</Text>
          </Pressable>
        )}
      </View>
      <SectionList
        sections={sections}
        keyExtractor={(g) => g.item.id}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        contentContainerStyle={styles.list}
        stickySectionHeadersEnabled={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false) }}
            tintColor={colors.accent}
          />
        }
        ListEmptyComponent={<AnimatedEmptyState emptyBody={emptyBody} />}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: layout.screenPadding,
    paddingTop: layout.screenTopPadding,
    paddingBottom: spacing.md,
  },
  title: { ...t.h1 },
  markAllRead: { ...t.smallStrong },
  skeletonWrap: {
    paddingHorizontal: layout.screenPadding,
    paddingTop: spacing.md,
  },
  list: {
    paddingHorizontal: layout.screenPadding,
    paddingBottom: spacing.xxxl,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  sectionTitle: { ...t.label },
  swipeBehind: {
    position: 'absolute',
    right: spacing.xl,
    top: 0,
    bottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacing.xs,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: spacing.lg,
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  cardBody: { flex: 1, gap: spacing.xs },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  senderName: {
    ...t.bodyStrong,
    flexShrink: 1,
  },
  pill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.pill,
  },
  pillText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'lowercase',
  },
  extras: {
    marginTop: spacing.xs,
    gap: 2,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 6,
  },
  empty: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingTop: spacing.xxxl * 2,
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
})
```

- [ ] **Step 2: Typecheck and lint**

Run:

```bash
cd apps/mobile && npm run typecheck && npm run lint
```

Expected: both exit 0.

- [ ] **Step 3: Manual smoke test (recovery)**

Sign in as a recovery user with at least one unread `warm_ping`, one unread `encouragement`, one unread `message`, and one read older notification (seed by triggering activity in the app or directly in supabase). Open the alerts tab. Verify:

- [ ] The screen has a `NEW` section at the top listing unread items from today/yesterday.
- [ ] Below it, an `EARLIER` section lists older + read items.
- [ ] If there are no unread items, the `NEW` section is omitted.
- [ ] Each card has: sender avatar (left), sender name + lowercase type pill + relative time (top row), body text, optional `+ N more from name ›` row when collapsed, an amber unread dot on the right.
- [ ] Card left border colors: warm pings = teal, encouragements = amber, messages = purple. Read items have a muted-grey left border.
- [ ] Tapping a card marks it as read in place: dot disappears, the card visually dims (avatar/name/body fade to ~55% opacity), pill goes muted grey.
- [ ] Tapping `mark all read` clears all unread state.
- [ ] When the same sender sends 3+ same-type alerts in a row, only the most recent shows as a full card with `+ N more from <name> ›` underneath. Tapping that row expands the extras inline; tapping again collapses.

- [ ] **Step 4: Manual smoke test (supporter)**

Sign in as a supporter and repeat the same checks on `/(supporter)/notifications`. The same `NotificationList` is used so behavior should be identical.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/components/NotificationList.tsx
git commit -m "redesign alerts screen with sender avatars colored borders sections and grouped repeats"
```

---

### Task 11: Install `expo-image-picker`

**Files:**
- Modify: `apps/mobile/package.json`
- Modify: `apps/mobile/package-lock.json` (auto)

- [ ] **Step 1: Install with the Expo-pinned version**

Run (from repo root):

```bash
cd apps/mobile && npx expo install expo-image-picker
```

Expected output ends with a line like `+ expo-image-picker@~17.x.y` (the exact patch version is whatever Expo SDK 54 pins) and no errors.

- [ ] **Step 2: Confirm package.json contains the dependency**

Run:

```bash
grep '"expo-image-picker"' apps/mobile/package.json
```

Expected: a line of the form `"expo-image-picker": "~17.x.y",` is present in `dependencies`.

- [ ] **Step 3: Typecheck**

Run:

```bash
cd apps/mobile && npm run typecheck
```

Expected: exits 0.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/package.json apps/mobile/package-lock.json
git commit -m "add expo-image-picker for profile photo upload"
```

---

### Task 12: `lib/uploadAvatar.ts` (TDD)

**Files:**
- Create: `apps/mobile/lib/uploadAvatar.test.ts`
- Create: `apps/mobile/lib/uploadAvatar.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/mobile/lib/uploadAvatar.test.ts` with:

```ts
import { uploadAvatar, avatarObjectPath } from './uploadAvatar'

const upload = jest.fn()
const getPublicUrl = jest.fn()
const update = jest.fn()
const eq = jest.fn()

jest.mock('./supabase', () => ({
  supabase: {
    storage: {
      from: () => ({
        upload: (...args: unknown[]) => upload(...args),
        getPublicUrl: (...args: unknown[]) => getPublicUrl(...args),
      }),
    },
    from: () => ({
      update: (...args: unknown[]) => update(...args),
      eq: (...args: unknown[]) => eq(...args),
    }),
  },
}))

beforeEach(() => {
  upload.mockReset()
  getPublicUrl.mockReset()
  update.mockReset()
  eq.mockReset()
  // chain: supabase.from('users').update({...}).eq('id', userId) => returns {error: null}
  update.mockReturnValue({ eq: (col: string, val: string) => { eq(col, val); return Promise.resolve({ error: null }) } })
  upload.mockResolvedValue({ data: { path: 'u1/avatar.jpg' }, error: null })
  getPublicUrl.mockReturnValue({ data: { publicUrl: 'https://cdn/u1/avatar.jpg' } })
})

describe('avatarObjectPath', () => {
  it('returns userId/avatar.jpg', () => {
    expect(avatarObjectPath('u1')).toBe('u1/avatar.jpg')
  })
})

describe('uploadAvatar', () => {
  it('uploads bytes to the avatars bucket with upsert and writes the public url', async () => {
    const result = await uploadAvatar('u1', 'file:///tmp/p.jpg', new Uint8Array([1, 2, 3]))

    expect(upload).toHaveBeenCalledWith(
      'u1/avatar.jpg',
      expect.any(Uint8Array),
      expect.objectContaining({ upsert: true, contentType: 'image/jpeg' }),
    )
    expect(getPublicUrl).toHaveBeenCalledWith('u1/avatar.jpg')
    expect(eq).toHaveBeenCalledWith('id', 'u1')
    expect(result).toBe('https://cdn/u1/avatar.jpg')
  })

  it('throws when storage upload errors', async () => {
    upload.mockResolvedValue({ data: null, error: { message: 'denied' } })
    await expect(
      uploadAvatar('u1', 'file:///tmp/p.jpg', new Uint8Array([1])),
    ).rejects.toThrow('denied')
  })

  it('throws when users update errors', async () => {
    update.mockReturnValue({
      eq: () => Promise.resolve({ error: { message: 'rls denied' } }),
    })
    await expect(
      uploadAvatar('u1', 'file:///tmp/p.jpg', new Uint8Array([1])),
    ).rejects.toThrow('rls denied')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
cd apps/mobile && npx jest lib/uploadAvatar.test.ts
```

Expected: failure with `Cannot find module './uploadAvatar' from 'lib/uploadAvatar.test.ts'`.

- [ ] **Step 3: Write the implementation**

Create `apps/mobile/lib/uploadAvatar.ts` with:

```ts
import { supabase } from './supabase'

export function avatarObjectPath(userId: string): string {
  return `${userId}/avatar.jpg`
}

/**
 * Uploads `bytes` (a Uint8Array of a JPEG payload) to the `avatars` bucket
 * under `<userId>/avatar.jpg`, then writes the resulting public URL to
 * `users.avatar_url`. Returns the public URL on success.
 *
 * `localUri` is accepted but currently unused — callers pass it so the
 * caller can also keep an immediate optimistic preview.
 */
export async function uploadAvatar(
  userId: string,
  _localUri: string,
  bytes: Uint8Array,
): Promise<string> {
  const path = avatarObjectPath(userId)
  const { error: upErr } = await supabase.storage
    .from('avatars')
    .upload(path, bytes, { upsert: true, contentType: 'image/jpeg' })
  if (upErr) throw new Error(upErr.message)

  const { data } = supabase.storage.from('avatars').getPublicUrl(path)
  const url = data.publicUrl

  const { error: updErr } = await supabase
    .from('users')
    .update({ avatar_url: url })
    .eq('id', userId)
  if (updErr) throw new Error(updErr.message)

  return url
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run:

```bash
cd apps/mobile && npx jest lib/uploadAvatar.test.ts
```

Expected: `PASS  lib/uploadAvatar.test.ts`; jest exits 0.

- [ ] **Step 5: Lint and typecheck**

Run:

```bash
cd apps/mobile && npm run lint && npm run typecheck
```

Expected: both exit 0.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/lib/uploadAvatar.ts apps/mobile/lib/uploadAvatar.test.ts
git commit -m "add uploadavatar helper that pushes to storage and updates user row"
```

---

### Task 13: Edit-photo screen (manual smoke)

**Files:**
- Create: `apps/mobile/app/(profile)/edit-photo.tsx`
- Modify: `apps/mobile/app/(profile)/index.tsx`

- [ ] **Step 1: Create the edit-photo screen**

Create `apps/mobile/app/(profile)/edit-photo.tsx` with:

```tsx
import { useState } from 'react'
import { View, Text, StyleSheet, Alert, ScrollView } from 'react-native'
import { router } from 'expo-router'
import * as ImagePicker from 'expo-image-picker'
import { useColors } from '../../hooks/useColors'
import { useAuthStore } from '../../store/auth'
import { Avatar } from '../../components/Avatar'
import { Button } from '../../components/Button'
import { BackButton } from '../../components/BackButton'
import { uploadAvatar } from '../../lib/uploadAvatar'
import { spacing, type as t, layout } from '../../constants/theme'

export default function EditPhotoScreen() {
  const colors = useColors()
  const user = useAuthStore((s) => s.user)
  const setUser = useAuthStore((s) => s.setUser)
  const [previewUri, setPreviewUri] = useState<string | null>(null)
  const [pickedBytes, setPickedBytes] = useState<Uint8Array | null>(null)
  const [busy, setBusy] = useState(false)

  if (!user) return null

  async function pick() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!perm.granted) {
      Alert.alert('permission needed', 'allow photo library access in settings to upload a photo.')
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
      base64: true,
    })
    if (result.canceled || !result.assets[0]) return
    const asset = result.assets[0]
    setPreviewUri(asset.uri)
    if (asset.base64) {
      // Convert base64 -> Uint8Array for the storage upload.
      const binary = globalThis.atob(asset.base64)
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
      setPickedBytes(bytes)
    }
  }

  async function save() {
    if (!pickedBytes || !previewUri) return
    setBusy(true)
    try {
      const url = await uploadAvatar(user!.id, previewUri, pickedBytes)
      setUser({ ...user!, avatarUrl: url })
      router.back()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'something went wrong'
      Alert.alert('could not upload', msg)
    } finally {
      setBusy(false)
    }
  }

  const displayUrl = previewUri ?? user.avatarUrl

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.container}
    >
      <View style={styles.header}>
        <BackButton />
        <Text style={[styles.title, { color: colors.textPrimary }]}>profile photo</Text>
      </View>

      <View style={styles.preview}>
        <Avatar
          userId={user.id}
          displayName={user.displayName}
          avatarUrl={displayUrl}
          size={140}
        />
      </View>

      <Button label="choose photo" variant="ghost" onPress={pick} />
      <Button
        label="save"
        onPress={save}
        loading={busy}
        disabled={!pickedBytes}
      />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    padding: layout.screenPadding,
    paddingTop: layout.screenTopPadding,
    gap: spacing.xl,
  },
  header: { gap: spacing.sm },
  title: { ...t.h1 },
  preview: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
})
```

- [ ] **Step 2: Add the entry point in profile settings**

Open `apps/mobile/app/(profile)/index.tsx` and inside the `<SettingSection title="profile">` block, add a new row above the `name` row:

```tsx
<SettingRow
  label="profile photo"
  onPress={() => router.push('/(profile)/edit-photo')}
/>
```

- [ ] **Step 3: Typecheck and lint**

Run:

```bash
cd apps/mobile && npm run typecheck && npm run lint
```

Expected: both exit 0. If typecheck complains about `MediaTypeOptions` being deprecated in the installed `expo-image-picker` version, replace `mediaTypes: ImagePicker.MediaTypeOptions.Images` with `mediaTypes: ['images']` (the new string-array API in newer SDKs) and re-run.

- [ ] **Step 4: Manual smoke test**

In the app, navigate Profile → Profile photo. Verify:

- [ ] The current avatar (or initials if none) renders large.
- [ ] Tapping `choose photo` prompts for photo library access on first run, then opens the picker.
- [ ] After picking + cropping, the preview updates to the new image.
- [ ] Tapping `save` shows a loading state, then returns to the profile screen with the new avatar visible in the AppHeader on the home screen.
- [ ] On supporter accounts viewing this user, the new avatar appears in the supporter's `PersonCard` after refresh.
- [ ] If you cancel the picker, no upload happens and the existing avatar is unchanged.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/app/(profile)/edit-photo.tsx apps/mobile/app/(profile)/index.tsx
git commit -m "add edit-photo screen and profile entry for uploading avatar"
```

---

### Task 14: Backfill `avatarUrl` on user load (manual smoke)

**Files:**
- Modify: any auth bootstrap site that constructs `AppUser` (typically `apps/mobile/app/_layout.tsx` and `apps/mobile/app/(auth)/...`)

- [ ] **Step 1: Locate every `AppUser` construction site**

Run:

```bash
cd apps/mobile && grep -rn "displayName:" --include="*.ts" --include="*.tsx" app store lib hooks | grep -v ".test."
```

Expected: a list of files. For each match where the object literal is being built into an `AppUser`-shaped object, ensure the supabase select for `users` includes `avatar_url` and the constructed object spreads `avatarUrl: row.avatar_url ?? null`.

- [ ] **Step 2: Update the bootstrap select**

For each construction site, locate the supabase query. If it currently selects `id, email, display_name, role, ...`, update it to include `avatar_url`:

```ts
const { data } = await supabase
  .from('users')
  .select('id, email, display_name, avatar_url, role') // add avatar_url
  // ...
```

Then in the object literal, add:

```ts
avatarUrl: row.avatar_url ?? null,
```

(Adjust `row` to whatever the local variable is at each site.)

- [ ] **Step 3: Typecheck**

Run:

```bash
cd apps/mobile && npm run typecheck
```

Expected: exits 0. Any remaining type errors point at construction sites still missing `avatarUrl`. Add the field there.

- [ ] **Step 4: Lint**

Run:

```bash
cd apps/mobile && npm run lint
```

Expected: exits 0.

- [ ] **Step 5: Manual smoke test**

Cold-start the app (kill it and reopen). Verify:

- [ ] If you uploaded an avatar in Task 13, it loads immediately on the recovery / supporter home header without needing to navigate to the profile screen first.
- [ ] If you have no avatar, the initials show with a stable color across cold starts.

- [ ] **Step 6: Commit**

```bash
git add -A apps/mobile/app apps/mobile/store apps/mobile/hooks apps/mobile/lib
git commit -m "load avatar_url into the auth user on bootstrap"
```

---

### Task 15: Full-suite verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run:

```bash
cd apps/mobile && npm test -- --runInBand
```

Expected: all suites pass; jest exits 0. The new tests (`alerts.test.ts`, `Avatar.test.tsx`, `AppHeader.test.tsx`, `CenterCheckInButton.test.tsx`, `uploadAvatar.test.ts`) appear in the run output.

- [ ] **Step 2: Run lint**

Run:

```bash
cd apps/mobile && npm run lint
```

Expected: exits 0 with `0 errors, 0 warnings` (the script enforces `--max-warnings 0`).

- [ ] **Step 3: Run typecheck**

Run:

```bash
cd apps/mobile && npm run typecheck
```

Expected: exits 0 with no diagnostic output.

- [ ] **Step 4: Final manual sweep**

Open the app and re-verify the spec's Section 6 boundaries hold:

- [ ] Check-in screen itself is unchanged (only its entry point moved into the center button).
- [ ] Chat screens unchanged.
- [ ] No push notification behavior changed.
- [ ] Recovery role: 5-tab bar with center check-in. Header has avatar, wordmark, SOS, messages.
- [ ] Supporter role: home/alerts/add tab bar (3 visible). Header has avatar, wordmark, messages (no SOS).
- [ ] Alerts screen has NEW/EARLIER sections, type-colored borders, sender avatars, lowercase pills, read dimming, and `+ N more from <name>` collapsing.
- [ ] Profile photo upload round-trips through the supabase `avatars` bucket and shows up on supporter dashboards.

- [ ] **Step 5: Commit (verification stamp, only if anything changed)**

If lint/typecheck/test fixes were required during this task, commit them now:

```bash
git add -A
git commit -m "fix lint and type issues uncovered during full-suite verification"
```

If no changes were needed, skip the commit.
