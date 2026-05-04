# Onboarding — Single-Step Account Selection Design Spec

**Date:** 2026-05-04
**Status:** Approved
**Scope:** Replace the two-step `context-select` then `role-select` onboarding flow with a single 3-card account-type selection screen.

---

## 1. Overview

Today, a new sign-up walks through two consecutive selection screens:

1. `context-select.tsx` (recovery vs family)
2. `role-select.tsx` (recovery vs supporter)

This produces three effective account types (recovery-substance, recovery-family, supporter) but asks two questions to get there. The questions are also abstract for first-time users, since "context" and "role" are internal-model words that map awkwardly to "what is this app for me?".

This spec collapses both selections into one screen with three direct cards.

## 2. New Flow

```
sign-up
  -> onboarding (welcome / how it works)
    -> account-select  (single 3-card screen)
      |- "i'm in recovery"          -> sobriety-start -> /(recovery)
      |- "i need daily support"     -> /(recovery)
      `- "i'm here to support"      -> invite-code   -> /(supporter)
```

The `context-select.tsx` screen is removed. `role-select.tsx` is replaced by `account-select.tsx`.

## 3. Screen Design

### 3.1 Layout

- Back chevron, top-left
- Single bold title: "who's circly for?"
- No subtitle, no helper text
- Three vertically-stacked option cards
- Single primary "continue" button at the bottom (disabled until a card is selected)

### 3.2 Cards

| Icon | Label | Description (single line) |
|---|---|---|
| ◐ | i'm in recovery | track sobriety with daily check-ins |
| ○ | i need daily support | check in and stay connected |
| ♡ | i'm here to support someone | show up for someone you care about |

Card visual:
- Default: dark `#131318` background, soft monochrome icon, body text in white/grey
- Selected: inset 1.5px amber border, amber-tinted background, icon turns amber
- No checkmark badge (selection state is conveyed entirely by the border + tint)
- Generous touch target (~70px tall)
- 18px corner radius

### 3.3 Continue button

- Disabled visual when no card is selected (dark grey, muted text)
- Active visual when any card is selected (amber, dark text)
- Tap routes per the mapping in 4.

## 4. Card to Data Mapping

| Card | `role` | `context` | Next screen |
|---|---|---|---|
| i'm in recovery | `'recovery'` | `'recovery'` | `/(auth)/sobriety-start` |
| i need daily support | `'recovery'` | `'life'` | `/(recovery)` |
| i'm here to support someone | `'supporter'` | `null` (see 5) | `/(auth)/invite-code` |

> **Naming note:** the `'life'` context token replaces the previous `'family'` value to better reflect that this account type covers any day-to-day support relationship (family, friends, coworkers, partners, anyone). Existing rows using `'family'` will be migrated to `'life'` as part of this work.

The same `users` and `profiles` insert that `role-select.tsx` does today is performed on continue, with both `role` and `context` set in one operation.

## 5. Supporter Context Inference

Supporters do not pick a context on this screen. Their `context` is set to `null` at account creation and inferred on first connection:

- When a supporter accepts an invite code, the system already knows the recovery user the relationship is being formed with.
- At that moment, the supporter's `context` is updated to match that recovery user's `context`.
- Until the first connection completes, any context-dependent supporter copy falls back to the same default the app uses elsewhere (today: `'recovery'`).

This avoids a fourth onboarding screen for a value the supporter does not need to consciously choose.

If a supporter later forms additional connections that span both contexts (e.g. one substance-recovery person and one family person), the supporter's stored `context` is left at its first-set value. Per-card copy on the supporter feed should already be derived from the connected person's `context`, not the supporter's, so this does not surface as a UX bug.

## 6. Copy Rules

All copy follows the project rule: no em dashes anywhere on this screen.

Card descriptions are single short sentences and avoid implementation language ("relationship", "circle", "context"). The descriptions are written so a first-time user knows which card is theirs without reading the others.

## 7. Files Affected

- `apps/mobile/app/(auth)/account-select.tsx` (new) - replaces the role-select screen
- `apps/mobile/app/(auth)/role-select.tsx` (delete)
- `apps/mobile/app/(auth)/context-select.tsx` (delete)
- `apps/mobile/app/(auth)/onboarding.tsx` - update the two `router.replace('/(auth)/context-select')` redirects to point to `/(auth)/account-select`
- `apps/mobile/app/_layout.tsx` - any auth-state routing that points at `context-select` or `role-select` updates to `account-select`
- `apps/mobile/store/auth.ts` - update the `AppContext` type from `'recovery' | 'family'` to `'recovery' | 'life'`
- `apps/mobile/lib/copy.ts` - rename the `family` copy bucket key to `life` and any user-visible copy that read "family" gets replaced with neutral phrasing
- New Supabase migration - `update profiles set context = 'life' where context = 'family';` plus updating the CHECK constraint on the column
- Tests covering copy keys and any auth-flow tests covering the removed screens are updated for the new screen
- Profile settings screen - add the "wrong account type? contact us" link per §8

## 8. Account Type Switching

A general account-type switcher in settings is **out of scope for v1**. The trade-off is deliberate: switching has many edge cases (orphaned relationships when changing role, lost streak history when changing context) that are not worth building UI for before knowing real-world demand.

Instead, profile settings include a single line:

> wrong account type? [contact us](mailto:support@circly.app)

This handles the rare misclick by routing the user to a human, and lets the team manually correct the row. Post-launch, if a particular switch direction is repeatedly requested, that specific transition can be designed and built with proper data-handling.

## 9. Out of Scope

- Changing copy on the welcome / onboarding intro screen
- Changing what happens after `/(recovery)` or `/(supporter)` is reached (covered by other specs)
- A general user-facing account-type switcher (see §8 for v1 stance)
- Supporter context follow-up question (rejected in favor of inference per §5)
- Visual changes to other auth screens (sign-in, sign-up, forgot-password, etc.)
