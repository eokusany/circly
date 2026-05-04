# Onboarding Account-Select Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Spec:** [/Users/emmanuelokusanya/CREATIONS/reeco/docs/superpowers/specs/2026-05-04-onboarding-account-select-design.md](../specs/2026-05-04-onboarding-account-select-design.md)
**Goal:** Replace the two-step `context-select` then `role-select` onboarding flow with a single 3-card `account-select` screen, rename the `'family'` context token to `'life'` everywhere, run a Supabase migration to update existing rows, and replace the in-app context switcher with a "wrong account type? contact us" link.
**Architecture:** A single new `account-select.tsx` screen owns all three account-type choices and writes both `role` and `context` to `public.users` in one operation. Supporters insert a `null` context and rely on later invite-acceptance code to backfill it (out of scope for this plan). The `'family'` token in `AppContext` becomes `'life'` in TypeScript and in the `users.context` CHECK constraint, with a one-line UPDATE backfilling existing rows. The previous context-switching settings row is removed and replaced by a single mailto link to `support@circly.app`.
**Tech Stack:** React Native (Expo Router 6) + TypeScript 5.9 + Zustand + Supabase Postgres. Tests use `jest` with `jest-expo` preset; sibling `*.test.ts` / `*.test.tsx` files. Tests under `apps/mobile/app/` are excluded from jest (see `apps/mobile/package.json` jest `testPathIgnorePatterns`). Lint is `npm run lint`, typecheck is `npm run typecheck`.

---

## File Structure

New:
- `apps/mobile/app/(auth)/account-select.tsx`: the single 3-card screen, replaces both `context-select.tsx` and `role-select.tsx`.
- `supabase/migrations/014_rename_family_context_to_life.sql`: backfill `'family'` rows and update the CHECK constraint.

Modified:
- `apps/mobile/store/auth.ts`: `AppContext = 'recovery' | 'family'` becomes `'recovery' | 'life'`.
- `apps/mobile/lib/copy.ts`: rename the `family` bucket to `life`, drop the `contextCard` and `roleSelect` fields from `ContextCopy` (no longer rendered now that the new screen has hardcoded copy per the spec).
- `apps/mobile/lib/copy.test.ts`: update keys, remove tests for the dropped `contextCard` and `roleSelect` fields, assert `life` exists.
- `apps/mobile/app/(auth)/onboarding.tsx`: both `router.replace('/(auth)/context-select')` calls become `router.replace('/(auth)/account-select')`.
- `apps/mobile/app/_layout.tsx`: the no-profile branch routes to `'/(auth)/account-select'`.
- `apps/mobile/app/(recovery)/profile.tsx`: remove the "context" SettingRow, add a "wrong account type?" SettingRow that opens `mailto:support@circly.app`. Replace `user.context === 'recovery'` legacy literal references unchanged (no `'family'` literal lives here, but the rename of the type makes this file recompile).
- `apps/mobile/app/(supporter)/profile.tsx`: same edit (remove "context" row, add "wrong account type?" row).
- `apps/mobile/app/(profile)/index.tsx`: same edit (remove "context" row, add "wrong account type?" row).

Deleted:
- `apps/mobile/app/(auth)/context-select.tsx`
- `apps/mobile/app/(auth)/role-select.tsx`
- `apps/mobile/app/(profile)/switch-context.tsx`

Apply order: types and copy map first (Tasks 1-3) so the screen can compile against them; then the new screen (Task 4); then nav rewires and old-screen deletions (Tasks 5-6); then profile-screen swaps (Tasks 7-9); then the migration (Task 10); then deletion of `switch-context.tsx` (Task 11); then full lint/typecheck/test sweep (Task 12).

---

### Task 1: Rename `AppContext` type token in the auth store

**Files:**
- Modify: `/Users/emmanuelokusanya/CREATIONS/reeco/apps/mobile/store/auth.ts`

This is a pure type change. The store has no runtime test of its own and is exercised through the screens that consume it. We rely on `npm run typecheck` (run as part of Task 12) to catch any missed call site, but the explicit Grep results below cover every known reference.

- [ ] **Step 1: Edit the type alias**

Open `/Users/emmanuelokusanya/CREATIONS/reeco/apps/mobile/store/auth.ts` and change line 5:

```ts
// BEFORE
export type AppContext = 'recovery' | 'family'

// AFTER
export type AppContext = 'recovery' | 'life'
```

- [ ] **Step 2: Verify no remaining `'family'` literals in `apps/mobile`**

Run:

```sh
cd /Users/emmanuelokusanya/CREATIONS/reeco && grep -rn "'family'" apps/mobile
```

Expected output (the grep should match four lines, all in files we will edit in later tasks):

```
apps/mobile/lib/copy.test.ts:10:    expect(Object.keys(COPY).sort()).toEqual(['family', 'recovery'])
apps/mobile/lib/copy.test.ts:83:    for (const ctx of ['recovery', 'family'] as const) {
apps/mobile/lib/copy.ts:19:export type AppContext = 'recovery' | 'family'
apps/mobile/app/(auth)/context-select.tsx:12:const CONTEXTS: AppContext[] = ['recovery', 'family']
apps/mobile/app/(profile)/switch-context.tsx:14:const CONTEXTS: AppContext[] = ['recovery', 'family']
```

Note: `context-select.tsx` and `switch-context.tsx` will be deleted in later tasks; `copy.ts` and `copy.test.ts` are updated in Tasks 2-3. No other production code path references `'family'`.

- [ ] **Step 3: Commit**

```sh
cd /Users/emmanuelokusanya/CREATIONS/reeco && git add apps/mobile/store/auth.ts && git commit -m "rename AppContext family token to life"
```

---

### Task 2: Update copy map. Rename `family` bucket to `life` and drop unused screens' fields (TDD)

**Files:**
- Modify (test first): `/Users/emmanuelokusanya/CREATIONS/reeco/apps/mobile/lib/copy.test.ts`
- Modify: `/Users/emmanuelokusanya/CREATIONS/reeco/apps/mobile/lib/copy.ts`

`copy.ts` is a pure module with an existing sibling test that runs under jest. We follow strict TDD here.

The spec §3 says the new account-select screen has hardcoded copy ("who's circly for?", three card labels, three card descriptions); the old `contextCard` and `roleSelect` blocks in `ContextCopy` are no longer rendered after `context-select.tsx` and `role-select.tsx` are deleted. We drop them from the type, the data, and the tests now to keep the copy module honest. All other context-aware copy (`dashboard`, `signUpSubtitle`, etc.) stays.

- [ ] **Step 1: Write the failing test**

Replace the entire contents of `/Users/emmanuelokusanya/CREATIONS/reeco/apps/mobile/lib/copy.test.ts` with:

```ts
// Mock the auth store so copy.ts doesn't pull in zustand + supabase at import.
jest.mock('../store/auth', () => ({
  useAuthStore: jest.fn(() => null),
}))

import { COPY, DEFAULT_CONTEXT, useCopy } from './copy'

describe('COPY map', () => {
  it('has exactly the expected contexts', () => {
    expect(Object.keys(COPY).sort()).toEqual(['life', 'recovery'])
  })

  it('default context is recovery', () => {
    expect(DEFAULT_CONTEXT).toBe('recovery')
  })

  describe('recovery context', () => {
    const rc = COPY.recovery

    it('exposes user and supporter roles', () => {
      expect(rc.roles).toEqual(['recovery', 'supporter'])
    })

    it('has a label, description, and icon for every role', () => {
      for (const role of rc.roles) {
        expect(rc.roleCopy[role].label).toBeTruthy()
        expect(rc.roleCopy[role].description).toBeTruthy()
        expect(rc.roleCopy[role].icon).toBeTruthy()
      }
    })

    it('uses "sober for" as the streak label', () => {
      expect(rc.dashboard.streakLabel).toBe('sober for')
    })

    it('has the three check-in statuses', () => {
      const statuses = Object.keys(rc.dashboard.checkInStatuses).sort()
      expect(statuses).toEqual(['good_day', 'sober', 'struggling'])
    })

    it('journalLabel is "journal"', () => {
      expect(rc.dashboard.journalLabel).toBe('journal')
    })
  })

  describe('life context', () => {
    const lc = COPY.life

    it('exposes user and supporter roles', () => {
      expect(lc.roles).toEqual(['recovery', 'supporter'])
    })

    it('uses "connected for" as the streak label', () => {
      expect(lc.dashboard.streakLabel).toBe('connected for')
    })

    it('uses "reflections" as the journal label', () => {
      expect(lc.dashboard.journalLabel).toBe('reflections')
    })

    it('relabels recovery role as "the person at the center"', () => {
      expect(lc.roleCopy.recovery.label).toBe('the person at the center')
    })

    it('relabels supporter role as "family member"', () => {
      expect(lc.roleCopy.supporter.label).toBe('family member')
    })

    it('has distinct check-in labels from recovery', () => {
      expect(lc.dashboard.checkInStatuses.good_day.label).not.toBe(
        COPY.recovery.dashboard.checkInStatuses.good_day.label,
      )
    })
  })

  describe('shape invariants across contexts', () => {
    for (const ctx of ['recovery', 'life'] as const) {
      it(`${ctx} has a non-empty signUpSubtitle`, () => {
        expect(COPY[ctx].signUpSubtitle).toBeTruthy()
      })

      it(`${ctx} has all three checkInStatuses`, () => {
        const s = COPY[ctx].dashboard.checkInStatuses
        expect(s.good_day).toBeDefined()
        expect(s.sober).toBeDefined()
        expect(s.struggling).toBeDefined()
      })

      it(`${ctx} has a getSupportLabel`, () => {
        expect(COPY[ctx].dashboard.getSupportLabel).toBe('get support')
      })

      it(`${ctx} has okayTapPrompt and okayTapDone`, () => {
        expect(COPY[ctx].dashboard.okayTapPrompt).toBeTruthy()
        expect(COPY[ctx].dashboard.okayTapDone).toBeTruthy()
      })

      it(`${ctx} has silenceNudge and warmPingSent`, () => {
        expect(COPY[ctx].dashboard.silenceNudge).toBeTruthy()
        expect(COPY[ctx].dashboard.warmPingSent).toBeTruthy()
      })
    }
  })
})

describe('useCopy', () => {
  it('falls back to the default (recovery) copy when user context is null', () => {
    const copy = useCopy()
    expect(copy).toBe(COPY.recovery)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```sh
cd /Users/emmanuelokusanya/CREATIONS/reeco/apps/mobile && npx jest lib/copy.test.ts
```

Expected: the test run fails because `COPY.life` is undefined and `Object.keys(COPY).sort()` returns `['family', 'recovery']` not `['life', 'recovery']`. The exact failing assertion is "has exactly the expected contexts".

- [ ] **Step 3: Write minimal implementation**

Replace the entire contents of `/Users/emmanuelokusanya/CREATIONS/reeco/apps/mobile/lib/copy.ts` with:

```ts
// Context-aware copy map.
//
// Circly supports multiple care contexts from a single codebase. The data model
// and component tree stay the same across contexts. Only the user-facing text
// adapts. Every piece of copy that differs between "recovery" and "life" (or
// any future context) lives here.
//
// Rules:
// - Components must not hardcode strings that vary by context. Pull from COPY.
// - Adding a new context = adding a new entry in COPY. No component changes.
// - The two DB roles (recovery, supporter) are shared across all contexts,
//   but each context may relabel them. `roles` lists which ones show up in
//   role-select-style flows and in what display order.

import { useAuthStore } from '../store/auth'
import type { UserRole } from '../store/auth'
import type { IconName } from '../components/Icon'

export type AppContext = 'recovery' | 'life'

export interface RoleCopy {
  label: string
  description: string
  icon: IconName
}

export interface ContextCopy {
  roles: UserRole[]
  roleCopy: Record<UserRole, RoleCopy>

  // Recovery-user-equivalent dashboard labels
  // ("recovery" in DB = "person at the center" in life context)
  dashboard: {
    streakLabel: string // e.g. "sober for" / "connected for"
    checkInStatuses: Record<
      'good_day' | 'sober' | 'struggling',
      { icon: IconName; label: string; description: string }
    >
    checkInPrompt: string // e.g. "how are you today?"
    journalLabel: string
    journalDescription: string
    getSupportLabel: string // always "get support". kept here for symmetry
    getSupportDescription: string
    okayTapPrompt: string
    okayTapDone: string
    silenceNudge: string
    warmPingSent: string
  }

  // Sign-up subtitle
  signUpSubtitle: string
}

// recovery context

const recovery: ContextCopy = {
  roles: ['recovery', 'supporter'],
  roleCopy: {
    recovery: {
      label: 'i need support',
      description:
        'track your journey, check in daily, and stay connected with your support network',
      icon: 'sunrise',
    },
    supporter: {
      label: 'i want to support someone',
      description:
        'show up for someone you love. see their updates and send encouragement.',
      icon: 'users',
    },
  },
  dashboard: {
    streakLabel: 'sober for',
    checkInStatuses: {
      good_day: { icon: 'sun', label: 'good day', description: 'feeling strong and steady' },
      sober: { icon: 'anchor', label: 'sober', description: 'getting through, one moment at a time' },
      struggling: { icon: 'cloud', label: 'struggling', description: "it's a hard one, you showed up" },
    },
    checkInPrompt: 'how are you today?',
    journalLabel: 'journal',
    journalDescription: 'a private space for your thoughts',
    getSupportLabel: 'get support',
    getSupportDescription: 'reach your network instantly',
    okayTapPrompt: "tap to say you're okay",
    okayTapDone: "you're okay. your circle knows.",
    silenceNudge: "it's been {days} days since {name} checked in. maybe reach out?",
    warmPingSent: '{name} will feel your warmth.',
  },
  signUpSubtitle: 'your circle starts here',
}

// life context

const life: ContextCopy = {
  roles: ['recovery', 'supporter'],
  roleCopy: {
    recovery: {
      label: 'the person at the center',
      description:
        'share how you are, write private reflections, and stay close to the people who love you',
      icon: 'heart',
    },
    supporter: {
      label: 'family member',
      description:
        'stay close to someone you love. see how they are and send a little warmth.',
      icon: 'users',
    },
  },
  dashboard: {
    streakLabel: 'connected for',
    checkInStatuses: {
      good_day: { icon: 'sun', label: 'great day', description: 'feeling strong and steady' },
      sober: { icon: 'heart', label: 'feeling well', description: 'present and showing up' },
      struggling: { icon: 'cloud-rain', label: 'need some help', description: "it's a hard one, you showed up" },
    },
    checkInPrompt: 'how are you today?',
    journalLabel: 'reflections',
    journalDescription: 'a private space for your thoughts',
    getSupportLabel: 'get support',
    getSupportDescription: 'reach your people instantly',
    okayTapPrompt: "tap to say you're okay",
    okayTapDone: "you're okay. your people know.",
    silenceNudge: "it's been {days} days since {name} tapped in. maybe call?",
    warmPingSent: '{name} will feel your warmth.',
  },
  signUpSubtitle: 'your circle starts here',
}

// public API

export const COPY: Record<AppContext, ContextCopy> = {
  recovery,
  life,
}

export const DEFAULT_CONTEXT: AppContext = 'recovery'

/**
 * Returns the copy block for the current user's context. Safe to call before
 * the user has picked a context. Falls back to the default so screens that
 * render during onboarding still have labels to show.
 */
export function useCopy(): ContextCopy {
  const ctx = useAuthStore((s) => s.user?.context ?? null)
  return COPY[ctx ?? DEFAULT_CONTEXT]
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```sh
cd /Users/emmanuelokusanya/CREATIONS/reeco/apps/mobile && npx jest lib/copy.test.ts
```

Expected: PASS. All tests in `lib/copy.test.ts` green.

- [ ] **Step 5: Commit**

```sh
cd /Users/emmanuelokusanya/CREATIONS/reeco && git add apps/mobile/lib/copy.ts apps/mobile/lib/copy.test.ts && git commit -m "rename family copy bucket to life and drop unused contextCard and roleSelect fields"
```

---

### Task 3: Verify all consumers of the copy module still typecheck after the field drop

**Files:**
- Read-only: every file that imports from `'./copy'` or `'../lib/copy'` or `'../../lib/copy'`.

We dropped `contextCard` and `roleSelect` from `ContextCopy` in Task 2. Two doomed-to-be-deleted screens read those fields: `apps/mobile/app/(auth)/context-select.tsx` (reads `contextCard`) and `apps/mobile/app/(profile)/switch-context.tsx` (reads `contextCard`); `apps/mobile/app/(auth)/role-select.tsx` reads `roleSelect`. The profile screens read `contextCard.label`. Until those files are deleted (Tasks 6 and 11) and replaced (Tasks 7-9), the typecheck will be red. We accept this and do not run typecheck mid-flight; we run it once at the end of Task 12.

- [ ] **Step 1: Confirm the consumer list**

Run:

```sh
cd /Users/emmanuelokusanya/CREATIONS/reeco && grep -rn "from '.*lib/copy'" apps/mobile
```

Expected output (exact line numbers may vary by one):

```
apps/mobile/app/(auth)/context-select.tsx:10:import { COPY, type AppContext } from '../../lib/copy'
apps/mobile/app/(auth)/role-select.tsx:12:import { COPY, DEFAULT_CONTEXT, type AppContext } from '../../lib/copy'
apps/mobile/app/(profile)/index.tsx:8:import { COPY, DEFAULT_CONTEXT } from '../../lib/copy'
apps/mobile/app/(profile)/switch-context.tsx:12:import { COPY, DEFAULT_CONTEXT, type AppContext } from '../../lib/copy'
apps/mobile/app/(recovery)/check-in.tsx:23:import { useCopy } from '../../lib/copy'
apps/mobile/app/(recovery)/index.tsx:21:import { useCopy } from '../../lib/copy'
apps/mobile/app/(recovery)/profile.tsx:7:import { COPY, DEFAULT_CONTEXT } from '../../lib/copy'
apps/mobile/app/(supporter)/profile.tsx:7:import { COPY, DEFAULT_CONTEXT } from '../../lib/copy'
apps/mobile/lib/copy.test.ts:6:import { COPY, DEFAULT_CONTEXT, useCopy } from './copy'
```

`(recovery)/index.tsx` and `(recovery)/check-in.tsx` consume only `useCopy()` and `dashboard.*` fields, neither of which we changed. The four `profile`/`switch-context`/`context-select`/`role-select` files are explicitly handled in Tasks 4-9 and 11. No additional refactor is required here.

- [ ] **Step 2: No code change. No commit.**

---

### Task 4: Build the new `account-select.tsx` screen

**Files:**
- Create: `/Users/emmanuelokusanya/CREATIONS/reeco/apps/mobile/app/(auth)/account-select.tsx`

This screen lives under `apps/mobile/app/`, which is excluded from jest by `testPathIgnorePatterns`. We do not write a unit test for it. The verification step is a manual smoke checklist run after `npm run typecheck` and `npm run lint` pass in Task 12.

The screen mirrors the mockup at `.superpowers/brainstorm/28105-1777880886/content/account-select.html`: dark cards on a dark background, monochrome Feather icons in a square tile, an inset amber outline on the selected card, no checkmark badge, generous radii, single primary "continue" button. We reuse the existing `Icon`, `Button`, `BackButton`, `useColors`, theme tokens, and `tapLight` helpers.

Card-to-action mapping (spec §4):

| Card key       | Label                          | Description                              | Icon       | role        | context    | Next route                        |
|----------------|--------------------------------|------------------------------------------|------------|-------------|------------|-----------------------------------|
| `recovery`     | i'm in recovery                | track sobriety with daily check-ins      | `sunrise`  | `recovery`  | `recovery` | `/(auth)/sobriety-start`          |
| `daily`        | i need daily support           | check in and stay connected              | `circle`   | `recovery`  | `life`     | `/(recovery)`                     |
| `supporter`    | i'm here to support someone    | show up for someone you care about       | `heart`    | `supporter` | `null`     | `/(auth)/invite-code`             |

Icons use Feather (already used app-wide via the `Icon` component) so the visual texture matches the rest of the app. `sunrise` for recovery (continuity with the existing recovery copy entry), `circle` for daily-support (a clean neutral mark equivalent to the mockup's `○`), `heart` for supporter (matches the mockup's `♡`).

- [ ] **Step 1: Create the screen**

Write the file `/Users/emmanuelokusanya/CREATIONS/reeco/apps/mobile/app/(auth)/account-select.tsx` with these exact contents:

```tsx
import { useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView } from 'react-native'
import { router } from 'expo-router'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/auth'
import { useColors } from '../../hooks/useColors'
import { Button } from '../../components/Button'
import { BackButton } from '../../components/BackButton'
import { Icon, type IconName } from '../../components/Icon'
import { tapLight } from '../../lib/haptics'
import { spacing, radii, type as t, layout } from '../../constants/theme'
import type { AppContext, UserRole } from '../../store/auth'

type AccountKey = 'recovery' | 'daily' | 'supporter'

interface AccountOption {
  key: AccountKey
  label: string
  description: string
  icon: IconName
  role: UserRole
  context: AppContext | null
  next: '/(auth)/sobriety-start' | '/(recovery)' | '/(auth)/invite-code'
}

const OPTIONS: AccountOption[] = [
  {
    key: 'recovery',
    label: "i'm in recovery",
    description: 'track sobriety with daily check-ins',
    icon: 'sunrise',
    role: 'recovery',
    context: 'recovery',
    next: '/(auth)/sobriety-start',
  },
  {
    key: 'daily',
    label: 'i need daily support',
    description: 'check in and stay connected',
    icon: 'circle',
    role: 'recovery',
    context: 'life',
    next: '/(recovery)',
  },
  {
    key: 'supporter',
    label: "i'm here to support someone",
    description: 'show up for someone you care about',
    icon: 'heart',
    role: 'supporter',
    context: null,
    next: '/(auth)/invite-code',
  },
]

export default function AccountSelectScreen() {
  const colors = useColors()
  const setUser = useAuthStore((s) => s.setUser)
  const [selectedKey, setSelectedKey] = useState<AccountKey | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleContinue() {
    const choice = OPTIONS.find((o) => o.key === selectedKey)
    if (!choice) return

    setLoading(true)
    const { data: { user: authUser } } = await supabase.auth.getUser()
    if (!authUser) {
      setLoading(false)
      return
    }

    const displayName =
      (authUser.user_metadata?.display_name as string) ||
      authUser.email?.split('@')[0] ||
      'user'

    const { error } = await supabase.from('users').insert({
      id: authUser.id,
      email: authUser.email!,
      display_name: displayName,
      role: choice.role,
      context: choice.context,
    })

    if (error) {
      setLoading(false)
      Alert.alert('something went wrong', error.message)
      return
    }

    await supabase.from('profiles').insert({ user_id: authUser.id })

    setUser({
      id: authUser.id,
      email: authUser.email!,
      displayName,
      role: choice.role,
      context: choice.context,
      sobrietyStartDate: null,
    })

    setLoading(false)
    router.replace(choice.next)
  }

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.container}
    >
      <View style={styles.header}>
        <BackButton />
        <Text style={[styles.title, { color: colors.textPrimary }]}>
          who&apos;s circly for?
        </Text>
      </View>

      <View style={styles.cards}>
        {OPTIONS.map((option) => {
          const isSelected = selectedKey === option.key
          return (
            <TouchableOpacity
              key={option.key}
              accessibilityRole="button"
              accessibilityLabel={option.label}
              accessibilityState={{ selected: isSelected }}
              activeOpacity={0.85}
              onPress={() => {
                setSelectedKey(option.key)
                tapLight()
              }}
              style={[
                styles.card,
                {
                  backgroundColor: isSelected ? colors.accentSoft : colors.surface,
                  borderColor: isSelected ? colors.accent : 'transparent',
                },
              ]}
            >
              <View
                style={[
                  styles.iconTile,
                  {
                    backgroundColor: isSelected ? colors.accentSoft : colors.surfaceRaised,
                  },
                ]}
              >
                <Icon
                  name={option.icon}
                  size={20}
                  color={isSelected ? colors.accent : colors.textSecondary}
                />
              </View>
              <View style={styles.cardBody}>
                <Text style={[styles.cardLabel, { color: colors.textPrimary }]}>
                  {option.label}
                </Text>
                <Text style={[styles.cardDescription, { color: colors.textSecondary }]}>
                  {option.description}
                </Text>
              </View>
            </TouchableOpacity>
          )
        })}
      </View>

      <Button
        label="continue"
        onPress={handleContinue}
        loading={loading}
        disabled={!selectedKey}
        style={{ opacity: selectedKey ? 1 : 0.4 }}
      />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: layout.screenPadding,
    paddingTop: layout.screenTopPadding,
    paddingBottom: spacing.xxxl,
    gap: layout.sectionGap,
    justifyContent: 'space-between',
  },
  header: {
    gap: spacing.lg,
  },
  title: {
    ...t.h1,
  },
  cards: {
    gap: spacing.md,
  },
  card: {
    borderRadius: radii.xl,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1.5,
    minHeight: 70,
  },
  iconTile: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: {
    flex: 1,
    gap: spacing.xs,
  },
  cardLabel: {
    ...t.h3,
  },
  cardDescription: {
    ...t.small,
  },
})
```

- [ ] **Step 2: Verification (manual smoke checklist)**

Files under `apps/mobile/app/` are excluded from jest, so this screen has no unit test. After Task 12 finishes (full lint + typecheck pass), exercise the screen on the simulator with this checklist:

- [ ] Sign up with a fresh email; after the onboarding carousel, `account-select` appears with the title "who's circly for?", three cards, and a disabled "continue" button.
- [ ] Tapping any card produces a light haptic, an inset amber border, and an amber-tinted background. The icon turns amber. No checkmark badge appears.
- [ ] The "continue" button enables (full amber) only when a card is selected. Tapping a different card moves the selection.
- [ ] Card 1 ("i'm in recovery") + continue routes to `/(auth)/sobriety-start`.
- [ ] Card 2 ("i need daily support") + continue routes to `/(recovery)`. The user row in Supabase has `role='recovery'` and `context='life'`.
- [ ] Card 3 ("i'm here to support someone") + continue routes to `/(auth)/invite-code`. The user row has `role='supporter'` and `context=null`.
- [ ] The back chevron returns to the onboarding carousel.

- [ ] **Step 3: Commit**

```sh
cd /Users/emmanuelokusanya/CREATIONS/reeco && git add apps/mobile/app/\(auth\)/account-select.tsx && git commit -m "add single-step account-select onboarding screen"
```

---

### Task 5: Rewire the onboarding carousel to point at `account-select`

**Files:**
- Modify: `/Users/emmanuelokusanya/CREATIONS/reeco/apps/mobile/app/(auth)/onboarding.tsx`

The onboarding carousel currently does `router.replace('/(auth)/context-select')` in two places (the "next" button on the last slide and the "skip" link). Both must point at `'/(auth)/account-select'`.

- [ ] **Step 1: Edit the two router calls**

In `/Users/emmanuelokusanya/CREATIONS/reeco/apps/mobile/app/(auth)/onboarding.tsx`, replace:

```tsx
  function handleNext() {
    if (isLast) {
      router.replace('/(auth)/context-select')
    } else {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1 })
    }
  }

  function handleSkip() {
    router.replace('/(auth)/context-select')
  }
```

with:

```tsx
  function handleNext() {
    if (isLast) {
      router.replace('/(auth)/account-select')
    } else {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1 })
    }
  }

  function handleSkip() {
    router.replace('/(auth)/account-select')
  }
```

- [ ] **Step 2: Verify no `context-select` references remain in this file**

Run:

```sh
cd /Users/emmanuelokusanya/CREATIONS/reeco && grep -n "context-select" apps/mobile/app/\(auth\)/onboarding.tsx
```

Expected output: no matches (exit code 1 from grep). Empty stdout.

- [ ] **Step 3: Commit**

```sh
cd /Users/emmanuelokusanya/CREATIONS/reeco && git add apps/mobile/app/\(auth\)/onboarding.tsx && git commit -m "route onboarding carousel to new account-select screen"
```

---

### Task 6: Rewire the no-profile auth branch and delete the old onboarding screens

**Files:**
- Modify: `/Users/emmanuelokusanya/CREATIONS/reeco/apps/mobile/app/_layout.tsx`
- Delete: `/Users/emmanuelokusanya/CREATIONS/reeco/apps/mobile/app/(auth)/context-select.tsx`
- Delete: `/Users/emmanuelokusanya/CREATIONS/reeco/apps/mobile/app/(auth)/role-select.tsx`

`_layout.tsx` line 70 redirects to `'/(auth)/context-select'` when an authenticated session has no `public.users` row. After this change, both the new-signup path (via `onboarding.tsx`) and the orphan-session path land on `account-select`. Once both nav edges point at the new screen, the two old files are removed.

- [ ] **Step 1: Edit `_layout.tsx`**

In `/Users/emmanuelokusanya/CREATIONS/reeco/apps/mobile/app/_layout.tsx`, replace the line at offset 70:

```tsx
        router.replace('/(auth)/context-select')
```

with:

```tsx
        router.replace('/(auth)/account-select')
```

- [ ] **Step 2: Delete the two old screens**

Run:

```sh
cd /Users/emmanuelokusanya/CREATIONS/reeco && rm apps/mobile/app/\(auth\)/context-select.tsx apps/mobile/app/\(auth\)/role-select.tsx
```

Expected: silent success. Verify with:

```sh
cd /Users/emmanuelokusanya/CREATIONS/reeco && ls apps/mobile/app/\(auth\)/
```

Expected output (exact list, no `context-select.tsx` and no `role-select.tsx`):

```
account-select.tsx
forgot-password.tsx
invite-code.tsx
onboarding.tsx
sign-in.tsx
sign-up.tsx
sobriety-start.tsx
verify-reset.tsx
```

- [ ] **Step 3: Verify no remaining live references to the deleted screens**

Run:

```sh
cd /Users/emmanuelokusanya/CREATIONS/reeco && grep -rn "context-select\|role-select" apps/mobile
```

Expected output: only comments inside `lib/copy.ts`, `(profile)/switch-context.tsx`, and `(auth)/sign-up.tsx` mentioning the historical names. No live `router.replace`/`router.push`/`Redirect` calls. Acceptable matches:

```
apps/mobile/app/(auth)/sign-up.tsx:45:      // Store name in session metadata for role-select to use
apps/mobile/app/(profile)/switch-context.tsx:53:            // Also update auth metadata so role-select / re-login both see
apps/mobile/lib/copy.ts:13://   role-select-style flows and in what display order.
```

These are stale comments. The `switch-context.tsx` comment will disappear in Task 11 when that file is deleted. Update the other two now to keep the codebase honest:

In `/Users/emmanuelokusanya/CREATIONS/reeco/apps/mobile/app/(auth)/sign-up.tsx`, change line 45:

```tsx
      // Store name in session metadata for role-select to use
```

to:

```tsx
      // Store name in session metadata for account-select to use
```

In `/Users/emmanuelokusanya/CREATIONS/reeco/apps/mobile/lib/copy.ts`, change line 13:

```ts
//   role-select-style flows and in what display order.
```

to:

```ts
//   account-select-style flows and in what display order.
```

- [ ] **Step 4: Commit**

```sh
cd /Users/emmanuelokusanya/CREATIONS/reeco && git add apps/mobile/app/_layout.tsx apps/mobile/app/\(auth\)/context-select.tsx apps/mobile/app/\(auth\)/role-select.tsx apps/mobile/app/\(auth\)/sign-up.tsx apps/mobile/lib/copy.ts && git commit -m "delete old context-select and role-select screens and route auth pipeline to account-select"
```

---

### Task 7: Replace the "context" settings row with a "wrong account type? contact us" row in the recovery profile tab

**Files:**
- Modify: `/Users/emmanuelokusanya/CREATIONS/reeco/apps/mobile/app/(recovery)/profile.tsx`

Spec §8: settings include a single line "wrong account type? contact us" pointing at `mailto:support@circly.app`. The previous in-app context switcher row is removed.

- [ ] **Step 1: Edit the profile screen**

Open `/Users/emmanuelokusanya/CREATIONS/reeco/apps/mobile/app/(recovery)/profile.tsx`.

Replace the import block at the top with:

```tsx
import { View, Text, StyleSheet, ScrollView, Linking } from 'react-native'
import { router } from 'expo-router'
import { useColors } from '../../hooks/useColors'
import { useAuthStore } from '../../store/auth'
import { spacing, type as t, layout } from '../../constants/theme'
import { SettingRow, SettingSection } from '../../components/SettingRow'
import { COPY, DEFAULT_CONTEXT } from '../../lib/copy'

// support@circly.app is the placeholder support address. Confirm with ops
// before launch and update if a different inbox is preferred.
const SUPPORT_EMAIL = 'support@circly.app'
```

Then replace the entire "profile" SettingSection block:

```tsx
      <SettingSection title="profile">
        <SettingRow
          label="name"
          value={user.displayName}
          onPress={() => router.push('/(profile)/edit-name')}
        />
        <SettingRow
          label="context"
          value={contextLabel}
          onPress={() => router.push('/(profile)/switch-context')}
        />
      </SettingSection>
```

with:

```tsx
      <SettingSection title="profile">
        <SettingRow
          label="name"
          value={user.displayName}
          onPress={() => router.push('/(profile)/edit-name')}
        />
        <SettingRow
          label="wrong account type?"
          value="contact us"
          onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`)}
        />
      </SettingSection>
```

The `contextLabel` constant computed at the top of the function is still used by the header subtitle. Leave it untouched.

- [ ] **Step 2: Manual smoke check (file is in `app/`, jest excludes it)**

After Task 12 passes, on the simulator:

- [ ] As a recovery user, open the profile tab. The "context" row is gone. A new row "wrong account type? · contact us" appears in the profile section.
- [ ] Tapping the row opens the system mail composer addressed to `support@circly.app`.
- [ ] The header subtitle "{displayName} · {contextLabel}" still renders correctly.

- [ ] **Step 3: Commit**

```sh
cd /Users/emmanuelokusanya/CREATIONS/reeco && git add apps/mobile/app/\(recovery\)/profile.tsx && git commit -m "replace context switcher row with contact-us link in recovery profile"
```

---

### Task 8: Same swap on the supporter profile tab

**Files:**
- Modify: `/Users/emmanuelokusanya/CREATIONS/reeco/apps/mobile/app/(supporter)/profile.tsx`

- [ ] **Step 1: Edit the file**

Open `/Users/emmanuelokusanya/CREATIONS/reeco/apps/mobile/app/(supporter)/profile.tsx`.

Replace the import block at the top with:

```tsx
import { View, Text, StyleSheet, ScrollView, Linking } from 'react-native'
import { router } from 'expo-router'
import { useColors } from '../../hooks/useColors'
import { useAuthStore } from '../../store/auth'
import { spacing, type as t, layout } from '../../constants/theme'
import { SettingRow, SettingSection } from '../../components/SettingRow'
import { COPY, DEFAULT_CONTEXT } from '../../lib/copy'

// support@circly.app is the placeholder support address. Confirm with ops
// before launch and update if a different inbox is preferred.
const SUPPORT_EMAIL = 'support@circly.app'
```

Replace the entire "profile" SettingSection block:

```tsx
      <SettingSection title="profile">
        <SettingRow
          label="name"
          value={user.displayName}
          onPress={() => router.push('/(profile)/edit-name')}
        />
        <SettingRow
          label="context"
          value={contextLabel}
          onPress={() => router.push('/(profile)/switch-context')}
        />
      </SettingSection>
```

with:

```tsx
      <SettingSection title="profile">
        <SettingRow
          label="name"
          value={user.displayName}
          onPress={() => router.push('/(profile)/edit-name')}
        />
        <SettingRow
          label="wrong account type?"
          value="contact us"
          onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`)}
        />
      </SettingSection>
```

- [ ] **Step 2: Manual smoke check**

After Task 12 passes, on the simulator:

- [ ] As a supporter user, open the profile tab. The "context" row is gone. The "wrong account type? · contact us" row appears.
- [ ] Tapping the row opens the system mail composer addressed to `support@circly.app`.

- [ ] **Step 3: Commit**

```sh
cd /Users/emmanuelokusanya/CREATIONS/reeco && git add apps/mobile/app/\(supporter\)/profile.tsx && git commit -m "replace context switcher row with contact-us link in supporter profile"
```

---

### Task 9: Same swap on the standalone `(profile)/index.tsx` settings screen

**Files:**
- Modify: `/Users/emmanuelokusanya/CREATIONS/reeco/apps/mobile/app/(profile)/index.tsx`

- [ ] **Step 1: Edit the file**

Open `/Users/emmanuelokusanya/CREATIONS/reeco/apps/mobile/app/(profile)/index.tsx`.

Replace the import block at the top with:

```tsx
import { View, Text, StyleSheet, ScrollView, Linking } from 'react-native'
import { router } from 'expo-router'
import { useColors } from '../../hooks/useColors'
import { useAuthStore } from '../../store/auth'
import { BackButton } from '../../components/BackButton'
import { spacing, type as t, layout } from '../../constants/theme'
import { SettingRow, SettingSection } from '../../components/SettingRow'
import { COPY, DEFAULT_CONTEXT } from '../../lib/copy'

// support@circly.app is the placeholder support address. Confirm with ops
// before launch and update if a different inbox is preferred.
const SUPPORT_EMAIL = 'support@circly.app'
```

Replace the entire "profile" SettingSection block:

```tsx
      <SettingSection title="profile">
        <SettingRow
          label="name"
          value={user.displayName}
          onPress={() => router.push('/(profile)/edit-name')}
        />
        <SettingRow
          label="context"
          value={contextLabel}
          onPress={() => router.push('/(profile)/switch-context')}
        />
      </SettingSection>
```

with:

```tsx
      <SettingSection title="profile">
        <SettingRow
          label="name"
          value={user.displayName}
          onPress={() => router.push('/(profile)/edit-name')}
        />
        <SettingRow
          label="wrong account type?"
          value="contact us"
          onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`)}
        />
      </SettingSection>
```

- [ ] **Step 2: Manual smoke check**

After Task 12 passes, on the simulator:

- [ ] Navigate to the standalone `/(profile)` screen. The "context" row is gone. The "wrong account type? · contact us" row appears.
- [ ] Tapping the row opens the system mail composer addressed to `support@circly.app`.

- [ ] **Step 3: Commit**

```sh
cd /Users/emmanuelokusanya/CREATIONS/reeco && git add apps/mobile/app/\(profile\)/index.tsx && git commit -m "replace context switcher row with contact-us link in standalone profile screen"
```

---

### Task 10: Add the Supabase migration that backfills `'family'` rows and updates the CHECK constraint

**Files:**
- Create: `/Users/emmanuelokusanya/CREATIONS/reeco/supabase/migrations/014_rename_family_context_to_life.sql`

Spec §7 explicitly calls out two SQL statements: backfill (`update profiles set context = 'life' where context = 'family';`) and a CHECK constraint update on the column. The column actually lives on `public.users` (see migration 003). The spec wording has a typo (says "profiles") but migration 003 puts `context` on `public.users`, and the runtime store reads from `users.context`. We migrate `public.users.context`. We also widen the comment to mention `'life'`.

- [ ] **Step 1: Create the migration file**

Write the file `/Users/emmanuelokusanya/CREATIONS/reeco/supabase/migrations/014_rename_family_context_to_life.sql` with these exact contents:

```sql
-- Migration 014: rename context value 'family' to 'life'
--
-- The 'family' token was renamed to 'life' on 2026-05-04 because "family" was
-- too narrow. The new value covers any day-to-day support relationship
-- (family, friends, coworkers, partners, anyone). This migration backfills
-- existing rows and widens the CHECK constraint to allow the new value while
-- forbidding the old one.

-- 1. Backfill any existing rows that were stored under the old token.
update public.users
  set context = 'life'
  where context = 'family';

-- 2. Replace the CHECK constraint to allow only the new token (or null).
alter table public.users
  drop constraint if exists users_context_check;

alter table public.users
  add constraint users_context_check
  check (context is null or context in ('recovery', 'life'));

comment on column public.users.context is
  'User-chosen situational context. Drives UI copy and role labeling. One of: recovery, life. Nullable during onboarding and for supporters until first connection.';
```

- [ ] **Step 2: Lint the SQL by re-reading it**

Run:

```sh
cd /Users/emmanuelokusanya/CREATIONS/reeco && cat supabase/migrations/014_rename_family_context_to_life.sql
```

Expected: the file prints exactly as written. The implementer should visually confirm both statements (backfill UPDATE and the constraint swap) are present, and that the constraint allows `null`, `'recovery'`, and `'life'`.

- [ ] **Step 3: Commit**

```sh
cd /Users/emmanuelokusanya/CREATIONS/reeco && git add supabase/migrations/014_rename_family_context_to_life.sql && git commit -m "migrate users context value family to life and update CHECK constraint"
```

---

### Task 11: Delete the in-app context switcher screen

**Files:**
- Delete: `/Users/emmanuelokusanya/CREATIONS/reeco/apps/mobile/app/(profile)/switch-context.tsx`

After Tasks 7-9, no `router.push('/(profile)/switch-context')` call remains anywhere in `apps/mobile`. The screen is unreachable and references the dropped `contextCard` field. Delete it.

- [ ] **Step 1: Confirm no remaining references**

Run:

```sh
cd /Users/emmanuelokusanya/CREATIONS/reeco && grep -rn "switch-context\|switch_context\|switchContext" apps/mobile
```

Expected output: only the file itself (`apps/mobile/app/(profile)/switch-context.tsx:...`). No callers.

- [ ] **Step 2: Delete the file**

Run:

```sh
cd /Users/emmanuelokusanya/CREATIONS/reeco && rm apps/mobile/app/\(profile\)/switch-context.tsx
```

Verify:

```sh
cd /Users/emmanuelokusanya/CREATIONS/reeco && ls apps/mobile/app/\(profile\)/
```

Expected output (exact list, no `switch-context.tsx`):

```
_layout.tsx
change-email.tsx
change-password.tsx
delete-account.tsx
edit-name.tsx
index.tsx
notifications.tsx
privacy-policy.tsx
reset-sobriety.tsx
terms.tsx
```

- [ ] **Step 3: Commit**

```sh
cd /Users/emmanuelokusanya/CREATIONS/reeco && git add apps/mobile/app/\(profile\)/switch-context.tsx && git commit -m "delete in-app context switcher screen now that account type changes go through support"
```

---

### Task 12: Full sweep. Typecheck, lint, jest, and final `'family'` audit

**Files:**
- None modified unless a regression appears.

This is the catch-all verification. Everything in the plan should now be consistent: types, copy, screens, navigation, settings, migration, deletions.

- [ ] **Step 1: Typecheck**

Run:

```sh
cd /Users/emmanuelokusanya/CREATIONS/reeco/apps/mobile && npm run typecheck
```

Expected: exit code 0. No `tsc` errors. If errors appear, the most likely culprit is a stale import of a deleted screen or a stale `'family'` literal. Fix in place; do not commit a workaround.

- [ ] **Step 2: Lint**

Run:

```sh
cd /Users/emmanuelokusanya/CREATIONS/reeco/apps/mobile && npm run lint
```

Expected: exit code 0, "0 warnings, 0 errors". The `--max-warnings 0` flag fails the build on any warning.

- [ ] **Step 3: Jest**

Run:

```sh
cd /Users/emmanuelokusanya/CREATIONS/reeco/apps/mobile && npm test -- --runInBand
```

Expected: all suites pass. The relevant suite is `lib/copy.test.ts` (rewritten in Task 2). Other suites should be unaffected.

- [ ] **Step 4: Final `'family'` audit across `apps/mobile` and `supabase`**

Run:

```sh
cd /Users/emmanuelokusanya/CREATIONS/reeco && grep -rn "'family'" apps/mobile supabase
```

Expected output: empty (exit code 1 from grep). Any match here is a regression and must be fixed before claiming the plan is complete.

Then run the case-insensitive sweep to surface any user-visible "family" copy that should have been re-worded:

```sh
cd /Users/emmanuelokusanya/CREATIONS/reeco && grep -rn -i "family" apps/mobile
```

Expected matches (and only these):

```
apps/mobile/lib/copy.ts:113:      label: 'family member',
```

The "family member" supporter label inside the `life` context bucket is intentional kept (it is one phrasing option for the supporter role inside the `life` context, not a context name) and matches the test in Task 2 (`expect(lc.roleCopy.supporter.label).toBe('family member')`). Anything else under the case-insensitive search is a stray that must be reviewed.

- [ ] **Step 5: Manual smoke run**

On a fresh simulator install, exercise the full happy path for each of the three account types per the checklists in Tasks 4 and 7-9. Confirm:

- [ ] Existing accounts that were created with `context='family'` (if any in the dev database) now read as `context='life'` after the Task 10 migration is applied. The simplest verification is to log into a known-`family` test account post-migration and confirm the recovery dashboard renders the `life`-bucket copy ("connected for", "reflections") rather than crashing with an undefined-key access.

- [ ] **Step 6: No commit unless a regression was patched**

If Steps 1-5 all pass with no edits required, do not create an empty commit. Otherwise, commit the regression fix with a single-sentence message describing exactly what was patched.

---

## Spec Coverage Self-Review

| Spec section                                       | Covered by                |
|----------------------------------------------------|---------------------------|
| §1 Overview (replace two screens with one)         | Tasks 4, 5, 6             |
| §2 New flow (sign-up -> onboarding -> account-select -> branch) | Tasks 4, 5, 6  |
| §3.1 Layout (back chevron, title, three cards, continue) | Task 4              |
| §3.2 Cards (icon, label, description, selected state, no checkmark, 70px, 18px radius) | Task 4 |
| §3.3 Continue button (disabled until selection)    | Task 4                    |
| §4 Card-to-data mapping (role, context, next route)| Task 4 (`OPTIONS` const)  |
| §5 Supporter context inference (null on insert)    | Task 4 (`context: null` for supporter option) |
| §6 Copy rules (no em dashes, single short sentences) | Task 4 (literal copy used) |
| §7 Files affected (account-select created, context-select/role-select deleted, onboarding/_layout rewired, store/auth type renamed, copy bucket renamed, migration written, profile contact-us added) | Tasks 1, 2, 4, 5, 6, 7, 8, 9, 10, 11 |
| §8 Account type switching (no in-app switcher; contact-us link) | Tasks 7, 8, 9, 11 |
| §9 Out of scope items                              | Honoured by absence       |

## Type / Name Consistency Self-Review

- `AppContext` is `'recovery' | 'life'` in both `apps/mobile/store/auth.ts` (Task 1) and `apps/mobile/lib/copy.ts` (Task 2).
- The migration constraint allows `null`, `'recovery'`, `'life'` (Task 10), which is the union of values the TypeScript type permits including the nullable column.
- The supporter card in `account-select.tsx` writes `context: null`, which the constraint allows. The "i need daily support" card writes `context: 'life'`, which the constraint allows.
- No `'family'` literal survives in `apps/mobile` source or in `supabase/migrations` after Task 12 Step 4.
