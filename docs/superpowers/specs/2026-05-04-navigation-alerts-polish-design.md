# Navigation, Alerts & Profile Pictures — Design Spec

**Date:** 2026-05-04
**Status:** Approved
**Scope:** Tab bar redesign, header simplification, alerts screen redesign, profile picture support

---

## 1. Overview

Three visual pain points identified during live testing:

1. The recovery tab bar was asymmetric (2 left + raised center + 1 right) after the profile tab was removed.
2. The AppHeader had three icons on the right (SOS + add-supporter + messages) making the wordmark feel off-center.
3. The alerts screen was visually flat — no read/unread state, identical cards regardless of type, no person context.

This spec covers the fixes for all three, plus adding profile picture support to the avatar system.

---

## 2. Tab Bar Redesign

### 2.1 Recovery tab bar

**Before:** Home · Journal · [check-in] · Alerts — 2 left, 1 right (lopsided)

**After:** Home · Journal · [check-in] · Alerts · Add — 2 left, 2 right (balanced)

The "Add" tab replaces the "Profile" tab. It navigates to the existing add-supporter/invite flow (`/(recovery)/settings`). Profile is now only accessible via the header avatar.

The center check-in button is kept: raised, circular, amber with glow.

Tab split uses `Math.ceil(visibleRoutes.length / 2)` so 4 routes → 2 left, 2 right around center.

### 2.2 Supporter tab bar

**Before:** Home · Connections · Alerts — 3 tabs

**After:** Home · Connections · Alerts · Add — 4 even tabs

The "Add" tab navigates to the existing invite/connections flow (`/(supporter)/invite`). Profile removed from tab bar — header avatar only.

### 2.3 Icon for Add tab

Use Lucide/Feather `user-plus` icon, label "add". Follows same active/inactive color rules as other tabs (amber when focused, muted otherwise).

---

## 3. Header Redesign

### 3.1 Recovery header

| Position | Element |
|----------|---------|
| Left | User avatar (tappable → profile) |
| Centre | "circly" wordmark |
| Right | SOS icon · Messages icon |

The add-supporter icon is removed from the header — it now lives in the Add tab.

### 3.2 Supporter header

| Position | Element |
|----------|---------|
| Left | User avatar (tappable → profile) |
| Centre | "circly" wordmark |
| Right | Messages icon only |

Supporters do not have an SOS button — it is a recovery-user-only feature.

---

## 4. Alerts Screen Redesign

### 4.1 Visual treatment

Each alert card has:

- **Colored left border** (3px) by notification type:
  - Encouragement → amber (`colors.accent`)
  - Warm ping → teal (`#4ca8a8`)
  - Message → purple (`#8b5cf6`)
  - Read state → muted grey (`colors.border`)
- **Sender avatar** on the left — real photo if available, initials + person-specific color if not
- **Unread amber dot** on the far right — hidden when read
- **Read dimming** — avatar, name, and body text all reduce to muted opacity when read

### 4.2 Card anatomy

```
[border] [avatar] [name] [type pill]          [time]
                  [body text]
                                              [dot?]
```

Type pill is a small rounded label (e.g. "encouragement", "warm ping", "message") using the same color as the border.

### 4.3 Grouping

When the same sender has sent 3 or more alerts of the same type in a row, collapse them:
- Show the most recent one as a full card
- Show "+ N more from [name] ›" below it as a tappable row that expands inline

### 4.4 Sections

The list is divided into two sections:
- **NEW** — unread alerts
- **EARLIER** — read alerts

Section labels are small uppercase muted text. If there are no unread alerts, the NEW section is omitted.

### 4.5 Mark as read

Tapping any alert card marks it as read immediately (optimistic update). The card fades to its read visual state in place.

---

## 5. Profile Pictures

### 5.1 Avatar component behaviour

The existing avatar component (currently initials-only) is updated to:

1. Show `avatar_url` from the user's profile if present — rendered as a circular `Image`
2. Fall back to initials + background color if `avatar_url` is null

The color used for initials avatars should be consistent per user (derived from user ID, not random) so it doesn't change between renders.

### 5.2 Where avatars appear

- AppHeader (left — current user's own avatar)
- Alerts screen (sender's avatar on each card)
- Feed cards: CheckInActivityCard, SilenceAlertCard, SharedIntentionCard (supporter's linked person)
- Any future screens showing a person (chat list, connections list)

### 5.3 Upload

Profile photo upload is handled via the existing profile settings screen (already tappable from the header avatar). No new UI required — just wire the component to display what's already stored.

---

## 6. Out of Scope

- Changing the check-in screen itself
- Chat screen changes
- Push notification changes
- Any new backend routes (avatar upload already exists; alerts read-state uses existing `is_read` field or equivalent)
