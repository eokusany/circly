# Circly V1 Polish — Design Spec

**Date:** 2026-05-03  
**Status:** Approved  
**Scope:** Retention features, navigation redesign, onboarding redesign, journal improvements, design system consistency

---

## 1. Overview

Circly's core functionality is solid. This spec covers the changes needed before public release to give users — specifically people in recovery — a reason to return daily. The focus is on three areas: a feed-based home experience that creates a daily habit loop, a navigation redesign that makes the most important actions always reachable, and an onboarding redesign that matches the app's visual language.

---

## 2. Feed — Home Tab Becomes the Feed

### 2.1 Core concept

The existing home tab is replaced by a feed. The streak snapshot is pinned at the top of the screen; feed cards scroll below. No new tab is added — Home becomes Feed.

The feed has two layers:
- **Daily Pulse** — one contextual card surfaced after each check-in, chosen based on the user's recovery stage and history
- **Passive cards** — milestones, memories, and intention slots that appear without requiring action

Cards are curated, not infinite scroll. A user sees 3–6 cards per day, refreshed as they take actions.

### 2.2 Recovery user feed cards

| Card | Trigger | Content |
|------|---------|---------|
| Daily Pulse — Reflection | After check-in | A single question adaptive to recovery stage (day 7 gets different prompts than day 90). Tapping opens a prompted journal entry. |
| Daily Pulse — Memory | Rotates with reflection | "On this day [X weeks/months] ago you wrote…" — pulls from the user's own journal entries. |
| Intention | Daily, empty until set | "Set today's intention — what do you want to carry with you today?" Stored privately. |
| Milestone | On unlock | Celebrates the reached milestone (1d, 1w, 1m, 3m, 1y). Shows which supporters reacted. |

Only one Daily Pulse card appears per check-in. It persists in the feed until the user's next check-in, at which point it is replaced. The card type (reflection vs. memory) is chosen based on: recency of last memory shown, how many journal entries exist, and days-sober count.

### 2.3 Supporter feed cards

| Card | Trigger | Content |
|------|---------|---------|
| Check-in activity | When linked user checks in | Shows user's name, check-in status, and a one-tap "Send encouragement" action. |
| Milestone celebration | When linked user hits milestone | Prominent card with a CTA to send a message. |
| Silence alert | When linked user hasn't checked in past threshold | Warm prompt to reach out: "Marcus hasn't checked in for 3 days." + "Send a message →" |
| Shared intention | When linked user sets an intention | Displays their intention text. Read-only. |

### 2.4 Pinned streak snapshot

Sits between the header and the feed cards. Shows:
- Days sober (large, amber)
- "X days until [next milestone]"
- Milestone progress dots (1d, 1w, 1m, 3m, 1y) — filled, active, or empty states

---

## 3. Navigation Redesign

### 3.1 Bottom tab bar — Option C

The center position of the bottom nav is a raised check-in button (gold gradient, circular). Four tabs flank it.

**Recovery user tabs:** Home · Journal · [Check-in] · Alerts · Profile  
**Supporter tabs:** Home · Connections · Alerts · Profile (no center button — supporters don't check in). Connections maps to the existing invites/linked users screen.

Text labels are kept beneath each tab icon. Active tab uses the amber accent colour.

### 3.2 Header — LinkedIn-inspired

Replaces the current plain header across all main screens.

| Position | Element |
|----------|---------|
| Left | User's avatar (tappable → profile) |
| Centre | "circly" wordmark (lowercase) |
| Right | SOS icon · Add Supporter icon · Messages icon (with unread badge) |

All header icons use the Lucide/Feather icon set. No emojis.

The header is persistent across all tabs.

---

## 4. Get Support — Placement

### 4.1 Header icon

A small SOS icon (triangle with exclamation, Lucide `alert-triangle`) sits permanently in the header, styled with a dark red background and red border. Tapping it opens the existing get support flow immediately.

It is visible on every screen in the app via the persistent header — not just the home tab.

### 4.2 Contextual card

When a user checks in with status "Struggling", a full support card automatically appears at the top of the feed (above all other cards):

- Label: "You said you're struggling"
- Body: "Your supporters have been notified. You're not alone."
- CTA: "Talk to someone now →" (opens the existing emergency/encouragement flow)
- Style: dark red border, prominent but not alarming

This card persists until the user's next check-in.

---

## 5. Onboarding Redesign

### 5.1 Flow changes

Current flow (6 steps): Sign up → 4-slide carousel → Context select → Role select → Sobriety date / Invite code

New flow (4 steps): Welcome → Sign up → Role select (merged) → Personalization

The 4-slide intro carousel is removed. Context select and role select are merged into a single "what brings you here?" screen.

### 5.2 Screen designs

**Screen 1 — Welcome**
- Circly logo (actual asset, not placeholder) centred on dark background
- Tagline: "Recovery is easier when you're not alone."
- Two actions: "Get started" (primary, purple gradient) · "Already have an account? Sign in" (text link)
- Subtle radial glow behind logo

**Screen 2 — Create account**
- Header: "create account" (lowercase)
- Subtext: "We keep your data private and secure."
- Fields: Your name · Email · Password
- Privacy note below CTA
- Active field uses purple border highlight

**Screen 3 — Role select**
- Header: "what brings you here?"
- Subtext: "This shapes your experience. You can change it later."
- Two selectable cards:
  - "I'm in recovery" — icon, title, one-line description
  - "I'm supporting someone" — icon, title, one-line description
- Selected card gets purple border; unselected dims
- Privacy note at bottom: lock icon + "Your role is private."
- Continue button disabled until selection

**Screen 4a — Recovery personalization**
- Header: "when did you start?"
- Subtext: "Your streak starts here. Even day one counts."
- Quick preset chips: Today · Yesterday · 1 week ago · 1 month ago
- "Or pick an exact date" toggle → date picker
- Reassurance note: "Every day you've stayed the course counts. You can always update this."
- CTA: "Start my journey" (gold gradient)

**Screen 4b — Supporter personalization**
- Header: "join their circle"
- Subtext: "Enter the invite code they shared with you."
- Single code input (6 chars, uppercase, large)
- "What you'll see" info card listing: shared check-ins · milestone celebrations · silence alerts
- "Skip for now" text link
- CTA: "Join their circle" (purple gradient)

### 5.3 Visual language

All onboarding screens use the same dark background (#0f0f12), amber/purple accent colours, and rounded card components as the main app. No light-mode screens in onboarding.

---

## 6. Journal Changes

### 6.1 Prompted entries (new entry point only)

The journal UI, mood graph, and entry list are unchanged.

New behaviour: tapping "Write your answer →" on a Daily Pulse reflection card opens a new journal entry with the prompt text pre-loaded in a styled chip at the top of the entry. The user writes their answer below it. The entry is saved as a normal journal entry — the prompt chip is display-only metadata.

This is an additional entry point into the existing journal, not a new screen or flow.

### 6.2 Mood scale — Struggling → Thriving

The existing mood slider endpoints are changed from "Struggling / Grateful" to "Struggling / Thriving". These are on the same axis (how the user is doing) and are consistent with recovery language used elsewhere in the app.

---

## 7. Design System Consistency

### 7.1 Typography

Applied consistently across the entire app:
- **Headers / tab labels / screen titles:** lowercase
- **Body text / descriptions / card blurbs:** Sentence case

### 7.2 Icon audit

Every emoji used as a UI icon in the current app is replaced with an equivalent from the Lucide or Feather icon set. Emojis may only appear in user-generated content (journal entries, messages).

Affected areas include but are not limited to: tab bar icons, card labels, onboarding icons, check-in status indicators, milestone badges.

### 7.3 Profile pictures

The avatar system (currently initials-based) already supports this. No change required — users can add photos via profile settings once the header avatar is tappable.

---

## 8. Out of Scope

- Community / peer support features (Phase 2)
- AI reflection prompts (Phase 2)
- Analytics dashboard
- Any changes to the messages/chat screen
- Any changes to settings screens
- Backend infrastructure beyond what feed cards require (see section 9)

---

## 9. Backend Requirements

| Feature | What's needed |
|---------|--------------|
| Daily Pulse card selection | Logic to choose reflection vs. memory card per check-in. Needs access to: days sober, journal entry count, last memory card shown date. |
| Reflection prompts | A static set of prompts bucketed by recovery stage (days 1–7, 8–30, 31–90, 90+). Can be hardcoded initially. |
| Memory card | Query: most recent journal entry from ~same date ±3 days in a prior month. Returns entry text + original date. |
| Intention storage | New field on the user record or a daily intentions table: `user_id`, `date`, `text`. |
| Supporter feed | Existing check-in, milestone, and silence detection events already fire — they need to be surfaced as feed cards rather than only push notifications. |
| Mood scale update | Update the mood enum/range from `struggling–grateful` to `struggling–thriving`. Migration required for existing entries. |
