# Retention Moments — Design Spec

**Date:** 2026-05-04
**Status:** Approved
**Scope:** Five retention/onboarding moments across recovery and supporter roles

---

## 1. Overview

Five retention gaps were identified during product review:

1. No explicit "I relapsed / start fresh" affordance — users would have to dig into profile settings and edit their sobriety date manually.
2. The day-one feed for new recovery users is empty and gives no direction.
3. The very first check-in is identical to the 100th — no warmth, no orientation.
4. Supporters who arrive cold (no invite code) hit a blank state with no path forward.
5. Streak milestones tick up silently — no acknowledgement, no shared moment with supporters.

This spec covers the design fix for each.

### 1.1 Role scoping (global rule)

**Sections 2, 3, 4, and 6 apply to recovery accounts only.** Supporter accounts retain current generic behavior for those screens. Section 5 (Supporter first-run) is, by definition, supporter-only.

Implementation should branch on `user.role === 'recovery'` before applying any of the recovery-only treatments.

---

## 2. Streak Break / "Start Fresh" Flow (Recovery only)

### 2.1 Entry points

Two entry points, always available:

**A. Reset chip on the streak card.** Wherever the streak number is shown (home feed streak card, profile screen), a small `↻ reset` chip is rendered to the right of the day count. Tapping it opens the confirm sheet (2.2).

**B. Inside the check-in flow, when "struggling" mood is selected.** A soft inline card appears below the mood scale:

> **need a fresh start?**
> if today wasn't a clean day, you can reset your start date. it's not a failure, it's honesty.
> [↻ start fresh]

Tapping the button opens the same confirm sheet.

### 2.2 Confirm sheet (two-step gentle)

A bottom sheet:

- Title: "today is day one again."
- Body: "that took courage."
- Primary button: "reset to today" (amber, full width)
- Secondary: "cancel" (text-only)

On confirm: `sobriety_start_date` is set to today's date, `last_milestone_celebrated_days` is cleared to `0` (so milestones from the new journey will re-celebrate), sheet dismisses, user lands back on whatever screen they were on (home feed or check-in). The streak card now reads "0 days" / "day one".

### 2.3 Supporter signal (soft)

When a recovery user resets, supporters in their circle see a single feed card on their next feed load:

- Visual: same style as other feed cards, accent border in the encouragement amber
- Copy: "[name] started fresh today" (no mention of relapse)
- Tappable → opens the existing send-encouragement flow pre-targeted to that person

**No push notification.** This is intentional — surfacing the moment via push at someone's lowest point would feel exposing.

---

## 3. Empty Feed (Recovery, Day One)

### 3.1 Pre first check-in

Recovery user with zero check-ins ever: feed shows one big warm card and nothing else.

- Style: full-width card, amber gradient background, larger than normal feed cards
- Copy: "welcome. start with your first check-in."
- CTA: large amber button "check in →"
- Tap → routes to the check-in tab (which then runs the first-check-in intro, section 4)

### 3.2 After first check-in

Once the user has at least one check-in, the day-one feed shows:

1. The completed check-in card (standard styling, as on any other day)
2. One quiet secondary card below it: "invite someone who's in your corner →" linking to the add-supporter flow

Nothing else. No tip cards, no ghost/sample cards, no "what this app does" copy.

### 3.3 Day two onward

Standard feed behavior. The "invite a supporter" card persists in the feed only while the user has zero connections; once they add their first supporter, it disappears.

---

## 4. First Check-In Experience (Recovery only)

### 4.1 Intro screen (before the very first check-in)

When a user with zero historical check-ins opens the check-in flow for the first time, a full-screen intro appears before the standard check-in:

- Centered text: "this is your daily check-in."
- Subtext: "one minute, every day. that's the whole thing."
- Single button at bottom: "begin"
- Tap → standard check-in screen

Shown exactly once per user, gated on a flag (e.g. `profiles.first_checkin_intro_seen` boolean).

### 4.2 Check-in screen itself

**Unchanged from every other day.** No inline coaching, no helper text, no guides. The standard check-in is the experience.

### 4.3 Celebratory screen (after first-ever submit)

After the first check-in is successfully saved, a full-screen celebratory moment:

- Centered text: "day one. you showed up."
- Single button: "continue"
- Tap → routes to the home feed (which now shows the post-first-checkin state from 3.2)

Shown exactly once. Subsequent check-ins return directly to the feed as today.

---

## 5. Supporter First-Run

Two arrival paths exist and need different treatment. Branching is determined at first home-screen load by checking whether the supporter has any active connections.

### 5.1 Connected path (arrived via invite code)

The supporter signed up using an invite code, so they already have one active relationship. On their first home-screen load:

- Full-screen intro: "[name] invited you."
- Subtext: "here's what they've been working on."
- Primary button: "see their journey"
- Tap → a richer first-time view of the connected person showing: avatar, current streak, most recent check-in mood, current intention if any. Single CTA at bottom: "go to feed →"
- Tap → standard supporter feed (which now contains that person's recent activity)

The intro is shown exactly once per supporter, gated on a flag.

### 5.2 Cold path (no invite code, no connections)

The supporter signed up without a code. On first home-screen load:

- Full-screen onboarding-style screen
- Heading: "who are you here for?"
- Two large buttons stacked:
  - "i have an invite code" → opens invite-code entry
  - "i want to invite someone" → opens the invite-creation flow
- A small "skip for now" text link at the bottom → lands on a polite empty feed: "your circle is waiting. add someone when you're ready."

After the user completes either action and gains their first connection, the next time they load the home feed, the connected-path intro (5.1) is shown for that newly-added person.

---

## 6. Milestone Celebrations (Recovery only)

### 6.1 Milestone schedule

Frequent early, sparse later:

- 1 day
- 3 days
- 1 week
- 2 weeks
- 1 month
- 3 months
- 6 months
- 1 year
- then yearly (2 years, 3 years, etc.)

A milestone is "hit" when the streak (days since `sobriety_start_date`) equals one of these values.

### 6.2 Recovery user — full-screen takeover

On the first home-screen load of the milestone day, a full-screen celebratory moment:

- Subtle ambient animation (gentle particle drift or soft glow pulse — kept minimal, no confetti)
- Centered milestone label: e.g. "1 week.", "1 month.", "1 year."
- Affirming line below: "you did this."
- Single button: "continue"
- Tap → home feed

Shown once per milestone — gated by storing the highest milestone-day already celebrated on the user's profile (e.g. `last_milestone_celebrated_days INT`).

### 6.3 Recovery user — persistent feed card

After the takeover dismisses, a special celebratory feed card is appended to the recovery user's feed for that milestone day:

- Style: distinct from regular cards — slightly larger, amber background tint, milestone label badge
- Copy: e.g. "🌱 1 week clean. quiet wins matter."
- Stays in the feed history permanently (does not auto-disappear)

### 6.4 Supporter — connection card

When a connected recovery user hits a milestone, every supporter in their circle sees a parallel card in their feed:

- Style: matches the recovery card's celebratory tint
- Copy: "[name] hit 1 week."
- CTA: "send encouragement →" tappable, pre-targets that person in the existing encouragement flow

Push notification rules for milestones are out of scope here — they follow whatever existing push preferences the supporter has set.

---

## 7. Data / State Additions

The following minimal state additions are needed (exact schema in the implementation plan):

- `profiles.first_checkin_intro_seen BOOLEAN` — gates section 4.1
- `profiles.first_checkin_celebration_seen BOOLEAN` — gates section 4.3
- `profiles.supporter_first_run_seen BOOLEAN` — gates section 5.1 / 5.2
- `profiles.last_milestone_celebrated_days INT` — gates section 6.2 (stores the highest milestone already celebrated for the current `sobriety_start_date`; reset to `0` whenever the user starts fresh per section 2.2)
- "Started fresh" supporter card (section 2.3) and milestone cards (section 6.3, 6.4): generated from existing data — no new persisted card type needed if derivable from `sobriety_start_date` history and current streak. If `sobriety_start_date` reset events aren't already audited, a small `sobriety_resets` table will be needed (one row per reset).

---

## 8. Out of Scope

- Push notifications for milestones (defer to existing push preferences)
- Any change to the regular daily check-in screen
- Streak repair / "I made a mistake, undo my reset" flow
- Multi-language copy variations
- Analytics events for these moments (can be added later)
- Custom milestone messages per supporter
