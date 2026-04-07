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

---

## File Inventory

### Mobile app (`apps/mobile/`)
| File | Purpose |
|---|---|
| `app.json` | Expo config — name "reeco", scheme, `userInterfaceStyle: automatic` |
| `babel.config.js` | Babel preset — required for expo-router to inject EXPO_ROUTER_APP_ROOT |
| `metro.config.js` | Metro config — uses `getDefaultConfig` from expo |
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
- [ ] Current `npx expo start --clear` error still being resolved — `babel.config.js` fix committed, awaiting confirmation from device

---

*Session date: 2026-04-06 / 2026-04-07*
*Commits: 7 (71e70c4 → d8684aa)*
