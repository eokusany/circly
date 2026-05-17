# System-text casing pass — 2026-05-16

Targeted casing fix for strings that render in iOS/Android system shells (push notifications, native modal alerts), where the app's all-lowercase brand voice reads as broken or unfinished. The in-app brand voice (lowercase) is preserved everywhere else.

## In scope

Sentence-case the following:

### 1. Push notification titles

In [apps/mobile/lib/notifications.ts](apps/mobile/lib/notifications.ts), three `title: 'circly'` occurrences at lines 31, 88, 112. Change to `'Circly'` — the brand reads correctly when iOS renders it bold in the notification card.

### 2. Push notification bodies

Sentence-case the body strings in the same file and in [apps/mobile/lib/notificationActions.ts](apps/mobile/lib/notificationActions.ts):

- `notifications.ts:32` → `"How's today going? Tap below to check in."`
- `notifications.ts:113` → `"Open the app to check in"`
- `notificationActions.ts:23` → `"Logged. Have a good one. ✓"`
- `notificationActions.ts:27` → `"Logged. One foot in front of the other. ✓"`
- `notificationActions.ts:31` → `"Logged. Your circle has been notified. Tap to talk →"`

### 3. Native `Alert.alert` dialogs

Every `Alert.alert(title, body, ...)` call in `apps/mobile/**` — sentence-case both the title and the body. iOS renders Alert title bold, and lowercase looks like a typo in the system context. Approximately 30+ instances spread across:

- `app/(auth)/sign-up.tsx`
- `app/(auth)/forgot-password.tsx`
- `app/(auth)/verify-reset.tsx`
- `app/(auth)/invite-code.tsx`
- `app/(auth)/account-select.tsx`
- `app/(auth)/sobriety-start.tsx`
- `app/(profile)/edit-photo.tsx`
- `app/(profile)/change-email.tsx`
- `app/(profile)/change-password.tsx`
- `app/(profile)/delete-account.tsx`
- `app/(profile)/reset-sobriety.tsx`
- `app/(recovery)/silence-settings.tsx`
- `app/(recovery)/index.tsx`
- `app/(recovery)/start-fresh.tsx`
- `app/(recovery)/supporter-settings.tsx`
- `app/(supporter)/index.tsx`
- `app/(supporter)/invite.tsx`
- `hooks/useEmergencyAlert.ts`
- `hooks/useRealtimeNotifications.ts`
- `components/feed/TodayCheckInCard.tsx` (`'couldn't save check-in'`)

Title rule: capitalize the first word. Body rule: capitalize the first word of each sentence; preserve any embedded proper nouns (`Circly`).

Examples of the transformation:
- `Alert.alert('missing fields', 'please fill in all fields.')` → `Alert.alert('Missing fields', 'Please fill in all fields.')`
- `Alert.alert('could not save', 'check your connection and try again.')` → `Alert.alert('Could not save', 'Check your connection and try again.')`
- `Alert.alert('couldn't save check-in', 'please try again in a moment.')` → `Alert.alert("Couldn't save check-in", 'Please try again in a moment.')`

## Out of scope — brand voice stays lowercase

Do not touch any of the following. They are deliberate brand voice and the user explicitly wants them preserved:

- The `AppHeader` wordmark `"circly"` (user reviewed three header variants and kept lowercase).
- All in-app card titles, labels, badges, headings (`"today's reflection"`, `"sober for"`, `"today: sober"`, etc.).
- Reflection prompts (`getPromptForDay` output).
- Encouragement strings (`pickEncouragement` output).
- Milestone copy (`"1 day clean. quiet wins matter."`).
- Tab bar labels (`"home"`, `"journal"`, `"hold"`, `"messages"`, `"add"`).
- `app.json` `name` / `slug` (likely already `"Circly"` for the App Store; verify, do not change in-app rendering).

## Out of scope — server-side push payloads

The server-side push notification *titles* (in `server/src/services/pushNotifications.ts` and any route that constructs push payloads) are not touched in this pass. The mobile client receives the payload and renders it, but the strings live server-side. They warrant the same treatment and are filed for a follow-up.

## Success criteria

- Every iOS native `Alert.alert` modal renders with a sentence-cased title and body.
- Every locally-scheduled push notification (`expo-notifications` `scheduleNotificationAsync` call in `apps/mobile/**`) has a sentence-cased title and body.
- The in-app screens (StreakCard, DailyPulseCard, headers, tabs, cards) remain unchanged — visual diff on home, journal, messages, and profile screens shows zero change.
- All existing mobile tests pass without modification, except for any test that asserts the literal title/body string of an alert or notification — those tests get updated to the new casing.

## Risks

- Some tests assert exact alert text. They'll fail and need their assertion strings updated to match the new casing. This is mechanical, no behavior change.
- The mobile-side strings won't fully fix the system-shell text problem until the server-side push strings are also updated (out of scope here, follow-up).
