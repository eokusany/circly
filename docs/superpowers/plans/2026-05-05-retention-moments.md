# Retention Moments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Spec:** [/Users/emmanuelokusanya/CREATIONS/reeco/docs/superpowers/specs/2026-05-04-retention-moments-design.md](../specs/2026-05-04-retention-moments-design.md)

**Depends on:** The companion plan `/Users/emmanuelokusanya/CREATIONS/reeco/docs/superpowers/plans/2026-05-05-account-select.md` (or whatever the account-select plan ends up named) is responsible for renaming the `'family'` context token to `'life'` in the `AppContext` type, the `users.context` CHECK constraint, the `COPY` map, and the `context-select` / `switch-context` screens. **This plan consumes `context === 'life'` throughout and must NOT add any new references to `'family'`.** If the rename has not yet shipped when you execute this plan, every `context === 'life'` check below will simply be false for current users (no users have `'life'` context yet), and the plan still applies cleanly. The `recovery` context branches work either way because that token name is unchanged. Where this plan touches files the navigation/account-select plan also touches (notably `apps/mobile/lib/copy.ts` and `apps/mobile/store/auth.ts`), changes are designed additively: new fields and new keys, never renames or deletes of existing ones.

**Goal:** Ship the five retention moments — start fresh, day-one feed, first check-in, supporter first-run, and milestone celebrations — across all three account types (recovery-substance, recovery-life, supporter), with correct context branching and per-moment one-shot gating.

**Architecture:** Add five boolean/int gating columns plus one audit table on `profiles` (server-of-record) and surface them through the existing zustand `AppUser` shape (extended additively). Pure helpers (milestone schedules, "should celebrate?" predicates, "next milestone" lookups) live in `apps/mobile/lib/` with sibling jest tests so we can TDD them. Screens that render the celebrations and one-shot intros live under `apps/mobile/app/` and are verified with manual smoke checklists because `apps/mobile/app/` is excluded from jest by the package's `testPathIgnorePatterns`.

**Tech Stack:**
- Expo Router v6 (file-based navigation under `apps/mobile/app/`)
- React Native 0.81 + React 19
- TypeScript 5.9, strict
- Supabase JS v2.101 (`apps/mobile/lib/supabase.ts`)
- Postgres migrations under `supabase/migrations/`
- jest 29 + jest-expo for unit tests (only outside `apps/mobile/app/`)
- zustand for the auth/user store

---

## Account-Type Scoping

| Section | Recovery-substance (role=recovery, context=recovery) | Recovery-life (role=recovery, context=life) | Supporter (role=supporter) |
|---|---|---|---|
| §2 Start fresh entry points & confirm sheet | Yes | No (omit chip + inline card entirely) | No |
| §2.3 Started-fresh supporter card | Producer (writes `sobriety_resets` row) | No (no producer) | Consumer (sees card if connected to substance user who reset) |
| §3 Day-one empty feed | Yes (generic copy) | Yes (same generic copy — no streak language) | Unchanged |
| §4 First check-in intro + celebration | Yes | Yes (same copy) | Unchanged |
| §5 Supporter first-run (connected + cold paths) | No | No | Yes |
| §6 Milestone takeover + persistent feed card | Day-count schedule (`MILESTONES_SUBSTANCE`), gated by `last_milestone_celebrated_days` | Cumulative-check-in schedule (`MILESTONES_LIFE`), gated by `last_milestone_celebrated_checkins` | Mirrors the connected user's celebration as a feed card |

The branching rule **everywhere** is on `user.context` (not just `user.role`):
- `role === 'recovery' && context === 'recovery'` → substance affordances
- `role === 'recovery' && context === 'life'` → life affordances (no streak, no start-fresh)
- `role === 'supporter'` → supporter affordances (regardless of own `context`)

---

## File Structure

**Migrations (new):**
- `supabase/migrations/014_retention_moments.sql` — adds five profile columns + `sobriety_resets` table

**Pure helpers (new, with sibling jest tests — real TDD):**
- `apps/mobile/lib/milestones.ts` — schedules + helpers for both contexts
- `apps/mobile/lib/milestones.test.ts` — full coverage of the helpers

**Auth/store extensions (modified additively):**
- `apps/mobile/store/auth.ts` — extend `AppUser` with five new optional fields
- `apps/mobile/app/_layout.tsx` — extend `loadUser` query + setUser call to populate the new fields

**Reusable celebration components (new):**
- `apps/mobile/components/MilestoneTakeover.tsx` — full-screen takeover modal
- `apps/mobile/components/MilestoneFeedCard.tsx` — persistent feed card variant
- `apps/mobile/components/StartedFreshFeedCard.tsx` — supporter-side card

**One-shot screens (new under `app/` — manual smoke):**
- `apps/mobile/app/(recovery)/first-checkin-intro.tsx` — §4.1 intro
- `apps/mobile/app/(recovery)/first-checkin-celebration.tsx` — §4.3 celebration
- `apps/mobile/app/(supporter)/first-run-connected.tsx` — §5.1 connected intro
- `apps/mobile/app/(supporter)/first-run-cold.tsx` — §5.2 cold onboarding

**Screens modified additively:**
- `apps/mobile/app/(recovery)/index.tsx` — adds reset chip on streak card, day-one empty card, milestone takeover/card, replaces existing CelebrationBanner with new system
- `apps/mobile/app/(recovery)/check-in.tsx` — routes through first-checkin-intro on first run, fires first-checkin-celebration on first save, adds inline "start fresh" card when struggling selected (recovery context only)
- `apps/mobile/app/(supporter)/index.tsx` — renders started-fresh and milestone supporter cards, routes to first-run screens when `supporter_first_run_seen === false`

**Optional new screen for shared confirm logic (new):**
- `apps/mobile/app/(recovery)/start-fresh.tsx` — confirm sheet screen (modal route)

---

### Task 1: Migration — gating columns and `sobriety_resets` audit table

**Files:** Create `supabase/migrations/014_retention_moments.sql`

- [ ] **Step 1: Write the migration file**

Create `supabase/migrations/014_retention_moments.sql` with exactly:

```sql
-- Migration 014: retention moments
--
-- Adds five gating fields to profiles plus one audit table for sobriety
-- resets. Backs the spec at
-- docs/superpowers/specs/2026-05-04-retention-moments-design.md.
--
-- 1. profiles.first_checkin_intro_seen        — gates §4.1 (one-shot)
-- 2. profiles.first_checkin_celebration_seen  — gates §4.3 (one-shot)
-- 3. profiles.supporter_first_run_seen        — gates §5.1/§5.2 (one-shot)
-- 4. profiles.last_milestone_celebrated_days  — highest substance-context
--    day-count milestone already celebrated for the *current* sobriety
--    start date; reset to 0 by the start-fresh flow per §2.2.
-- 5. profiles.last_milestone_celebrated_checkins — highest life-context
--    cumulative-check-in milestone already celebrated; never reset.
--
-- 6. public.sobriety_resets — one row per "start fresh" event, used to
--    derive the §2.3 supporter "started fresh" feed card. Append-only.

alter table public.profiles
  add column if not exists first_checkin_intro_seen boolean not null default false;

alter table public.profiles
  add column if not exists first_checkin_celebration_seen boolean not null default false;

alter table public.profiles
  add column if not exists supporter_first_run_seen boolean not null default false;

alter table public.profiles
  add column if not exists last_milestone_celebrated_days integer not null default 0;

alter table public.profiles
  add column if not exists last_milestone_celebrated_checkins integer not null default 0;

comment on column public.profiles.first_checkin_intro_seen is
  'One-shot flag: has the user seen the first-check-in intro screen (spec §4.1).';
comment on column public.profiles.first_checkin_celebration_seen is
  'One-shot flag: has the user seen the day-one celebratory screen after their first check-in (spec §4.3).';
comment on column public.profiles.supporter_first_run_seen is
  'One-shot flag: has the supporter seen the first-run intro (connected or cold path, spec §5).';
comment on column public.profiles.last_milestone_celebrated_days is
  'Highest substance-context day-count milestone (in days) already celebrated for the current sobriety_start_date. Reset to 0 by the start-fresh flow (spec §2.2). Gates §6.2 for context=recovery users.';
comment on column public.profiles.last_milestone_celebrated_checkins is
  'Highest life-context cumulative-check-in milestone already celebrated. Never reset. Gates §6.2 for context=life users.';

create table if not exists public.sobriety_resets (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users(id) on delete cascade,
  reset_at    timestamptz not null default now(),
  -- previous_start_date is informational only; the new start date is
  -- always today and is written to profiles.sobriety_start_date in the
  -- same transaction by the client.
  previous_start_date date
);

create index if not exists sobriety_resets_user_id_idx
  on public.sobriety_resets (user_id, reset_at desc);

comment on table public.sobriety_resets is
  'Append-only audit of "start fresh" events. Drives the §2.3 supporter "started fresh" feed card. One row per reset.';

-- RLS: a user can insert their own resets and read their own resets;
-- supporters can read resets for users they have an active relationship
-- with (so they can render the §2.3 card).
alter table public.sobriety_resets enable row level security;

create policy "sobriety_resets: insert own"
  on public.sobriety_resets for insert
  with check (user_id = auth.uid());

create policy "sobriety_resets: select own"
  on public.sobriety_resets for select
  using (user_id = auth.uid());

create policy "sobriety_resets: select linked supporter"
  on public.sobriety_resets for select
  using (
    exists (
      select 1 from public.relationships r
      where r.recovery_user_id = sobriety_resets.user_id
        and r.supporter_id = auth.uid()
        and r.status = 'active'
    )
  );
```

- [ ] **Step 2: Append the migration to `apply_all.sql`**

Append the contents of `014_retention_moments.sql` to `supabase/migrations/apply_all.sql` (this matches the convention used by migrations 001-013). Open `supabase/migrations/apply_all.sql`, scroll to the end, and append a blank line followed by the entire body of `014_retention_moments.sql`.

- [ ] **Step 3: Verify SQL parses (smoke check via psql dry-run if available, otherwise eyeball)**

Run: `ls supabase/migrations/014_retention_moments.sql && wc -l supabase/migrations/014_retention_moments.sql`

Expected output (line count may differ slightly):
```
supabase/migrations/014_retention_moments.sql
      63 supabase/migrations/014_retention_moments.sql
```

If a local Postgres is available run `psql -f supabase/migrations/014_retention_moments.sql` against a scratch DB and expect:
```
ALTER TABLE
ALTER TABLE
ALTER TABLE
ALTER TABLE
ALTER TABLE
COMMENT
COMMENT
COMMENT
COMMENT
COMMENT
CREATE TABLE
CREATE INDEX
COMMENT
ALTER TABLE
CREATE POLICY
CREATE POLICY
CREATE POLICY
```

- [ ] **Step 4: Commit**

```
git add supabase/migrations/014_retention_moments.sql supabase/migrations/apply_all.sql
git commit -m "add retention-moments migration with profile gating columns and sobriety_resets table"
```

---

### Task 2: Pure helpers — `apps/mobile/lib/milestones.ts` (TDD)

**Files:** Create `apps/mobile/lib/milestones.ts` and `apps/mobile/lib/milestones.test.ts`

- [ ] **Step 1: Write the failing test file**

Create `apps/mobile/lib/milestones.test.ts` with:

```ts
import {
  MILESTONES_SUBSTANCE,
  MILESTONES_LIFE,
  nextSubstanceMilestone,
  nextLifeMilestone,
  shouldCelebrateSubstance,
  shouldCelebrateLife,
  highestReachedSubstanceDays,
  highestReachedLifeCheckins,
  type SubstanceMilestone,
  type LifeMilestone,
} from './milestones'

describe('MILESTONES_SUBSTANCE', () => {
  it('matches the spec schedule (1d, 3d, 1w, 2w, 1m, 3m, 6m, 1y, then yearly)', () => {
    expect(MILESTONES_SUBSTANCE.map((m) => m.days)).toEqual([
      1, 3, 7, 14, 30, 90, 180, 365, 730, 1095, 1460, 1825,
    ])
  })

  it('is sorted ascending', () => {
    for (let i = 1; i < MILESTONES_SUBSTANCE.length; i++) {
      expect(MILESTONES_SUBSTANCE[i].days).toBeGreaterThan(
        MILESTONES_SUBSTANCE[i - 1].days,
      )
    }
  })

  it('every entry has a non-empty label', () => {
    for (const m of MILESTONES_SUBSTANCE) {
      expect(m.label.length).toBeGreaterThan(0)
    }
  })
})

describe('MILESTONES_LIFE', () => {
  it('matches the spec schedule (10, 25, 50, 100, 250, 500, then +250)', () => {
    expect(MILESTONES_LIFE.map((m) => m.checkins)).toEqual([
      10, 25, 50, 100, 250, 500, 750, 1000, 1250, 1500,
    ])
  })

  it('is sorted ascending', () => {
    for (let i = 1; i < MILESTONES_LIFE.length; i++) {
      expect(MILESTONES_LIFE[i].checkins).toBeGreaterThan(
        MILESTONES_LIFE[i - 1].checkins,
      )
    }
  })
})

describe('nextSubstanceMilestone', () => {
  it('returns 1d at day 0', () => {
    expect(nextSubstanceMilestone(0)?.days).toBe(1)
  })
  it('returns 3d at day 1', () => {
    expect(nextSubstanceMilestone(1)?.days).toBe(3)
  })
  it('returns 7d at day 3', () => {
    expect(nextSubstanceMilestone(3)?.days).toBe(7)
  })
  it('returns null past the last entry in the static list', () => {
    expect(nextSubstanceMilestone(99999)).toBeNull()
  })
})

describe('nextLifeMilestone', () => {
  it('returns 10 for a brand-new user (0 check-ins)', () => {
    expect(nextLifeMilestone(0)?.checkins).toBe(10)
  })
  it('returns 25 right after 10 is hit', () => {
    expect(nextLifeMilestone(10)?.checkins).toBe(25)
  })
  it('returns 100 at 50', () => {
    expect(nextLifeMilestone(50)?.checkins).toBe(100)
  })
  it('returns null past the last entry in the static list', () => {
    expect(nextLifeMilestone(99999)).toBeNull()
  })
})

describe('shouldCelebrateSubstance', () => {
  it('returns null when streak is 0', () => {
    expect(shouldCelebrateSubstance(0, 0)).toBeNull()
  })

  it('returns the 1d milestone on day 1 when nothing celebrated yet', () => {
    const m = shouldCelebrateSubstance(1, 0)
    expect(m?.days).toBe(1)
  })

  it('returns the 7d milestone at day 7 when last celebrated was 3', () => {
    const m = shouldCelebrateSubstance(7, 3)
    expect(m?.days).toBe(7)
  })

  it('returns null when the highest applicable milestone has already been celebrated', () => {
    expect(shouldCelebrateSubstance(7, 7)).toBeNull()
  })

  it('returns the highest reached but not yet celebrated when several were skipped', () => {
    // Streak jumped to 30 (e.g. user re-opened app after a break) and only
    // 1d was celebrated. The takeover should fire for 30 (the highest
    // reached), not 3 or 7 — we never queue multiple celebrations.
    const m = shouldCelebrateSubstance(30, 1)
    expect(m?.days).toBe(30)
  })

  it('is not triggered between milestones', () => {
    expect(shouldCelebrateSubstance(15, 14)).toBeNull()
  })

  it('handles a year boundary cleanly', () => {
    expect(shouldCelebrateSubstance(365, 180)?.days).toBe(365)
    expect(shouldCelebrateSubstance(365, 365)).toBeNull()
  })
})

describe('shouldCelebrateLife', () => {
  it('returns null at 0 check-ins', () => {
    expect(shouldCelebrateLife(0, 0)).toBeNull()
  })

  it('returns null at 9 check-ins', () => {
    expect(shouldCelebrateLife(9, 0)).toBeNull()
  })

  it('returns the 10-checkin milestone at exactly 10', () => {
    expect(shouldCelebrateLife(10, 0)?.checkins).toBe(10)
  })

  it('returns null when 10 has already been celebrated', () => {
    expect(shouldCelebrateLife(10, 10)).toBeNull()
  })

  it('returns the highest reached but not yet celebrated when several were skipped', () => {
    expect(shouldCelebrateLife(110, 25)?.checkins).toBe(100)
  })

  it('returns 750 at 750 check-ins (the +250 cadence after 500)', () => {
    expect(shouldCelebrateLife(750, 500)?.checkins).toBe(750)
  })
})

describe('highestReachedSubstanceDays', () => {
  it('returns 0 at day 0', () => {
    expect(highestReachedSubstanceDays(0)).toBe(0)
  })
  it('returns 1 at day 1', () => {
    expect(highestReachedSubstanceDays(1)).toBe(1)
  })
  it('returns 3 at day 5', () => {
    expect(highestReachedSubstanceDays(5)).toBe(3)
  })
  it('returns 30 at day 60', () => {
    expect(highestReachedSubstanceDays(60)).toBe(30)
  })
})

describe('highestReachedLifeCheckins', () => {
  it('returns 0 at 0 check-ins', () => {
    expect(highestReachedLifeCheckins(0)).toBe(0)
  })
  it('returns 0 at 9 check-ins', () => {
    expect(highestReachedLifeCheckins(9)).toBe(0)
  })
  it('returns 10 at 24 check-ins', () => {
    expect(highestReachedLifeCheckins(24)).toBe(10)
  })
  it('returns 500 at 600 check-ins', () => {
    expect(highestReachedLifeCheckins(600)).toBe(500)
  })
})

describe('SubstanceMilestone and LifeMilestone types are exported', () => {
  it('compile-time check (smoke)', () => {
    const a: SubstanceMilestone = { days: 1, label: '1 day' }
    const b: LifeMilestone = { checkins: 10, label: '10 check-ins' }
    expect(a.days).toBe(1)
    expect(b.checkins).toBe(10)
  })
})
```

- [ ] **Step 2: Run test to verify it fails (file does not exist yet)**

Run: `cd apps/mobile && npx jest lib/milestones.test.ts`

Expected output (Cannot find module):
```
Cannot find module './milestones' from 'lib/milestones.test.ts'
```

- [ ] **Step 3: Write the minimal implementation**

Create `apps/mobile/lib/milestones.ts` with:

```ts
// Milestone schedules and helpers for the two recovery contexts.
//
// substance (`context === 'recovery'`): day-count schedule per spec §6.1.
// life      (`context === 'life'`):     cumulative-check-in schedule per
//                                       spec §6.1b. The 10/25/50/100/250/500
//                                       prefix is followed by +250 forever;
//                                       we materialize a finite tail (up to
//                                       1500) which is more than enough for
//                                       the foreseeable lifetime of an
//                                       account. Extending the tail later
//                                       only requires adding entries.

export interface SubstanceMilestone {
  days: number
  label: string
}

export interface LifeMilestone {
  checkins: number
  label: string
}

export const MILESTONES_SUBSTANCE: SubstanceMilestone[] = [
  { days: 1, label: '1 day' },
  { days: 3, label: '3 days' },
  { days: 7, label: '1 week' },
  { days: 14, label: '2 weeks' },
  { days: 30, label: '1 month' },
  { days: 90, label: '3 months' },
  { days: 180, label: '6 months' },
  { days: 365, label: '1 year' },
  { days: 730, label: '2 years' },
  { days: 1095, label: '3 years' },
  { days: 1460, label: '4 years' },
  { days: 1825, label: '5 years' },
]

export const MILESTONES_LIFE: LifeMilestone[] = [
  { checkins: 10, label: '10 check-ins' },
  { checkins: 25, label: '25 check-ins' },
  { checkins: 50, label: '50 check-ins' },
  { checkins: 100, label: '100 check-ins' },
  { checkins: 250, label: '250 check-ins' },
  { checkins: 500, label: '500 check-ins' },
  { checkins: 750, label: '750 check-ins' },
  { checkins: 1000, label: '1000 check-ins' },
  { checkins: 1250, label: '1250 check-ins' },
  { checkins: 1500, label: '1500 check-ins' },
]

/** Next milestone strictly greater than `days`, or null if none. */
export function nextSubstanceMilestone(days: number): SubstanceMilestone | null {
  return MILESTONES_SUBSTANCE.find((m) => days < m.days) ?? null
}

/** Next milestone strictly greater than `checkins`, or null if none. */
export function nextLifeMilestone(checkins: number): LifeMilestone | null {
  return MILESTONES_LIFE.find((m) => checkins < m.checkins) ?? null
}

/** Highest milestone whose `days` threshold has been reached, or 0. */
export function highestReachedSubstanceDays(days: number): number {
  let highest = 0
  for (const m of MILESTONES_SUBSTANCE) {
    if (days >= m.days) highest = m.days
    else break
  }
  return highest
}

/** Highest milestone whose `checkins` threshold has been reached, or 0. */
export function highestReachedLifeCheckins(checkins: number): number {
  let highest = 0
  for (const m of MILESTONES_LIFE) {
    if (checkins >= m.checkins) highest = m.checkins
    else break
  }
  return highest
}

/**
 * Returns the milestone that should trigger a celebration takeover for a
 * substance-context user, or null if none.
 *
 * Uses the highest reached milestone (not the most-recently-crossed one)
 * so a user who hasn't opened the app for a while sees one celebration
 * for their current state, never a queue.
 */
export function shouldCelebrateSubstance(
  streakDays: number,
  lastCelebratedDays: number,
): SubstanceMilestone | null {
  if (streakDays <= 0) return null
  const highest = highestReachedSubstanceDays(streakDays)
  if (highest === 0) return null
  if (highest <= lastCelebratedDays) return null
  return MILESTONES_SUBSTANCE.find((m) => m.days === highest) ?? null
}

/**
 * Returns the milestone that should trigger a celebration takeover for a
 * life-context user, or null if none.
 */
export function shouldCelebrateLife(
  totalCheckins: number,
  lastCelebratedCheckins: number,
): LifeMilestone | null {
  if (totalCheckins <= 0) return null
  const highest = highestReachedLifeCheckins(totalCheckins)
  if (highest === 0) return null
  if (highest <= lastCelebratedCheckins) return null
  return MILESTONES_LIFE.find((m) => m.checkins === highest) ?? null
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd apps/mobile && npx jest lib/milestones.test.ts`

Expected output (the trailing summary):
```
Test Suites: 1 passed, 1 total
Tests:       33 passed, 33 total
```

- [ ] **Step 5: Run lint and typecheck on the helper**

Run: `cd apps/mobile && npm run lint && npm run typecheck`

Expected output (lint section ends with no errors, typecheck exits 0 silently):
```
> @circly/mobile@1.0.0 lint
> eslint . --ext .ts,.tsx --max-warnings 0

> @circly/mobile@1.0.0 typecheck
> tsc --noEmit
```

- [ ] **Step 6: Commit**

```
git add apps/mobile/lib/milestones.ts apps/mobile/lib/milestones.test.ts
git commit -m "add milestone helpers for substance and life contexts"
```

---

### Task 3: Extend `AppUser` shape with retention fields (additive)

**Files:** Modify `apps/mobile/store/auth.ts`, `apps/mobile/app/_layout.tsx`

- [ ] **Step 1: Extend `AppUser` interface in `apps/mobile/store/auth.ts`**

Open `apps/mobile/store/auth.ts`. Replace the existing `AppUser` interface with:

```ts
export interface AppUser {
  id: string
  email: string
  displayName: string
  role: UserRole
  context: AppContext | null
  sobrietyStartDate: string | null
  // Retention-moment one-shot flags and counters. All optional so the
  // store stays backwards compatible with callers that don't care.
  firstCheckinIntroSeen?: boolean
  firstCheckinCelebrationSeen?: boolean
  supporterFirstRunSeen?: boolean
  lastMilestoneCelebratedDays?: number
  lastMilestoneCelebratedCheckins?: number
}
```

Do not modify `AppContext`, `UserRole`, or any other export in this file. The `'family'` → `'life'` rename of `AppContext` belongs to the account-select plan; this plan stays additive.

- [ ] **Step 2: Extend the `loadUser` query in `apps/mobile/app/_layout.tsx`**

In `apps/mobile/app/_layout.tsx`, locate the `loadUser` callback (around lines 37-76). Replace the `.select(...)` call and the typed result and the `setUser(...)` call so that the new profile columns are loaded and surfaced. Specifically:

Replace this block:

```ts
const { data } = await supabase
  .from('users')
  .select('id, email, display_name, role, context, profiles(sobriety_start_date)')
  .eq('id', userId)
  .single<{
    id: string
    email: string
    display_name: string
    role: UserRole
    context: AppContext | null
    profiles: { sobriety_start_date: string | null } | null
  }>()

if (data) {
  const sobrietyStartDate = data.profiles?.sobriety_start_date ?? null
  setUser({
    id: data.id,
    email: data.email,
    displayName: data.display_name,
    role: data.role,
    context: data.context,
    sobrietyStartDate,
  })
```

With:

```ts
const { data } = await supabase
  .from('users')
  .select(
    'id, email, display_name, role, context, profiles(sobriety_start_date, first_checkin_intro_seen, first_checkin_celebration_seen, supporter_first_run_seen, last_milestone_celebrated_days, last_milestone_celebrated_checkins)',
  )
  .eq('id', userId)
  .single<{
    id: string
    email: string
    display_name: string
    role: UserRole
    context: AppContext | null
    profiles: {
      sobriety_start_date: string | null
      first_checkin_intro_seen: boolean | null
      first_checkin_celebration_seen: boolean | null
      supporter_first_run_seen: boolean | null
      last_milestone_celebrated_days: number | null
      last_milestone_celebrated_checkins: number | null
    } | null
  }>()

if (data) {
  const sobrietyStartDate = data.profiles?.sobriety_start_date ?? null
  setUser({
    id: data.id,
    email: data.email,
    displayName: data.display_name,
    role: data.role,
    context: data.context,
    sobrietyStartDate,
    firstCheckinIntroSeen: data.profiles?.first_checkin_intro_seen ?? false,
    firstCheckinCelebrationSeen: data.profiles?.first_checkin_celebration_seen ?? false,
    supporterFirstRunSeen: data.profiles?.supporter_first_run_seen ?? false,
    lastMilestoneCelebratedDays: data.profiles?.last_milestone_celebrated_days ?? 0,
    lastMilestoneCelebratedCheckins: data.profiles?.last_milestone_celebrated_checkins ?? 0,
  })
```

Do not change anything else in `loadUser`.

- [ ] **Step 3: Run typecheck and lint**

Run: `cd apps/mobile && npm run typecheck && npm run lint`

Expected output:
```
> @circly/mobile@1.0.0 typecheck
> tsc --noEmit

> @circly/mobile@1.0.0 lint
> eslint . --ext .ts,.tsx --max-warnings 0
```

- [ ] **Step 4: Commit**

```
git add apps/mobile/store/auth.ts apps/mobile/app/_layout.tsx
git commit -m "extend AppUser with retention-moment gating fields"
```

---

### Task 4: Reusable `MilestoneTakeover` component

**Files:** Create `apps/mobile/components/MilestoneTakeover.tsx`

This is a presentational component (no state outside Animated values, no DB writes) so it does not need a jest test. It is consumed by §6.2.

- [ ] **Step 1: Create the component**

Create `apps/mobile/components/MilestoneTakeover.tsx` with:

```tsx
import { useEffect, useMemo } from 'react'
import { Modal, View, Text, StyleSheet, Pressable, Animated } from 'react-native'
import { useColors } from '../hooks/useColors'
import { spacing, radii, type } from '../constants/theme'

/**
 * Full-screen celebration takeover used by §6.2 of the retention-moments
 * spec. Presentational only — caller owns the `visible` state and is
 * responsible for marking the milestone as celebrated when `onContinue`
 * fires.
 */
export function MilestoneTakeover({
  visible,
  label,
  onContinue,
}: {
  visible: boolean
  /** Already-formatted milestone label, e.g. "1 week." or "50 check-ins." */
  label: string
  onContinue: () => void
}) {
  const colors = useColors()
  const fade = useMemo(() => new Animated.Value(0), [])

  useEffect(() => {
    if (visible) {
      fade.setValue(0)
      Animated.timing(fade, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }).start()
    }
  }, [visible, fade])

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={false}
      onRequestClose={onContinue}
    >
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <Animated.View style={[styles.center, { opacity: fade }]}>
          <Text style={[styles.label, { color: colors.textPrimary }]}>{label}</Text>
          <Text style={[styles.affirm, { color: colors.textSecondary }]}>
            you did this.
          </Text>
        </Animated.View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="continue"
          onPress={onContinue}
          style={({ pressed }) => [
            styles.button,
            {
              backgroundColor: colors.accent,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <Text style={styles.buttonText}>continue</Text>
        </Pressable>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxxl,
    justifyContent: 'space-between',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  label: {
    ...type.display,
    textAlign: 'center',
  },
  affirm: {
    ...type.h3,
    textAlign: 'center',
  },
  button: {
    borderRadius: radii.pill,
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
})
```

- [ ] **Step 2: Verify lint + typecheck**

Run: `cd apps/mobile && npm run lint && npm run typecheck`

Expected output:
```
> @circly/mobile@1.0.0 lint
> eslint . --ext .ts,.tsx --max-warnings 0

> @circly/mobile@1.0.0 typecheck
> tsc --noEmit
```

- [ ] **Step 3: Commit**

```
git add apps/mobile/components/MilestoneTakeover.tsx
git commit -m "add MilestoneTakeover full-screen celebration component"
```

---

### Task 5: `MilestoneFeedCard` and `StartedFreshFeedCard` components

**Files:** Create `apps/mobile/components/MilestoneFeedCard.tsx`, `apps/mobile/components/StartedFreshFeedCard.tsx`

- [ ] **Step 1: Create `MilestoneFeedCard.tsx`**

Create `apps/mobile/components/MilestoneFeedCard.tsx` with:

```tsx
import { View, Text, StyleSheet, Pressable } from 'react-native'
import { useColors } from '../hooks/useColors'
import { spacing, radii, type } from '../constants/theme'

/**
 * Persistent celebratory feed card per spec §6.3 (recovery user) and
 * §6.4 (supporter). Style is shared; the caller chooses the body text
 * and optional onPress (supporter side gets the encouragement CTA).
 */
export function MilestoneFeedCard({
  badge,
  body,
  cta,
  onPress,
}: {
  /** Short badge, e.g. "1 week" or "50 check-ins". */
  badge: string
  /** Full-sentence body, e.g. "🌱 1 week clean. quiet wins matter." */
  body: string
  /** Optional CTA label for the supporter variant. */
  cta?: string
  onPress?: () => void
}) {
  const colors = useColors()
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.accentSoft, borderColor: colors.accent },
      ]}
      accessibilityLabel={`milestone: ${badge}`}
    >
      <View style={[styles.badgeWrap, { backgroundColor: colors.accent }]}>
        <Text style={styles.badgeText}>{badge}</Text>
      </View>
      <Text style={[styles.body, { color: colors.textPrimary }]}>{body}</Text>
      {cta && onPress && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={cta}
          onPress={onPress}
          style={({ pressed }) => [styles.cta, { opacity: pressed ? 0.7 : 1 }]}
        >
          <Text style={[styles.ctaText, { color: colors.accent }]}>{cta}</Text>
        </Pressable>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: spacing.xl,
    gap: spacing.md,
  },
  badgeWrap: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  body: { ...type.h3 },
  cta: { paddingTop: spacing.xs },
  ctaText: { ...type.smallStrong },
})
```

- [ ] **Step 2: Create `StartedFreshFeedCard.tsx`**

Create `apps/mobile/components/StartedFreshFeedCard.tsx` with:

```tsx
import { View, Text, StyleSheet, Pressable } from 'react-native'
import { useColors } from '../hooks/useColors'
import { spacing, radii, type } from '../constants/theme'

/**
 * Supporter-side feed card shown when a connected recovery user starts
 * fresh (spec §2.3). Soft amber accent. Tapping opens the encouragement
 * flow for that person.
 */
export function StartedFreshFeedCard({
  name,
  onPress,
}: {
  name: string
  onPress: () => void
}) {
  const colors = useColors()
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${name} started fresh today. tap to send encouragement.`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.warning,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <Text style={[styles.body, { color: colors.textPrimary }]}>
        {name} started fresh today
      </Text>
      <Text style={[styles.cta, { color: colors.warning }]}>
        send encouragement
      </Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.lg,
    borderLeftWidth: 4,
    borderTopWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  body: { ...type.body, fontWeight: '600' },
  cta: { ...type.small, fontWeight: '600' },
})
```

- [ ] **Step 3: Verify lint + typecheck**

Run: `cd apps/mobile && npm run lint && npm run typecheck`

Expected output:
```
> @circly/mobile@1.0.0 lint
> eslint . --ext .ts,.tsx --max-warnings 0

> @circly/mobile@1.0.0 typecheck
> tsc --noEmit
```

- [ ] **Step 4: Commit**

```
git add apps/mobile/components/MilestoneFeedCard.tsx apps/mobile/components/StartedFreshFeedCard.tsx
git commit -m "add milestone and started-fresh feed card components"
```

---

### Task 6: Start-fresh confirm sheet screen — `(recovery)/start-fresh.tsx`

**Files:** Create `apps/mobile/app/(recovery)/start-fresh.tsx`

This is the spec §2.2 confirm sheet implemented as a modal route so it can be opened from any screen by `router.push('/(recovery)/start-fresh')`. Recovery-life users never reach this screen because the only entry points are the streak-card chip and the inline check-in card, both of which we gate by `context === 'recovery'` in later tasks.

- [ ] **Step 1: Create the screen**

Create `apps/mobile/app/(recovery)/start-fresh.tsx` with:

```tsx
import { useState } from 'react'
import { View, Text, StyleSheet, Pressable, Alert, Modal } from 'react-native'
import { router } from 'expo-router'
import { useColors } from '../../hooks/useColors'
import { useAuthStore } from '../../store/auth'
import { supabase } from '../../lib/supabase'
import { toISODate } from '../../lib/streak'
import { tapMedium, notifySuccess } from '../../lib/haptics'
import { spacing, radii, type } from '../../constants/theme'

/**
 * Spec §2.2 — "today is day one again" confirm sheet.
 *
 * Recovery-substance only. Sets sobriety_start_date to today, clears
 * last_milestone_celebrated_days to 0, and records an audit row in
 * sobriety_resets so supporters can render the §2.3 card.
 *
 * Routed as a transparent modal so the previous screen stays visible
 * underneath.
 */
export default function StartFreshScreen() {
  const colors = useColors()
  const user = useAuthStore((s) => s.user)
  const setUser = useAuthStore((s) => s.setUser)
  const [submitting, setSubmitting] = useState(false)

  // Defensive: a non-recovery-context user should never see this. If they
  // somehow do (deep link, dev tools), bounce them out without writing.
  if (!user || user.context !== 'recovery') {
    setTimeout(() => router.back(), 0)
    return null
  }

  async function handleConfirm() {
    if (!user) return
    setSubmitting(true)
    const todayISO = toISODate(new Date())
    const previousISO = user.sobrietyStartDate

    const { error: profileErr } = await supabase
      .from('profiles')
      .update({
        sobriety_start_date: todayISO,
        last_milestone_celebrated_days: 0,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id)

    if (profileErr) {
      setSubmitting(false)
      Alert.alert('something went wrong', profileErr.message)
      return
    }

    // Audit row. Failure here is non-fatal — the reset itself succeeded.
    await supabase.from('sobriety_resets').insert({
      user_id: user.id,
      previous_start_date: previousISO,
    })

    setUser({
      ...user,
      sobrietyStartDate: todayISO,
      lastMilestoneCelebratedDays: 0,
    })
    setSubmitting(false)
    notifySuccess()
    router.back()
  }

  return (
    <Modal
      visible
      animationType="slide"
      transparent
      onRequestClose={() => router.back()}
    >
      <Pressable style={styles.backdrop} onPress={() => router.back()}>
        <Pressable
          style={[
            styles.sheet,
            { backgroundColor: colors.background, borderColor: colors.border },
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          <Text style={[styles.title, { color: colors.textPrimary }]}>
            today is day one again.
          </Text>
          <Text style={[styles.body, { color: colors.textSecondary }]}>
            that took courage.
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="reset to today"
            disabled={submitting}
            onPress={() => {
              tapMedium()
              handleConfirm()
            }}
            style={({ pressed }) => [
              styles.primary,
              {
                backgroundColor: colors.warning,
                opacity: submitting ? 0.6 : pressed ? 0.85 : 1,
              },
            ]}
          >
            <Text style={styles.primaryText}>
              {submitting ? 'resetting...' : 'reset to today'}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="cancel"
            onPress={() => router.back()}
            style={({ pressed }) => [styles.cancel, { opacity: pressed ? 0.6 : 1 }]}
          >
            <Text style={[styles.cancelText, { color: colors.textSecondary }]}>
              cancel
            </Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    borderTopWidth: 1,
    padding: spacing.xl,
    paddingBottom: spacing.xxxl,
    gap: spacing.lg,
  },
  title: { ...type.h2 },
  body: { ...type.body },
  primary: {
    borderRadius: radii.pill,
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  primaryText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  cancel: { alignItems: 'center', paddingVertical: spacing.md },
  cancelText: { ...type.body },
})
```

- [ ] **Step 2: Verify lint + typecheck**

Run: `cd apps/mobile && npm run lint && npm run typecheck`

Expected output:
```
> @circly/mobile@1.0.0 lint
> eslint . --ext .ts,.tsx --max-warnings 0

> @circly/mobile@1.0.0 typecheck
> tsc --noEmit
```

- [ ] **Step 3: Manual smoke checklist**

Build the app for iOS simulator (`cd apps/mobile && npm run ios` or open in Expo Go) and verify:

- [ ] As a recovery-substance user, navigate manually via dev tools to `/(recovery)/start-fresh`. The sheet appears with the title "today is day one again."
- [ ] Tap the backdrop → sheet dismisses, no DB writes.
- [ ] Tap "cancel" → sheet dismisses, no DB writes.
- [ ] Tap "reset to today" → sheet dismisses; in Supabase Studio confirm `profiles.sobriety_start_date` is today's date and `profiles.last_milestone_celebrated_days` is 0; confirm a new `sobriety_resets` row exists with `previous_start_date` matching the prior value.
- [ ] As a recovery-life user (set `users.context='life'` in DB) navigate to `/(recovery)/start-fresh`: the screen mounts and immediately routes back; no DB writes occur.

- [ ] **Step 4: Commit**

```
git add apps/mobile/app/(recovery)/start-fresh.tsx
git commit -m "add start-fresh confirm sheet for recovery-substance users"
```

---

### Task 7: Add reset chip to streak card in `(recovery)/index.tsx`

**Files:** Modify `apps/mobile/app/(recovery)/index.tsx`

- [ ] **Step 1: Add the chip to `StreakCard`**

Open `apps/mobile/app/(recovery)/index.tsx`. Find the `StreakCard` function (around line 310). The current render of the streak number row looks like:

```tsx
<View style={styles.streakNumberRow}>
  <Text style={[styles.streakNumber, { color: colors.accent }]}>{days}</Text>
  <Text style={[styles.streakUnit, { color: colors.textSecondary }]}>
    {days === 1 ? 'day' : 'days'}
  </Text>
</View>
```

Modify the `StreakCard` props to accept a new `showResetChip: boolean` prop, and render the chip when true. Replace the props block:

```tsx
function StreakCard({
  days,
  next,
  streakLabel,
}: {
  days: number
  next: Milestone | null
  streakLabel: string
}) {
```

with:

```tsx
function StreakCard({
  days,
  next,
  streakLabel,
  showResetChip,
}: {
  days: number
  next: Milestone | null
  streakLabel: string
  showResetChip: boolean
}) {
```

And replace the `streakNumberRow` block above with:

```tsx
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
        ↻ reset
      </Text>
    </Pressable>
  )}
</View>
```

Add these two style entries to the bottom of the `StyleSheet.create` block (just above the closing `})`):

```tsx
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
```

- [ ] **Step 2: Pass `showResetChip` from the `RecoveryHome` render**

In the `RecoveryHome` component's JSX (around line 266), the current call is:

```tsx
<StreakCard days={days} next={next} streakLabel={copy.dashboard.streakLabel} />
```

Change it to:

```tsx
<StreakCard
  days={days}
  next={next}
  streakLabel={copy.dashboard.streakLabel}
  showResetChip={user?.context === 'recovery'}
/>
```

- [ ] **Step 3: Verify lint + typecheck**

Run: `cd apps/mobile && npm run lint && npm run typecheck`

Expected output:
```
> @circly/mobile@1.0.0 lint
> eslint . --ext .ts,.tsx --max-warnings 0

> @circly/mobile@1.0.0 typecheck
> tsc --noEmit
```

- [ ] **Step 4: Manual smoke checklist**

- [ ] As a recovery-substance user the home feed shows "↻ reset" chip on the right edge of the streak number row.
- [ ] Tap the chip → start-fresh sheet appears.
- [ ] Cancel → sheet dismisses, streak unchanged.
- [ ] Confirm reset → sheet dismisses; on next focus the streak card shows "0 days" / "1 day" depending on inclusivity (per `streakDays` impl this is 1 since today counts).
- [ ] As a recovery-life user (manually set `users.context='life'`), navigate to home: no chip is rendered.

- [ ] **Step 5: Commit**

```
git add apps/mobile/app/(recovery)/index.tsx
git commit -m "add reset chip to streak card for recovery-substance users"
```

---

### Task 8: Add inline "start fresh" card to check-in when struggling selected (recovery context only)

**Files:** Modify `apps/mobile/app/(recovery)/check-in.tsx`

- [ ] **Step 1: Add the inline card under the mood options**

Open `apps/mobile/app/(recovery)/check-in.tsx`. Locate the closing `</View>` of the `<View style={styles.options}>` block (around line 165). Immediately after that closing `</View>` and before `<View style={styles.noteWrap}>`, insert:

```tsx
{status === 'struggling' && user?.context === 'recovery' && (
  <View
    style={[
      styles.startFreshCard,
      { backgroundColor: colors.warningSoft, borderColor: colors.warning },
    ]}
  >
    <Text style={[styles.startFreshTitle, { color: colors.textPrimary }]}>
      need a fresh start?
    </Text>
    <Text style={[styles.startFreshBody, { color: colors.textSecondary }]}>
      if today wasn&apos;t a clean day, you can reset your start date. it&apos;s not a failure, it&apos;s honesty.
    </Text>
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={() => router.push('/(recovery)/start-fresh')}
      style={[styles.startFreshBtn, { backgroundColor: colors.warning }]}
    >
      <Text style={styles.startFreshBtnText}>↻ start fresh</Text>
    </TouchableOpacity>
  </View>
)}
```

Add these style entries inside the `StyleSheet.create` block (just before `historySection`):

```tsx
startFreshCard: {
  borderRadius: radii.lg,
  borderWidth: 1,
  padding: spacing.lg,
  gap: spacing.sm,
},
startFreshTitle: { ...t.h3 },
startFreshBody: { ...t.small },
startFreshBtn: {
  alignSelf: 'flex-start',
  paddingHorizontal: spacing.lg,
  paddingVertical: spacing.sm,
  borderRadius: radii.pill,
  marginTop: spacing.xs,
},
startFreshBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
```

- [ ] **Step 2: Verify lint + typecheck**

Run: `cd apps/mobile && npm run lint && npm run typecheck`

Expected output:
```
> @circly/mobile@1.0.0 lint
> eslint . --ext .ts,.tsx --max-warnings 0

> @circly/mobile@1.0.0 typecheck
> tsc --noEmit
```

- [ ] **Step 3: Manual smoke checklist**

- [ ] As recovery-substance user open check-in, tap "good day" → no start-fresh card.
- [ ] Tap "struggling" → amber card appears with "need a fresh start?" copy and "↻ start fresh" button.
- [ ] Tap the button → start-fresh sheet opens.
- [ ] As recovery-life user open check-in, tap the equivalent of "struggling" (which uses different copy in life context — confirmed by `copy.dashboard.checkInStatuses.struggling.label`) → no start-fresh card appears (gated by `user.context === 'recovery'`).

- [ ] **Step 4: Commit**

```
git add apps/mobile/app/(recovery)/check-in.tsx
git commit -m "add inline start-fresh card to check-in struggling state for recovery context"
```

---

### Task 9: First-check-in intro screen — `(recovery)/first-checkin-intro.tsx`

**Files:** Create `apps/mobile/app/(recovery)/first-checkin-intro.tsx`

- [ ] **Step 1: Create the screen**

Create `apps/mobile/app/(recovery)/first-checkin-intro.tsx` with:

```tsx
import { useState } from 'react'
import { View, Text, StyleSheet, Pressable } from 'react-native'
import { router } from 'expo-router'
import { useColors } from '../../hooks/useColors'
import { useAuthStore } from '../../store/auth'
import { supabase } from '../../lib/supabase'
import { spacing, radii, type, layout } from '../../constants/theme'

/**
 * Spec §4.1 — first-check-in intro. Shown exactly once, gated by
 * profiles.first_checkin_intro_seen. The flag is flipped on tap of "begin"
 * before routing to the standard check-in screen so the user never sees
 * this intro twice.
 */
export default function FirstCheckinIntroScreen() {
  const colors = useColors()
  const user = useAuthStore((s) => s.user)
  const setUser = useAuthStore((s) => s.setUser)
  const [advancing, setAdvancing] = useState(false)

  async function handleBegin() {
    if (!user || advancing) return
    setAdvancing(true)
    await supabase
      .from('profiles')
      .update({ first_checkin_intro_seen: true })
      .eq('user_id', user.id)
    setUser({ ...user, firstCheckinIntroSeen: true })
    router.replace('/(recovery)/check-in')
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={styles.center}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>
          this is your daily check-in.
        </Text>
        <Text style={[styles.sub, { color: colors.textSecondary }]}>
          one minute, every day. that&apos;s the whole thing.
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="begin"
        onPress={handleBegin}
        disabled={advancing}
        style={({ pressed }) => [
          styles.button,
          {
            backgroundColor: colors.accent,
            opacity: advancing ? 0.6 : pressed ? 0.85 : 1,
          },
        ]}
      >
        <Text style={styles.buttonText}>{advancing ? '...' : 'begin'}</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: layout.screenTopPadding,
    paddingBottom: spacing.xxxl,
    justifyContent: 'space-between',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  title: { ...type.h1, textAlign: 'center' },
  sub: { ...type.body, textAlign: 'center' },
  button: {
    borderRadius: radii.pill,
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
})
```

- [ ] **Step 2: Route to the intro from `CheckInTile` when conditions are met**

The `CheckInTile` in `apps/mobile/app/(recovery)/index.tsx` currently routes to `/(recovery)/check-in`. We do NOT change that — we instead make the check-in screen itself redirect to the intro on first run. That keeps the deep-link surface area minimal. (Done in the next step.)

- [ ] **Step 3: Make `(recovery)/check-in.tsx` redirect to the intro on first ever visit**

Open `apps/mobile/app/(recovery)/check-in.tsx`. At the top of `CheckInScreen`, just below the existing destructuring of `user` and `copy`, add:

```tsx
// First-check-in intro: §4.1. Redirect once if the flag is unset and we
// have no historical check-ins. Done before loading anything to avoid
// flashing the standard screen.
useEffect(() => {
  if (!user) return
  if (user.firstCheckinIntroSeen) return
  ;(async () => {
    const { count } = await supabase
      .from('check_ins')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
    if ((count ?? 0) === 0) {
      router.replace('/(recovery)/first-checkin-intro')
    }
  })()
}, [user])
```

Note the existing imports already include `useEffect`, `router`, `supabase`, and `useAuthStore`. No new imports are needed.

- [ ] **Step 4: Verify lint + typecheck**

Run: `cd apps/mobile && npm run lint && npm run typecheck`

Expected output:
```
> @circly/mobile@1.0.0 lint
> eslint . --ext .ts,.tsx --max-warnings 0

> @circly/mobile@1.0.0 typecheck
> tsc --noEmit
```

- [ ] **Step 5: Manual smoke checklist**

- [ ] Create a fresh recovery-substance account (or in Supabase delete all check_ins for the test user and set `profiles.first_checkin_intro_seen=false`). Open the app, tap the "check in" tile from home → routed to the intro screen with copy "this is your daily check-in."
- [ ] Tap "begin" → routed to the standard check-in screen; in Supabase confirm `first_checkin_intro_seen=true`.
- [ ] Close and reopen the check-in tile → routed straight to the standard screen, no intro re-shown.
- [ ] Repeat with a recovery-life account: same behavior (intro is context-neutral by design).

- [ ] **Step 6: Commit**

```
git add apps/mobile/app/(recovery)/first-checkin-intro.tsx apps/mobile/app/(recovery)/check-in.tsx
git commit -m "add first-checkin intro screen gated by profiles flag"
```

---

### Task 10: First-check-in celebration screen — `(recovery)/first-checkin-celebration.tsx`

**Files:** Create `apps/mobile/app/(recovery)/first-checkin-celebration.tsx`, modify `apps/mobile/app/(recovery)/check-in.tsx`

- [ ] **Step 1: Create the celebration screen**

Create `apps/mobile/app/(recovery)/first-checkin-celebration.tsx` with:

```tsx
import { useState } from 'react'
import { View, Text, StyleSheet, Pressable } from 'react-native'
import { router } from 'expo-router'
import { useColors } from '../../hooks/useColors'
import { useAuthStore } from '../../store/auth'
import { supabase } from '../../lib/supabase'
import { spacing, radii, type, layout } from '../../constants/theme'

/**
 * Spec §4.3 — celebratory screen after the first-ever check-in submit.
 * Shown exactly once, gated by profiles.first_checkin_celebration_seen.
 */
export default function FirstCheckinCelebrationScreen() {
  const colors = useColors()
  const user = useAuthStore((s) => s.user)
  const setUser = useAuthStore((s) => s.setUser)
  const [advancing, setAdvancing] = useState(false)

  async function handleContinue() {
    if (!user || advancing) return
    setAdvancing(true)
    await supabase
      .from('profiles')
      .update({ first_checkin_celebration_seen: true })
      .eq('user_id', user.id)
    setUser({ ...user, firstCheckinCelebrationSeen: true })
    router.replace('/(recovery)')
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={styles.center}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>
          day one. you showed up.
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="continue"
        onPress={handleContinue}
        disabled={advancing}
        style={({ pressed }) => [
          styles.button,
          {
            backgroundColor: colors.accent,
            opacity: advancing ? 0.6 : pressed ? 0.85 : 1,
          },
        ]}
      >
        <Text style={styles.buttonText}>{advancing ? '...' : 'continue'}</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: layout.screenTopPadding,
    paddingBottom: spacing.xxxl,
    justifyContent: 'space-between',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { ...type.display, textAlign: 'center' },
  button: {
    borderRadius: radii.pill,
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
})
```

- [ ] **Step 2: Route to celebration after the first save**

In `apps/mobile/app/(recovery)/check-in.tsx`, find `handleSave` (around line 75). The current ending is:

```tsx
// Optimistically update history
setHistory((prev) => {
  const without = prev.filter((r) => r.check_in_date !== todayISO)
  return [data, ...without]
})
router.back()
```

Replace those four lines with:

```tsx
// Optimistically update history
setHistory((prev) => {
  const without = prev.filter((r) => r.check_in_date !== todayISO)
  return [data, ...without]
})

// First-check-in celebration: §4.3. Trigger if the user hasn't seen it
// AND this submit produced their very first row (history was empty
// before the optimistic prepend, so length was 0).
const wasFirstEver = history.length === 0
if (wasFirstEver && user && !user.firstCheckinCelebrationSeen) {
  router.replace('/(recovery)/first-checkin-celebration')
} else {
  router.back()
}
```

- [ ] **Step 3: Verify lint + typecheck**

Run: `cd apps/mobile && npm run lint && npm run typecheck`

Expected output:
```
> @circly/mobile@1.0.0 lint
> eslint . --ext .ts,.tsx --max-warnings 0

> @circly/mobile@1.0.0 typecheck
> tsc --noEmit
```

- [ ] **Step 4: Manual smoke checklist**

- [ ] Fresh recovery user (no check-ins, both flags false): complete the check-in → routed to celebration showing "day one. you showed up."
- [ ] Tap "continue" → home feed; in Supabase confirm `first_checkin_celebration_seen=true`.
- [ ] Submit a second check-in (next day or via DB hack) → goes back to feed, no celebration re-shown.
- [ ] Editing the same-day check-in (history is non-empty, but `wasFirstEver` is false because the existing row is in history) → no celebration.

- [ ] **Step 5: Commit**

```
git add apps/mobile/app/(recovery)/first-checkin-celebration.tsx apps/mobile/app/(recovery)/check-in.tsx
git commit -m "add first-checkin celebration screen and trigger on first save"
```

---

### Task 11: Day-one empty feed for recovery users (substance + life)

**Files:** Modify `apps/mobile/app/(recovery)/index.tsx`

- [ ] **Step 1: Add zero-checkin and connection-count tracking to `RecoveryHome`**

In `apps/mobile/app/(recovery)/index.tsx`, locate the `useState` block at the top of `RecoveryHome` (around lines 36-46). Add two new state variables next to the others:

```tsx
const [hasAnyCheckIns, setHasAnyCheckIns] = useState<boolean | null>(null)
const [connectionCount, setConnectionCount] = useState<number>(0)
```

In `loadDashboard`, add two more queries to the `Promise.all` (extend the array). The current shape is:

```tsx
;[checkInRes, streakRes, weekCheckRes, weekJournalRes, okayTapRes] = await Promise.all([
  // ...existing five queries...
])
```

Change the destructure name list and add the two queries at the end:

```tsx
const [
  checkInRes2,
  streakRes2,
  weekCheckRes2,
  weekJournalRes2,
  okayTapRes2,
  totalCheckRes,
  relationshipsRes,
] = await Promise.all([
  // existing five queries (unchanged)...
  supabase
    .from('check_ins')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id),
  supabase
    .from('relationships')
    .select('id', { count: 'exact', head: true })
    .eq('recovery_user_id', user.id)
    .eq('status', 'active'),
])
checkInRes = checkInRes2
streakRes = streakRes2
weekCheckRes = weekCheckRes2
weekJournalRes = weekJournalRes2
okayTapRes = okayTapRes2
```

(Implementer note: the original five `let` bindings remain so the rest of `loadDashboard` is unchanged. Only the `Promise.all` is extended and we add the two extra reads.)

After the existing `setOkayTapped` line, add:

```tsx
setHasAnyCheckIns((totalCheckRes.count ?? 0) > 0)
setConnectionCount(relationshipsRes.count ?? 0)
```

- [ ] **Step 2: Render the day-one empty card and the post-first-checkin invite card**

Inside the `<ScrollView>` returned by `RecoveryHome`, immediately after the `<CelebrationBanner />` line (or replacing it — see Task 13 for the celebration banner removal), insert a conditional block. The simplest insertion point is right before the existing `<OkayTapCard ... />`. Replace `<OkayTapCard ... />` and the surrounding section with:

```tsx
{hasAnyCheckIns === false ? (
  // §3.1 — pre first check-in, big warm card
  <View
    style={[
      styles.dayOneCard,
      { backgroundColor: colors.accentSoft, borderColor: colors.accent },
    ]}
  >
    <Text style={[styles.dayOneTitle, { color: colors.textPrimary }]}>
      welcome. start with your first check-in.
    </Text>
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="check in"
      onPress={() => router.push('/(recovery)/check-in')}
      style={({ pressed }) => [
        styles.dayOneBtn,
        { backgroundColor: colors.accent, opacity: pressed ? 0.85 : 1 },
      ]}
    >
      <Text style={styles.dayOneBtnText}>check in →</Text>
    </Pressable>
  </View>
) : (
  <>
    <OkayTapCard
      tapped={okayTapped}
      onTap={async () => {
        try {
          await api('/api/okay-tap', { method: 'POST' })
          setOkayTapped(true)
        } catch {
          // silent — haptic already fired, will retry on next refresh
        }
      }}
      prompt={copy.dashboard.okayTapPrompt}
      doneMessage={copy.dashboard.okayTapDone}
    />
    {connectionCount === 0 && (
      // §3.2/§3.3 — quiet invite-a-supporter card while user has zero
      // connections.
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="invite someone who is in your corner"
        onPress={() => router.push('/(recovery)/settings')}
        style={({ pressed }) => [
          styles.inviteCard,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            opacity: pressed ? 0.85 : 1,
          },
        ]}
      >
        <Text style={[styles.inviteText, { color: colors.textPrimary }]}>
          invite someone who&apos;s in your corner →
        </Text>
      </Pressable>
    )}
  </>
)}
```

Add these style entries to the `StyleSheet.create` block at the end (just before the closing `})`):

```tsx
dayOneCard: {
  borderRadius: radii.xl,
  borderWidth: 1,
  padding: spacing.xl,
  gap: spacing.lg,
},
dayOneTitle: { ...type.h2 },
dayOneBtn: {
  alignSelf: 'flex-start',
  paddingHorizontal: spacing.xl,
  paddingVertical: spacing.lg,
  borderRadius: radii.pill,
},
dayOneBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
inviteCard: {
  borderRadius: radii.lg,
  borderWidth: 1,
  padding: spacing.lg,
},
inviteText: { ...type.body, fontWeight: '500' },
```

- [ ] **Step 3: Verify lint + typecheck**

Run: `cd apps/mobile && npm run lint && npm run typecheck`

Expected output:
```
> @circly/mobile@1.0.0 lint
> eslint . --ext .ts,.tsx --max-warnings 0

> @circly/mobile@1.0.0 typecheck
> tsc --noEmit
```

- [ ] **Step 4: Manual smoke checklist**

- [ ] Fresh recovery-substance user, zero check-ins, zero connections: home feed shows the big amber "welcome. start with your first check-in." card and nothing above the streak section.
- [ ] Tap "check in →" → routed to first-checkin intro (Task 9 wiring).
- [ ] After completing the first check-in: home feed shows the OkayTapCard plus the quiet "invite someone who's in your corner →" card.
- [ ] Add a supporter (via invite flow): the invite card disappears.
- [ ] Repeat the entire flow with a recovery-life account — copy is identical (it's intentionally generic).

- [ ] **Step 5: Commit**

```
git add apps/mobile/app/(recovery)/index.tsx
git commit -m "add day-one empty feed and invite-supporter card for recovery users"
```

---

### Task 12: Milestone takeover and persistent feed card on recovery home

**Files:** Modify `apps/mobile/app/(recovery)/index.tsx`

- [ ] **Step 1: Compute the celebration target and total check-ins**

In `apps/mobile/app/(recovery)/index.tsx`, add to the imports near the top:

```tsx
import {
  shouldCelebrateSubstance,
  shouldCelebrateLife,
  highestReachedSubstanceDays,
  highestReachedLifeCheckins,
} from '../../lib/milestones'
import { MilestoneTakeover } from '../../components/MilestoneTakeover'
import { MilestoneFeedCard } from '../../components/MilestoneFeedCard'
```

Add two more state variables to `RecoveryHome` next to `hasAnyCheckIns`:

```tsx
const [totalCheckIns, setTotalCheckIns] = useState<number>(0)
const [milestoneTakeoverVisible, setMilestoneTakeoverVisible] = useState(false)
```

After `setHasAnyCheckIns(...)` in `loadDashboard`, add:

```tsx
setTotalCheckIns(totalCheckRes.count ?? 0)
```

- [ ] **Step 2: Decide whether to show the takeover after data loads**

After `setLoading(false)` and `hasLoaded.current = true` at the end of `loadDashboard`, add:

```tsx
// Decide milestone celebration. Substance: by streak days. Life: by
// total check-ins. Branches strictly on user.context.
if (user.context === 'recovery') {
  const m = shouldCelebrateSubstance(
    user.sobrietyStartDate ? streakDays(user.sobrietyStartDate) : 0,
    user.lastMilestoneCelebratedDays ?? 0,
  )
  if (m) setMilestoneTakeoverVisible(true)
} else if (user.context === 'life') {
  const m = shouldCelebrateLife(
    totalCheckRes.count ?? 0,
    user.lastMilestoneCelebratedCheckins ?? 0,
  )
  if (m) setMilestoneTakeoverVisible(true)
}
```

- [ ] **Step 3: Compute the celebration label and persistent-card body for render**

Just before the `return` statement of `RecoveryHome`, add:

```tsx
// Resolve which milestone (if any) is currently being celebrated and
// also which (if any) is the highest already reached so we can render
// the persistent feed card permanently.
const substanceCelebrating =
  user?.context === 'recovery'
    ? shouldCelebrateSubstance(
        days,
        user.lastMilestoneCelebratedDays ?? 0,
      )
    : null
const lifeCelebrating =
  user?.context === 'life'
    ? shouldCelebrateLife(
        totalCheckIns,
        user.lastMilestoneCelebratedCheckins ?? 0,
      )
    : null

const substanceHighest = highestReachedSubstanceDays(days)
const lifeHighest = highestReachedLifeCheckins(totalCheckIns)

const takeoverLabel =
  substanceCelebrating
    ? `${substanceCelebrating.label}.`
    : lifeCelebrating
      ? `${lifeCelebrating.label}.`
      : ''

async function handleTakeoverContinue() {
  if (!user) {
    setMilestoneTakeoverVisible(false)
    return
  }
  if (user.context === 'recovery' && substanceCelebrating) {
    await supabase
      .from('profiles')
      .update({ last_milestone_celebrated_days: substanceCelebrating.days })
      .eq('user_id', user.id)
    setUser({ ...user, lastMilestoneCelebratedDays: substanceCelebrating.days })
  } else if (user.context === 'life' && lifeCelebrating) {
    await supabase
      .from('profiles')
      .update({ last_milestone_celebrated_checkins: lifeCelebrating.checkins })
      .eq('user_id', user.id)
    setUser({ ...user, lastMilestoneCelebratedCheckins: lifeCelebrating.checkins })
  }
  setMilestoneTakeoverVisible(false)
}
```

You will also need `setUser` from the auth store. Add it where `user` is destructured at the top of `RecoveryHome`:

```tsx
const setUser = useAuthStore((s) => s.setUser)
```

- [ ] **Step 4: Render the takeover and the persistent feed card**

In the returned JSX, immediately after the opening `<ScrollView ...>` tag (before the `<View style={styles.header}>`), insert the takeover (a Modal renders globally; placement here is fine):

```tsx
<MilestoneTakeover
  visible={milestoneTakeoverVisible}
  label={takeoverLabel}
  onContinue={handleTakeoverContinue}
/>
```

Then, right after the `<WeeklySummary ... />` line, add the persistent card:

```tsx
{user?.context === 'recovery' && substanceHighest > 0 && (
  <MilestoneFeedCard
    badge={
      MILESTONES_SUBSTANCE_LABEL[substanceHighest] ??
      `${substanceHighest} days`
    }
    body={`🌱 ${MILESTONES_SUBSTANCE_LABEL[substanceHighest] ?? `${substanceHighest} days`} clean. quiet wins matter.`}
  />
)}
{user?.context === 'life' && lifeHighest > 0 && (
  <MilestoneFeedCard
    badge={`${lifeHighest} check-ins`}
    body={`🌱 ${lifeHighest} check-ins. showing up matters.`}
  />
)}
```

Add a small lookup map outside the component, near the top of the file (after imports, before `RecoveryHome`):

```tsx
const MILESTONES_SUBSTANCE_LABEL: Record<number, string> = {
  1: '1 day',
  3: '3 days',
  7: '1 week',
  14: '2 weeks',
  30: '1 month',
  90: '3 months',
  180: '6 months',
  365: '1 year',
  730: '2 years',
  1095: '3 years',
  1460: '4 years',
  1825: '5 years',
}
```

- [ ] **Step 5: Remove the old `CelebrationBanner` system (replaced by takeover)**

The existing `CelebrationBanner` component and the `useEffect` that drives it (around lines 180-191) are replaced by the takeover. Delete:

```tsx
const prevDaysRef = useRef(days)
useEffect(() => {
  if (days > 0 && prevDaysRef.current !== days) {
    const justReached = MILESTONES.find(m => m.days === days)
    if (justReached) {
      setShowCelebration(true)
      notifySuccess()
      setTimeout(() => setShowCelebration(false), 3000)
    }
  }
  prevDaysRef.current = days
}, [days])
```

Also delete the `<CelebrationBanner />` JSX line (`{showCelebration && <CelebrationBanner />}`), the `showCelebration` useState, and the `CelebrationBanner` function definition entirely. Remove the `notifySuccess` and `Animated` imports if they become unused (lint will flag them).

- [ ] **Step 6: Verify lint + typecheck**

Run: `cd apps/mobile && npm run lint && npm run typecheck`

Expected output:
```
> @circly/mobile@1.0.0 lint
> eslint . --ext .ts,.tsx --max-warnings 0

> @circly/mobile@1.0.0 typecheck
> tsc --noEmit
```

- [ ] **Step 7: Manual smoke checklist (substance)**

- [ ] Set a recovery-substance user's `sobriety_start_date` to today (so `streakDays` is 1) and `last_milestone_celebrated_days = 0`. Open home → full-screen takeover appears with "1 day." and "you did this." Tap "continue" → returns to feed; persistent feed card "🌱 1 day clean. quiet wins matter." is visible. Confirm `last_milestone_celebrated_days = 1` in Supabase.
- [ ] Reopen home → no takeover (gating worked).
- [ ] Manually set `sobriety_start_date` to 7 days ago → reopen home → takeover appears with "1 week."; tap continue → persistent card updates badge to "1 week".
- [ ] Manually set `sobriety_start_date` to 365 days ago → "1 year." takeover appears.

- [ ] **Step 8: Manual smoke checklist (life)**

- [ ] Set a recovery-life user with 10 check-ins seeded and `last_milestone_celebrated_checkins = 0` → open home → "10 check-ins." takeover appears; persistent card reads "🌱 10 check-ins. showing up matters."
- [ ] Bump check-ins to 25 → takeover for "25 check-ins."
- [ ] Bump to 110 → takeover for "100 check-ins." (highest reached but not yet celebrated, per the helper).

- [ ] **Step 9: Commit**

```
git add apps/mobile/app/(recovery)/index.tsx
git commit -m "add milestone takeover and persistent feed card on recovery home"
```

---

### Task 13: Supporter feed — milestone card and started-fresh card

**Files:** Modify `apps/mobile/app/(supporter)/index.tsx`

- [ ] **Step 1: Add imports**

At the top of `apps/mobile/app/(supporter)/index.tsx`, add:

```tsx
import { MilestoneFeedCard } from '../../components/MilestoneFeedCard'
import { StartedFreshFeedCard } from '../../components/StartedFreshFeedCard'
import {
  highestReachedSubstanceDays,
  highestReachedLifeCheckins,
} from '../../lib/milestones'
import { streakDays as computeStreakDays } from '../../lib/streak'
```

- [ ] **Step 2: Extend the per-person row with totals + recent reset**

In the `LinkedPerson` interface (around line 38), add two fields:

```ts
interface LinkedPerson {
  relationship_id: string
  recovery_user_id: string
  display_name: string
  sobriety_start_date: string | null
  today_check_in: CheckInStatus | null
  latest_milestone: MilestoneType | null
  context: 'recovery' | 'life' | null
  total_check_ins: number
  recent_reset_at: string | null
}
```

In the `load` function, where `users:recovery_user_id(...)` is selected, extend the projection to include the user's `context`:

Replace:
```ts
'id, recovery_user_id, users:recovery_user_id(display_name, profiles(sobriety_start_date))',
```

With:
```ts
'id, recovery_user_id, users:recovery_user_id(display_name, context, profiles(sobriety_start_date))',
```

Update the typed cast accordingly:

```ts
const base = (rels as unknown as Array<{
  id: string
  recovery_user_id: string
  users: {
    display_name: string
    context: 'recovery' | 'life' | null
    profiles: { sobriety_start_date: string | null } | null
  } | null
}>).map((r) => ({
  relationship_id: r.id,
  recovery_user_id: r.recovery_user_id,
  display_name: r.users?.display_name ?? 'friend',
  sobriety_start_date: r.users?.profiles?.sobriety_start_date ?? null,
  today_check_in: null as CheckInStatus | null,
  latest_milestone: null as MilestoneType | null,
  context: r.users?.context ?? null,
  total_check_ins: 0,
  recent_reset_at: null as string | null,
}))
```

- [ ] **Step 3: Batch-load total check-ins and recent resets per linked person**

Inside the existing `Promise.all` block in `load`, append two more queries to the array. Currently the array contains four entries (`checkInsRes`, `milestonesRes`, `nudgesRes`, `emergencyRes`). Add:

```ts
supabase
  .from('check_ins')
  .select('user_id', { count: 'exact', head: false })
  .in('user_id', ids),
supabase
  .from('sobriety_resets')
  .select('user_id, reset_at')
  .in('user_id', ids)
  .gte('reset_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
  .order('reset_at', { ascending: false }),
```

Update the destructure to include the two new results:

```ts
const [checkInsRes, milestonesRes, nudgesRes, emergencyRes, totalCheckInsRes, resetsRes] = await Promise.all([
```

After the `latestMilestoneByUser` building loop, build the two new lookups:

```ts
// Total check-ins per user (count rows in JS — we did head: false above
// so each row carries user_id, but we also need a count-by-user. The
// supabase-js client doesn't yet support GROUP BY, so we count manually.)
const totalCheckInsByUser = new Map<string, number>()
for (const row of (totalCheckInsRes.data ?? []) as Array<{ user_id: string }>) {
  totalCheckInsByUser.set(
    row.user_id,
    (totalCheckInsByUser.get(row.user_id) ?? 0) + 1,
  )
}

// Most recent reset per user within the last 7 days. Sorted desc, so
// first occurrence wins.
const recentResetByUser = new Map<string, string>()
for (const row of (resetsRes.data ?? []) as Array<{ user_id: string; reset_at: string }>) {
  if (!recentResetByUser.has(row.user_id)) {
    recentResetByUser.set(row.user_id, row.reset_at)
  }
}
```

Update the final `enriched` mapping to populate the new fields:

```ts
const enriched = base.map((p) => ({
  ...p,
  today_check_in: checkInByUser.get(p.recovery_user_id) ?? null,
  latest_milestone: latestMilestoneByUser.get(p.recovery_user_id) ?? null,
  total_check_ins: totalCheckInsByUser.get(p.recovery_user_id) ?? 0,
  recent_reset_at: recentResetByUser.get(p.recovery_user_id) ?? null,
}))
```

- [ ] **Step 4: Render the cards**

Inside the `peopleSection` view, just before the existing `{people.map((p) => (...PersonCard...))}`, add:

```tsx
{people.flatMap((p) => {
  const cards: React.ReactNode[] = []

  // §2.3 — started fresh card (only for substance-context connections
  // with a reset in the last 7 days).
  if (p.context === 'recovery' && p.recent_reset_at) {
    cards.push(
      <StartedFreshFeedCard
        key={`reset-${p.relationship_id}`}
        name={p.display_name}
        onPress={() => setSendingFor(p)}
      />,
    )
  }

  // §6.4 — milestone card. Substance variant uses day-count, life
  // variant uses cumulative check-ins.
  if (p.context === 'recovery' && p.sobriety_start_date) {
    const days = computeStreakDays(p.sobriety_start_date)
    const highest = highestReachedSubstanceDays(days)
    if (highest > 0) {
      const label = SUBSTANCE_LABEL[highest] ?? `${highest} days`
      cards.push(
        <MilestoneFeedCard
          key={`ms-${p.relationship_id}`}
          badge={label}
          body={`${p.display_name} hit ${label}.`}
          cta="send encouragement →"
          onPress={() => setSendingFor(p)}
        />,
      )
    }
  } else if (p.context === 'life') {
    const highest = highestReachedLifeCheckins(p.total_check_ins)
    if (highest > 0) {
      cards.push(
        <MilestoneFeedCard
          key={`ms-${p.relationship_id}`}
          badge={`${highest} check-ins`}
          body={`${p.display_name} hit ${highest} check-ins.`}
          cta="send encouragement →"
          onPress={() => setSendingFor(p)}
        />,
      )
    }
  }

  return cards
})}
```

Add the substance label lookup near the top of the file (right after imports):

```tsx
const SUBSTANCE_LABEL: Record<number, string> = {
  1: '1 day',
  3: '3 days',
  7: '1 week',
  14: '2 weeks',
  30: '1 month',
  90: '3 months',
  180: '6 months',
  365: '1 year',
  730: '2 years',
  1095: '3 years',
  1460: '4 years',
  1825: '5 years',
}
```

- [ ] **Step 5: Verify lint + typecheck**

Run: `cd apps/mobile && npm run lint && npm run typecheck`

Expected output:
```
> @circly/mobile@1.0.0 lint
> eslint . --ext .ts,.tsx --max-warnings 0

> @circly/mobile@1.0.0 typecheck
> tsc --noEmit
```

- [ ] **Step 6: Manual smoke checklist**

- [ ] Supporter linked to a substance user whose `sobriety_resets` has a row in the last 7 days: feed shows "[name] started fresh today" card. Tap → encouragement sheet opens pre-targeted to that person.
- [ ] Supporter linked to a substance user with 7+ days streak: feed shows "[name] hit 1 week." card with "send encouragement →" CTA. Tap → encouragement sheet opens.
- [ ] Supporter linked to a life-context user with 10+ check-ins: feed shows "[name] hit 10 check-ins." card.
- [ ] Supporter linked to a fresh user (no streak / no check-ins): no extra cards, just the standard PersonCard.

- [ ] **Step 7: Commit**

```
git add apps/mobile/app/(supporter)/index.tsx
git commit -m "render started-fresh and milestone feed cards on supporter home"
```

---

### Task 14: Supporter first-run — connected path screen

**Files:** Create `apps/mobile/app/(supporter)/first-run-connected.tsx`

- [ ] **Step 1: Create the screen**

Create `apps/mobile/app/(supporter)/first-run-connected.tsx` with:

```tsx
import { useEffect, useState } from 'react'
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native'
import { router } from 'expo-router'
import { useColors } from '../../hooks/useColors'
import { useAuthStore } from '../../store/auth'
import { supabase } from '../../lib/supabase'
import { streakDays, type MilestoneType } from '../../lib/streak'
import { spacing, radii, type, layout } from '../../constants/theme'

interface ConnectedPerson {
  display_name: string
  sobriety_start_date: string | null
  today_status: string | null
  latest_milestone: MilestoneType | null
}

/**
 * Spec §5.1 — first-run intro for supporters who arrived via an invite
 * code (so they already have one connection). Two-screen flow:
 *   step 1: "[name] invited you. here's what they've been working on."
 *   step 2: rich first-time view with avatar / streak / mood / milestone.
 *
 * Dismisses by setting profiles.supporter_first_run_seen=true and
 * routing to the standard supporter feed.
 */
export default function FirstRunConnectedScreen() {
  const colors = useColors()
  const user = useAuthStore((s) => s.user)
  const setUser = useAuthStore((s) => s.setUser)
  const [step, setStep] = useState<1 | 2>(1)
  const [person, setPerson] = useState<ConnectedPerson | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    ;(async () => {
      const { data } = await supabase
        .from('relationships')
        .select(
          'recovery_user_id, users:recovery_user_id(display_name, profiles(sobriety_start_date))',
        )
        .eq('supporter_id', user.id)
        .eq('status', 'active')
        .limit(1)
        .maybeSingle<{
          recovery_user_id: string
          users: {
            display_name: string
            profiles: { sobriety_start_date: string | null } | null
          } | null
        }>()
      if (!data) {
        // No connection — fall through to cold path.
        router.replace('/(supporter)/first-run-cold')
        return
      }
      // Best-effort: fetch latest milestone + today's status.
      const [todayRes, msRes] = await Promise.all([
        supabase
          .from('check_ins')
          .select('status')
          .eq('user_id', data.recovery_user_id)
          .order('check_in_date', { ascending: false })
          .limit(1)
          .maybeSingle<{ status: string }>(),
        supabase
          .from('milestones')
          .select('type')
          .eq('user_id', data.recovery_user_id)
          .order('achieved_at', { ascending: false })
          .limit(1)
          .maybeSingle<{ type: MilestoneType }>(),
      ])
      setPerson({
        display_name: data.users?.display_name ?? 'someone',
        sobriety_start_date: data.users?.profiles?.sobriety_start_date ?? null,
        today_status: todayRes.data?.status ?? null,
        latest_milestone: msRes.data?.type ?? null,
      })
      setLoading(false)
    })()
  }, [user])

  async function dismiss() {
    if (!user) return
    await supabase
      .from('profiles')
      .update({ supporter_first_run_seen: true })
      .eq('user_id', user.id)
    setUser({ ...user, supporterFirstRunSeen: true })
    router.replace('/(supporter)')
  }

  if (loading || !person) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.accent} />
      </View>
    )
  }

  if (step === 1) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <View style={styles.center}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>
            {person.display_name} invited you.
          </Text>
          <Text style={[styles.sub, { color: colors.textSecondary }]}>
            here&apos;s what they&apos;ve been working on.
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="see their journey"
          onPress={() => setStep(2)}
          style={({ pressed }) => [
            styles.button,
            { backgroundColor: colors.accent, opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <Text style={styles.buttonText}>see their journey</Text>
        </Pressable>
      </View>
    )
  }

  const days = person.sobriety_start_date
    ? streakDays(person.sobriety_start_date)
    : null

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={styles.center}>
        <View style={[styles.avatar, { backgroundColor: colors.accentSoft }]}>
          <Text style={[styles.avatarText, { color: colors.accent }]}>
            {person.display_name.charAt(0).toUpperCase()}
          </Text>
        </View>
        <Text style={[styles.name, { color: colors.textPrimary }]}>
          {person.display_name}
        </Text>
        {days !== null && (
          <Text style={[styles.streak, { color: colors.accent }]}>
            {days} {days === 1 ? 'day' : 'days'}
          </Text>
        )}
        {person.today_status && (
          <Text style={[styles.line, { color: colors.textSecondary }]}>
            today: {person.today_status}
          </Text>
        )}
        {person.latest_milestone && (
          <Text style={[styles.line, { color: colors.textSecondary }]}>
            latest milestone: {person.latest_milestone}
          </Text>
        )}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="go to feed"
        onPress={dismiss}
        style={({ pressed }) => [
          styles.button,
          { backgroundColor: colors.accent, opacity: pressed ? 0.85 : 1 },
        ]}
      >
        <Text style={styles.buttonText}>go to feed →</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  root: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: layout.screenTopPadding,
    paddingBottom: spacing.xxxl,
    justifyContent: 'space-between',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  title: { ...type.h1, textAlign: 'center' },
  sub: { ...type.body, textAlign: 'center' },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 32, fontWeight: '700' },
  name: { ...type.h2 },
  streak: { ...type.h3, fontWeight: '700' },
  line: { ...type.body },
  button: {
    borderRadius: radii.pill,
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
})
```

- [ ] **Step 2: Verify lint + typecheck**

Run: `cd apps/mobile && npm run lint && npm run typecheck`

Expected output:
```
> @circly/mobile@1.0.0 lint
> eslint . --ext .ts,.tsx --max-warnings 0

> @circly/mobile@1.0.0 typecheck
> tsc --noEmit
```

- [ ] **Step 3: Commit**

```
git add apps/mobile/app/(supporter)/first-run-connected.tsx
git commit -m "add supporter first-run connected-path intro screen"
```

---

### Task 15: Supporter first-run — cold path screen

**Files:** Create `apps/mobile/app/(supporter)/first-run-cold.tsx`

- [ ] **Step 1: Create the screen**

Create `apps/mobile/app/(supporter)/first-run-cold.tsx` with:

```tsx
import { View, Text, StyleSheet, Pressable } from 'react-native'
import { router } from 'expo-router'
import { useColors } from '../../hooks/useColors'
import { useAuthStore } from '../../store/auth'
import { supabase } from '../../lib/supabase'
import { spacing, radii, type, layout } from '../../constants/theme'

/**
 * Spec §5.2 — first-run for supporters with no connections (signed up
 * without an invite code). Three actions: enter a code, create one, or
 * skip. All three flip supporter_first_run_seen so the user lands on
 * the standard feed next time.
 */
export default function FirstRunColdScreen() {
  const colors = useColors()
  const user = useAuthStore((s) => s.user)
  const setUser = useAuthStore((s) => s.setUser)

  async function markSeen() {
    if (!user) return
    await supabase
      .from('profiles')
      .update({ supporter_first_run_seen: true })
      .eq('user_id', user.id)
    setUser({ ...user, supporterFirstRunSeen: true })
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={styles.headerWrap}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>
          who are you here for?
        </Text>
      </View>

      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="i have an invite code"
          onPress={async () => {
            await markSeen()
            router.replace('/(auth)/invite-code')
          }}
          style={({ pressed }) => [
            styles.bigBtn,
            {
              backgroundColor: colors.accent,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <Text style={styles.bigBtnText}>i have an invite code</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="i want to invite someone"
          onPress={async () => {
            await markSeen()
            router.replace('/(supporter)/invite')
          }}
          style={({ pressed }) => [
            styles.bigBtn,
            {
              backgroundColor: colors.surface,
              borderColor: colors.accent,
              borderWidth: 1,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <Text style={[styles.bigBtnText, { color: colors.accent }]}>
            i want to invite someone
          </Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="skip for now"
          onPress={async () => {
            await markSeen()
            router.replace('/(supporter)')
          }}
          style={({ pressed }) => [styles.skip, { opacity: pressed ? 0.6 : 1 }]}
        >
          <Text style={[styles.skipText, { color: colors.textMuted }]}>
            skip for now
          </Text>
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: layout.screenTopPadding,
    paddingBottom: spacing.xxxl,
    justifyContent: 'space-between',
  },
  headerWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { ...type.h1, textAlign: 'center' },
  actions: { gap: spacing.lg },
  bigBtn: {
    borderRadius: radii.lg,
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
  bigBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  skip: { alignItems: 'center', paddingVertical: spacing.md },
  skipText: { ...type.small },
})
```

Note: The "polite empty feed" copy from §5.2 ("your circle is waiting. add someone when you're ready.") is rendered by the existing `EmptyState` in `apps/mobile/app/(supporter)/index.tsx`. Update its copy in the next step.

- [ ] **Step 2: Update supporter `EmptyState` copy to match spec**

In `apps/mobile/app/(supporter)/index.tsx`, locate the `EmptyState` component (around line 399). Replace the existing `Text` block:

```tsx
<Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
  no one linked yet
</Text>
<Text style={[styles.emptyBody, { color: colors.textSecondary }]}>
  your circle is where you show up for the people{'\n'}who matter most. invite someone to get started.
</Text>
```

with:

```tsx
<Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
  your circle is waiting.
</Text>
<Text style={[styles.emptyBody, { color: colors.textSecondary }]}>
  add someone when you&apos;re ready.
</Text>
```

- [ ] **Step 3: Verify lint + typecheck**

Run: `cd apps/mobile && npm run lint && npm run typecheck`

Expected output:
```
> @circly/mobile@1.0.0 lint
> eslint . --ext .ts,.tsx --max-warnings 0

> @circly/mobile@1.0.0 typecheck
> tsc --noEmit
```

- [ ] **Step 4: Commit**

```
git add apps/mobile/app/(supporter)/first-run-cold.tsx apps/mobile/app/(supporter)/index.tsx
git commit -m "add supporter first-run cold-path screen and update empty-state copy"
```

---

### Task 16: Wire supporter first-run gating into `(supporter)/index.tsx`

**Files:** Modify `apps/mobile/app/(supporter)/index.tsx`

- [ ] **Step 1: Add a routing effect at the top of `SupporterHome`**

Open `apps/mobile/app/(supporter)/index.tsx`. Just below the existing `useState` declarations in `SupporterHome` (around line 73), add:

```tsx
useEffect(() => {
  if (!user) return
  if (user.supporterFirstRunSeen) return
  ;(async () => {
    const { count } = await supabase
      .from('relationships')
      .select('id', { count: 'exact', head: true })
      .eq('supporter_id', user.id)
      .eq('status', 'active')
    if ((count ?? 0) > 0) {
      router.replace('/(supporter)/first-run-connected')
    } else {
      router.replace('/(supporter)/first-run-cold')
    }
  })()
}, [user])
```

Add `useEffect` to the React import if not already imported. The current imports include `useCallback, useMemo, useRef, useState` — add `useEffect`:

```tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
```

- [ ] **Step 2: Verify lint + typecheck**

Run: `cd apps/mobile && npm run lint && npm run typecheck`

Expected output:
```
> @circly/mobile@1.0.0 lint
> eslint . --ext .ts,.tsx --max-warnings 0

> @circly/mobile@1.0.0 typecheck
> tsc --noEmit
```

- [ ] **Step 3: Manual smoke checklist**

- [ ] Fresh supporter account that signed up via invite code (so 1 active relationship exists, `supporter_first_run_seen=false`): on first home load → routed to `first-run-connected` showing "[name] invited you." Tap "see their journey" → step 2 with avatar / streak / mood / milestone. Tap "go to feed →" → standard feed; in Supabase confirm `supporter_first_run_seen=true`.
- [ ] Reopen the app: lands on standard feed directly, no first-run.
- [ ] Fresh supporter with zero relationships and `supporter_first_run_seen=false`: routed to `first-run-cold` with "who are you here for?" Tap "i have an invite code" → routed to `/(auth)/invite-code`; flag is now true. Reopen → standard feed (which renders the polite empty state).
- [ ] Tap "skip for now" on cold path → standard supporter feed with the "your circle is waiting." empty state.

- [ ] **Step 4: Commit**

```
git add apps/mobile/app/(supporter)/index.tsx
git commit -m "wire supporter first-run gating to route to connected or cold path"
```

---

### Task 17: Final integration smoke and full lint/typecheck pass

**Files:** none (verification only)

- [ ] **Step 1: Run full lint, typecheck, and unit tests**

Run from repo root:

```
cd apps/mobile && npm run lint && npm run typecheck && npx jest
```

Expected output (the trailing summaries):
```
> @circly/mobile@1.0.0 lint
> eslint . --ext .ts,.tsx --max-warnings 0

> @circly/mobile@1.0.0 typecheck
> tsc --noEmit

Test Suites: <N> passed, <N> total
Tests:       <M> passed, <M> total
```

(`<N>` and `<M>` reflect the existing suite plus the new `milestones.test.ts`.)

- [ ] **Step 2: End-to-end manual smoke (the five spec sections, in order)**

For each of the three account types, walk through the relevant moments:

**Recovery-substance (role=recovery, context=recovery):**
- [ ] §3.1 day-one feed: brand-new account shows "welcome. start with your first check-in." card.
- [ ] §4.1 intro: tapping "check in" routes to "this is your daily check-in."
- [ ] §4.2 standard check-in is unchanged (no extra coaching copy).
- [ ] §4.3 celebration: "day one. you showed up." after first save; flag flips.
- [ ] §3.2 post-first-checkin: feed shows OkayTapCard + invite-supporter card.
- [ ] §6 milestones: at 1d / 7d / 30d / 365d (DB-bumped) the takeover fires once each, persistent feed card appears.
- [ ] §2 start fresh: tapping ↻ chip → confirm sheet → reset; `last_milestone_celebrated_days` returns to 0 so the fresh 1-day milestone re-celebrates the next time the streak crosses 1.
- [ ] §2.B inline card: selecting "struggling" in check-in shows the inline "need a fresh start?" card.

**Recovery-life (role=recovery, context=life):**
- [ ] §3 day-one feed: identical generic copy renders.
- [ ] §4 first check-in intro + celebration: identical experience.
- [ ] §6 cumulative milestones: at 10/25/50/100 check-ins (DB-bumped) the takeover and persistent card render with check-in copy.
- [ ] §2 start fresh: NO ↻ chip on streak card; navigating directly to `/(recovery)/start-fresh` immediately routes back; selecting "struggling" in check-in shows NO inline card.

**Supporter (role=supporter):**
- [ ] §5.1 connected first-run intro fires once for invite-code signups; flag flips.
- [ ] §5.2 cold first-run fires once for code-less signups; flag flips after any of the three actions.
- [ ] §6.4 milestone card mirrors the connected user's context (substance days vs life check-ins).
- [ ] §2.3 started-fresh card appears on the supporter's feed within 7 days of a substance connection's reset.

- [ ] **Step 3: No commit** — this task is verification only. If any step fails, fix in a follow-up commit before proceeding.

---

## Self-Review Checklist (executed before finalizing this plan)

- [x] §2 start fresh — Tasks 6, 7, 8 cover the confirm sheet, the streak-card chip entry point, and the inline check-in card entry point. All gated on `context === 'recovery'`.
- [x] §2.3 supporter started-fresh card — Task 13 step 4 renders `StartedFreshFeedCard` from `sobriety_resets` data.
- [x] §3 day-one feed — Task 11 covers both the pre-first-checkin big card and the post-first-checkin invite card; copy is generic so both contexts share the flow.
- [x] §4 first check-in — Task 9 (intro) and Task 10 (celebration) with one-shot gating via the two boolean columns.
- [x] §5 supporter first-run — Tasks 14, 15, 16 cover connected, cold, and the routing logic.
- [x] §6 milestones — Task 2 (helpers, TDD), Tasks 4 + 5 (UI components), Task 12 (recovery integration), Task 13 (supporter integration). Substance and life schedules are separate code paths.
- [x] §7 data model — Task 1 adds all five gating columns plus `sobriety_resets`. Includes `last_milestone_celebrated_checkins`.
- [x] Account-type scoping table at the top is consistent with the per-task `context === 'recovery'` / `context === 'life'` checks.
- [x] No placeholders. Every step has either real code or a concrete command + expected output.
- [x] No `'family'` references introduced. All branching uses `'recovery'` and `'life'` tokens.
- [x] No em dashes in user-facing copy.
- [x] Commit messages are single sentences with no co-author trailer or attribution.
- [x] TDD discipline: pure helpers (Task 2) get a sibling jest test driven via red-green; UI screens under `app/` use manual smoke checklists since `apps/mobile/app/` is excluded from jest by `testPathIgnorePatterns`.
