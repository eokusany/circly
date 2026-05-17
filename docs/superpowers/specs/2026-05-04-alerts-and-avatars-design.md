# Alerts & Profile Pictures — Design Spec

**Date:** 2026-05-04 (revised 2026-05-16)
**Status:** Approved
**Scope:** Alerts screen redesign, profile picture support

> **Revision note:** the original spec also covered tab bar and header layout changes. Those were superseded by the work in `feat/nav-sos-redesign` (shipped 2026-05-16). This spec now only covers the alerts screen and avatar/profile picture work, which is still untouched.

---

## 1. Overview

Pain points still outstanding from live testing:

1. The alerts screen is visually flat — no read/unread state, identical cards regardless of type, no person context.
2. The avatar component only renders initials — there is no support for user-uploaded profile pictures, even though the upload flow exists in settings.

This spec covers the fix for both, and treats them together because the alerts redesign depends on real avatars to feel personal.

---

## 2. Alerts Screen Redesign

### 2.1 Visual treatment

Each alert card has:

- **Colored left border** (3px) by notification type:
  - Encouragement → amber (`colors.accent`)
  - Warm ping → teal (`#4ca8a8`)
  - Message → purple (`#8b5cf6`)
  - Read state → muted grey (`colors.border`)
- **Sender avatar** on the left — real photo if available, initials + person-specific color if not
- **Unread amber dot** on the far right — hidden when read
- **Read dimming** — avatar, name, and body text all reduce to muted opacity when read

### 2.2 Card anatomy

```
[border] [avatar] [name] [type pill]          [time]
                  [body text]
                                              [dot?]
```

Type pill is a small rounded label (e.g. "encouragement", "warm ping", "message") using the same color as the border.

### 2.3 Grouping

When the same sender has sent 3 or more alerts of the same type in a row, collapse them:
- Show the most recent one as a full card
- Show "+ N more from [name] ›" below it as a tappable row that expands inline

### 2.4 Sections

The list is divided into two sections:
- **NEW** — unread alerts
- **EARLIER** — read alerts

Section labels are small uppercase muted text. If there are no unread alerts, the NEW section is omitted.

### 2.5 Mark as read

Tapping any alert card marks it as read immediately (optimistic update). The card fades to its read visual state in place.

---

## 3. Profile Pictures

### 3.1 Avatar component behaviour

The existing avatar component (currently initials-only) is updated to:

1. Show `avatar_url` from the user's profile if present — rendered as a circular `Image`
2. Fall back to initials + background color if `avatar_url` is null

The color used for initials avatars should be consistent per user (derived from user ID, not random) so it doesn't change between renders.

### 3.2 Where avatars appear

- AppHeader (left — current user's own avatar)
- Alerts screen (sender's avatar on each card)
- Feed cards: CheckInActivityCard, SilenceAlertCard, SharedIntentionCard (supporter's linked person)
- Any future screens showing a person (chat list, connections list)

### 3.3 Upload

Profile photo upload is handled via the existing profile settings screen (already tappable from the header avatar). No new UI required — just wire the component to display what's already stored.

---

## 4. Out of Scope

- Changing the check-in screen itself
- Chat screen changes
- Push notification changes
- Any new backend routes (avatar upload already exists; alerts read-state uses existing `is_read` field or equivalent)
- Tab bar and header layout (already shipped in `feat/nav-sos-redesign`)
