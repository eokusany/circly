# Visual System Foundation — Design Spec

**Status:** Approved (brainstorm 2026-05-05)
**Branch:** `feat/nav-sos-redesign` (this work lands alongside the nav-sos redesign)
**Predecessors:** `2026-05-05-nav-sos-redesign-design.md` (covers tab layout + SOS press-and-hold behavior; this spec covers visual styling of the same components)

## Goal

Establish a small set of visual tokens (depth, hero typography, SOS styling), document casing rules, and apply them to the recovery home screen so the streak card reads as a clear visual hero and the rest of the screen feels calm and breathable.

This is an **audit + extend** spec, not a rebuild. Existing spacing, type scale, and color palette stay — the work is filling specific gaps and applying what exists more consistently.

## Motivation

Feedback on the recovery home flagged five visual problems:

- Streak card blends into the screen instead of feeling emotionally important
- Cards stack on a single visual plane — "wall of dark rectangles"
- Bottom tab bar's active state is unclear and inactive icons are too dim
- SOS button styling has been ad-hoc and inconsistent
- Lowercase / uppercase / bold / colored text fight each other without a system

Most foundations already exist in [apps/mobile/constants/theme.ts](apps/mobile/constants/theme.ts) and [apps/mobile/constants/colors.ts](apps/mobile/constants/colors.ts). The gaps are: shadow/elevation tokens, a hero-scale display number, SOS-specific tokens, and documented casing rules.

## Scope

### In scope

- New tokens in `theme.ts`: `displayHero`, `elevation.{card,hero,pressed}`, `sos.*`
- Documented casing-rule comment in `theme.ts`
- New file `apps/mobile/lib/copy/encouragements.ts` with deterministic-by-day-of-year supportive copy
- Apply Tier 2 (hero) treatment to streak card on recovery home
- Apply Tier 1 (card) treatment to today check-in card and reflection card
- Extend usage of existing sage `success` color to positive-mood states
- Apply Variant C active-tab pill (pill background + hairline amber border, amber icon, white label) to recovery and supporter tab bars
- Apply SOS visual tokens to `CenterSOSButton` (radial gradient + halo ring + halo shadow)
- Force dark color scheme on `(recovery)` and `(supporter)` route groups regardless of system setting

### Out of scope

- **Tab bar layout** — already covered by `2026-05-05-nav-sos-redesign-design.md`
- **SOS press-and-hold behavior** — already covered by the nav-sos spec; this spec only changes the SOS button's appearance
- **Animated streak ring** (feedback #10A) — separate spec
- **Mood gradient background** (feedback #10B) — separate spec
- **Real stats page** (feedback #10D) — separate spec
- **Haptics / micro-interactions** (feedback #10C) — separate spec
- **Light-mode equivalents of elevation tokens** — superseded by the force-dark decision below
- **Supporter home, journal, chat, profile, settings application** — token rules will exist but applying them is a follow-up spec
- **Color palette overhaul** — sage `success` is already in the palette; only its usage expands

## Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Depth approach | **Hybrid**: Tier 1 = gradient surface + thin border (no shadow); Tier 2 = warm amber halo glow + warmer gradient surface | Standard cards stay calm and breathable; one visual climax per screen on the hero |
| Typography casing rules | **Layered, semantic**: `UPPERCASE` = labels; sentence case = content; lowercase = brand voice (wordmark, supportive whispers) | Each casing carries information rather than competing |
| Rotating supportive copy | **In scope, deterministic by day-of-year**, hardcoded array | Visible payoff, stable within a day, dumb and testable |
| Active tab pill | **Variant C**: pill background + hairline amber border, icon turns amber, label stays white | Mirrors the hero card glow language; clearest indicator |
| SOS button styling | **Locked tokens** (radial gradient `#D9736A → #A93A30`, halo ring `rgba(217,115,106,0.12)`, halo shadow) | User signaled this exact treatment is the brand vision |
| Color scheme on recovery + supporter surfaces | **Force dark** regardless of system setting | Calmer, friendlier for late-night recovery use; settings/profile/chat keep both schemes |

## Tokens added

```ts
// apps/mobile/constants/theme.ts

// Hero-scale display number (sobriety streak).
// Existing display = 56pt; not heroic enough.
export const type = {
  ...,
  displayHero: { fontSize: 96, fontWeight: '700' as const, letterSpacing: -3, lineHeight: 92 },
}

// Elevation tiers — replaces ad-hoc shadows scattered in components.
export const elevation = {
  card: {
    // Tier 1: gradient + thin border, no shadow. Standard cards.
    borderWidth: 1,
    borderColor: Colors.dark.border,
    // Gradient applied via expo-linear-gradient: surface top → surfaceSunken bottom.
  },
  hero: {
    // Tier 2: warm amber halo + warmer gradient surface. Hero card and active states.
    shadowColor: Colors.dark.accent,
    shadowOpacity: 0.18,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8, // Android — color is platform-default gray (see Risk #1)
    borderWidth: 1,
    borderColor: 'rgba(217,167,102,0.18)',
  },
  pressed: {
    // SOS hold-to-fill ring. Scaled-down hero shadow.
    shadowOpacity: 0.10,
    shadowRadius: 12,
  },
} as const

// SOS-specific token (single source of truth — used by CenterSOSButton).
export const sos = {
  gradient: { start: '#D9736A', end: '#A93A30' }, // radial, top-biased
  haloRing: 'rgba(217,115,106,0.12)',             // 4px ring
  haloShadow: { color: 'rgba(217,115,106,0.35)', radius: 24, offsetY: 8 },
} as const
```

**Casing-rule comment** added at the top of `theme.ts`:

```
// Casing rules:
// - type.label  → UPPERCASE for tier indicators ("DAYS SOBER", "TODAY'S CHECK-IN")
// - type.body / type.bodyStrong → sentence case for sentences and content
// - lowercase reserved for brand voice (wordmark "circly", supportive whispers)
// Do not mix these arbitrarily within a single screen.
```

**No spacing changes.** The existing 4-base scale (`xs/sm/md/lg/xl/xxl/xxxl` = 4/8/12/16/24/32/48) covers the 8pt feedback request via `sm/lg/xl/xxl`.

**No color additions.** Sage `success` (#5C9E7A / dark #7DB896) and amber `accent` (#C58A3F / dark #D9A766) are already in [colors.ts](apps/mobile/constants/colors.ts) — extend their usage.

## Application changes

| File | Change |
|---|---|
| `apps/mobile/constants/theme.ts` | Add `displayHero`, `elevation`, `sos` tokens. Add casing-rule comment block. |
| `apps/mobile/lib/copy/encouragements.ts` | **New.** Array of supportive lines + `pickEncouragement(dayOfYear: number): string`. Pure function, no React. |
| `apps/mobile/components/feed/StreakCard.tsx` | **New file.** Extract inline `StreakCard` from [`(recovery)/index.tsx:374`](apps/mobile/app/(recovery)/index.tsx#L374). Apply Tier 2 hero treatment: 96pt number, glowing progress fill, pill badge replacing "X days until Y" copy, encouragement line under number. |
| `apps/mobile/components/feed/DailyPulseCard.tsx` | Apply Tier 1 (`elevation.card`). Soften input (focus ring uses sage `success` at low alpha). Loosen quote `lineHeight`. |
| `apps/mobile/components/feed/TodayCheckInCard.tsx` | Apply Tier 1. Active mood chip ("good") uses sage `success`; "okay" / "struggling" stay neutral. |
| `apps/mobile/app/(recovery)/index.tsx` | Replace inline `StreakCard` with import. Audit spacing — convert any hardcoded numbers to `spacing.*` tokens. Apply casing rules. |
| `apps/mobile/app/(recovery)/_layout.tsx` | Apply Variant C active treatment via per-tab `tabBarButton` render functions (recovery uses Expo Router's built-in `<Tabs>`, not a custom component). Pass forced-dark scheme down via context (see "Force-dark implementation" below). |
| `apps/mobile/app/(supporter)/_layout.tsx` | Same forced-dark context wrap. |
| `apps/mobile/components/CenterSOSButton.tsx` | Apply `sos` tokens: radial red gradient, halo ring, halo shadow. Press-and-hold scale animation already exists from nav-sos spec — leave untouched. |
| `apps/mobile/components/SupporterTabBar.tsx` | Apply Variant C active treatment: pill background + hairline amber border, icon turns amber, label stays white. Brighten inactive label color to `#9A958A`. |
| `apps/mobile/hooks/useColors.ts` | Accept an optional forced-scheme override read from a new `ForcedSchemeContext`. Default behavior (read from `useColorScheme()`) preserved when no provider is present. |

### Streak card visual specifics

- Surface: `LinearGradient` `#2A2218 → #1B1A17` top-to-bottom
- Border: 1px `rgba(217,167,102,0.18)`
- Shadow: amber halo (see `elevation.hero`)
- Number: `type.displayHero` (96pt). When `days >= 1000`, fall back to `type.display` (56pt) to avoid overflow on small devices.
- "DAYS SOBER" label below number — `type.label` in `Colors.dark.accent`
- Progress bar: 6px tall, track `rgba(255,255,255,0.06)`, fill = horizontal gradient `#C58A3F → #D9A766` with a 12px-radius amber shadow (the "glowing fill")
- Pill badge: rounded pill with `rgba(217,167,102,0.12)` background, amber text. Copy: `"X days to your first week"` (or `"X days to <next milestone>"`), replacing the `"X days until 1 week"` phrasing
- Encouragement line: rendered above or below the number area; sentence-case, `Colors.dark.textSecondary`. Selected via `pickEncouragement(dayOfYear)`.

### Force-dark implementation

Recovery and supporter route groups must render in dark mode regardless of the system color scheme.

- Add a new `ForcedSchemeContext` in `apps/mobile/hooks/useColors.ts` (or a new co-located file). Default value: `null` (no override).
- Refactor the existing `useColors()` hook so it reads the context first; falls back to `useColorScheme()` when the context returns `null`.
- Wrap the `(recovery)/_layout.tsx` and `(supporter)/_layout.tsx` returns in `<ForcedSchemeContext.Provider value="dark">`.
- All other screens (settings, profile, chat) get neither the provider nor any change — they keep tracking the system scheme as today.

This keeps the override scoped to the route groups that need it, doesn't leak into unrelated screens, and is trivial to remove later if we revisit the decision.

### encouragements.ts shape

```ts
const lines = [
  "You showed up today.",
  "One day at a time still counts.",
  "Small streaks become new lives.",
  "You made it through today.",
  // ... grow over time, no upper bound
] as const

export function pickEncouragement(dayOfYear: number): string {
  return lines[dayOfYear % lines.length]
}
```

Stable within a day (no jitter on screen re-open), changes daily, deterministic in tests.

## Testing

### Unit tests (new)

- `apps/mobile/lib/copy/encouragements.test.ts`:
  - Same `dayOfYear` always returns the same string
  - Cycling `0..lines.length+5` returns each line in order, then wraps
  - Never returns `undefined`
- `apps/mobile/components/feed/StreakCard.test.tsx`:
  - Renders streak number and DAYS SOBER label
  - Progress fill width matches `days / nextMilestone` ratio
  - Pill renders correct phrasing (`"X days to your first week"` not `"... until 1 week"`)
  - Encouragement line rendered

### Existing tests to update

- `TodayCheckInCard.test.tsx` — assert sage `success` token used for active "good" chip (token-level check, not pixel)
- Snapshot updates expected on `(recovery)/index.tsx` after `StreakCard` extraction

### Manual verification (called out, not automated)

- iOS simulator + a physical Android device — shadows render differently between platforms
- Confirm Tier 2 glow visible-but-not-garish on iPhone 13 mini (smallest target) and a Pixel
- Confirm tab bar pill doesn't bleed into safe-area on devices with home-indicator
- Confirm `(recovery)` and `(supporter)` screens stay dark when system is set to light

### Out of scope for tests

- Visual regression / screenshot tests — not currently set up in this repo, not adding the infra here

## Rollout

- Single PR off `feat/nav-sos-redesign`. No feature flag — pure visual change with no behavior toggle.
- Eyeball on TestFlight build before merging to `main`, since beta testers will see the change immediately.

## Risks

1. **Android shadow color parity** — RN's Android `elevation` prop doesn't accept color; the amber glow renders as a platform-default gray drop shadow on Android. Mitigation: accept the platform difference rather than fake it with stacked views. Documented here so reviewers don't flag it as a bug.
2. **96pt number overflow at 4-digit streaks** — at 1000+ days (~3 yrs), the number can clip on small devices. Mitigation: in `StreakCard`, fall back to `type.display` (56pt) when `days >= 1000`.
3. **Force-dark on recovery + supporter surfaces is user-visible** — some users with strong light-mode preference may dislike that the recovery home ignores their system setting. Risk accepted: the calming dark surface is part of the recovery product direction, not just an aesthetic preference.
4. **Inline `StreakCard` extraction is a small refactor** — could touch unrelated bits of `(recovery)/index.tsx`. Mitigation: extract first as a no-op refactor, then apply visual changes in the next commit, so the diff stays reviewable.

## Success criteria

- The streak card is the unambiguous visual climax of the home screen — eye lands there first
- A first-time viewer can describe the screen as "calm with one warm focal point" rather than "wall of dark cards"
- Every UPPERCASE / sentence-case / lowercase choice in the touched files maps to a documented rule
- No lint, type, or test regressions; all new tests pass
- TestFlight build passes a quick visual smoke test on at least one iOS and one Android device
