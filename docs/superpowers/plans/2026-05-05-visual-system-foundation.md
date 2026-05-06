# Visual System Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add elevation/hero/SOS design tokens, enforce a casing rule system, and apply a 2-tier depth treatment to the recovery home screen so the streak card reads as the visual hero and all other cards feel calm beneath it.

**Architecture:** New tokens land in `theme.ts`; a `ForcedSchemeContext` wraps recovery/supporter route groups so they stay dark regardless of system setting; `StreakCard` is extracted from `index.tsx` into its own file then rebuilt with Tier 2 visual treatment; standard cards (check-in, reflection) get Tier 1 (gradient surface + thin border); SOS button and tab bar active states receive dedicated tokens. No behavioral changes.

**Tech Stack:** React Native, Expo Router, `expo-linear-gradient` (adding), `@testing-library/react-native`, Jest (jest-expo preset)

---

## File Map

| Action | Path | Responsibility |
|---|---|---|
| Modify | `apps/mobile/constants/theme.ts` | Add `displayHero`, `elevation`, `sos` tokens + casing-rule comment |
| Modify | `apps/mobile/lib/streak.ts` | Export `prevMilestoneDays` (needed by extracted StreakCard) |
| Modify | `apps/mobile/hooks/useColors.ts` | Add `ForcedSchemeContext`; read forced scheme before `useColorScheme()` |
| Create | `apps/mobile/hooks/useColors.test.tsx` | Tests for forced-scheme override behavior |
| Modify | `apps/mobile/app/(recovery)/_layout.tsx` | Wrap in `ForcedSchemeContext.Provider value="dark"`; add Variant C `tabBarButton` for each regular tab |
| Modify | `apps/mobile/app/(supporter)/_layout.tsx` | Wrap in `ForcedSchemeContext.Provider value="dark"` |
| Create | `apps/mobile/lib/copy/encouragements.ts` | `pickEncouragement(dayOfYear: number): string` + copy array |
| Create | `apps/mobile/lib/copy/encouragements.test.ts` | Unit tests for determinism, cycling, no-undefined |
| Create | `apps/mobile/components/feed/StreakCard.tsx` | StreakCard component (extracted + rebuilt with Tier 2 treatment) |
| Create | `apps/mobile/components/feed/StreakCard.test.tsx` | Tests for new visual structure and encouragement line |
| Modify | `apps/mobile/app/(recovery)/index.tsx` | Import `StreakCard` from file; remove inline definition; remove `prevMilestoneDays`; fix casing + spacing tokens |
| Modify | `apps/mobile/components/feed/TodayCheckInCard.tsx` | Tier 1 elevation; sage `success` color for "good_day" chip |
| Modify | `apps/mobile/components/feed/TodayCheckInCard.test.tsx` | Assert sage `success` color on active "good_day" chip |
| Modify | `apps/mobile/components/feed/DailyPulseCard.tsx` | Tier 1 elevation; looser `lineHeight` on prompt; casing rule |
| Modify | `apps/mobile/components/CenterSOSButton.tsx` | Apply `sos` tokens: radial gradient, halo ring, halo shadow |
| Modify | `apps/mobile/components/SupporterTabBar.tsx` | Variant C active pill: pill bg + amber border, amber icon, white label |

---

## Task 1: Install expo-linear-gradient and add tokens to theme.ts

**Files:**
- Modify: `apps/mobile/constants/theme.ts`

- [ ] **Step 1.1: Install expo-linear-gradient**

Run from the repo root (where `package.json` contains the `apps/mobile` workspace):

```bash
cd apps/mobile && npx expo install expo-linear-gradient
```

Expected: package appears in `apps/mobile/package.json` dependencies and in `node_modules/expo-linear-gradient/`.

- [ ] **Step 1.2: Add tokens to theme.ts**

Open `apps/mobile/constants/theme.ts`. Add directly after the existing exports (after the `layout` block):

```ts
// Casing rules:
// - type.label  → UPPERCASE for tier indicators ("DAYS SOBER", "TODAY'S CHECK-IN")
// - type.body / type.bodyStrong → sentence case for sentences and content
// - lowercase reserved for brand voice (wordmark "circly", supportive whispers)
// Do not mix these arbitrarily within a single screen.

// Hero-scale display number. Existing display (56pt) is not heroic enough.
// Falls back to type.display when days >= 1000 (see StreakCard).
export const displayHero = {
  fontSize: 96,
  fontWeight: '700' as const,
  letterSpacing: -3,
  lineHeight: 92,
} as const

// Elevation tiers.
// Tier 1 (elevation.card): gradient surface + thin border. No shadow. Used on standard cards.
// Tier 2 (elevation.hero): warm amber halo + warmer gradient surface. Hero card and SOS active state.
export const elevation = {
  card: {
    borderWidth: 1,
    borderColor: '#2A2825',       // Colors.dark.border — hardcoded to avoid circular import
  },
  hero: {
    shadowColor: '#D9A766',       // Colors.dark.accent
    shadowOpacity: 0.18,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,                 // Android (no color on Android — renders as gray drop shadow)
    borderWidth: 1,
    borderColor: 'rgba(217,167,102,0.18)',
  },
  pressed: {
    shadowColor: '#D9A766',
    shadowOpacity: 0.10,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
} as const

// SOS button visual tokens — single source of truth for CenterSOSButton.
export const sos = {
  gradientStart: '#D9736A',
  gradientEnd: '#A93A30',
  haloRing: 'rgba(217,115,106,0.12)',
  haloShadowColor: 'rgba(217,115,106,0.35)',
  haloShadowRadius: 24,
  haloShadowOffsetY: 8,
} as const
```

- [ ] **Step 1.3: Typecheck**

```bash
cd apps/mobile && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 1.4: Commit**

```bash
git add apps/mobile/constants/theme.ts apps/mobile/package.json apps/mobile/package-lock.json
git commit -m "add elevation, displayHero, and sos tokens to theme.ts; install expo-linear-gradient"
```

---

## Task 2: Export prevMilestoneDays from streak.ts

StreakCard needs this function. It currently lives as a private helper in `index.tsx`. Moving it to `streak.ts` where it belongs.

**Files:**
- Modify: `apps/mobile/lib/streak.ts`
- Modify: `apps/mobile/app/(recovery)/index.tsx` (remove duplicate after Task 6)

- [ ] **Step 2.1: Add export to streak.ts**

Open `apps/mobile/lib/streak.ts`. Append at the bottom of the file:

```ts
/**
 * Returns the day count of the last reached milestone before `days`.
 * Used for progress bar calculations in StreakCard.
 */
export function prevMilestoneDays(days: number): number {
  let prev = 0
  for (const m of MILESTONES) {
    if (days < m.days) return prev
    prev = m.days
  }
  return prev
}
```

- [ ] **Step 2.2: Typecheck**

```bash
cd apps/mobile && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 2.3: Commit**

```bash
git add apps/mobile/lib/streak.ts
git commit -m "export prevMilestoneDays from streak.ts"
```

---

## Task 3: Add ForcedSchemeContext and update useColors (TDD)

**Files:**
- Modify: `apps/mobile/hooks/useColors.ts`
- Create: `apps/mobile/hooks/useColors.test.tsx`

- [ ] **Step 3.1: Write failing tests**

Create `apps/mobile/hooks/useColors.test.tsx`:

```tsx
import React from 'react'
import { renderHook } from '@testing-library/react-native'
import { useColorScheme } from 'react-native'
import { useColors, ForcedSchemeContext } from './useColors'
import { Colors } from '../constants/colors'

jest.mock('react-native', () => ({
  ...jest.requireActual('react-native'),
  useColorScheme: jest.fn(),
}))

const mockUseColorScheme = useColorScheme as jest.MockedFunction<typeof useColorScheme>

beforeEach(() => {
  mockUseColorScheme.mockReturnValue('light')
})

it('returns dark colors when ForcedSchemeContext provides "dark"', () => {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <ForcedSchemeContext.Provider value="dark">{children}</ForcedSchemeContext.Provider>
  )
  const { result } = renderHook(() => useColors(), { wrapper })
  expect(result.current).toBe(Colors.dark)
})

it('returns light colors when ForcedSchemeContext provides "light"', () => {
  mockUseColorScheme.mockReturnValue('dark')
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <ForcedSchemeContext.Provider value="light">{children}</ForcedSchemeContext.Provider>
  )
  const { result } = renderHook(() => useColors(), { wrapper })
  expect(result.current).toBe(Colors.light)
})

it('falls back to system scheme when no ForcedSchemeContext is present', () => {
  mockUseColorScheme.mockReturnValue('dark')
  const { result } = renderHook(() => useColors())
  expect(result.current).toBe(Colors.dark)
})

it('falls back to light when system scheme is null', () => {
  mockUseColorScheme.mockReturnValue(null)
  const { result } = renderHook(() => useColors())
  expect(result.current).toBe(Colors.light)
})
```

- [ ] **Step 3.2: Run tests to verify they fail**

```bash
cd apps/mobile && npx jest hooks/useColors.test.tsx --no-coverage
```

Expected: FAIL — `ForcedSchemeContext` is not exported from `useColors`.

- [ ] **Step 3.3: Update useColors.ts**

Replace the entire contents of `apps/mobile/hooks/useColors.ts`:

```ts
import { createContext, useContext } from 'react'
import { useColorScheme } from 'react-native'
import { Colors, type ColorScheme } from '../constants/colors'

export const ForcedSchemeContext = createContext<ColorScheme | null>(null)

export function useColors() {
  const forced = useContext(ForcedSchemeContext)
  const system = useColorScheme() ?? 'light'
  return Colors[forced ?? system]
}
```

- [ ] **Step 3.4: Run tests to verify they pass**

```bash
cd apps/mobile && npx jest hooks/useColors.test.tsx --no-coverage
```

Expected: PASS (4 tests).

- [ ] **Step 3.5: Typecheck**

```bash
cd apps/mobile && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3.6: Commit**

```bash
git add apps/mobile/hooks/useColors.ts apps/mobile/hooks/useColors.test.tsx
git commit -m "add ForcedSchemeContext to useColors for per-route-group scheme override"
```

---

## Task 4: Force dark on recovery and supporter layouts

**Files:**
- Modify: `apps/mobile/app/(recovery)/_layout.tsx`
- Modify: `apps/mobile/app/(supporter)/_layout.tsx`

- [ ] **Step 4.1: Update recovery _layout.tsx**

At the top of `apps/mobile/app/(recovery)/_layout.tsx`, add the import:

```ts
import { ForcedSchemeContext } from '../../hooks/useColors'
```

Then wrap the returned `<Tabs>` element in `RecoveryLayout`:

```tsx
return (
  <ForcedSchemeContext.Provider value="dark">
    <Tabs
      screenOptions={{ ... }} // unchanged
    >
      {/* all Tabs.Screen entries unchanged */}
    </Tabs>
  </ForcedSchemeContext.Provider>
)
```

- [ ] **Step 4.2: Update supporter _layout.tsx**

Open `apps/mobile/app/(supporter)/_layout.tsx`. Find the import for `useColors` or add it, and add:

```ts
import { ForcedSchemeContext } from '../../hooks/useColors'
```

Wrap the returned JSX in the same provider:

```tsx
return (
  <ForcedSchemeContext.Provider value="dark">
    {/* existing layout JSX unchanged */}
  </ForcedSchemeContext.Provider>
)
```

- [ ] **Step 4.3: Typecheck and full test suite**

```bash
cd apps/mobile && npx tsc --noEmit && npx jest --no-coverage
```

Expected: 0 type errors, all existing tests pass.

- [ ] **Step 4.4: Commit**

```bash
git add apps/mobile/app/(recovery)/_layout.tsx apps/mobile/app/(supporter)/_layout.tsx
git commit -m "force dark scheme on recovery and supporter route groups"
```

---

## Task 5: Create encouragements.ts (TDD)

**Files:**
- Create: `apps/mobile/lib/copy/encouragements.ts`
- Create: `apps/mobile/lib/copy/encouragements.test.ts`

- [ ] **Step 5.1: Write failing tests**

Create `apps/mobile/lib/copy/encouragements.test.ts`:

```ts
import { pickEncouragement, ENCOURAGEMENTS } from './encouragements'

it('returns a non-empty string for any dayOfYear', () => {
  for (let d = 0; d < 366; d++) {
    expect(typeof pickEncouragement(d)).toBe('string')
    expect(pickEncouragement(d).length).toBeGreaterThan(0)
  }
})

it('is deterministic — same dayOfYear always returns the same string', () => {
  expect(pickEncouragement(0)).toBe(pickEncouragement(0))
  expect(pickEncouragement(42)).toBe(pickEncouragement(42))
  expect(pickEncouragement(365)).toBe(pickEncouragement(365))
})

it('cycles through the full array before repeating', () => {
  const seen = new Set<string>()
  for (let d = 0; d < ENCOURAGEMENTS.length; d++) {
    seen.add(pickEncouragement(d))
  }
  expect(seen.size).toBe(ENCOURAGEMENTS.length)
})

it('wraps correctly after cycling past array length', () => {
  const len = ENCOURAGEMENTS.length
  expect(pickEncouragement(len)).toBe(pickEncouragement(0))
  expect(pickEncouragement(len + 3)).toBe(pickEncouragement(3))
})
```

- [ ] **Step 5.2: Run to verify they fail**

```bash
cd apps/mobile && npx jest lib/copy/encouragements.test.ts --no-coverage
```

Expected: FAIL — module not found.

- [ ] **Step 5.3: Implement encouragements.ts**

Create `apps/mobile/lib/copy/encouragements.ts`:

```ts
export const ENCOURAGEMENTS = [
  'You showed up today.',
  'One day at a time still counts.',
  'Small streaks become new lives.',
  'You made it through today.',
  'Quiet wins matter.',
  'Showing up is the whole thing.',
  'Every sober hour is a choice you made.',
  'You are not your hardest days.',
  'Progress looks different every day.',
  'This is what courage looks like.',
] as const

export function pickEncouragement(dayOfYear: number): string {
  return ENCOURAGEMENTS[dayOfYear % ENCOURAGEMENTS.length]
}
```

- [ ] **Step 5.4: Run tests to verify they pass**

```bash
cd apps/mobile && npx jest lib/copy/encouragements.test.ts --no-coverage
```

Expected: PASS (4 tests).

- [ ] **Step 5.5: Commit**

```bash
git add apps/mobile/lib/copy/encouragements.ts apps/mobile/lib/copy/encouragements.test.ts
git commit -m "add encouragements copy module with deterministic day-of-year picker"
```

---

## Task 6: Extract StreakCard to its own file (no-op refactor)

Move the inline `StreakCard` function and its private styles from `index.tsx` into `components/feed/StreakCard.tsx` without changing any behavior.

**Files:**
- Create: `apps/mobile/components/feed/StreakCard.tsx`
- Modify: `apps/mobile/app/(recovery)/index.tsx`
- Modify: `apps/mobile/lib/streak.ts` (already done in Task 2)

- [ ] **Step 6.1: Create StreakCard.tsx with the verbatim extracted code**

Create `apps/mobile/components/feed/StreakCard.tsx`:

```tsx
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { router } from 'expo-router'
import { useColors } from '../../hooks/useColors'
import { spacing, radii, type as typeTokens } from '../../constants/theme'
import { MILESTONES, nextMilestone, prevMilestoneDays, type Milestone } from '../../lib/streak'

interface StreakCardProps {
  days: number
  next: Milestone | null
  streakLabel: string
  showResetChip: boolean
}

export function StreakCard({ days, next, streakLabel, showResetChip }: StreakCardProps) {
  const colors = useColors()

  const prevDays = prevMilestoneDays(days)
  const targetDays = next?.days ?? days
  const range = Math.max(targetDays - prevDays, 1)
  const progress = next ? Math.min((days - prevDays) / range, 1) : 1

  return (
    <View
      style={[
        styles.streakCard,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
        },
      ]}
    >
      <Text style={[styles.streakLabel, { color: colors.textMuted }]}>
        {streakLabel}
      </Text>

      <View style={styles.streakNumberRow}>
        <Text style={[styles.streakNumber, { color: colors.accent }]}>{days}</Text>
        <Text style={[styles.streakUnit, { color: colors.textSecondary }]}>
          {days === 1 ? 'day' : 'days'}
        </Text>
        {showResetChip && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="reset streak"
            onPress={() => router.push('/(recovery)/start-fresh')}
            style={({ pressed }) => [
              styles.resetChip,
              {
                backgroundColor: colors.surfaceRaised,
                borderColor: colors.border,
                opacity: pressed ? 0.7 : 1,
                marginLeft: 'auto',
              },
            ]}
          >
            <Text style={[styles.resetChipText, { color: colors.textSecondary }]}>
              {'\u21bb'} reset
            </Text>
          </Pressable>
        )}
      </View>

      {next ? (
        <View style={styles.progressWrap}>
          <View style={[styles.progressTrack, { backgroundColor: colors.surfaceRaised }]}>
            <View
              style={[
                styles.progressFill,
                {
                  backgroundColor: colors.accent,
                  width: `${progress * 100}%`,
                },
              ]}
            />
          </View>
          <Text style={[styles.progressCaption, { color: colors.textSecondary }]}>
            {next.days - days} {next.days - days === 1 ? 'day' : 'days'} until{' '}
            <Text style={{ color: colors.textPrimary, fontWeight: '600' }}>
              {next.label}
            </Text>
          </Text>
        </View>
      ) : (
        <Text style={[styles.progressCaption, { color: colors.textSecondary }]}>
          every milestone reached. incredible.
        </Text>
      )}

      <View style={styles.dotsRow}>
        {MILESTONES.map((m) => {
          const reached = days >= m.days
          const isCurrent = !reached && next?.days === m.days
          return (
            <View key={m.type} style={styles.dotItem}>
              <View
                style={[
                  styles.dot,
                  {
                    backgroundColor: reached
                      ? colors.success
                      : isCurrent
                        ? colors.accentSoft
                        : 'transparent',
                    borderColor: reached
                      ? colors.success
                      : isCurrent
                        ? colors.accent
                        : colors.border,
                    borderWidth: isCurrent ? 2 : 1,
                  },
                ]}
              />
              <Text
                style={[
                  styles.dotLabel,
                  {
                    color: reached
                      ? colors.textPrimary
                      : isCurrent
                        ? colors.accent
                        : colors.textMuted,
                  },
                ]}
              >
                {m.label}
              </Text>
            </View>
          )
        })}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  streakCard: {
    borderRadius: radii.xl,
    borderWidth: 1,
    padding: spacing.xl,
    gap: spacing.md,
  },
  streakLabel: { ...typeTokens.label },
  streakNumberRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
  streakNumber: { ...typeTokens.display },
  streakUnit: { fontSize: 18, fontWeight: '500' },
  progressWrap: { gap: spacing.sm, marginTop: spacing.xs },
  progressTrack: {
    height: 6,
    borderRadius: radii.pill,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: radii.pill,
  },
  progressCaption: { ...typeTokens.small },
  resetChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  resetChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  dotItem: {
    alignItems: 'center',
    gap: 4,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  dotLabel: {
    fontSize: 10,
    fontWeight: '500',
  },
})
```

- [ ] **Step 6.2: Update index.tsx to import StreakCard and remove the inline definition**

In `apps/mobile/app/(recovery)/index.tsx`:

1. Add import near the top with the other feed component imports:
```ts
import { StreakCard } from '../../components/feed/StreakCard'
```

2. Remove the inline `StreakCard` function definition (lines 374–505 roughly — the block starting with `function StreakCard({` through the closing `}`).

3. Remove the private `prevMilestoneDays` function (lines 508–515) since it's now exported from `streak.ts`.

4. Remove the streak-related styles from the `StyleSheet.create({...})` block at the bottom:
   - `streakCard`, `streakLabel`, `streakNumberRow`, `streakNumber`, `streakUnit`
   - `progressWrap`, `progressTrack`, `progressFill`, `progressCaption`
   - `resetChip`, `resetChipText`, `dotsRow`, `dotItem`, `dot`, `dotLabel`

5. Verify the `import { ..., nextMilestone } from '../../lib/streak'` still has the items it needs (remove `prevMilestoneDays` from this import if it was there; it should not be since it was local).

- [ ] **Step 6.3: Typecheck and run full test suite**

```bash
cd apps/mobile && npx tsc --noEmit && npx jest --no-coverage
```

Expected: 0 type errors, all tests pass (extraction was no-op).

- [ ] **Step 6.4: Commit**

```bash
git add apps/mobile/components/feed/StreakCard.tsx apps/mobile/app/(recovery)/index.tsx
git commit -m "extract StreakCard into its own component file (no-op refactor)"
```

---

## Task 7: Rebuild StreakCard with Tier 2 hero treatment (TDD)

Replace the extracted StreakCard's flat appearance with the hero visual design: warm gradient background, 96pt number, glowing progress fill, pill badge, encouragement line.

**Files:**
- Modify: `apps/mobile/components/feed/StreakCard.tsx`
- Create: `apps/mobile/components/feed/StreakCard.test.tsx`

- [ ] **Step 7.1: Write failing tests**

Create `apps/mobile/components/feed/StreakCard.test.tsx`:

```tsx
import React from 'react'
import { render } from '@testing-library/react-native'
import { StreakCard } from './StreakCard'
import { ENCOURAGEMENTS } from '../../lib/copy/encouragements'

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }))
jest.mock('expo-linear-gradient', () => ({
  LinearGradient: ({ children, ...props }: any) => {
    const { View } = require('react-native')
    return <View {...props}>{children}</View>
  },
}))

const NEXT_7D = { type: '7d' as const, label: '1 week', days: 7 }
const NEXT_30D = { type: '30d' as const, label: '1 month', days: 30 }

describe('<StreakCard />', () => {
  it('renders the streak number', () => {
    const { getByText } = render(
      <StreakCard days={5} next={NEXT_7D} streakLabel="days sober" showResetChip={false} />,
    )
    expect(getByText('5')).toBeTruthy()
  })

  it('renders the DAYS SOBER label in uppercase', () => {
    const { getByText } = render(
      <StreakCard days={5} next={NEXT_7D} streakLabel="days sober" showResetChip={false} />,
    )
    // label token applies textTransform: 'uppercase'; we assert the content string
    expect(getByText('days sober')).toBeTruthy()
  })

  it('renders a pill badge with correct copy when next milestone exists', () => {
    const { getByText } = render(
      <StreakCard days={5} next={NEXT_7D} streakLabel="days sober" showResetChip={false} />,
    )
    expect(getByText('2 days to 1 week')).toBeTruthy()
  })

  it('renders singular "day" when 1 day until next milestone', () => {
    const { getByText } = render(
      <StreakCard days={6} next={NEXT_7D} streakLabel="days sober" showResetChip={false} />,
    )
    expect(getByText('1 day to 1 week')).toBeTruthy()
  })

  it('renders a fallback message when all milestones are reached', () => {
    const { getByText } = render(
      <StreakCard days={400} next={null} streakLabel="days sober" showResetChip={false} />,
    )
    expect(getByText('every milestone reached. incredible.')).toBeTruthy()
  })

  it('renders an encouragement line (testID="streak-encouragement")', () => {
    const { getByTestId } = render(
      <StreakCard days={5} next={NEXT_7D} streakLabel="days sober" showResetChip={false} />,
    )
    const el = getByTestId('streak-encouragement')
    expect(el).toBeTruthy()
    // text must be one of the known encouragement strings
    expect(ENCOURAGEMENTS).toContain(el.props.children)
  })

  it('renders reset chip when showResetChip is true', () => {
    const { getByLabelText } = render(
      <StreakCard days={5} next={NEXT_7D} streakLabel="days sober" showResetChip={true} />,
    )
    expect(getByLabelText('reset streak')).toBeTruthy()
  })

  it('does not render reset chip when showResetChip is false', () => {
    const { queryByLabelText } = render(
      <StreakCard days={5} next={NEXT_7D} streakLabel="days sober" showResetChip={false} />,
    )
    expect(queryByLabelText('reset streak')).toBeNull()
  })

  it('renders without overflow at 1000+ days (uses smaller font)', () => {
    const { getByText } = render(
      <StreakCard days={1000} next={NEXT_30D} streakLabel="days sober" showResetChip={false} />,
    )
    expect(getByText('1000')).toBeTruthy()
  })
})
```

- [ ] **Step 7.2: Run to verify they fail**

```bash
cd apps/mobile && npx jest components/feed/StreakCard.test.tsx --no-coverage
```

Expected: several FAIL — no pill badge copy, no encouragement testID.

- [ ] **Step 7.3: Rebuild StreakCard.tsx with Tier 2 treatment**

Replace the entire contents of `apps/mobile/components/feed/StreakCard.tsx`:

```tsx
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { router } from 'expo-router'
import { useColors } from '../../hooks/useColors'
import { Colors } from '../../constants/colors'
import { spacing, radii, type as typeTokens, elevation, displayHero } from '../../constants/theme'
import { MILESTONES, prevMilestoneDays, type Milestone } from '../../lib/streak'
import { pickEncouragement } from '../../../lib/copy/encouragements'

// Day-of-year helper (1–366).
function getDayOfYear(): number {
  const now = new Date()
  const start = new Date(now.getFullYear(), 0, 0)
  return Math.floor((now.getTime() - start.getTime()) / 86400000)
}

interface StreakCardProps {
  days: number
  next: Milestone | null
  streakLabel: string
  showResetChip: boolean
}

export function StreakCard({ days, next, streakLabel, showResetChip }: StreakCardProps) {
  const prevDays = prevMilestoneDays(days)
  const targetDays = next?.days ?? days
  const range = Math.max(targetDays - prevDays, 1)
  const progress = next ? Math.min((days - prevDays) / range, 1) : 1
  const encouragement = pickEncouragement(getDayOfYear())

  // At 1000+ days the 96pt number would overflow on small phones; drop to the
  // standard display size (56pt).
  const numberStyle = days >= 1000 ? typeTokens.display : displayHero

  return (
    <LinearGradient
      colors={['#2A2218', '#1B1A17']}
      style={[styles.card, elevation.hero]}
    >
      <Text style={[typeTokens.label, styles.streakLabel, { color: Colors.dark.accent }]}>
        {streakLabel}
      </Text>

      <View style={styles.numberRow}>
        <Text style={[numberStyle, { color: Colors.dark.textPrimary }]}>{days}</Text>
        {showResetChip && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="reset streak"
            onPress={() => router.push('/(recovery)/start-fresh')}
            style={({ pressed }) => [styles.resetChip, { opacity: pressed ? 0.7 : 1 }]}
          >
            <Text style={styles.resetChipText}>{'\u21bb'} reset</Text>
          </Pressable>
        )}
      </View>

      <Text testID="streak-encouragement" style={styles.encouragement}>
        {encouragement}
      </Text>

      {next ? (
        <View style={styles.progressWrap}>
          <View style={styles.progressTrack}>
            <LinearGradient
              colors={['#C58A3F', '#D9A766']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.progressFill, { width: `${progress * 100}%` }]}
            />
          </View>
          <View style={styles.pillWrap}>
            <Text style={styles.pillText}>
              {next.days - days} {next.days - days === 1 ? 'day' : 'days'} to {next.label}
            </Text>
          </View>
        </View>
      ) : (
        <Text style={styles.progressCaption}>
          every milestone reached. incredible.
        </Text>
      )}
    </LinearGradient>
  )
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.xl,
    padding: spacing.xl,
    gap: spacing.md,
  },
  streakLabel: {
    letterSpacing: 0.8,
  },
  numberRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  encouragement: {
    fontSize: 14,
    fontWeight: '400',
    color: Colors.dark.textSecondary,
    lineHeight: 20,
    marginTop: -spacing.xs,
  },
  progressWrap: {
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  progressTrack: {
    height: 6,
    borderRadius: radii.pill,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  progressFill: {
    height: '100%',
    borderRadius: radii.pill,
    shadowColor: '#D9A766',
    shadowOpacity: 0.4,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
  pillWrap: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(217,167,102,0.12)',
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  pillText: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.dark.accent,
  },
  progressCaption: {
    ...typeTokens.small,
    color: Colors.dark.textSecondary,
  },
  resetChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: 'rgba(217,167,102,0.30)',
    backgroundColor: 'rgba(217,167,102,0.08)',
    marginTop: spacing.xs,
  },
  resetChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.dark.textSecondary,
  },
})
```

- [ ] **Step 7.4: Fix the encouragements import path**

The import in StreakCard.tsx should be:

```ts
import { pickEncouragement } from '../../lib/copy/encouragements'
```

(The previous step had an extra `../` — fix it.)

- [ ] **Step 7.5: Run tests to verify they pass**

```bash
cd apps/mobile && npx jest components/feed/StreakCard.test.tsx --no-coverage
```

Expected: PASS (9 tests).

- [ ] **Step 7.6: Typecheck and full test suite**

```bash
cd apps/mobile && npx tsc --noEmit && npx jest --no-coverage
```

Expected: 0 errors, all tests pass.

- [ ] **Step 7.7: Commit**

```bash
git add apps/mobile/components/feed/StreakCard.tsx apps/mobile/components/feed/StreakCard.test.tsx
git commit -m "rebuild StreakCard with Tier 2 hero elevation, 96pt number, pill badge, and encouragement line"
```

---

## Task 8: Apply Tier 1 elevation and sage chip color to TodayCheckInCard

**Files:**
- Modify: `apps/mobile/components/feed/TodayCheckInCard.tsx`
- Modify: `apps/mobile/components/feed/TodayCheckInCard.test.tsx`

- [ ] **Step 8.1: Update TodayCheckInCard.tsx**

In `apps/mobile/components/feed/TodayCheckInCard.tsx`, make these three changes:

**1. Import LinearGradient and Colors:**
```ts
import { LinearGradient } from 'expo-linear-gradient'
import { Colors } from '../../constants/colors'
import { elevation } from '../../constants/theme'
```

**2. Replace the outer `<View>` card wrappers with `<LinearGradient>`.**

For the loading state (around line 96), replace:
```tsx
<View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
```
with:
```tsx
<LinearGradient colors={['#221F1B', '#1A1815']} style={[styles.card, elevation.card]}>
```
(And change the closing `</View>` to `</LinearGradient>`)

For the collapsed state (around line 105), replace the outer `<Pressable>`'s inline `backgroundColor`/`borderColor`:
```tsx
// Remove: backgroundColor: colors.surface, borderColor: colors.border
// Add:
style={({ pressed }) => [
  styles.card,
  elevation.card,
  styles.collapsedCard,
  { opacity: pressed ? 0.85 : 1 },
]}
```
Wrap the Pressable content in a LinearGradient background? No — Pressable and LinearGradient don't compose cleanly. Instead, use a plain `backgroundColor: Colors.dark.surfaceRaised` on the Pressable and `borderColor: Colors.dark.border`.

Alternatively, keep the collapsed state as a View-like look using the card elevation:
```tsx
<Pressable
  ...
  style={({ pressed }) => [
    styles.card,
    {
      backgroundColor: '#221F1B',
      borderColor: Colors.dark.border,
      borderWidth: 1,
      opacity: pressed ? 0.85 : 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
  ]}
>
```

For the expanded state card (around line 130):
```tsx
<LinearGradient colors={['#221F1B', '#1A1815']} style={[styles.card, elevation.card]}>
```
(And close with `</LinearGradient>`)

**3. Update the "good_day" chip color.** Find the chip rendering block and change the active chip colors for `good_day` status:

```tsx
const isGoodDay = status === 'good_day'
const isSelected = row?.status === status

// background:
backgroundColor: isSelected
  ? (isGoodDay ? Colors.dark.successSoft : colors.accentSoft)
  : colors.surfaceRaised,
// border:
borderColor: isSelected
  ? (isGoodDay ? Colors.dark.success : colors.accent)
  : colors.border,
```

And for the icon and text color inside the chip:
```tsx
<Icon
  name={meta.icon}
  size={14}
  color={isSelected ? (isGoodDay ? Colors.dark.success : colors.accent) : colors.textSecondary}
/>
<Text style={[type.small, {
  color: isSelected ? (isGoodDay ? Colors.dark.success : colors.accent) : colors.textPrimary,
  fontWeight: '600',
}]}>
  {meta.label}
</Text>
```

**4. Update the label casing.** Change:
```tsx
<Text style={[type.label, { color: colors.textMuted }]}>today's check-in</Text>
```
to:
```tsx
<Text style={[type.label, { color: colors.textMuted }]}>TODAY'S CHECK-IN</Text>
```

- [ ] **Step 8.2: Update TodayCheckInCard.test.tsx to assert sage color for good_day**

Add this import at the top of `TodayCheckInCard.test.tsx`:
```ts
import { Colors } from '../../constants/colors'
```

Add this test at the end of the `describe` block:

```tsx
it('uses sage success color for the active good_day chip', async () => {
  loadMock.mockResolvedValueOnce({
    id: 'r1', status: 'good_day', note: null, check_in_date: '2026-05-05',
  })
  const { findByText, findByLabelText } = render(<TodayCheckInCard onSaved={jest.fn()} />)
  // expand from collapsed state
  fireEvent.press(await findByText(/edit/i))
  const chip = await findByLabelText('chip-good_day')
  // @testing-library/jest-native's toHaveStyle resolves StyleSheet IDs correctly
  expect(chip).toHaveStyle({ backgroundColor: Colors.dark.successSoft })
})
```

- [ ] **Step 8.3: Run TodayCheckInCard tests**

```bash
cd apps/mobile && npx jest components/feed/TodayCheckInCard.test.tsx --no-coverage
```

Expected: all tests pass including the new one.

- [ ] **Step 8.4: Typecheck**

```bash
cd apps/mobile && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 8.5: Commit**

```bash
git add apps/mobile/components/feed/TodayCheckInCard.tsx apps/mobile/components/feed/TodayCheckInCard.test.tsx
git commit -m "apply Tier 1 elevation and sage success color to good_day chip in TodayCheckInCard"
```

---

## Task 9: Apply Tier 1 elevation and casing to DailyPulseCard

**Files:**
- Modify: `apps/mobile/components/feed/DailyPulseCard.tsx`

- [ ] **Step 9.1: Update DailyPulseCard.tsx**

Replace the entire file contents of `apps/mobile/components/feed/DailyPulseCard.tsx`:

```tsx
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { useColors } from '../../hooks/useColors'
import { Icon } from '../Icon'
import { spacing, radii, type as typeTokens, elevation } from '../../constants/theme'

interface DailyPulseCardProps {
  prompt: string
  onWriteAnswer: () => void
}

export function DailyPulseCard({ prompt, onWriteAnswer }: DailyPulseCardProps) {
  const colors = useColors()
  return (
    <LinearGradient colors={['#221F1B', '#1A1815']} style={[styles.card, elevation.card]}>
      <View style={styles.labelRow}>
        <Icon name="sun" size={11} color={colors.accent} />
        <Text style={[typeTokens.label, { color: colors.accent }]}>TODAY'S REFLECTION</Text>
      </View>
      <Text style={[styles.prompt, { color: colors.textPrimary }]}>{`"${prompt}"`}</Text>
      <Pressable
        onPress={onWriteAnswer}
        style={({ pressed }) => [
          styles.cta,
          { backgroundColor: colors.surfaceRaised, opacity: pressed ? 0.85 : 1 },
        ]}
        accessibilityLabel="Write your answer in the journal"
      >
        <Text style={[typeTokens.small, { color: colors.textSecondary }]}>Write your answer</Text>
        <Icon name="arrow-right" size={14} color={colors.accent} />
      </Pressable>
    </LinearGradient>
  )
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.xl,
    padding: spacing.lg,
    gap: spacing.md,
  },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  prompt: {
    ...typeTokens.body,
    fontStyle: 'italic',
    lineHeight: 26,  // loosened from 22 per feedback #5
  },
  cta: {
    borderRadius: radii.md,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
})
```

- [ ] **Step 9.2: Typecheck and run tests**

```bash
cd apps/mobile && npx tsc --noEmit && npx jest --no-coverage
```

Expected: 0 errors, all tests pass.

- [ ] **Step 9.3: Commit**

```bash
git add apps/mobile/components/feed/DailyPulseCard.tsx
git commit -m "apply Tier 1 elevation, looser lineHeight, and UPPERCASE label to DailyPulseCard"
```

---

## Task 10: Apply SOS visual tokens to CenterSOSButton

**Files:**
- Modify: `apps/mobile/components/CenterSOSButton.tsx`

The press-and-hold ring animation and the `onArmed` callback are **untouched**. Only the visual appearance changes.

- [ ] **Step 10.1: Update CenterSOSButton.tsx**

In `apps/mobile/components/CenterSOSButton.tsx`:

**1. Add import:**
```ts
import { LinearGradient } from 'expo-linear-gradient'
import { sos } from '../constants/theme'
```

**2. Replace the `<Pressable>` button element** (the one with `backgroundColor: colors.danger`) with a `LinearGradient` button that applies `sos` tokens. The gradient needs to be radial-style; since RN's LinearGradient is linear, approximate the radial with a top-biased vertical gradient:

```tsx
<Pressable
  accessibilityRole="button"
  accessibilityLabel="hold to alert your supporters"
  onPressIn={() => { setPressed(true); startHold() }}
  onPressOut={() => { setPressed(false); cancelHold() }}
  style={[
    styles.pressable,
    {
      transform: [{ scale: pressed ? 0.94 : 1 }],
      opacity: pressed ? 0.85 : 1,
    },
  ]}
>
  <LinearGradient
    colors={[sos.gradientStart, sos.gradientEnd]}
    start={{ x: 0.5, y: 0 }}
    end={{ x: 0.5, y: 1 }}
    style={styles.button}
  >
    <Icon name="alert-triangle" size={22} color="#fff" />
  </LinearGradient>
</Pressable>
```

**3. Update styles.button and add styles.pressable:**

```tsx
const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', marginTop: -20 },
  pressable: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
  },
  button: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: sos.haloShadowColor,
    shadowOpacity: 1,
    shadowRadius: sos.haloShadowRadius,
    shadowOffset: { width: 0, height: sos.haloShadowOffsetY },
    elevation: 12,
    // Halo ring: achieved via a boxShadow-equivalent border using a surrounding View
  },
  label: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.4,
    marginTop: 2,
    color: Colors.dark.textMuted,
  },
})
```

**4. Add the halo ring wrapper around the SVG + Pressable stack.** The ring is a faint circular View behind the button:

Wrap the existing `<View style={{ width: RING_SIZE, ... }}>` that contains the SVG ring in an outer View with the halo treatment:

```tsx
<View
  style={[
    styles.haloWrap,
    { shadowColor: sos.haloShadowColor },
  ]}
>
  {/* existing ring_size view + SVG + Pressable unchanged */}
</View>
```

Add to StyleSheet:
```tsx
haloWrap: {
  borderRadius: (RING_SIZE + 8) / 2,
  padding: 4,
  shadowOpacity: 0.8,
  shadowRadius: 16,
  shadowOffset: { width: 0, height: 0 },
  elevation: 0,
},
```

**5. Remove the `colors.danger` reference** from the button since the gradient replaces it.

**6. Add `Colors` import:**
```ts
import { Colors } from '../constants/colors'
```

- [ ] **Step 10.2: Typecheck and run tests**

```bash
cd apps/mobile && npx tsc --noEmit && npx jest components/CenterSOSButton.test.tsx --no-coverage
```

Expected: 0 type errors, existing SOS button tests pass.

- [ ] **Step 10.3: Commit**

```bash
git add apps/mobile/components/CenterSOSButton.tsx
git commit -m "apply sos visual tokens to CenterSOSButton: radial gradient and halo ring"
```

---

## Task 11: Apply Variant C active-tab pill to SupporterTabBar

**Files:**
- Modify: `apps/mobile/components/SupporterTabBar.tsx`

Variant C: focused tab gets a pill background + hairline amber border; icon turns amber; label stays white. Inactive labels brighten from `textMuted` to `textSecondary`.

- [ ] **Step 11.1: Update SupporterTabBar.tsx**

Replace the entire file contents of `apps/mobile/components/SupporterTabBar.tsx`:

```tsx
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { BottomTabBarProps } from '@react-navigation/bottom-tabs'
import { Colors } from '../constants/colors'
import { Icon } from './Icon'
import { Badge } from './Badge'
import { spacing, radii } from '../constants/theme'
import type { IconName } from './Icon'
import { useNotificationStore } from '../store/notifications'

const TABS: Array<{ name: string; label: string; icon: IconName }> = [
  { name: 'index',         label: 'home',        icon: 'home'  },
  { name: 'invite',        label: 'connections', icon: 'users' },
  { name: 'notifications', label: 'alerts',      icon: 'bell'  },
  { name: 'profile',       label: 'profile',     icon: 'user'  },
]

export function SupporterTabBar({ state, navigation, insets }: BottomTabBarProps) {
  const unreadCount = useNotificationStore((s) => s.unreadCount)

  return (
    <View style={[styles.container, {
      paddingBottom: insets.bottom + spacing.sm,
    }]}>
      {TABS.map((tabDef) => {
        const route = state.routes.find((r) => r.name === tabDef.name)
        if (!route) return null
        const focused = state.routes[state.index].key === route.key
        const isAlerts = tabDef.name === 'notifications'

        return (
          <Pressable
            key={tabDef.name}
            onPress={() => {
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              })
              if (!focused && !event.defaultPrevented) {
                navigation.navigate(tabDef.name)
              }
            }}
            accessibilityRole="tab"
            accessibilityLabel={tabDef.label}
            accessibilityState={{ selected: focused }}
            style={[styles.tab, focused && styles.tabActive]}
          >
            <View style={styles.iconWrap}>
              <Icon
                name={tabDef.icon}
                size={20}
                color={focused ? Colors.dark.accent : Colors.dark.textSecondary}
              />
              {isAlerts && unreadCount > 0 && (
                <View style={styles.badgeWrap}>
                  <Badge count={unreadCount} />
                </View>
              )}
            </View>
            <Text style={[styles.label, { color: focused ? Colors.dark.textPrimary : Colors.dark.textSecondary }]}>
              {tabDef.label}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: Colors.dark.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.dark.border,
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.sm,
    alignItems: 'center',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.pill,
    gap: 3,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  tabActive: {
    backgroundColor: 'rgba(217,167,102,0.12)',
    borderColor: 'rgba(217,167,102,0.28)',
  },
  iconWrap: {
    position: 'relative',
  },
  badgeWrap: {
    position: 'absolute',
    top: -4,
    right: -8,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
})
```

- [ ] **Step 11.2: Typecheck and run tests**

```bash
cd apps/mobile && npx tsc --noEmit && npx jest --no-coverage
```

Expected: 0 errors, all tests pass.

- [ ] **Step 11.3: Commit**

```bash
git add apps/mobile/components/SupporterTabBar.tsx
git commit -m "apply Variant C active-tab pill to SupporterTabBar"
```

---

## Task 12: Apply Variant C pill to recovery tab bar and fix casing in index.tsx

**Files:**
- Modify: `apps/mobile/app/(recovery)/_layout.tsx`
- Modify: `apps/mobile/app/(recovery)/index.tsx`

- [ ] **Step 12.1: Add per-tab pill buttons to recovery _layout.tsx**

In `apps/mobile/app/(recovery)/_layout.tsx`, add a local `RecoveryTabButton` component before `RecoveryLayout`:

```tsx
import { Pressable, Text, View, StyleSheet } from 'react-native'
import { Colors } from '../../constants/colors'
import { spacing, radii } from '../../constants/theme'
import type { IconName } from '../../components/Icon'

function RecoveryTabButton({
  icon,
  label,
  onPress,
  onLongPress,
  accessibilityState,
  accessibilityRole,
}: {
  icon: IconName
  label: string
  onPress?: () => void
  onLongPress?: () => void
  accessibilityState?: { selected?: boolean }
  accessibilityRole?: string
}) {
  const focused = accessibilityState?.selected ?? false
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole={accessibilityRole ?? 'tab'}
      accessibilityState={accessibilityState}
      style={[tabStyles.tab, focused && tabStyles.tabActive]}
    >
      <Icon name={icon} size={20} color={focused ? Colors.dark.accent : Colors.dark.textSecondary} />
      <Text style={[tabStyles.label, { color: focused ? Colors.dark.textPrimary : Colors.dark.textSecondary }]}>
        {label}
      </Text>
    </Pressable>
  )
}

const tabStyles = StyleSheet.create({
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.pill,
    gap: 3,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  tabActive: {
    backgroundColor: 'rgba(217,167,102,0.12)',
    borderColor: 'rgba(217,167,102,0.28)',
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
})
```

Then update the four regular `Tabs.Screen` entries to use `tabBarButton`:

```tsx
<Tabs.Screen
  name="index"
  options={{
    title: 'home',
    tabBarButton: (props) => (
      <RecoveryTabButton
        icon="home"
        label="home"
        onPress={props.onPress ?? undefined}
        onLongPress={props.onLongPress ?? undefined}
        accessibilityState={props.accessibilityState as { selected?: boolean }}
        accessibilityRole={props.accessibilityRole}
      />
    ),
  }}
/>
<Tabs.Screen
  name="journal"
  options={{
    title: 'journal',
    tabBarButton: (props) => (
      <RecoveryTabButton
        icon="book-open"
        label="journal"
        onPress={props.onPress ?? undefined}
        onLongPress={props.onLongPress ?? undefined}
        accessibilityState={props.accessibilityState as { selected?: boolean }}
        accessibilityRole={props.accessibilityRole}
      />
    ),
  }}
/>
<Tabs.Screen
  name="chat"
  options={{
    title: 'messages',
    tabBarButton: (props) => (
      <RecoveryTabButton
        icon="message-circle"
        label="messages"
        onPress={props.onPress ?? undefined}
        onLongPress={props.onLongPress ?? undefined}
        accessibilityState={props.accessibilityState as { selected?: boolean }}
        accessibilityRole={props.accessibilityRole}
      />
    ),
  }}
/>
<Tabs.Screen
  name="settings"
  options={{
    title: 'add',
    tabBarButton: (props) => (
      <RecoveryTabButton
        icon="user-plus"
        label="add"
        onPress={props.onPress ?? undefined}
        onLongPress={props.onLongPress ?? undefined}
        accessibilityState={props.accessibilityState as { selected?: boolean }}
        accessibilityRole={props.accessibilityRole}
      />
    ),
  }}
/>
```

Remove `tabBarActiveTintColor`, `tabBarInactiveTintColor`, `tabBarLabelStyle` from `screenOptions` since `RecoveryTabButton` handles its own colors.

- [ ] **Step 12.2: Fix casing in (recovery)/index.tsx**

In `apps/mobile/app/(recovery)/index.tsx`, apply the casing rules to visible copy strings in JSX:

1. The invite card text — already sentence case, leave it.
2. The `MilestoneFeedCard` body strings use lowercase — leave these (they're brand voice whispers, not labels).
3. Any `type.label` rendered inline on this screen should use UPPERCASE content. Verify each one.

For spacing: after StreakCard extraction, the remaining `styles` in `index.tsx` are:
- `container` — uses `layout.screenPadding`, `layout.screenTopPadding`, `spacing.xxxl * 3`, `spacing.lg` ✓ already tokenized
- `inviteCard` — uses `radii.lg`, `spacing.lg` ✓
- `inviteText` — uses `type.body` ✓

No raw number substitutions needed. The styles are clean after the StreakCard styles are removed.

- [ ] **Step 12.3: Typecheck and full test suite**

```bash
cd apps/mobile && npx tsc --noEmit && npx jest --no-coverage
```

Expected: 0 type errors, all tests pass.

- [ ] **Step 12.4: Commit**

```bash
git add apps/mobile/app/(recovery)/_layout.tsx apps/mobile/app/(recovery)/index.tsx
git commit -m "apply Variant C active-tab pill to recovery tab bar and fix casing in home screen"
```

---

## Final Verification

- [ ] **Run full test suite one last time**

```bash
cd apps/mobile && npx jest --no-coverage
```

Expected: all tests pass.

- [ ] **Typecheck**

```bash
cd apps/mobile && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Manual smoke test (visual check)**

On iOS simulator:
1. Launch the app → sign in with a recovery account
2. Recovery home: streak card should glow warm amber, check-in and reflection cards sit calm beneath it
3. Tap the "good" chip on check-in → chip turns sage green
4. Tab bar: active tab has pill background + hairline amber border; inactive tabs are `textSecondary` (not dimmed `textMuted`)
5. Hold the SOS button → red gradient + halo visible
6. Switch system to Light Mode → recovery home stays dark

On Android emulator (or device):
7. Same checks — note SOS button will show gray drop shadow instead of red halo (expected, documented in spec Risk #1)
8. Confirm tab bar pill renders correctly

- [ ] **Open PR**

```bash
# already on feat/nav-sos-redesign
gh pr create --title "visual system foundation: elevation tokens, hero streak card, tab pill, SOS styling" --body "$(cat <<'EOF'
## Summary

- Adds `elevation`, `displayHero`, and `sos` tokens to `theme.ts`
- Forces dark scheme on recovery and supporter route groups via `ForcedSchemeContext`
- Extracts and rebuilds `StreakCard` as a standalone component with Tier 2 hero treatment (96pt number, amber glow, glowing progress fill, pill badge, rotating encouragement line)
- Applies Tier 1 (gradient surface + thin border) to `TodayCheckInCard` and `DailyPulseCard`
- Extends sage `success` color to the "good" mood chip in `TodayCheckInCard`
- Applies `sos` visual tokens (radial gradient + halo) to `CenterSOSButton`
- Applies Variant C active-tab pill to both recovery and supporter tab bars
- Locks casing rules: UPPERCASE labels, sentence-case content, lowercase brand voice

## Test plan

- [ ] `npx jest --no-coverage` passes (includes new tests for `encouragements.ts`, `StreakCard`, `useColors` forced-scheme)
- [ ] `npx tsc --noEmit` reports 0 errors
- [ ] iOS simulator smoke test: streak card glows, check-in/reflection sit calm, good chip turns sage, tab pill active, SOS gradient renders
- [ ] Android emulator smoke test: same checks (SOS halo will be gray — expected)
- [ ] Light Mode system setting → recovery home stays dark

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```
