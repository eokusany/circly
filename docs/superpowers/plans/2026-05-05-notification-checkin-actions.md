# Notification Check-In Actions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Spec:** [`docs/superpowers/specs/2026-05-05-notification-checkin-actions-design.md`](../specs/2026-05-05-notification-checkin-actions-design.md)

**Goal:** Let recovery users log a real check-in by tapping a mood button (good / okay / struggling) directly on the daily reminder notification, with no app launch, plus fire a mood-aware confirmation notification.

**Architecture:** Register a notification category with three action buttons on app startup. A response listener fires when the user taps a button, maps the action identifier to a `check_ins.status`, upserts the row via Supabase (idempotent on `(user_id, check_in_date)`), and schedules a follow-up local notification. If the network call fails, the tap is queued in `AsyncStorage` and flushed the next time the app foregrounds. A new `source` column on `check_ins` distinguishes notification-driven entries from in-app ones.

**Tech Stack:** Expo Notifications (`setNotificationCategoryAsync`, `addNotificationResponseReceivedListener`), `@react-native-async-storage/async-storage`, Supabase (`@supabase/supabase-js`), React Native AppState API, Jest + jest-expo.

---

## Spec → Code Translation

The spec talks about a `mood` column with values `'good' | 'okay' | 'struggling'`. The actual schema column is `status` (enum `check_in_status`) with values `'good_day' | 'sober' | 'struggling'`. Mapping is fixed:

| Spec mood | Action identifier | DB `status` value |
|---|---|---|
| good | `mood-good` | `good_day` |
| okay | `mood-okay` | `sober` |
| struggling | `mood-struggling` | `struggling` |

The spec's "intention = null" maps to `note: null` (the actual column is `note`, not `intention`).

The spec mentions "store/auth.ts or wherever the in-app check-in upsert lives" — the upsert actually lives inline in [`apps/mobile/app/(recovery)/check-in.tsx:78-90`](../../../apps/mobile/app/(recovery)/check-in.tsx#L78-L90). Task 11 updates that call site directly.

## File Structure

**New files:**
- `supabase/migrations/015_check_ins_source.sql` — migration adding the `source` column
- `apps/mobile/lib/notificationActions.ts` — pure mapping helpers + the queue + the response handler (testable in isolation)
- `apps/mobile/lib/notificationActions.test.ts` — unit tests for the above

**Modified files:**
- `apps/mobile/lib/notifications.ts` — register `daily-checkin` category, update body copy, add `categoryIdentifier`, expose `setupNotificationResponseListener` and `flushPendingNotificationCheckins`
- `apps/mobile/lib/notifications.test.ts` — new test file (sibling to `notifications.ts`) covering category shape and body copy
- `apps/mobile/app/_layout.tsx` — call setup once on mount, flush on foreground
- `apps/mobile/app/(recovery)/check-in.tsx` — pass `source: 'in_app'` explicitly
- `apps/mobile/package.json` — add `@react-native-async-storage/async-storage`

`lib/notifications.ts` stays focused on Expo notification scheduling/registration. `lib/notificationActions.ts` owns the action-handling logic (mapping, queuing, supabase write) so it can be unit-tested without involving expo-notifications internals.

---

### Task 1: Migration — add `source` column to `check_ins`

**Files:**
- Create: `supabase/migrations/015_check_ins_source.sql`

- [ ] **Step 1: Write the migration SQL**

Create `supabase/migrations/015_check_ins_source.sql` with:

```sql
-- 015: notification check-in source
-- Adds a `source` column to check_ins so we can distinguish notification-driven
-- entries from in-app submissions. Backfills existing rows to 'in_app'.

alter table public.check_ins
  add column source text not null default 'in_app'
  check (source in ('in_app', 'notification'));
```

- [ ] **Step 2: Apply the migration locally**

Run (from repo root, against your local Supabase):

```bash
psql "$SUPABASE_DB_URL" -f supabase/migrations/015_check_ins_source.sql
```

Expected: `ALTER TABLE` with no errors.

- [ ] **Step 3: Verify the column exists and constraint works**

Run:

```bash
psql "$SUPABASE_DB_URL" -c "\d public.check_ins"
```

Expected output includes `source | text | not null default 'in_app'` and a CHECK constraint on `source`.

Then verify the CHECK constraint blocks bad values:

```bash
psql "$SUPABASE_DB_URL" -c "insert into public.check_ins (user_id, status, source) values ('00000000-0000-0000-0000-000000000000', 'sober', 'bogus');"
```

Expected: ERROR mentioning the check constraint. (The user_id FK will also fail; the check should fail first or alongside.)

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/015_check_ins_source.sql
git commit -m "add source column to check_ins for notification-driven entries"
```

---

### Task 2: Add `@react-native-async-storage/async-storage` dependency

**Files:**
- Modify: `apps/mobile/package.json`

- [ ] **Step 1: Install the dependency via Expo**

From repo root:

```bash
cd apps/mobile && npx expo install @react-native-async-storage/async-storage
```

Expected: package installs at the version Expo recommends for the SDK in use, `package.json` and lockfile updated.

- [ ] **Step 2: Verify it imports cleanly**

Run:

```bash
cd apps/mobile && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/package.json apps/mobile/package-lock.json apps/mobile/yarn.lock 2>/dev/null; git status
git commit -m "add async-storage dependency for notification queue"
```

(Use whichever lockfile exists; ignore the missing one.)

---

### Task 3: Action identifier → status mapping (pure function, TDD)

**Files:**
- Create: `apps/mobile/lib/notificationActions.ts`
- Create: `apps/mobile/lib/notificationActions.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/mobile/lib/notificationActions.test.ts`:

```ts
import { actionToStatus, NOTIFICATION_CATEGORY_ID } from './notificationActions'

describe('actionToStatus', () => {
  it('maps mood-good to good_day', () => {
    expect(actionToStatus('mood-good')).toBe('good_day')
  })

  it('maps mood-okay to sober', () => {
    expect(actionToStatus('mood-okay')).toBe('sober')
  })

  it('maps mood-struggling to struggling', () => {
    expect(actionToStatus('mood-struggling')).toBe('struggling')
  })

  it('returns null for unknown identifiers', () => {
    expect(actionToStatus('mood-bogus')).toBeNull()
    expect(actionToStatus('default')).toBeNull()
    expect(actionToStatus('')).toBeNull()
  })
})

describe('NOTIFICATION_CATEGORY_ID', () => {
  it('is the stable category identifier used at registration and on the schedule', () => {
    expect(NOTIFICATION_CATEGORY_ID).toBe('daily-checkin')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
cd apps/mobile && npx jest lib/notificationActions.test.ts
```

Expected: FAIL with "Cannot find module './notificationActions'".

- [ ] **Step 3: Write minimal implementation**

Create `apps/mobile/lib/notificationActions.ts`:

```ts
export const NOTIFICATION_CATEGORY_ID = 'daily-checkin'

export type CheckInStatus = 'good_day' | 'sober' | 'struggling'

const ACTION_TO_STATUS: Record<string, CheckInStatus> = {
  'mood-good': 'good_day',
  'mood-okay': 'sober',
  'mood-struggling': 'struggling',
}

export function actionToStatus(actionIdentifier: string): CheckInStatus | null {
  return ACTION_TO_STATUS[actionIdentifier] ?? null
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
cd apps/mobile && npx jest lib/notificationActions.test.ts
```

Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/lib/notificationActions.ts apps/mobile/lib/notificationActions.test.ts
git commit -m "add action-identifier to status mapping for notification check-ins"
```

---

### Task 4: Confirmation copy lookup (pure function, TDD)

**Files:**
- Modify: `apps/mobile/lib/notificationActions.ts`
- Modify: `apps/mobile/lib/notificationActions.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `apps/mobile/lib/notificationActions.test.ts`:

```ts
import { confirmationFor } from './notificationActions'

describe('confirmationFor', () => {
  it('returns non-tappable copy for good_day', () => {
    const c = confirmationFor('good_day')
    expect(c.body).toBe('logged. have a good one. ✓')
    expect(c.tappable).toBe(false)
    expect(c.tapRoute).toBeUndefined()
  })

  it('returns non-tappable copy for sober', () => {
    const c = confirmationFor('sober')
    expect(c.body).toBe('logged. one foot in front of the other. ✓')
    expect(c.tappable).toBe(false)
  })

  it('returns tappable copy for struggling that deep-links to chat', () => {
    const c = confirmationFor('struggling')
    expect(c.body).toBe('logged. your circle has been notified. tap to talk →')
    expect(c.tappable).toBe(true)
    expect(c.tapRoute).toBe('/(recovery)/chat')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
cd apps/mobile && npx jest lib/notificationActions.test.ts
```

Expected: FAIL with "confirmationFor is not a function" or "is not exported".

- [ ] **Step 3: Add the implementation**

Append to `apps/mobile/lib/notificationActions.ts`:

```ts
export interface ConfirmationCopy {
  body: string
  tappable: boolean
  tapRoute?: string
}

const CONFIRMATIONS: Record<CheckInStatus, ConfirmationCopy> = {
  good_day: {
    body: 'logged. have a good one. ✓',
    tappable: false,
  },
  sober: {
    body: 'logged. one foot in front of the other. ✓',
    tappable: false,
  },
  struggling: {
    body: 'logged. your circle has been notified. tap to talk →',
    tappable: true,
    tapRoute: '/(recovery)/chat',
  },
}

export function confirmationFor(status: CheckInStatus): ConfirmationCopy {
  return CONFIRMATIONS[status]
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
cd apps/mobile && npx jest lib/notificationActions.test.ts
```

Expected: PASS, 8 tests total.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/lib/notificationActions.ts apps/mobile/lib/notificationActions.test.ts
git commit -m "add per-status confirmation copy for notification check-ins"
```

---

### Task 5: Pending queue (AsyncStorage read/write/clear, TDD)

**Files:**
- Modify: `apps/mobile/lib/notificationActions.ts`
- Modify: `apps/mobile/lib/notificationActions.test.ts`

- [ ] **Step 1: Write the failing test**

At the top of `apps/mobile/lib/notificationActions.test.ts`, add the AsyncStorage mock import and reset between tests:

```ts
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
)

import AsyncStorage from '@react-native-async-storage/async-storage'
```

Then append:

```ts
import {
  PENDING_QUEUE_KEY,
  enqueuePending,
  readPending,
  clearPending,
  type PendingCheckIn,
} from './notificationActions'

describe('pending queue', () => {
  beforeEach(async () => {
    await AsyncStorage.clear()
  })

  it('uses the documented storage key', () => {
    expect(PENDING_QUEUE_KEY).toBe('pending_notification_checkins')
  })

  it('returns an empty list when nothing is queued', async () => {
    expect(await readPending()).toEqual([])
  })

  it('appends a pending entry', async () => {
    const entry: PendingCheckIn = {
      userId: 'user-1',
      status: 'sober',
      checkInDate: '2026-05-05',
    }
    await enqueuePending(entry)
    expect(await readPending()).toEqual([entry])
  })

  it('appends without overwriting existing entries', async () => {
    await enqueuePending({ userId: 'a', status: 'sober', checkInDate: '2026-05-05' })
    await enqueuePending({ userId: 'b', status: 'good_day', checkInDate: '2026-05-05' })
    const queue = await readPending()
    expect(queue).toHaveLength(2)
    expect(queue[1]?.userId).toBe('b')
  })

  it('clears the queue', async () => {
    await enqueuePending({ userId: 'a', status: 'sober', checkInDate: '2026-05-05' })
    await clearPending()
    expect(await readPending()).toEqual([])
  })

  it('returns an empty list when the stored value is corrupted', async () => {
    await AsyncStorage.setItem(PENDING_QUEUE_KEY, 'not-json')
    expect(await readPending()).toEqual([])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
cd apps/mobile && npx jest lib/notificationActions.test.ts
```

Expected: FAIL with "PENDING_QUEUE_KEY is not exported" or similar.

- [ ] **Step 3: Add the implementation**

Append to `apps/mobile/lib/notificationActions.ts`:

```ts
import AsyncStorage from '@react-native-async-storage/async-storage'

export const PENDING_QUEUE_KEY = 'pending_notification_checkins'

export interface PendingCheckIn {
  userId: string
  status: CheckInStatus
  checkInDate: string
}

export async function readPending(): Promise<PendingCheckIn[]> {
  const raw = await AsyncStorage.getItem(PENDING_QUEUE_KEY)
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as PendingCheckIn[]) : []
  } catch {
    return []
  }
}

export async function enqueuePending(entry: PendingCheckIn): Promise<void> {
  const current = await readPending()
  current.push(entry)
  await AsyncStorage.setItem(PENDING_QUEUE_KEY, JSON.stringify(current))
}

export async function clearPending(): Promise<void> {
  await AsyncStorage.removeItem(PENDING_QUEUE_KEY)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
cd apps/mobile && npx jest lib/notificationActions.test.ts
```

Expected: PASS, 14 tests total.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/lib/notificationActions.ts apps/mobile/lib/notificationActions.test.ts
git commit -m "add async-storage pending queue for offline notification check-ins"
```

---

### Task 6: Upsert helper — `recordNotificationCheckIn` (TDD with supabase mocked)

**Files:**
- Modify: `apps/mobile/lib/notificationActions.ts`
- Modify: `apps/mobile/lib/notificationActions.test.ts`

The helper takes a userId, status, and an injected supabase client (so tests don't need a real connection). It calls the same upsert pattern as the in-app screen ([check-in.tsx:78-90](../../../apps/mobile/app/(recovery)/check-in.tsx#L78-L90)) with `source: 'notification'`. Returns `'ok'` or `'failed'`.

- [ ] **Step 1: Write the failing test**

Append to `apps/mobile/lib/notificationActions.test.ts`:

```ts
import { recordNotificationCheckIn } from './notificationActions'

function makeFakeSupabase(behavior: 'ok' | 'error') {
  const upsert = jest.fn().mockReturnValue({
    select: jest.fn().mockReturnValue({
      single: jest.fn().mockResolvedValue(
        behavior === 'ok'
          ? { data: { id: 'row-1' }, error: null }
          : { data: null, error: { message: 'network down' } },
      ),
    }),
  })
  const from = jest.fn().mockReturnValue({ upsert })
  return { from, upsert } as const
}

describe('recordNotificationCheckIn', () => {
  it('upserts a row with status, source=notification, note=null, todays date', async () => {
    const sb = makeFakeSupabase('ok')
    const result = await recordNotificationCheckIn(
      { userId: 'user-1', status: 'sober', todayISO: '2026-05-05' },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { supabase: sb as any },
    )
    expect(result).toBe('ok')
    expect(sb.from).toHaveBeenCalledWith('check_ins')
    expect(sb.upsert).toHaveBeenCalledWith(
      {
        user_id: 'user-1',
        status: 'sober',
        note: null,
        check_in_date: '2026-05-05',
        source: 'notification',
      },
      { onConflict: 'user_id,check_in_date' },
    )
  })

  it('returns "failed" when supabase returns an error', async () => {
    const sb = makeFakeSupabase('error')
    const result = await recordNotificationCheckIn(
      { userId: 'user-1', status: 'good_day', todayISO: '2026-05-05' },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { supabase: sb as any },
    )
    expect(result).toBe('failed')
  })

  it('returns "failed" when the call throws', async () => {
    const sb = {
      from: jest.fn().mockImplementation(() => {
        throw new Error('boom')
      }),
    }
    const result = await recordNotificationCheckIn(
      { userId: 'user-1', status: 'good_day', todayISO: '2026-05-05' },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { supabase: sb as any },
    )
    expect(result).toBe('failed')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
cd apps/mobile && npx jest lib/notificationActions.test.ts
```

Expected: FAIL with "recordNotificationCheckIn is not a function".

- [ ] **Step 3: Add the implementation**

Append to `apps/mobile/lib/notificationActions.ts`:

```ts
import type { SupabaseClient } from '@supabase/supabase-js'

export interface RecordCheckInArgs {
  userId: string
  status: CheckInStatus
  todayISO: string
}

export interface RecordCheckInDeps {
  supabase: SupabaseClient
}

export async function recordNotificationCheckIn(
  args: RecordCheckInArgs,
  deps: RecordCheckInDeps,
): Promise<'ok' | 'failed'> {
  try {
    const { error } = await deps.supabase
      .from('check_ins')
      .upsert(
        {
          user_id: args.userId,
          status: args.status,
          note: null,
          check_in_date: args.todayISO,
          source: 'notification',
        },
        { onConflict: 'user_id,check_in_date' },
      )
      .select('id')
      .single()
    return error ? 'failed' : 'ok'
  } catch {
    return 'failed'
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
cd apps/mobile && npx jest lib/notificationActions.test.ts
```

Expected: PASS, 17 tests total.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/lib/notificationActions.ts apps/mobile/lib/notificationActions.test.ts
git commit -m "add upsert helper for notification-driven check-ins"
```

---

### Task 7: Pending-queue flush — `flushPending` (TDD)

**Files:**
- Modify: `apps/mobile/lib/notificationActions.ts`
- Modify: `apps/mobile/lib/notificationActions.test.ts`

`flushPending` reads the queue, retries each entry via `recordNotificationCheckIn`, and removes entries that succeed. Failed entries stay for the next attempt.

- [ ] **Step 1: Write the failing test**

Append to `apps/mobile/lib/notificationActions.test.ts`:

```ts
import { flushPending } from './notificationActions'

describe('flushPending', () => {
  beforeEach(async () => {
    await AsyncStorage.clear()
  })

  it('does nothing when the queue is empty', async () => {
    const sb = makeFakeSupabase('ok')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await flushPending({ supabase: sb as any })
    expect(result).toEqual({ attempted: 0, succeeded: 0, remaining: 0 })
    expect(sb.from).not.toHaveBeenCalled()
  })

  it('clears all entries when every retry succeeds', async () => {
    await enqueuePending({ userId: 'a', status: 'sober', checkInDate: '2026-05-05' })
    await enqueuePending({ userId: 'b', status: 'good_day', checkInDate: '2026-05-05' })
    const sb = makeFakeSupabase('ok')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await flushPending({ supabase: sb as any })
    expect(result).toEqual({ attempted: 2, succeeded: 2, remaining: 0 })
    expect(await readPending()).toEqual([])
  })

  it('keeps failed entries in the queue for next time', async () => {
    await enqueuePending({ userId: 'a', status: 'sober', checkInDate: '2026-05-05' })
    const sb = makeFakeSupabase('error')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await flushPending({ supabase: sb as any })
    expect(result).toEqual({ attempted: 1, succeeded: 0, remaining: 1 })
    expect(await readPending()).toHaveLength(1)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
cd apps/mobile && npx jest lib/notificationActions.test.ts
```

Expected: FAIL with "flushPending is not a function".

- [ ] **Step 3: Add the implementation**

Append to `apps/mobile/lib/notificationActions.ts`:

```ts
export interface FlushResult {
  attempted: number
  succeeded: number
  remaining: number
}

export async function flushPending(deps: RecordCheckInDeps): Promise<FlushResult> {
  const queue = await readPending()
  if (queue.length === 0) {
    return { attempted: 0, succeeded: 0, remaining: 0 }
  }

  const stillPending: PendingCheckIn[] = []
  let succeeded = 0
  for (const entry of queue) {
    const result = await recordNotificationCheckIn(
      { userId: entry.userId, status: entry.status, todayISO: entry.checkInDate },
      deps,
    )
    if (result === 'ok') {
      succeeded += 1
    } else {
      stillPending.push(entry)
    }
  }

  if (stillPending.length === 0) {
    await clearPending()
  } else {
    await AsyncStorage.setItem(PENDING_QUEUE_KEY, JSON.stringify(stillPending))
  }

  return { attempted: queue.length, succeeded, remaining: stillPending.length }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
cd apps/mobile && npx jest lib/notificationActions.test.ts
```

Expected: PASS, 20 tests total.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/lib/notificationActions.ts apps/mobile/lib/notificationActions.test.ts
git commit -m "add pending-queue flush helper"
```

---

### Task 8: Update notification body copy and add `categoryIdentifier`

**Files:**
- Modify: `apps/mobile/lib/notifications.ts`
- Create: `apps/mobile/lib/notifications.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/mobile/lib/notifications.test.ts`:

```ts
const scheduleMock = jest.fn().mockResolvedValue(undefined)
const cancelMock = jest.fn().mockResolvedValue(undefined)
const setCategoryMock = jest.fn().mockResolvedValue(undefined)
const getPermsMock = jest.fn().mockResolvedValue({ status: 'granted' })
const reqPermsMock = jest.fn().mockResolvedValue({ status: 'granted' })

jest.mock('expo-notifications', () => ({
  scheduleNotificationAsync: (...args: unknown[]) => scheduleMock(...args),
  cancelScheduledNotificationAsync: (...args: unknown[]) => cancelMock(...args),
  setNotificationCategoryAsync: (...args: unknown[]) => setCategoryMock(...args),
  getPermissionsAsync: () => getPermsMock(),
  requestPermissionsAsync: () => reqPermsMock(),
  SchedulableTriggerInputTypes: { DAILY: 'daily' },
}))

import { scheduleOkayReminder } from './notifications'
import { NOTIFICATION_CATEGORY_ID } from './notificationActions'

describe('scheduleOkayReminder', () => {
  beforeEach(() => {
    scheduleMock.mockClear()
    cancelMock.mockClear()
  })

  it('schedules with the new prompt body and the daily-checkin category', async () => {
    await scheduleOkayReminder(9, 0)
    expect(scheduleMock).toHaveBeenCalledTimes(1)
    const arg = scheduleMock.mock.calls[0][0]
    expect(arg.identifier).toBe('okay-tap-daily')
    expect(arg.content.body).toBe("how's today going? tap below to check in.")
    expect(arg.content.categoryIdentifier).toBe(NOTIFICATION_CATEGORY_ID)
    expect(arg.trigger).toEqual({ type: 'daily', hour: 9, minute: 0 })
  })

  it('cancels any prior schedule first', async () => {
    await scheduleOkayReminder(9, 0)
    expect(cancelMock).toHaveBeenCalledWith('okay-tap-daily')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
cd apps/mobile && npx jest lib/notifications.test.ts
```

Expected: FAIL — body still reads `"tap to say you're okay…"` and `categoryIdentifier` is missing.

- [ ] **Step 3: Update `scheduleOkayReminder`**

In `apps/mobile/lib/notifications.ts`, add an import for `NOTIFICATION_CATEGORY_ID` and update the schedule call. Replace the existing function body (lines 21-40) with:

```ts
import { NOTIFICATION_CATEGORY_ID } from './notificationActions'

// ... (other code unchanged) ...

export async function scheduleOkayReminder(hour: number, minute: number): Promise<void> {
  await cancelOkayReminder()

  const granted = await requestPermissions()
  if (!granted) return

  await Notifications.scheduleNotificationAsync({
    identifier: OKAY_REMINDER_ID,
    content: {
      title: 'circly',
      body: "how's today going? tap below to check in.",
      categoryIdentifier: NOTIFICATION_CATEGORY_ID,
      ...(Platform.OS === 'android' && { channelId: 'default' }),
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
    },
  })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
cd apps/mobile && npx jest lib/notifications.test.ts
```

Expected: PASS, 2 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/lib/notifications.ts apps/mobile/lib/notifications.test.ts
git commit -m "switch daily reminder body and attach action category"
```

---

### Task 9: Register the `daily-checkin` category at startup (TDD)

**Files:**
- Modify: `apps/mobile/lib/notifications.ts`
- Modify: `apps/mobile/lib/notifications.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `apps/mobile/lib/notifications.test.ts`:

```ts
import { registerDailyCheckinCategory } from './notifications'

describe('registerDailyCheckinCategory', () => {
  beforeEach(() => {
    setCategoryMock.mockClear()
  })

  it('registers three actions in the expected order with non-foregrounding options', async () => {
    await registerDailyCheckinCategory()
    expect(setCategoryMock).toHaveBeenCalledTimes(1)
    const [categoryId, actions] = setCategoryMock.mock.calls[0]
    expect(categoryId).toBe('daily-checkin')
    expect(actions).toEqual([
      {
        identifier: 'mood-good',
        buttonTitle: 'good',
        options: { opensAppToForeground: false },
      },
      {
        identifier: 'mood-okay',
        buttonTitle: 'okay',
        options: { opensAppToForeground: false },
      },
      {
        identifier: 'mood-struggling',
        buttonTitle: 'struggling',
        options: { opensAppToForeground: false, isDestructive: true },
      },
    ])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
cd apps/mobile && npx jest lib/notifications.test.ts
```

Expected: FAIL with "registerDailyCheckinCategory is not a function".

- [ ] **Step 3: Add the implementation**

Append to `apps/mobile/lib/notifications.ts`:

```ts
export async function registerDailyCheckinCategory(): Promise<void> {
  await Notifications.setNotificationCategoryAsync(NOTIFICATION_CATEGORY_ID, [
    {
      identifier: 'mood-good',
      buttonTitle: 'good',
      options: { opensAppToForeground: false },
    },
    {
      identifier: 'mood-okay',
      buttonTitle: 'okay',
      options: { opensAppToForeground: false },
    },
    {
      identifier: 'mood-struggling',
      buttonTitle: 'struggling',
      options: { opensAppToForeground: false, isDestructive: true },
    },
  ])
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
cd apps/mobile && npx jest lib/notifications.test.ts
```

Expected: PASS, 3 tests total.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/lib/notifications.ts apps/mobile/lib/notifications.test.ts
git commit -m "register daily-checkin notification category with three mood actions"
```

---

### Task 10: Confirmation notification helper (TDD)

**Files:**
- Modify: `apps/mobile/lib/notifications.ts`
- Modify: `apps/mobile/lib/notifications.test.ts`

`fireCheckinConfirmation(status)` schedules an immediate local notification with mood-aware copy. Uses a stable identifier `okay-tap-confirm` so a second tap on the same day replaces (not stacks) the previous confirmation.

- [ ] **Step 1: Write the failing test**

Append to `apps/mobile/lib/notifications.test.ts`:

```ts
import { fireCheckinConfirmation } from './notifications'

describe('fireCheckinConfirmation', () => {
  beforeEach(() => {
    scheduleMock.mockClear()
  })

  it('fires the good_day confirmation as non-tappable', async () => {
    await fireCheckinConfirmation('good_day')
    const arg = scheduleMock.mock.calls[0][0]
    expect(arg.identifier).toBe('okay-tap-confirm')
    expect(arg.content.body).toBe('logged. have a good one. ✓')
    expect(arg.content.data).toEqual({})
    expect(arg.trigger).toBeNull()
  })

  it('fires the sober confirmation as non-tappable', async () => {
    await fireCheckinConfirmation('sober')
    const arg = scheduleMock.mock.calls[0][0]
    expect(arg.content.body).toBe('logged. one foot in front of the other. ✓')
    expect(arg.content.data).toEqual({})
  })

  it('fires the struggling confirmation with a deep-link payload', async () => {
    await fireCheckinConfirmation('struggling')
    const arg = scheduleMock.mock.calls[0][0]
    expect(arg.content.body).toBe('logged. your circle has been notified. tap to talk →')
    expect(arg.content.data).toEqual({ tapRoute: '/(recovery)/chat' })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
cd apps/mobile && npx jest lib/notifications.test.ts
```

Expected: FAIL with "fireCheckinConfirmation is not a function".

- [ ] **Step 3: Add the implementation**

Append to `apps/mobile/lib/notifications.ts`:

```ts
import { confirmationFor, type CheckInStatus } from './notificationActions'

const CONFIRM_ID = 'okay-tap-confirm'

export async function fireCheckinConfirmation(status: CheckInStatus): Promise<void> {
  const copy = confirmationFor(status)
  await Notifications.scheduleNotificationAsync({
    identifier: CONFIRM_ID,
    content: {
      title: 'circly',
      body: copy.body,
      data: copy.tapRoute ? { tapRoute: copy.tapRoute } : {},
      ...(Platform.OS === 'android' && { channelId: 'default' }),
    },
    trigger: null,
  })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
cd apps/mobile && npx jest lib/notifications.test.ts
```

Expected: PASS, 6 tests total.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/lib/notifications.ts apps/mobile/lib/notifications.test.ts
git commit -m "add per-mood confirmation notification helper"
```

---

### Task 11: Notification response handler (TDD)

**Files:**
- Modify: `apps/mobile/lib/notificationActions.ts`
- Modify: `apps/mobile/lib/notificationActions.test.ts`

`handleNotificationResponse` is the single function the listener will call when the user taps an action button. Given a response object plus injected dependencies (supabase client, today's date, optional user id from cached session), it does: map identifier → status; if no status, ignore. If status, attempt the upsert; on failure, enqueue. On any successful path, fire the confirmation. If logged out (no user id), fire a single "open the app to check in" prompt instead.

This is where the per-mood end-to-end behaviour gets verified.

- [ ] **Step 1: Write the failing test**

Append to `apps/mobile/lib/notificationActions.test.ts`:

```ts
import { handleNotificationResponse } from './notificationActions'

describe('handleNotificationResponse', () => {
  beforeEach(async () => {
    await AsyncStorage.clear()
  })

  function makeResponse(actionIdentifier: string) {
    return { actionIdentifier } as { actionIdentifier: string }
  }

  it('ignores unknown action identifiers (e.g. plain notification tap)', async () => {
    const sb = makeFakeSupabase('ok')
    const fireConfirmation = jest.fn()
    const fireSignedOutPrompt = jest.fn()
    await handleNotificationResponse(makeResponse('default'), {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      supabase: sb as any,
      getUserId: async () => 'user-1',
      todayISO: '2026-05-05',
      fireConfirmation,
      fireSignedOutPrompt,
    })
    expect(sb.from).not.toHaveBeenCalled()
    expect(fireConfirmation).not.toHaveBeenCalled()
    expect(fireSignedOutPrompt).not.toHaveBeenCalled()
  })

  it('writes a check-in row and fires the matching confirmation on success', async () => {
    const sb = makeFakeSupabase('ok')
    const fireConfirmation = jest.fn()
    const fireSignedOutPrompt = jest.fn()
    await handleNotificationResponse(makeResponse('mood-good'), {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      supabase: sb as any,
      getUserId: async () => 'user-1',
      todayISO: '2026-05-05',
      fireConfirmation,
      fireSignedOutPrompt,
    })
    expect(sb.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'good_day', source: 'notification' }),
      { onConflict: 'user_id,check_in_date' },
    )
    expect(fireConfirmation).toHaveBeenCalledWith('good_day')
    expect(await readPending()).toEqual([])
  })

  it('queues the entry and still fires confirmation when supabase fails', async () => {
    const sb = makeFakeSupabase('error')
    const fireConfirmation = jest.fn()
    const fireSignedOutPrompt = jest.fn()
    await handleNotificationResponse(makeResponse('mood-struggling'), {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      supabase: sb as any,
      getUserId: async () => 'user-1',
      todayISO: '2026-05-05',
      fireConfirmation,
      fireSignedOutPrompt,
    })
    const queue = await readPending()
    expect(queue).toEqual([
      { userId: 'user-1', status: 'struggling', checkInDate: '2026-05-05' },
    ])
    expect(fireConfirmation).toHaveBeenCalledWith('struggling')
  })

  it('fires the signed-out prompt when there is no user id', async () => {
    const sb = makeFakeSupabase('ok')
    const fireConfirmation = jest.fn()
    const fireSignedOutPrompt = jest.fn()
    await handleNotificationResponse(makeResponse('mood-okay'), {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      supabase: sb as any,
      getUserId: async () => null,
      todayISO: '2026-05-05',
      fireConfirmation,
      fireSignedOutPrompt,
    })
    expect(sb.from).not.toHaveBeenCalled()
    expect(fireConfirmation).not.toHaveBeenCalled()
    expect(fireSignedOutPrompt).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
cd apps/mobile && npx jest lib/notificationActions.test.ts
```

Expected: FAIL with "handleNotificationResponse is not a function".

- [ ] **Step 3: Add the implementation**

Append to `apps/mobile/lib/notificationActions.ts`:

```ts
export interface HandleResponseDeps {
  supabase: SupabaseClient
  getUserId: () => Promise<string | null>
  todayISO: string
  fireConfirmation: (status: CheckInStatus) => Promise<void> | void
  fireSignedOutPrompt: () => Promise<void> | void
}

export interface NotificationResponseLike {
  actionIdentifier: string
}

export async function handleNotificationResponse(
  response: NotificationResponseLike,
  deps: HandleResponseDeps,
): Promise<void> {
  const status = actionToStatus(response.actionIdentifier)
  if (!status) return

  const userId = await deps.getUserId()
  if (!userId) {
    await deps.fireSignedOutPrompt()
    return
  }

  const result = await recordNotificationCheckIn(
    { userId, status, todayISO: deps.todayISO },
    { supabase: deps.supabase },
  )
  if (result === 'failed') {
    await enqueuePending({ userId, status, checkInDate: deps.todayISO })
  }
  await deps.fireConfirmation(status)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
cd apps/mobile && npx jest lib/notificationActions.test.ts
```

Expected: PASS, 24 tests total.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/lib/notificationActions.ts apps/mobile/lib/notificationActions.test.ts
git commit -m "add notification response handler that writes check-in and fires confirmation"
```

---

### Task 12: Wire `setupNotificationResponseListener` and `flushPendingNotificationCheckins` into `notifications.ts`

**Files:**
- Modify: `apps/mobile/lib/notifications.ts`

These two functions are the public surface that `_layout.tsx` calls. They wrap the response handler with real expo-notifications, supabase, and a signed-out fallback notification. They are thin enough that the unit tests covering `handleNotificationResponse` and `flushPending` already give us confidence; we don't add separate Jest tests for them — they're verified by manual smoke test in Task 14.

- [ ] **Step 1: Add the helpers**

Append to `apps/mobile/lib/notifications.ts`:

```ts
import { router } from 'expo-router'
import { supabase } from './supabase'
import { toISODate } from './streak'
import {
  flushPending,
  handleNotificationResponse,
  type NotificationResponseLike,
} from './notificationActions'

const SIGNED_OUT_ID = 'okay-tap-signed-out'

async function fireSignedOutPrompt(): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    identifier: SIGNED_OUT_ID,
    content: {
      title: 'circly',
      body: 'open the app to check in',
      ...(Platform.OS === 'android' && { channelId: 'default' }),
    },
    trigger: null,
  })
}

async function getCachedUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession()
  return data.session?.user?.id ?? null
}

const DEFAULT_ACTION = 'expo.modules.notifications.actions.DEFAULT'

export function setupNotificationResponseListener(): { remove: () => void } {
  const sub = Notifications.addNotificationResponseReceivedListener((response) => {
    // Plain notification tap on a confirmation that carries a deep-link payload
    // (currently only the struggling confirmation): route the user there.
    if (response.actionIdentifier === DEFAULT_ACTION) {
      const data = response.notification.request.content.data as
        | { tapRoute?: string }
        | undefined
      if (data?.tapRoute) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        router.push(data.tapRoute as any)
      }
      return
    }

    void handleNotificationResponse(response as NotificationResponseLike, {
      supabase,
      getUserId: getCachedUserId,
      todayISO: toISODate(new Date()),
      fireConfirmation: fireCheckinConfirmation,
      fireSignedOutPrompt,
    })
  })
  return { remove: () => sub.remove() }
}

export async function flushPendingNotificationCheckins(): Promise<void> {
  await flushPending({ supabase })
}
```

- [ ] **Step 2: Verify the file still compiles**

Run:

```bash
cd apps/mobile && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Re-run the notifications tests to make sure existing ones still pass**

Run:

```bash
cd apps/mobile && npx jest lib/notifications.test.ts lib/notificationActions.test.ts
```

Expected: all previous tests pass (mocks for setNotificationCategoryAsync, scheduleNotificationAsync etc. cover the new code paths transitively).

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/lib/notifications.ts
git commit -m "expose response listener and pending-flush wiring for app startup"
```

---

### Task 13: Wire setup + flush into `_layout.tsx`

**Files:**
- Modify: `apps/mobile/app/_layout.tsx`

Register the category once on mount, attach the response listener (kept for the lifetime of the app), and flush the pending queue every time the app foregrounds via `AppState`.

- [ ] **Step 1: Add the imports and the new effect**

In `apps/mobile/app/_layout.tsx`, add to the import block at the top:

```ts
import { AppState, type AppStateStatus } from 'react-native'
import {
  registerDailyCheckinCategory,
  setupNotificationResponseListener,
  flushPendingNotificationCheckins,
} from '../lib/notifications'
```

Then inside `RootLayout`, after the existing `useEffect` blocks, add:

```ts
  useEffect(() => {
    void registerDailyCheckinCategory()
    const listener = setupNotificationResponseListener()
    void flushPendingNotificationCheckins()

    const onChange = (state: AppStateStatus) => {
      if (state === 'active') {
        void flushPendingNotificationCheckins()
      }
    }
    const sub = AppState.addEventListener('change', onChange)

    return () => {
      listener.remove()
      sub.remove()
    }
  }, [])
```

- [ ] **Step 2: Verify the file compiles**

Run:

```bash
cd apps/mobile && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Verify lint**

Run:

```bash
cd apps/mobile && npm run lint
```

Expected: no warnings.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/app/_layout.tsx
git commit -m "register notification category and pending-queue flush on app startup"
```

---

### Task 14: Update in-app check-in upsert to set `source: 'in_app'`

**Files:**
- Modify: `apps/mobile/app/(recovery)/check-in.tsx`

The migration backfills existing rows to `'in_app'`, and the column has `default 'in_app'`, so behaviour is correct without this change. We pass it explicitly anyway so the call site documents intent and future migrations can change the default safely.

- [ ] **Step 1: Edit the upsert call**

In `apps/mobile/app/(recovery)/check-in.tsx`, modify the upsert call inside `handleSave` (the existing block at lines 78-88). Replace the `.upsert(...)` payload with:

```ts
    const { error, data } = await supabase
      .from('check_ins')
      .upsert(
        {
          user_id: user.id,
          status,
          note: note.trim() || null,
          check_in_date: todayISO,
          source: 'in_app',
        },
        { onConflict: 'user_id,check_in_date' }
      )
      .select('id, status, note, check_in_date')
      .single<CheckInRow>()
```

(Only the addition of `source: 'in_app',` is new. Leave everything else as-is.)

- [ ] **Step 2: Verify the file compiles**

Run:

```bash
cd apps/mobile && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/app/(recovery)/check-in.tsx
git commit -m "set source=in_app explicitly on in-app check-in upsert"
```

---

### Task 15: Full test suite + manual smoke checklist

**Files:**
- None (verification only)

- [ ] **Step 1: Run the full mobile test suite**

Run:

```bash
cd apps/mobile && npm test -- --watchAll=false
```

Expected: all tests pass, including the new `notifications.test.ts` (6 tests) and `notificationActions.test.ts` (24 tests). No regressions in `streak.test.ts`, `auth.test.ts`, `mood.test.ts`, etc.

- [ ] **Step 2: Run typecheck and lint**

Run:

```bash
cd apps/mobile && npm run typecheck && npm run lint
```

Expected: both pass with no errors and no warnings.

- [ ] **Step 3: Manual smoke test on a physical device (this REQUIRES a dev build, not Expo Go — notification action categories are not supported in Expo Go on iOS)**

Build a dev client if not already available:

```bash
cd apps/mobile && npx expo run:ios   # or run:android
```

Then run through this checklist (recovery account, both contexts):

1. Trigger the daily reminder early by setting reminder time to ~2 minutes ahead in the app's notification settings, then background the app.
2. When the notification fires on the lock screen:
   - iOS: long-press → expect three buttons (good, okay, struggling) with struggling rendered red
   - Android: expect three inline buttons under the body
3. Tap **good** without unlocking the phone:
   - Notification dismisses
   - A confirmation notification "logged. have a good one. ✓" appears within ~1s
   - Open the app → today's check-in row exists with status `good_day`, source `notification`
4. Re-trigger reminder, tap **okay**:
   - Confirmation reads "logged. one foot in front of the other. ✓"
   - DB row for today is updated (not duplicated) with status `sober`, source `notification`
5. Re-trigger reminder, tap **struggling**:
   - Confirmation reads "logged. your circle has been notified. tap to talk →"
   - Tap the confirmation → app opens to `/(recovery)/chat`
   - Supporters connected to this account receive their existing struggling-mood signal
6. Sign out, re-trigger reminder, tap any mood:
   - "open the app to check in" appears, no DB row written
7. Enable airplane mode, re-trigger reminder, tap **good**:
   - Confirmation still appears (we always fire it locally)
   - Disable airplane mode, foreground the app
   - Within a moment, the queued check-in is written to the DB

- [ ] **Step 4: Final commit (only if you needed any small fixes during smoke)**

If smoke tests passed without code changes, skip. Otherwise commit fixes with a focused message.

---

## Out of Scope (Reminder)

Per spec §8, this plan does NOT cover:
- Action buttons on any other notification (warm pings, encouragement)
- Free-text input from the notification
- A daily reminder for supporters
- Custom per-user reminder copy
- Home-screen widgets (separate stashed spec)
- Analytics dashboards on `source` (queryable later)
