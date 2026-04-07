# Reeco — Implementation Plan

## Overview

Build the Reeco MVP: a React Native (Expo) mobile app with an Express backend and Supabase database. The app supports three roles — recovery user, supporter, and sponsor — in a shared permission system. The person in recovery always owns their data.

This plan uses **vertical slices**: each task delivers a working, testable feature path end-to-end rather than building all of one layer at a time.

---

## Architecture Decisions

- **Monorepo layout:** `apps/mobile` (Expo), `server/` (Express), `supabase/` (migrations). Keeps everything in one repo without requiring a build tool like Turborepo early on.
- **Supabase as the database and auth source of truth.** The Express server handles business logic that goes beyond Supabase's RLS (e.g., notification dispatch, relationship management). Simple queries can hit Supabase directly from the mobile client via the JS SDK.
- **Expo Router for navigation.** File-based routing, supports deep linking, well-suited for role-based tab layouts.
- **Zustand for global state.** Lightweight, TypeScript-friendly, no boilerplate.
- **Row-Level Security (RLS) enforced at the Supabase layer.** No user should ever see another's data through a missed API check — the database enforces it.
- **Roles are stored in the `users` table and mirrored in the Supabase JWT custom claim.** This allows RLS policies to branch by role without extra lookups.

---

## Dependency Graph

```
Supabase schema + RLS migrations
        │
        ├── Supabase Auth (users table + JWT custom claims)
        │       │
        │       ├── Express auth middleware (verify JWT)
        │       │       │
        │       │       ├── /api/v1/relationships (invite, approve, remove)
        │       │       ├── /api/v1/check-ins
        │       │       ├── /api/v1/journals
        │       │       ├── /api/v1/notifications (emergency button)
        │       │       └── /api/v1/messages
        │       │
        │       └── Supabase JS SDK (mobile client — direct queries)
        │
        ├── Expo app shell (navigation, design tokens, auth context)
        │       │
        │       ├── Onboarding screens (sign up, role select, welcome)
        │       │
        │       ├── Recovery user tab layout
        │       │       ├── Dashboard (streak, check-in, milestones)
        │       │       ├── Journal
        │       │       ├── Supporters (invite, manage, permissions)
        │       │       └── Chat
        │       │
        │       └── Supporter tab layout
        │               ├── Feed (shared updates)
        │               ├── Encouragement
        │               └── Chat
        │
        └── Supabase Realtime (chat subscriptions)
```

Implementation order follows bottom-up: schema → auth → Express middleware → API routes → mobile shell → screens.

---

## Phase 1: Foundation

### Task 1: Project scaffold and tooling

**Description:** Initialize the monorepo with the Expo app, Express server, and Supabase config. Set up TypeScript, ESLint, Prettier, and shared environment variable conventions. No business logic yet — just a working, runnable skeleton.

**Acceptance criteria:**
- [ ] `apps/mobile` runs in Expo Go with a placeholder home screen
- [ ] `server/` starts with `npm run dev` and responds to `GET /health` with `{ status: "ok" }`
- [ ] TypeScript, ESLint, and Prettier are configured and passing
- [ ] `.env.example` files exist for both `apps/mobile` and `server/`

**Verification:**
- [ ] `npx expo start` launches without errors
- [ ] `curl localhost:3000/health` returns 200
- [ ] `npm run lint` passes in both workspaces

**Dependencies:** None

**Files likely touched:**
- `apps/mobile/` (Expo init)
- `server/index.ts`, `server/package.json`
- Root `package.json`, `.eslintrc`, `.prettierrc`
- `.env.example` files

**Estimated scope:** Medium

---

### Task 2: Supabase schema and RLS migrations

**Description:** Write and apply the full database schema (all 8 tables from the spec) plus Row-Level Security policies. This is the security foundation — everything else builds on it.

**Acceptance criteria:**
- [ ] All 8 tables exist: `users`, `profiles`, `relationships`, `check_ins`, `journal_entries`, `milestones`, `messages`, `conversations`
- [ ] RLS is enabled on every table
- [ ] A recovery user can only read their own `check_ins` and `journal_entries`
- [ ] A supporter can only read `check_ins` where the relationship `permissions` jsonb grants access
- [ ] `journal_entries` with `is_private = true` are never visible to supporters, enforced by RLS

**Verification:**
- [ ] Migrations apply cleanly: `supabase db push`
- [ ] Manual test in Supabase SQL editor: query as a supporter user returns only permitted rows

**Dependencies:** Task 1 (repo exists)

**Files likely touched:**
- `supabase/migrations/001_initial_schema.sql`
- `supabase/migrations/002_rls_policies.sql`
- `supabase/seed.sql`

**Estimated scope:** Medium

---

### Task 3: Auth — sign up, sign in, role selection

**Description:** Build the full auth flow as one vertical slice: Supabase Auth sign-up/sign-in → role selection screen → profile row created → JWT custom claim set → user lands on the correct role dashboard. This is the entry point for every user.

**Acceptance criteria:**
- [ ] User can create an account with email + password
- [ ] After sign-up, user sees a role selection screen (Recovery / Supporter / Sponsor)
- [ ] Selected role is stored in `users.role` and as a Supabase JWT custom claim
- [ ] Returning user is sent directly to their role's dashboard (no re-onboarding)
- [ ] Auth errors (invalid email, wrong password, duplicate email) show friendly messages
- [ ] Sponsor accounts show a "verification pending" state after role selection

**Verification:**
- [ ] Sign up → role select → dashboard flow works end-to-end in Expo Go
- [ ] Sign out → sign in → lands on correct dashboard
- [ ] Supabase dashboard shows the user row with correct `role` value
- [ ] Auth unit tests pass (mock Supabase client)

**Dependencies:** Task 1, Task 2

**Files likely touched:**
- `apps/mobile/app/(auth)/sign-up.tsx`
- `apps/mobile/app/(auth)/sign-in.tsx`
- `apps/mobile/app/(auth)/role-select.tsx`
- `apps/mobile/lib/supabase.ts`
- `apps/mobile/store/auth.ts`
- `server/routes/auth.ts` (set custom claim via Supabase admin SDK)

**Estimated scope:** Medium

---

## Checkpoint: Foundation

- [ ] App boots and navigates to auth screens
- [ ] Sign up and sign in work in Expo Go
- [ ] Schema is deployed and RLS is active
- [ ] `npm run lint` passes, TypeScript compiles
- [ ] **Review with human before proceeding**

---

## Phase 2: Recovery User Core

### Task 4: Recovery user dashboard — sobriety streak and milestones

**Description:** Build the recovery user's home screen showing the sobriety counter (days since `sobriety_start_date`) and milestone badges. During onboarding, the recovery user sets their sobriety start date. Milestones auto-trigger when streak thresholds are crossed.

**Acceptance criteria:**
- [ ] Onboarding step for recovery users prompts for sobriety start date (or "today")
- [ ] Home screen shows days sober as a large, prominent counter
- [ ] Milestone badges (1d, 7d, 30d, 90d, 1y) are shown as earned/unearned
- [ ] When a milestone is first reached, a celebration microinteraction fires
- [ ] Milestone rows are written to the `milestones` table

**Verification:**
- [ ] Set start date to 30 days ago → 30d milestone shows as earned
- [ ] Set start date to today → only 1d milestone eligible
- [ ] `milestones` table contains the correct rows after first load
- [ ] Unit tests for streak calculation logic pass

**Dependencies:** Task 3

**Files likely touched:**
- `apps/mobile/app/(recovery)/index.tsx`
- `apps/mobile/components/SobrietyCounter.tsx`
- `apps/mobile/components/MilestoneBadge.tsx`
- `apps/mobile/hooks/useStreak.ts`
- `server/services/milestones.ts`

**Estimated scope:** Medium

---

### Task 5: Daily check-in

**Description:** Build the daily check-in flow for recovery users. One check-in per day, three states (Sober / Struggling / Good Day), optional short note. Previous check-ins visible in a simple log.

**Acceptance criteria:**
- [ ] Check-in button is prominent on the recovery dashboard
- [ ] User selects one of three states; an optional note field appears
- [ ] Only one check-in per calendar day is allowed (subsequent taps show today's entry)
- [ ] Check-in is written to `check_ins` via the Express API
- [ ] A scrollable history of past check-ins is visible on the screen
- [ ] RLS prevents any other user from reading this user's check-ins unless permitted

**Verification:**
- [ ] Submit check-in → row appears in Supabase `check_ins` table
- [ ] Second tap on same day → shows existing check-in, no duplicate row
- [ ] Unit test: `POST /api/v1/check-ins` with a duplicate date returns 409
- [ ] Integration test: check-in endpoint rejects unauthenticated requests

**Dependencies:** Task 4

**Files likely touched:**
- `apps/mobile/app/(recovery)/check-in.tsx`
- `apps/mobile/components/CheckInCard.tsx`
- `server/routes/check-ins.ts`
- `server/services/check-ins.ts`

**Estimated scope:** Small

---

### Task 6: Journal entry

**Description:** A private journal space for recovery users. Entries are always private by default. User can optionally tag a mood. Entries are never surfaced to supporters unless a future explicit share feature is built.

**Acceptance criteria:**
- [ ] Journal is accessible from the recovery user tab bar
- [ ] User can write a new entry with a text field and optional mood tag
- [ ] All entries default to `is_private = true`
- [ ] Past entries are listed in reverse-chronological order
- [ ] RLS policy blocks any supporter or sponsor from reading `journal_entries`

**Verification:**
- [ ] Create entry → appears in list
- [ ] Direct SQL query as a supporter user returns 0 rows from `journal_entries` (RLS enforced)
- [ ] Notification body for any event never contains journal text

**Dependencies:** Task 4

**Files likely touched:**
- `apps/mobile/app/(recovery)/journal.tsx`
- `apps/mobile/components/JournalEntryCard.tsx`
- `server/routes/journals.ts`

**Estimated scope:** Small

---

### Task 7: Emergency support button

**Description:** A one-tap emergency button on the recovery user dashboard that immediately sends an in-app push notification to all of the user's active supporters. No content from the user's journal or check-ins is included in the notification body.

**Acceptance criteria:**
- [ ] Button is always visible on the recovery dashboard (not buried in a menu)
- [ ] On tap, a confirmation modal appears ("Send alert to your supporters?")
- [ ] On confirm, all active supporters for this user receive a push notification: "[Name] needs support right now."
- [ ] The notification body contains no journal or check-in content
- [ ] The event is logged in the `notifications` table

**Verification:**
- [ ] Trigger button → supporters receive Expo push notification within a few seconds
- [ ] Notification payload in `notifications` table has correct `type: "emergency"` and no sensitive fields
- [ ] Integration test: `POST /api/v1/notifications/emergency` dispatches to all active supporters

**Dependencies:** Task 3, Task 5 (relationships must exist to have supporters)

**Files likely touched:**
- `apps/mobile/components/EmergencyButton.tsx`
- `server/routes/notifications.ts`
- `server/services/push.ts` (Expo push token management)

**Estimated scope:** Medium

---

## Checkpoint: Recovery User Core

- [ ] Recovery user can sign up, set sobriety date, check in daily, write journal entries
- [ ] Streak and milestones calculate correctly
- [ ] Emergency button sends notifications
- [ ] All RLS policies verified manually in Supabase dashboard
- [ ] **Review with human before proceeding**

---

## Phase 3: Relationships and Supporter Flow

### Task 8: Invite and link supporters

**Description:** Build the full supporter relationship flow: recovery user sends an invite (by email or share link), supporter accepts, relationship goes from `pending` to `active`. Recovery user can remove supporters at any time. This is the access control gate for everything supporters see.

**Acceptance criteria:**
- [ ] Recovery user can invite a supporter by entering their email
- [ ] Invited supporter sees a pending invite notification in the app
- [ ] Supporter accepts → `relationships` row status becomes `active`
- [ ] Recovery user can view their supporter list and remove anyone
- [ ] Removing a supporter immediately revokes access (RLS enforces this)
- [ ] A recovery user can have multiple active supporters

**Verification:**
- [ ] Invite → accept flow works end-to-end between two Expo Go sessions
- [ ] After removal, the removed supporter's feed shows no data (RLS-blocked)
- [ ] Integration tests for `POST /api/v1/relationships`, `PATCH /api/v1/relationships/:id`, `DELETE /api/v1/relationships/:id`

**Dependencies:** Task 3

**Files likely touched:**
- `apps/mobile/app/(recovery)/supporters.tsx`
- `apps/mobile/components/SupporterCard.tsx`
- `server/routes/relationships.ts`
- `server/services/relationships.ts`

**Estimated scope:** Medium

---

### Task 9: Privacy controls — what supporters can see

**Description:** Recovery users control per-supporter visibility for check-ins and milestones. The `permissions` jsonb column on `relationships` drives this. RLS policies read from it. Journals are always private.

**Acceptance criteria:**
- [ ] For each active supporter, the recovery user sees toggle controls: "Share check-ins", "Share milestones"
- [ ] Toggling updates the `permissions` jsonb in the `relationships` row
- [ ] RLS policies enforce these toggles — a supporter with `check_ins: false` gets zero rows
- [ ] Default permissions on new relationships: check-ins shared, milestones shared, journals never shared

**Verification:**
- [ ] Toggle off check-ins for Supporter A → Supporter A's feed shows no check-in data
- [ ] Toggle back on → data reappears
- [ ] Direct Supabase query as Supporter A confirms RLS blocks the data when toggled off

**Dependencies:** Task 8

**Files likely touched:**
- `apps/mobile/app/(recovery)/supporter-permissions.tsx`
- `supabase/migrations/003_rls_permissions.sql` (update RLS to read jsonb)
- `server/routes/relationships.ts` (PATCH permissions)

**Estimated scope:** Small

---

### Task 10: Supporter dashboard — feed and encouragement

**Description:** Build the supporter's home screen. Shows shared check-ins and milestones from their linked recovery user(s). Supporter can send encouragement (short message or reaction). Prompt cards surface if no recent activity.

**Acceptance criteria:**
- [ ] Supporter sees a feed of shared check-ins and milestones (only permitted data)
- [ ] Each feed item has a "Send encouragement" action
- [ ] Encouragement is delivered as an in-app notification to the recovery user
- [ ] If no updates in the last 24h, a prompt card appears: "Reach out today"
- [ ] Supporter with multiple linked recovery users sees a combined feed, grouped by person

**Verification:**
- [ ] Supporter feed shows only data the recovery user has permitted (tested via toggling in Task 9)
- [ ] Send encouragement → recovery user receives notification
- [ ] Supporter with no linked user sees an empty state with an "Waiting to be invited" message

**Dependencies:** Task 8, Task 9

**Files likely touched:**
- `apps/mobile/app/(supporter)/index.tsx`
- `apps/mobile/components/FeedCard.tsx`
- `apps/mobile/components/EncouragementInput.tsx`
- `server/routes/feed.ts`

**Estimated scope:** Medium

---

## Checkpoint: Relationships and Supporter Flow

- [ ] Full invite → accept → feed flow works across two devices
- [ ] Privacy toggles correctly gate what supporters see
- [ ] Encouragement notifications delivered
- [ ] No data leaks: supporters cannot see unpermitted data at the DB layer
- [ ] **Review with human before proceeding**

---

## Phase 4: Chat and Notifications

### Task 11: 1:1 chat

**Description:** Real-time direct messaging between a recovery user and each of their supporters, using Supabase Realtime. One conversation per relationship. Messages are never included in push notification bodies.

**Acceptance criteria:**
- [ ] Recovery user can open a chat with any active supporter
- [ ] Supporter can open a chat with the recovery user they are linked to
- [ ] Messages appear in real time on both sides without polling
- [ ] New message triggers a push notification: "[Name] sent you a message" (no content in body)
- [ ] Messages are stored in `messages` and `conversations` tables
- [ ] RLS: a user can only read messages in conversations they participate in

**Verification:**
- [ ] Send message → appears on other device within 1–2 seconds (Supabase Realtime)
- [ ] Push notification arrives with no message content in body
- [ ] RLS test: querying `messages` as a non-participant returns 0 rows

**Dependencies:** Task 8

**Files likely touched:**
- `apps/mobile/app/(shared)/chat/[conversationId].tsx`
- `apps/mobile/components/MessageBubble.tsx`
- `apps/mobile/hooks/useRealtimeChat.ts`
- `server/routes/messages.ts`

**Estimated scope:** Medium

---

### Task 12: Push notification setup and notification center

**Description:** Wire up Expo push tokens, register them on sign-in, and build a simple in-app notification center so users can see past alerts (emergency alerts, encouragement, new messages) without relying solely on device push.

**Acceptance criteria:**
- [ ] App requests push permission on first sign-in
- [ ] Expo push token is stored in `profiles` and sent with relevant API calls
- [ ] A notification center screen shows unread and past notifications
- [ ] Tapping a notification navigates to the relevant screen
- [ ] `notifications.read_at` is set when the notification is tapped

**Verification:**
- [ ] Fresh install → push permission prompt appears
- [ ] Send emergency alert → notification appears in both device push and in-app center
- [ ] Mark as read → `read_at` timestamp updated in Supabase

**Dependencies:** Task 7, Task 10, Task 11

**Files likely touched:**
- `apps/mobile/app/(shared)/notifications.tsx`
- `apps/mobile/hooks/usePushToken.ts`
- `server/services/push.ts`

**Estimated scope:** Small

---

## Checkpoint: Full MVP

- [ ] Complete user journeys work end-to-end:
  - Recovery user signs up → sets sobriety date → checks in → writes journal → invites supporter → taps emergency button
  - Supporter signs up → accepts invite → sees feed → sends encouragement → chats
- [ ] All RLS policies verified: no data leaks between roles
- [ ] Push notifications working on a real device (Expo development build)
- [ ] TypeScript compiles, lint passes
- [ ] Core test coverage: auth, check-ins, permission logic
- [ ] **Final review with human before TestFlight submission**

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| RLS policy gaps let supporters see private data | High | Write RLS tests using Supabase's `auth.uid()` switching. Test every policy after writing it. |
| Expo push notifications require a development build (not Expo Go) | Medium | Build a dev build early (Task 12). Test push in Expo Go via the Expo push API playground first. |
| Supabase Realtime latency on free tier | Low | Acceptable for MVP. Monitor in dev. Upgrade plan if needed before TestFlight. |
| Role-based navigation gets complex | Medium | Use Expo Router layouts with a top-level role guard. Keep recovery and supporter screens in separate route groups. |
| Emergency button tapped accidentally | Low | One confirmation modal. No second-guessing beyond that. |

---

## Parallelization Opportunities

Once Task 2 (schema) and Task 3 (auth) are done, Tasks 4, 5, 6, 8 can be built in parallel by different sessions/agents since they touch independent screens and routes.

Tasks 7 (emergency) and 10 (supporter dashboard) depend on relationships existing (Task 8) but are otherwise independent of each other.

---

*Last updated: 2026-04-06*
