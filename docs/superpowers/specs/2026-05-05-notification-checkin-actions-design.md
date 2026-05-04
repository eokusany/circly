# Notification Check-In Actions — Design Spec

**Date:** 2026-05-05
**Status:** Approved
**Scope:** Add tappable mood buttons to the existing daily check-in reminder so users can log a real check-in without opening the app.

---

## 1. Overview

The app already schedules a daily local notification (see [apps/mobile/lib/notifications.ts:21-40](apps/mobile/lib/notifications.ts#L21-L40)) with the body *"tap to say you're okay — your circle is thinking of you."* Today, tapping the notification only opens the app. The user still has to navigate to the check-in screen and submit.

This spec adds three action buttons (good / okay / struggling) directly to that notification. Tapping any one creates a full `check_ins` row in the background and fires a confirmation notification appropriate to the chosen mood. No app open required.

The result: the lightest-weight check-in path possible while preserving the full mood signal that drives supporter notifications.

## 2. Scope and Account Types

| Account type | Applies? |
|---|---|
| Recovery-substance | Yes |
| Recovery-life | Yes |
| Supporter | No (supporters do not have a daily check-in reminder) |

The existing reminder is already only scheduled for recovery accounts; this spec changes only what happens once the notification is delivered.

## 3. Notification Content

Body copy update (slightly more active than current): *"how's today going? tap below to check in."*

Three action buttons in the notification category, in this order:

| Button label | iOS option flags | Android style | Logged mood value |
|---|---|---|---|
| good | foreground=false, destructive=false | regular | `'good'` |
| okay | foreground=false, destructive=false | regular | `'okay'` |
| struggling | foreground=false, destructive=true | warning-tinted | `'struggling'` |

Notes:
- All three buttons run as background actions (`opensAppToForeground: false` in expo-notifications). The app is not launched.
- "struggling" uses the destructive style so iOS renders it red and it stands out visually as a meaningful signal to the user (matches the colored chip in the mockup).
- The notification category is registered once at app startup via `Notifications.setNotificationCategoryAsync('daily-checkin', [...])`. The existing `scheduleOkayReminder` updates to set `categoryIdentifier: 'daily-checkin'`.

## 4. Tap Behavior — Data

When any mood button is tapped:

1. The notification background handler runs in the app's response listener.
2. The handler creates a `check_ins` row with:
   - `user_id` = the authed user (read from the cached Supabase session)
   - `mood` = the chosen value (`'good' | 'okay' | 'struggling'`)
   - `intention` = `null`
   - `source` = `'notification'` (new column, see §6)
   - `created_at` = now
3. **Idempotency:** if a `check_ins` row already exists for this user today, the handler updates that row's `mood` and `source` instead of creating a duplicate. Today is defined as the user's local calendar day (`YYYY-MM-DD`). This matches in-app behavior, where re-checking-in updates the day's existing entry.
4. The existing supporter-signal logic fires from the database trigger / API path — no new branching.

**Failure handling:**
- If the user has no cached Supabase session (logged out), the tap silently no-ops and a single follow-up notification is fired: *"open the app to check in"* (tappable, opens to sign-in).
- If the network call fails, the tap is queued in `AsyncStorage` under a `pending_notification_checkins` key and retried on the next app foreground. No retry notification is shown.

## 5. Confirmation Notification (After Tap)

Immediately after a successful check-in row write, a follow-up local notification fires. It is shown with a unique identifier (`okay-tap-confirm`) and replaces any prior confirmation so the lock screen never piles up.

| Mood | Body text | Tappable? | Tap target |
|---|---|---|---|
| good | "logged. have a good one. ✓" | No | n/a |
| okay | "logged. one foot in front of the other. ✓" | No | n/a |
| struggling | "logged. your circle has been notified. tap to talk →" | Yes | `/(recovery)/chat` (the chat list) |

All three confirmations are real local notifications and will persist in notification center until the user dismisses them or the system clears them (standard iOS / Android behavior — there is no "auto-dismiss in N seconds" primitive when the app is not in the foreground). The good and okay variants are intentionally non-tappable so they read as soft acknowledgement rather than action. The user can swipe them away.

For struggling, the confirmation is tappable. Tap behavior opens the app and routes directly to the chat list, where the user can pick a supporter to message.

Confirmation notifications use a stable identifier (`okay-tap-confirm`) so a second tap on the same day replaces the previous confirmation rather than stacking.

## 6. Data Model Changes

A single column addition to the `check_ins` table:

```sql
alter table public.check_ins
  add column source text not null default 'in_app'
  check (source in ('in_app', 'notification'));
```

Existing rows backfill to `'in_app'`. No other data model change is required. The `mood` column already accepts the three values; no new mood is being introduced.

## 7. Implementation Notes

### 7.1 Notification category registration

A new module (or addition to [apps/mobile/lib/notifications.ts](apps/mobile/lib/notifications.ts)) registers the category:

```ts
await Notifications.setNotificationCategoryAsync('daily-checkin', [
  { identifier: 'mood-good',       buttonTitle: 'good',       options: { opensAppToForeground: false } },
  { identifier: 'mood-okay',       buttonTitle: 'okay',       options: { opensAppToForeground: false } },
  { identifier: 'mood-struggling', buttonTitle: 'struggling', options: { opensAppToForeground: false, isDestructive: true } },
])
```

### 7.2 Response listener

A new background-safe handler is registered at app startup via `Notifications.addNotificationResponseReceivedListener`. The handler:

1. Reads `response.actionIdentifier` to determine the chosen mood
2. Reads the cached Supabase session to get `user_id`
3. Calls the same direct-Supabase upsert pattern already used by daily intentions (no API server dependency)
4. Triggers the confirmation notification via `Notifications.scheduleNotificationAsync` with a near-immediate trigger
5. On failure, queues the tap in `AsyncStorage`

The listener must be set up early in app startup — not inside a screen — because notification taps can wake the app from a cold state.

### 7.3 Pending queue flush

On every app foreground, a small helper checks `AsyncStorage` for any `pending_notification_checkins`. For each pending entry:
- Try the upsert
- If it succeeds, remove the entry
- If it still fails, leave it for the next foreground

This means a tap during airplane mode will eventually be persisted when the user comes back online and reopens the app.

### 7.4 Files affected

- `apps/mobile/lib/notifications.ts` — register category, update `scheduleOkayReminder` body copy and `categoryIdentifier`, add `setupNotificationResponseListener` and `flushPendingNotificationCheckins`
- `apps/mobile/app/_layout.tsx` — call the setup function once on mount, call the flush function on foreground
- New Supabase migration — add `source` column to `check_ins`
- `apps/mobile/store/auth.ts` or wherever the in-app check-in upsert lives — pass `source: 'in_app'` explicitly so the default works correctly going forward
- Tests for the notification module covering: category registration shape, mood mapping, idempotent upsert, confirmation copy per mood, pending queue flush

## 8. Out of Scope

- Adding action buttons to any notification other than the daily check-in reminder (warm pings, encouragement messages, etc.)
- Allowing users to type an intention or journal entry from the notification (notifications can't host text input on either platform without opening the app)
- A daily reminder for supporters (they don't have one today)
- Custom per-user reminder copy
- Home-screen widgets (covered in the separate stashed spec)
- Analytics on notification-driven check-in rates (the `source` column makes this trivially queryable later but no dashboard is being built now)
