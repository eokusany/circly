# Nav + SOS Redesign — Design Spec

**Date:** 2026-05-05
**Status:** Draft (awaiting user review)
**Scope:** Reorganize the recovery and supporter tab bars and app header so that alerts moves into the header, messages becomes a primary tab, and the recovery center FAB switches from check-in to a press-and-hold SOS button. Pull the daily check-in inline onto the home feed and retire the dedicated check-in screen.

---

## 1. Overview

The current tab bar puts the daily ritual (check-in) front and center and the safety action (SOS) hidden as a small header icon. In practice the safety action is the one that needs to be most thumb-reachable, and the daily ritual is something users return to home to do anyway. This spec inverts that: SOS becomes the prominent center FAB, the check-in moves inline on home, and the header is simplified to one alerts bell.

This is a polish/IA redesign for v1, not a new feature. Data models, the emergency endpoint, the conversation list, and the notifications screen are all unchanged — only how they're surfaced.

---

## 2. App Header

Both recovery and supporter contexts share the same header.

- **Left:** user avatar (28px). Tap → push to profile.
- **Middle:** "circly" wordmark + greeting subtitle (existing copy).
- **Right:** bell icon with unread badge. Tap → push to the existing notifications screen.

Removed from the header: the SOS exclamation icon and the messages chat icon. Both move to the bottom bar.

The unread badge is driven by the existing `useNotificationStore` `unreadCount` selector. Badge style mirrors the current tab badge (red, fontSize 10).

---

## 3. Recovery Tab Bar

Five tabs in fixed order:

1. **home** — `(recovery)/index.tsx`
2. **journal** — `(recovery)/journal.tsx`
3. **\[SOS\]** — center FAB, press-and-hold. Not a real route.
4. **messages** — `(recovery)/chat.tsx` (already exists; today reached via the header icon).
5. **add** — `(recovery)/settings.tsx` (unchanged).

The current `notifications` route stays in the file tree but is removed from the tab bar (`href: null`); the header bell pushes to it.

### 3.1 Center SOS FAB

A new component `CenterSOSButton` replaces `CenterCheckInButton` in the layout's `tabBarButton`. The button:

- Is the same size and elevation as the current check-in button (raised, circular, glowed) but uses the danger color.
- **Tap-down feedback (instant):** scale to 0.94 and slightly dim (~0.85 opacity) for haptic-like visual press response. This applies on every press, even brief ones, so the button always feels tactile.
- **Hold-to-arm:** while still pressed past ~150ms, an SVG progress ring begins filling around the button. Full fill at ~1500ms.
- **Release before full:** ring resets, scale springs back, nothing fires. No modal, no confirmation.
- **Full fill:** trigger `notifyWarning` haptic, fire the existing `POST /api/emergency` call (already used by `handleGetSupport` on the home screen). On success show the same alerts as today ("your supporters have been notified" / "no supporters yet"). On failure show the same error alert.
- **Label:** small "hold" caption under the SOS glyph so the gesture is discoverable.

The home screen's existing top-right SOS icon and the `StrugglingCard`'s "get support" affordance both get rewired to the same single emergency entry point. The home screen no longer needs `handleGetSupport`; struggling card → SOS FAB hint, and emergency lives in one place.

### 3.2 Visibility

The SOS FAB is part of the tab bar, so it's visible on every screen inside `(recovery)`. This is a feature: SOS is reachable from journal, messages, add, and home without navigating back.

---

## 4. Supporter Tab Bar

Three even tabs, no center FAB:

1. **home** — `(supporter)/index.tsx`
2. **messages** — `(supporter)/chat.tsx` (existing; reached today via header icon)
3. **add** — `(supporter)/invite.tsx` (unchanged)

The supporter `notifications` route is removed from the tab bar and reached through the header bell only. No SOS or check-in equivalent — supporters don't have a daily ritual or distress action.

A "send encouragement" or "i'm here" presence-ping center FAB was considered and deferred to v1.1 to keep this redesign scoped.

---

## 5. Home Feed (Recovery)

The check-in capture moves inline. New card order on home, all existing components except the check-in card:

1. Streak card (existing)
2. **Today's check-in card (new)** — see 5.1
3. Today's reflection / memory card (existing `DailyPulseCard` / `MemoryCard`)
4. Intention card (existing)
5. Conditional cards (milestone, struggling, invite-supporter nudge) — existing logic unchanged

### 5.1 Today's check-in card

A new component `TodayCheckInCard` rendered between streak and reflection. The card contains:

- Header: "today's check-in" label + "how are you showing up?" prompt.
- A row of three status chips: good day · sober · struggling. Single-select. Tapping a chip writes immediately to `check_ins` via the existing upsert (same shape as `check-in.tsx#handleSave`).
- Below the chips, an optional inline note input (multi-line, auto-growing, max ~4 lines). On blur, persists the same `note` field.
- If today's status is already saved, the card collapses to a compact summary ("today: sober · 2:14pm · edit") that expands on tap.

When `todayStatus === 'struggling'`, two existing cards continue to render on home below the check-in card:

- `StrugglingCard` (home component) — its "get support" CTA is rewired from calling `handleGetSupport` directly to surfacing a hint that points at the SOS FAB ("hold the SOS button when you're ready"). The button is no longer a duplicate emergency trigger.
- The "need a fresh start?" warning card (currently inside `check-in.tsx`) is moved into a small home-feed component that renders only when `status === 'struggling' && context === 'recovery'`, and pushes to `start-fresh.tsx` as it does today.

### 5.2 Retiring the check-in screen

`(recovery)/check-in.tsx` is deleted. The `Tabs.Screen` entry that referenced it is removed. The `CenterCheckInButton` component is deleted. The `(recovery)/first-checkin-intro.tsx` and `(recovery)/first-checkin-celebration.tsx` screens are kept; they are now reached when the inline card detects the user has zero check-ins (intro) or has just submitted their first (celebration). Routing logic moves into `TodayCheckInCard`.

`(recovery)/start-fresh.tsx` is unchanged — still pushed from the struggling card.

---

## 6. Implementation notes

- New components: `CenterSOSButton`, `TodayCheckInCard`. Both live under `apps/mobile/components/`.
- The press-and-hold gesture uses `react-native`'s `Pressable` with `onPressIn` / `onPressOut` plus a `setTimeout` for the arm threshold and an `Animated.Value` driving both the scale (instant on `onPressIn`) and the ring fill (kicks off after the 150ms arm). `react-native-svg` is already in the dep tree (used elsewhere).
- The header bell reuses `useNotificationStore`. No new store wiring.
- No DB migrations. No API changes. The `/api/emergency` route, `check_ins` table, and `conversations` table are untouched.
- The existing `AppHeader` component is updated to render only avatar / wordmark / bell. Its `onSosPress` and `onMessagesPress` props are removed. Call sites in `(recovery)/index.tsx` and `(supporter)/index.tsx` get a smaller props payload.

---

## 7. Out of scope

- New conversation list UI (the existing `chat.tsx` is already a list).
- Notifications screen redesign (only the entry point changes).
- Supporter encouragement / presence-ping center action.
- Changes to streak, milestone, intention, or journal logic.
- Onboarding flow changes beyond the routing tweaks in 5.2.

---

## 8. Open questions

None at draft time. Iterate inline if anything surfaces during planning.
