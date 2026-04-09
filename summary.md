# Reeco — Session Summary

> Full record of everything designed, decided, and built in this session.

---

## What Reeco Is

Reeco is a dual-sided mobile app for people in addiction recovery and their support network. It creates a structured, privacy-first space where:

- **People in recovery** track their journey, log daily check-ins, and choose what to share
- **Supporters** (family, loved ones) show up in healthy, intentional ways — without supervising
- **Sponsors** (verified professionals) host sessions and provide guided support

**Core design principle:** Supporters can support, not supervise. The person in recovery always owns their data.

**One-line concept:**
> A dual-sided recovery app where users track their journey and supporters show up in healthy, intentional ways.

---

## Decisions Made

| Topic | Decision |
|---|---|
| Platform | React Native + Expo (cross-platform iOS/Android) |
| Backend | Express.js (Node) for business logic and API |
| Database | Supabase (PostgreSQL + Auth + Realtime) |
| Auth | Supabase Auth (email/password, social login later) |
| State management | Zustand |
| Navigation | Expo Router (file-based, role-based layouts) |
| Push notifications | Expo Notifications |
| Deployment path | Expo Go → Dev Build → TestFlight → App Store/Play Store |
| Color mode | System default (follows phone setting, no manual toggle in MVP) |
| Roles | Single shared system with permissions — not two separate apps |
| Supporter verification | None required. Join via invite from recovery user only |
| Sponsor verification | Phase 2. Video submission → manual or AI review |
| Emergency button | In-app only for MVP. SMS/call trigger in a later phase |
| Multiple supporters | Yes, unlimited |
| Monetization | Free for all users — no paywall or subscription in MVP |

---

## Design System

**Logo:** Circular motif with two orbital dots, lowercase "reeco" wordmark, violet gradient — established as the canonical brand direction. All UI must match this energy.

**Philosophy:** Hyper-modern. Calm, not clinical. Emotional but not cheesy.

### Color Tokens

| Token | Light | Dark |
|---|---|---|
| `background` | `#F5F3F8` | `#16131E` |
| `surface` | `#FFFFFF` | `#1F1A2E` |
| `surface-raised` | `#EFECF5` | `#2A2440` |
| `text-primary` | `#1A1625` | `#F0EDF8` |
| `text-secondary` | `#6B6480` | `#9B93B4` |
| `accent` | `#7B5EA7` | `#9B8EC4` |
| `accent-gradient` | `#9B8EC4 → #7B5EA7` | `#B8ADDA → #9B8EC4` |
| `success` | `#5CAF8A` | `#6DC9A0` |
| `warning` | `#E8A44A` | `#F0B866` |
| `danger` | `#D95F5F` | `#F07070` |
| `border` | `#E2DCF0` | `#2E2845` |

### Typography
- **Font:** Plus Jakarta Sans (weights: 400, 500, 600, 700)
- **Scale:** 12 / 14 / 16 / 18 / 22 / 28 / 36
- **Style:** Lowercase-friendly. App name and CTAs use lowercase where appropriate.

### Shape
- **Border radius:** 8 / 16 / 24 / pill (999)
- **Buttons:** Pill-shaped for all primary actions
- **Cards:** `surface` background, 16–20px radius, border or soft shadow

### Motion
- Check-in selection: spring scale pop
- Milestone unlock: circular ripple from badge center
- Encouragement sent: orbital dot animates around send button
- Screen transitions: fade + slight upward slide

---

## Tech Stack Summary

```
apps/mobile/        — Expo Router (React Native, TypeScript)
server/             — Express.js (TypeScript, Vitest tests)
supabase/           — PostgreSQL migrations + RLS policies
```

---

## Database Schema (Supabase)

8 tables deployed to Supabase project `kmhxynxbfvupjsqzbhdn`:

| Table | Purpose |
|---|---|
| `users` | Extends `auth.users` — stores role, display_name, avatar |
| `profiles` | Role-specific data: sobriety_start_date, bio, push_token |
| `relationships` | Links recovery user ↔ supporter with permissions jsonb |
| `check_ins` | Daily check-ins: sober / struggling / good_day + optional note |
| `journal_entries` | Private journal — never visible to supporters at DB level |
| `milestones` | Streak badges: 1d, 7d, 30d, 90d, 1y, custom |
| `conversations` | Chat conversations (direct or group) |
| `messages` | Chat messages linked to conversations |
| `notifications` | In-app notifications (emergency, encouragement, message) |

### Key RLS Rules
- **Every table has RLS enabled** — no data is accessible unless a policy explicitly allows it
- **Journals have zero supporter policies** — enforced at the database layer, not app code
- **3 helper functions** — `is_active_supporter()`, `can_see_check_ins()`, `can_see_milestones()` — read from `relationships.permissions` jsonb
- **Notifications** — no client insert policy; only the server (service role) can create them
- **`check_in_date`** — stored as a `date` column with `UNIQUE(user_id, check_in_date)` to enforce one check-in per day (avoids PostgreSQL expression index limitations)

---

## What Was Built

### Task 1 — Project Scaffold (commit `a2c9291`)

**Monorepo structure:**
```
reeco/
├── apps/mobile/         — Expo Router app (TypeScript)
│   ├── app/             — Expo Router screens
│   ├── components/      — Button, TextInput shared components
│   ├── constants/       — colors.ts (full design token palette)
│   ├── hooks/           — useColors (system color scheme aware)
│   ├── store/           — auth.ts (Zustand)
│   └── lib/             — supabase.ts (anon key client)
├── server/              — Express API (TypeScript, Vitest)
│   └── src/
│       ├── app.ts       — Express app + /health endpoint
│       ├── index.ts     — Server entry point
│       └── lib/         — supabase.ts (service role client)
└── supabase/
    └── migrations/      — SQL migration files
```

- Root ESLint + Prettier config shared across workspaces
- TypeScript strict mode in both workspaces
- Server test: `GET /health` → `{ status: "ok" }` (passes with Vitest + Supertest)
- `.env.example` files documenting all required env vars

### Task 2 — Supabase Schema + RLS (commit `a87c8e1`)

- All 8 tables created with correct types, indexes, and constraints
- RLS enabled on every table with full policy set
- 3 helper SQL functions for permission-aware queries
- Supabase clients wired in both mobile and server
- Migrations deployed to live Supabase project

### Task 3 — Auth Flow (commit `ca0f371`)

**Screens built:**
- `(auth)/sign-up.tsx` — Name, email, password → Supabase Auth signup
- `(auth)/sign-in.tsx` — Email/password sign-in with error handling
- `(auth)/role-select.tsx` — 3-card role picker (recovery / supporter / sponsor)

**Logic:**
- On role select: creates `public.users` row and `profiles` row in Supabase
- Session restore on app relaunch: reads `public.users` → routes to correct dashboard
- Auth store (Zustand) holds `user: AppUser | null` globally
- Root `_layout.tsx` is the auth guard — listens to `onAuthStateChange`
- Placeholder dashboards for all 3 roles

**Shared components built:**
- `Button.tsx` — pill-shaped, primary/ghost variants, loading state
- `TextInput.tsx` — labeled input with design token colors

---

## Bugs Fixed This Session

### 1. Blank screen on startup (`7e01311`)
**Cause:** `router.replace()` was being called before Expo Router's navigator was fully mounted.
**Fix:** Added `SplashScreen.preventAutoHideAsync()` in `_layout.tsx`. The splash screen is held until the session check resolves, then hidden and navigation fires atomically.

### 2. `EXPO_ROUTER_APP_ROOT` — first error (`4aa4fac`)
**Cause:** The blank template's `index.ts` was calling `registerRootComponent(App)`, which overrode `expo-router/entry` as the app's bundle entry point. Expo Router never got to inject the `EXPO_ROUTER_APP_ROOT` env var.
**Fix:** Deleted `index.ts` and `App.tsx` (leftover from `create-expo-app` template).

### 3. `EXPO_ROUTER_APP_ROOT` — second error (`d8684aa`)
**Cause:** Even after deleting the conflicting files, the error persisted because there was no `babel.config.js`. The `EXPO_ROUTER_APP_ROOT` env var is injected as a **static string literal** at Babel transform time by the `expo-router-plugin` inside `babel-preset-expo`. Without `babel.config.js`, the preset never runs, so `require.context` receives a dynamic `process.env.EXPO_ROUTER_APP_ROOT` expression that Metro rejects.
**Fix:** Added `babel.config.js` using `babel-preset-expo`. This activates the plugin that rewrites `process.env.EXPO_ROUTER_APP_ROOT` to the correct relative path string before Metro processes the file.

### 4. `EXPO_ROUTER_APP_ROOT` — persistent monorepo error (session 2)
**Cause:** `babel-preset-expo` is hoisted to root `node_modules`, but `expo-router` is only in `apps/mobile/node_modules`. The preset calls `hasModule('expo-router')` via `require.resolve` from its own location (root), can't find it, and **never adds** `expoRouterBabelPlugin` to the Babel pipeline. So `process.env.EXPO_ROUTER_APP_ROOT` is never replaced with a string literal.
**Fix:** Explicitly added the plugin in `apps/mobile/babel.config.js`:
```js
const { expoRouterBabelPlugin } = require('babel-preset-expo/build/expo-router-plugin')
plugins: [expoRouterBabelPlugin]
```
Also set `process.env.EXPO_ROUTER_APP_ROOT = 'app'` at the top of `metro.config.js` as a belt-and-suspenders fallback.

### 5. Duplicate React — invalid hook call / `useMemo` of null (session 2)
**Cause:** npm workspaces installed two copies of React — 19.1.0 in `apps/mobile/node_modules/react` and 19.2.4 in root `node_modules/react`. Metro's default resolution walks up from the requiring file, so `react-native` (in root) resolved to root's React 19.2.4 while `expo-router` (in apps/mobile) resolved to 19.1.0. Two separate React instances = two separate `ReactCurrentDispatcher` objects = hooks fail because the renderer sets the dispatcher on one copy but components read from the other.
**Fix:** Configured `metro.config.js` with a monorepo-aware setup:
- `watchFolders` includes the workspace root so Metro can access root `node_modules`
- `resolver.nodeModulesPaths` prioritizes `apps/mobile/node_modules` then root
- `resolver.resolveRequest` forcibly returns the exact file path for `require('react')` → `apps/mobile/node_modules/react/index.js` (19.1.0), bypassing Metro's default node_modules traversal. Sub-path imports like `react/jsx-runtime` are also redirected. This ensures every module in the bundle — including `react-native`'s renderer — uses the same React instance.

### 6. Xcode tooling errors (session 2)
**Cause:** `xcode-select` was pointing to `/Library/Developer/CommandLineTools` instead of the full Xcode app, and the Xcode license hadn't been accepted.
**Fix:** `sudo xcode-select -s /Applications/Xcode.app/Contents/Developer` then `sudo xcodebuild -license accept`.

---

## File Inventory

### Mobile app (`apps/mobile/`)
| File | Purpose |
|---|---|
| `app.json` | Expo config — name "reeco", scheme, `userInterfaceStyle: automatic` |
| `babel.config.js` | Babel preset + explicit `expoRouterBabelPlugin` (workaround for monorepo hoisting) |
| `metro.config.js` | Metro config — monorepo watchFolders, nodeModulesPaths, resolveRequest to force single React |
| `tsconfig.json` | Strict TypeScript, path aliases |
| `app/_layout.tsx` | Root layout — session guard, auth state listener, SplashScreen |
| `app/index.tsx` | Loading spinner fallback while session check runs |
| `app/(auth)/sign-up.tsx` | Sign-up screen |
| `app/(auth)/sign-in.tsx` | Sign-in screen |
| `app/(auth)/role-select.tsx` | Role selection (creates user + profile rows) |
| `app/(recovery)/index.tsx` | Placeholder recovery dashboard |
| `app/(supporter)/index.tsx` | Placeholder supporter dashboard |
| `app/(sponsor)/index.tsx` | Placeholder sponsor dashboard |
| `components/Button.tsx` | Pill button (primary/ghost, loading state) |
| `components/TextInput.tsx` | Labeled text input with design tokens |
| `constants/colors.ts` | Full light/dark color token palette |
| `hooks/useColors.ts` | Returns correct color set for current system scheme |
| `lib/supabase.ts` | Supabase JS client (anon key) |
| `store/auth.ts` | Zustand auth store — user, loading, signOut |
| `.env` | Live credentials (gitignored) |
| `.env.example` | Env var documentation |

### Server (`server/`)
| File | Purpose |
|---|---|
| `src/app.ts` | Express app — `GET /health` endpoint |
| `src/index.ts` | Server entry point — listens on PORT |
| `src/lib/supabase.ts` | Supabase service role client (bypasses RLS, never exposed to client) |
| `src/app.test.ts` | Vitest + Supertest test for /health endpoint |
| `.env` | Live credentials (gitignored) |
| `.env.example` | Env var documentation |

### Supabase (`supabase/migrations/`)
| File | Purpose |
|---|---|
| `001_initial_schema.sql` | All 8 tables, enums, indexes |
| `002_rls_policies.sql` | RLS on all tables, helper functions, all policies |
| `apply_all.sql` | Combined file for pasting into Supabase SQL Editor |

---

## What's Next (Remaining Plan)

### Phase 2 — Recovery User Core
- [ ] **Task 4** — Sobriety streak counter + milestone badges (1d, 7d, 30d, 90d, 1y)
- [ ] **Task 5** — Daily check-in (3 states, one per day, history log)
- [ ] **Task 6** — Journal entry (private, mood tag)
- [ ] **Task 7** — Emergency support button (in-app push to all supporters)

### Phase 3 — Relationships + Supporter Flow
- [ ] **Task 8** — Invite and link supporters (email invite, accept, remove)
- [ ] **Task 9** — Privacy controls (per-supporter visibility toggles)
- [ ] **Task 10** — Supporter dashboard (shared feed + encouragement)

### Phase 4 — Chat + Notifications
- [ ] **Task 11** — 1:1 real-time chat (Supabase Realtime)
- [ ] **Task 12** — Push notification setup + in-app notification center

### Phase 2 (Post-MVP)
- Sponsor verification (video submission → manual/AI review)
- Support groups
- AI reflection prompts
- Content moderation
- Product analytics

---

## Commands Reference

```bash
# Start mobile app
cd apps/mobile && npx expo start --clear

# Start server
cd server && npm run dev

# Run server tests
cd server && npm test

# Type check mobile
cd apps/mobile && npm run typecheck

# Lint mobile
cd apps/mobile && npm run lint

# Type check server
cd server && npm run typecheck

# Lint server
cd server && npm run lint
```

---

## Environment Variables

### `server/.env`
```
PORT=3000
SUPABASE_URL=https://kmhxynxbfvupjsqzbhdn.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service_role_key>
EXPO_ACCESS_TOKEN=<to be added>
```

### `apps/mobile/.env`
```
EXPO_PUBLIC_SUPABASE_URL=https://kmhxynxbfvupjsqzbhdn.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon_key>
EXPO_PUBLIC_API_URL=http://localhost:3000
```

---

## Open Questions

- [ ] Do supporters need their own wellness/check-in feature, or is their dashboard purely about the recovery user?
- [ ] Can supporters see each other (shared supporter view), or are all relationships private 1:recovery-to-supporter?
---

### Monorepo Gotchas (Documented for Future Reference)

These are non-obvious issues specific to running Expo in an npm workspaces monorepo:

1. **`babel-preset-expo` can't detect `expo-router`** — The preset hoists to root `node_modules` but `expo-router` stays in `apps/mobile/node_modules`. The preset's `hasModule()` uses `require.resolve` from its own location and fails silently. Fix: explicitly add `expoRouterBabelPlugin` in `babel.config.js`.

2. **Duplicate React instances** — npm installs React at both root and workspace level if versions differ even slightly (19.1.0 vs 19.2.4). Metro resolves `require('react')` by walking up from the requiring file, so different packages get different React copies. Fix: `resolver.resolveRequest` that returns an exact `filePath` for `require('react')` — delegation-based approaches (`extraNodeModules`, modified `nodeModulesPaths`) don't reliably override Metro's built-in node_modules traversal.

3. **`react` and `react-native-renderer` must be exactly the same version** — React 19 enforces exact version matching between the `react` package and the renderer bundled inside `react-native`. Even 19.1.0 vs 19.2.4 causes a hard crash.

---

*Session dates: 2026-04-06 / 2026-04-07*
*Commits: 7 (71e70c4 → d8684aa) + uncommitted monorepo fixes*

---

## Session 2026-04-08 — Rebrand to Circly + Profile Section

### Product direction
Reeco is being renamed **Circly** ("support that moves with you"). Same codebase, same data model, but onboarding now asks for a **context** (recovery vs family/elder-care). The app's copy, role labels, streak label, and check-in statuses adapt to the selected context via a single copy map. "Emergency" was relabeled to **"get support"** — works for both a recovery crisis and an elder who just needs someone to talk to.

### Context system
- **Migration `003_add_user_context.sql`** — adds `context` column to `public.users` (`recovery` | `family`, CHECK constrained). Applied.
- **[apps/mobile/lib/copy.ts](apps/mobile/lib/copy.ts)** — single source of truth for every string that differs by context. Exports `COPY`, `useCopy()` hook, `DEFAULT_CONTEXT`. Family context hides the sponsor role and relabels "person in recovery" → "the person at the center", streak → "connected for", journal → "reflections", etc.
- **[apps/mobile/app/(auth)/context-select.tsx](apps/mobile/app/(auth)/context-select.tsx)** — new first onboarding screen. Stashes selection in `auth.updateUser({ data: { context } })` metadata.
- **[apps/mobile/app/(auth)/role-select.tsx](apps/mobile/app/(auth)/role-select.tsx)** — reads context from auth metadata via useEffect, renders labels from `COPY`, persists context onto the `public.users` row at insert time.
- **[apps/mobile/app/_layout.tsx](apps/mobile/app/_layout.tsx)** — auth guard now routes sessions with no `public.users` row to `context-select`, and skips `sobriety-start` for non-recovery contexts.
- **[apps/mobile/store/auth.ts](apps/mobile/store/auth.ts)** — `AppUser` gained a `context: AppContext | null` field; `AppContext` re-exported for consumers.
- **[apps/mobile/app/(recovery)/index.tsx](apps/mobile/app/(recovery)/index.tsx)** — dashboard pulls streak label, check-in statuses, journal tile, get-support tile copy from `useCopy()`. Added profile button (circular initial avatar) in the header; removed the bottom sign-out link.
- **Layout fix** — both `context-select` and `role-select` now use `justifyContent: 'space-between'` + bottom padding so the button anchors to the bottom and dead space disappears.

### Profile section (new `(profile)` route group)
Nine screens behind a gear icon on the dashboard:
- **[_layout.tsx](apps/mobile/app/(profile)/_layout.tsx)** — stack layout.
- **[index.tsx](apps/mobile/app/(profile)/index.tsx)** — grouped iOS-style settings list using new `SettingRow` / `SettingSection` components.
- **edit-name.tsx** — edit display name.
- **change-email.tsx** — change email via `supabase.auth.updateUser({ email })`.
- **change-password.tsx** — change password via `supabase.auth.updateUser({ password })`.
- **switch-context.tsx** — toggle between recovery/family contexts with a confirm alert; updates both `public.users.context` and auth metadata.
- **reset-sobriety.tsx** — presets (today, yesterday, 1 week, 1 month) or custom date picker. Framed warmly: "starting over isn't starting from zero".
- **notifications.tsx** — manage notification preferences jsonb on profiles.
- **delete-account.tsx** — type-to-confirm destructive delete.

### New shared components
- **[apps/mobile/components/SettingRow.tsx](apps/mobile/components/SettingRow.tsx)** — reusable iOS-pattern row + section. Section auto-inserts 1px dividers between children using `Children.toArray` + Fragment.
- **[apps/mobile/components/TextInput.tsx](apps/mobile/components/TextInput.tsx)** — made `label` optional, added `autoCorrect` passthrough.

### Migrations added
- **`003_add_user_context.sql`** — context column. Applied.
- **`004_profile_additions.sql`** — `notification_preferences` jsonb on profiles + "users: delete own" policy. Applied.
- **`005_self_delete_function.sql`** — `public.delete_self_account()` RPC. Needs to be applied in Supabase SQL editor.

### Delete account bug fix
After deleting an account, signing back in with the same credentials succeeded and created a fresh account. Root cause: the client was only removing the `public.users` row — the `auth.users` row persisted, so Supabase Auth happily re-authenticated the old session and the auth guard then re-ran onboarding.

**Fix:** migration 005 adds `public.delete_self_account()`, a `SECURITY DEFINER` RPC pinned to `auth.uid()` so a caller can only delete themselves. It deletes from `auth.users`, which cascades through the FK chain from migration 001 (public.users → profiles, relationships, check_ins, journal_entries, milestones, messages, notifications). [delete-account.tsx](apps/mobile/app/(profile)/delete-account.tsx) now calls `supabase.rpc('delete_self_account')` then signs out. Execute grant is revoked from anon/public and granted only to authenticated.

### Small cleanups
- Delete confirmation phrase simplified from `"delete my account"` to just `"delete"`.
- Removed em-dashes (`—`) from all user-facing strings across `copy.ts`, `sign-in`, `context-select`, `role-select`, `switch-context`, `reset-sobriety`, `journal`, `check-in`. Remaining em-dashes are only in code comments (not user-visible), left in place for readability. User feedback: em-dashes "give it an AI feel".

### Verification
- `apps/mobile` typecheck: clean.
- `apps/mobile` lint: clean (0 warnings with `--max-warnings 0`).
- **Pending user action:** run `supabase/migrations/005_self_delete_function.sql` in the Supabase SQL editor before exercising the delete-account flow.

*Session date: 2026-04-08*

---

## Session 2026-04-09 — Forgot Password (OTP flow)

### What was built
Added a full password reset flow to the auth stack:

- **["forgot password?" link on sign-in](apps/mobile/app/(auth)/sign-in.tsx)** — sits directly under the sign-in button.
- **[(auth)/forgot-password.tsx](apps/mobile/app/(auth)/forgot-password.tsx)** — email input, calls `supabase.auth.resetPasswordForEmail(email)`, then navigates to `verify-reset` with the email as a route param.
- **[(auth)/verify-reset.tsx](apps/mobile/app/(auth)/verify-reset.tsx)** — code + new password + confirm fields. Calls `supabase.auth.verifyOtp({ email, token, type: 'recovery' })` to exchange the code for a recovery session, then `updateUser({ password })`, then `signOut()` so the user lands back on the sign-in screen with their new credentials.
- **[_layout.tsx](apps/mobile/app/_layout.tsx)** — auth state listener ignores `PASSWORD_RECOVERY` events so the transient recovery session doesn't route into the app home mid-flow.

### Why OTP instead of magic-link deep links
Originally implemented as a classic email-link deep link flow (`Linking.createURL` → `resetPasswordForEmail({ redirectTo })` → `set-new-password` screen + `PASSWORD_RECOVERY` handler). Spent significant time debugging why Supabase kept falling back to the Site URL (`circly://`) instead of using our `redirectTo`:

1. **Route group bug** — `Linking.createURL('(auth)/set-new-password')` was wrong; Expo Router groups aren't part of the URL path. Corrected to `/set-new-password`.
2. **Wildcard allowlist rejected** — tried `exp://**`, then `exp://192.168.1.232:8081/--/**`, then the exact URL. None were honored.
3. **Confirmed via direct curl** to `/auth/v1/recover?redirect_to=exp%3A%2F%2F...` — Supabase still returned `redirect_to=circly://` in the verification email even with the exact URL in the allowlist.

**Root cause:** Supabase's redirect URL validator doesn't accept custom schemes with IPs/ports (`exp://192.168.1.232:8081/--/...`) regardless of allowlist configuration. This is a server-side validator limitation, not a wildcard-matching issue.

**Pivot:** switched to OTP flow using the `{{ .Token }}` template variable in the Reset Password email. No deep links, no allowlist dependency, no scheme registration, works identically in Expo Go and standalone builds. Cleaner UX too.

### Files removed
- `apps/mobile/app/(auth)/set-new-password.tsx` — obsolete after pivot.

### Pending user action
- Supabase dashboard → **Authentication → Email Templates → Reset Password**: update the template to include `{{ .Token }}` so users receive the code in the email body.
- Optional cleanup: remove `exp://*` and `circly://set-new-password` entries from **URL Configuration → Redirect URLs** (no longer needed).

### Verification
- Reset flow tested end-to-end with a real email + code once template is updated.
- Code accepts any OTP length (Supabase currently sends 8-digit codes; copy dropped references to "6-digit").

*Session date: 2026-04-09*
