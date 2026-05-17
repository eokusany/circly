# Home polish pass — 2026-05-16

A pre-launch visual tidy-up of the recovery home screen. Scope is intentionally narrow: three surgical changes that lower visual noise without touching navigation, layout, or copy. No structural refactors.

## In scope

Three independent tweaks, all in the StreakCard surface:

### 1. Sole-hero treatment

Today both the StreakCard ("Your effort today is enough.") and the MilestoneFeedCard ("1 day clean. quiet wins matter.") render with an amber border, competing for the eye. Drop the amber border on `MilestoneFeedCard` so the StreakCard is the only hero. Use the standard subtle border (`colors.border`) instead.

**File:** `apps/mobile/components/MilestoneFeedCard.tsx`
**Change:** replace the amber border color with `colors.border`.

### 2. Outlined progress pill

The "6 days to your 1 week" pill inside StreakCard is filled, which reads like a tap target. Make it outlined (transparent background + amber border + amber text) so it reads as info, not an action.

**File:** `apps/mobile/components/feed/StreakCard.tsx`
**Change:** swap the pill's filled background for `backgroundColor: 'transparent'` and add `borderWidth: 1, borderColor: colors.accent`.

### 3. Current-milestone dot hierarchy

In the milestones row (1 day · 1 week · 1 month · 3 months · 1 year), the active milestone (1 week, currently a ring) and past milestone (1 day, currently filled green) read at the same weight. Make the current one a touch larger with a soft halo and the label color bumped to `colors.accent` with `fontWeight: '600'` so the eye lands on "where you are now".

**File:** `apps/mobile/components/feed/StreakCard.tsx`
**Change:**
- Current dot: increase size from current diameter to ~18px, add a soft amber halo (`shadowColor: colors.accent, shadowOpacity: 0.15, shadowRadius: 3`, or equivalent ring via `borderWidth: 2` + outer `View`).
- Current label: switch to `colors.accent` + `fontWeight: '600'`.
- Past, future dots: unchanged.

## Out of scope

Decisions made during brainstorm — not in this pass, do not implement:

- Header changes (wordmark removal, bell glyph size bump, avatar ring). User reviewed all three header variants and explicitly chose to keep the current header as-is.
- Anything else (SOS button, tab bar, reflection card, check-in card, journal screens).

## Success criteria

On the recovery home screen:

- Only one card has an amber border (the StreakCard).
- The "X days to your 1 week" pill reads as info, not an interactive control.
- The active milestone dot is visibly the focal point of the dots row.

Visual change only — no behavior, no API, no route changes. Existing tests should continue to pass without modification.

## Risks

- The MilestoneFeedCard is used on both recovery and supporter home screens. Confirm during implementation that the supporter rendering still looks correct after the border change. If the supporter context needs the amber border for its own emphasis, scope the change to recovery only via a prop.
- Halo via shadow on Android renders differently than iOS. If the shadow approach is visually weak on Android, use a wrapper `View` with `borderWidth` to achieve the ring effect cross-platform.
