# Reeco — Phase 2 Close-out, Phase 3, Phase 4 Plan

## Context

Phase 2 (Recovery User Core) is nearly complete: Task 4 (streak + milestones), Task 5 (daily check-in), and Task 6 (private journal) are shipped and tested. The remaining work spans one task to close Phase 2 (**Task 7 — Emergency support button**), three tasks in Phase 3 (**relationships + supporter flow**), and two tasks in Phase 4 (**chat + notifications**).

The mobile app currently has no server-dependent features. From Task 7 onward we start needing the Express server, because three features cannot be built client-only under the existing RLS policies:

1. **`notifications` table has zero client insert policies** — only the service-role server can create them. Every notification (emergency alert, encouragement, milestone, new message) must flow through the server.
2. **`users` table blocks email lookup** — reads are scoped to the current user and linked-relationship counterparts only. A recovery user cannot invite a supporter by email. We work around this with a server-generated **share code**.
3. **Push notifications** — will be in-app only for this phase (list view of the `notifications` table), deferring true push delivery until a dev build exists.

This plan turns those constraints into an explicit server contract, then slices the remaining tasks vertically so each one leaves the app in a working state.

## Architecture Decisions

1. **Server auth middleware (`requireAuth`)** — every protected server route verifies a Supabase JWT via `supabase.auth.getUser(token)` (service-role client). Mobile attaches `Authorization: Bearer <access_token>` from `supabase.auth.getSession()`. Built once in Task 7, reused everywhere after.

2. **Mobile API client helper** — single `lib/api.ts` that wraps `fetch` with base URL + auth header injection. Avoids scattering token logic across screens.

3. **Invite flow = share code** — 6-character uppercase alphanumeric code. New `invite_codes` table (migration 003) holds code + recovery_user_id + expiry. Server generates on demand, supporter redeems via server endpoint which uses service role to insert the `relationships` row as `status='active'`.

4. **Conversations created on accept** — when an invite is accepted, the same server endpoint creates a `direct` conversation with both user IDs in `participant_ids`. No lazy creation on first message.

5. **Supporter dashboard = minimal card per recovery user** — streak (computed client-side from `sobriety_start_date`), today's check-in (if permitted), most recent milestone, "send encouragement" button. Matches the existing check-in tile pattern from the recovery dashboard.

6. **Chat = 1:1 direct only** — one conversation per recovery↔supporter relationship. Group chats deferred post-MVP. Supabase Realtime `postgres_changes` subscription on `messages` filtered by `conversation_id`.

7. **Notifications = in-app center only this phase** — screen lists rows from `notifications` table, marks read on view, supports realtime inserts. `expo-notifications` install deferred; `profiles.push_token` stays null for now. Push delivery is a Phase 4.5 follow-up when a dev build lands.

8. **Encouragement = notification row** — simple preset messages ("thinking of you", "proud of you", "you've got this") + optional custom text. Server creates a notification row of `type='encouragement'` for the recovery user.

## Task List

### Phase 2 Close-out

#### Task 7a: Server auth middleware + API client

**Description:** Add a `requireAuth` middleware to the Express server that verifies Supabase JWTs. Add a mobile `lib/api.ts` helper that wraps fetch with the base URL and attaches the current session's access token. This is pure enabler infra — no feature yet.

**Acceptance criteria:**
- [ ] `server/src/middleware/auth.ts` exports `requireAuth` that reads `Authorization: Bearer`, calls `supabase.auth.getUser(token)`, attaches `req.user` or returns 401
- [ ] A test endpoint `GET /api/me` returns the authenticated user's id + email
- [ ] `apps/mobile/lib/api.ts` exports a `api()` function that takes path + init, resolves base URL from `EXPO_PUBLIC_API_URL`, injects the bearer token from the current Supabase session, returns parsed JSON or throws on non-2xx
- [ ] Vitest test in `server/src/middleware/auth.test.ts` covers missing token (401), invalid token (401), valid token (passes and attaches user)

**Verification:**
- [ ] `cd server && npm test` — all tests pass
- [ ] `cd server && npm run typecheck && npm run lint`
- [ ] `cd apps/mobile && npm run typecheck && npm run lint`
- [ ] Manual: hit `GET /api/me` from the mobile app debug console or a temporary button, confirm it returns the signed-in user's id

**Dependencies:** None

**Files likely touched:**
- `server/src/middleware/auth.ts` (new)
- `server/src/middleware/auth.test.ts` (new)
- `server/src/app.ts` (mount `/api/me`)
- `apps/mobile/lib/api.ts` (new)

**Estimated scope:** Small

---

#### Task 7b: Emergency support button

**Description:** Wire the "emergency support" tile on the recovery dashboard to a confirm dialog, then a `POST /api/emergency` server endpoint that creates a notification row for each of the user's active supporters. No supporters yet means no downstream effect — we verify by observing rows appear in the `notifications` table in Supabase.

**Acceptance criteria:**
- [ ] `POST /api/emergency` (protected by `requireAuth`) looks up `relationships` where `recovery_user_id = req.user.id AND status = 'active'` and inserts one notification row per supporter with `type='emergency'`, payload `{ from_display_name }`
- [ ] Server returns `{ supporters_notified: number }`
- [ ] Mobile: "emergency support" tile is now enabled, tap → confirm Alert "this will alert all your supporters right now" → on confirm, calls `POST /api/emergency` via `api()` helper
- [ ] Success shows a toast/alert ("your supporters have been notified") or ("you have no active supporters yet" if count === 0) — the user still gets confirmation something happened
- [ ] Loading state on the tile while the request is in flight

**Verification:**
- [ ] `cd server && npm test && npm run typecheck && npm run lint`
- [ ] `cd apps/mobile && npm run typecheck && npm run lint`
- [ ] Manual: tap emergency → confirm → see success alert. Check Supabase `notifications` table — zero rows if no supporters, one row per supporter otherwise.

**Dependencies:** 7a

**Files likely touched:**
- `server/src/routes/emergency.ts` (new)
- `server/src/app.ts` (mount route)
- `apps/mobile/app/(recovery)/index.tsx` (enable tile, wire handler)

**Estimated scope:** Small

---

### ✅ Checkpoint: Phase 2 complete

- [ ] All Phase 2 tasks (4-7) complete
- [ ] `notifications` row appears after emergency tap (verified in Supabase)
- [ ] Mobile + server: `npm run typecheck && npm run lint` clean on both workspaces
- [ ] `server/src` tests green
- [ ] Commit: "feat: emergency support button + server auth scaffolding (Task 7)"

---

### Phase 3: Relationships + Supporter Flow

#### Task 8a: Invite codes table + server endpoints

**Description:** New migration `003_invite_codes.sql` creating a table keyed by code. Server endpoints to generate (protected, recovery-role) and accept (protected, any role) invite codes. Accept endpoint creates the `relationships` row **and** the `direct` conversation in one transaction via the service role.

**Acceptance criteria:**
- [ ] Migration `003_invite_codes.sql` creates `public.invite_codes (code text pk, recovery_user_id uuid fk, expires_at timestamptz not null, used_at timestamptz, created_at timestamptz default now())`, with RLS enabled and no client policies (server-only)
- [ ] Migration applied to the live Supabase project (via SQL editor, as existing migrations are)
- [ ] `POST /api/invites` (auth required) generates a unique 6-char uppercase code, 24h expiry, returns `{ code, expires_at }`
- [ ] `POST /api/invites/accept` body `{ code }` — validates not used, not expired, recovery_user_id != req.user.id; inserts `relationships` row (`status='active'`, default permissions) and `conversations` row (`type='direct'`, `participant_ids=[recovery_user_id, req.user.id]`) via service role; marks code as used; returns `{ relationship_id, conversation_id }`
- [ ] Vitest covers: generate returns code, accept invalid code → 400, accept expired → 400, accept valid → creates relationship + conversation

**Verification:**
- [ ] `cd server && npm test`
- [ ] Manual SQL check: run `select * from invite_codes` after generate, confirm row exists
- [ ] Manual SQL check: after accept, confirm `relationships` and `conversations` rows exist

**Dependencies:** 7a

**Files likely touched:**
- `supabase/migrations/003_invite_codes.sql` (new)
- `server/src/routes/invites.ts` (new)
- `server/src/routes/invites.test.ts` (new)
- `server/src/app.ts`

**Estimated scope:** Medium

---

#### Task 8b: Mobile invite UI (generate + accept)

**Description:** Recovery user gets a "settings" entry point that opens an invite screen showing the current active supporters list and a "generate code" button. Supporter onboarding gains an "enter invite code" step right after role-select (skipping the straight-to-dashboard path).

**Acceptance criteria:**
- [ ] `app/(recovery)/settings.tsx` lists linked supporters (from `relationships` where `recovery_user_id = me AND status = 'active'`) with display names, and a "generate invite code" button
- [ ] Generate button calls `POST /api/invites` via `api()` helper, displays the code in a large copyable card with expiry ("expires in 24 hours"), includes a `Share` sheet integration
- [ ] Recovery dashboard gains a small "settings" gear icon in the header that navigates to `/settings`
- [ ] `app/(auth)/invite-code.tsx` — after role-select with role=supporter (and role=sponsor for now), the flow routes here instead of directly to the supporter dashboard
- [ ] Invite code screen has a 6-char input + "continue" button → `POST /api/invites/accept` → on success, routes to `/(supporter)` dashboard
- [ ] "skip for now" link lets supporters continue to an empty dashboard (supports the "I'll add people later" case)
- [ ] Error states: invalid code, expired code, self-invite — all surfaced via Alert

**Verification:**
- [ ] `cd apps/mobile && npm run typecheck && npm run lint`
- [ ] Manual end-to-end test (two accounts — one recovery, one supporter in second simulator or sign out/in): generate code, accept, confirm relationship + conversation rows exist in Supabase

**Dependencies:** 8a

**Files likely touched:**
- `apps/mobile/app/(recovery)/settings.tsx` (new)
- `apps/mobile/app/(auth)/invite-code.tsx` (new)
- `apps/mobile/app/(auth)/role-select.tsx` (route supporter → invite-code)
- `apps/mobile/app/_layout.tsx` (session restore: supporter with no relationships → allow, not force)
- `apps/mobile/app/(recovery)/index.tsx` (settings gear in header)

**Estimated scope:** Medium

---

#### Task 9: Privacy controls

**Description:** Recovery user can toggle per-supporter visibility: whether this specific supporter sees check-ins and milestones. Updates `relationships.permissions` jsonb. The helper SQL functions (`can_see_check_ins`, `can_see_milestones`) already read from this jsonb, so RLS enforces toggles automatically.

**Acceptance criteria:**
- [ ] From `settings.tsx`, tapping a supporter card opens `(recovery)/supporter-settings.tsx?id=<relationship_id>`
- [ ] Screen shows the supporter's display name, two toggles ("can see check-ins", "can see milestones"), and a "remove supporter" button
- [ ] Toggles update `relationships.permissions` via direct Supabase client call (owner-update RLS policy allows this)
- [ ] Remove button confirms, then updates `status='removed'` (RLS policy allows owner update); UI returns to settings with supporter gone from active list
- [ ] Verification via Supabase SQL: toggle check-ins off, confirm the supporter's query against `check_ins` returns empty

**Verification:**
- [ ] Typecheck + lint
- [ ] Manual: toggle off check-ins from recovery side, sign in as supporter, confirm check-ins no longer visible on their dashboard

**Dependencies:** 8b

**Files likely touched:**
- `apps/mobile/app/(recovery)/supporter-settings.tsx` (new)
- `apps/mobile/app/(recovery)/settings.tsx` (link each card to it)

**Estimated scope:** Small

---

#### Task 10: Supporter dashboard

**Description:** Replace the placeholder supporter dashboard with a list of linked recovery users. Each card shows current streak, today's check-in status (if permitted), most recent milestone, and a "send encouragement" button. Empty state points at the invite code entry if they have no relationships yet.

**Acceptance criteria:**
- [ ] `app/(supporter)/index.tsx` fetches active relationships where `supporter_id = me`, then for each joins `users` (name), `profiles` (sobriety_start_date), latest `check_ins` row for today, latest `milestones` row — respecting RLS which will silently hide what's not permitted
- [ ] Card renders: name, streak number (days since `sobriety_start_date`, same helper as recovery dash), today's check-in emoji + status (or "not yet today" / "not shared"), most recent milestone label (or "none yet"), "send encouragement" button
- [ ] Empty state: "no one linked yet — enter an invite code to get started" with a button routing to `/(auth)/invite-code` (or an in-place entry widget)
- [ ] "send encouragement" button opens a sheet with 3 preset messages + optional custom note, calls `POST /api/encouragements { relationship_id, message }`
- [ ] Server endpoint inserts a notification row for the recovery user with `type='encouragement'`, payload `{ from_display_name, message }`
- [ ] Supporter dashboard uses `useFocusEffect` to refresh when returning from other screens

**Verification:**
- [ ] Server tests cover the encouragements endpoint
- [ ] Typecheck + lint
- [ ] Manual: as supporter, see linked recovery user, send encouragement, confirm notification row in Supabase

**Dependencies:** 8b, 9

**Files likely touched:**
- `apps/mobile/app/(supporter)/index.tsx` (replace placeholder)
- `server/src/routes/encouragements.ts` (new)
- `server/src/routes/encouragements.test.ts` (new)
- `server/src/app.ts`

**Estimated scope:** Medium

---

### ✅ Checkpoint: Phase 3 complete

- [ ] Full invite → accept → support loop works end-to-end across two accounts
- [ ] Privacy toggles verified: turning check-ins off actually hides them from supporter dashboard
- [ ] Notifications table now has rows for encouragements
- [ ] All workspaces clean (typecheck + lint + tests)
- [ ] Commit: "feat: relationships + supporter flow (Phase 3)"

---

### Phase 4: Chat + Notifications

#### Task 11a: Conversations list screen

**Description:** Both recovery users and supporters get a `messages` tab/screen listing their active conversations (pulled from `conversations` where my id is in `participant_ids`). Each row shows the other participant's name and the latest message preview.

**Acceptance criteria:**
- [ ] Shared `components/ConversationList.tsx` (used from both `(recovery)` and `(supporter)` stacks) fetches conversations where `auth.uid() = any(participant_ids)` ordered by most recent message
- [ ] Each row: other participant's display name, latest message body (2 lines), time of latest message (today · HH:MM / yesterday / Mmm D)
- [ ] Tapping a row navigates to `/(chat)/[id]` where `id` is the conversation id
- [ ] New route group `(chat)` added; visible to both recovery and supporter role dashboards via an icon in the header
- [ ] Empty state: "no conversations yet"

**Verification:**
- [ ] Typecheck + lint
- [ ] Manual: as either side, see the conversation that was auto-created on invite accept

**Dependencies:** 8a (conversations created on invite accept)

**Files likely touched:**
- `apps/mobile/components/ConversationList.tsx` (new)
- `apps/mobile/app/(chat)/_layout.tsx` (new)
- `apps/mobile/app/(chat)/index.tsx` (new — the list)
- `apps/mobile/app/(recovery)/index.tsx` (header icon)
- `apps/mobile/app/(supporter)/index.tsx` (header icon)

**Estimated scope:** Medium

---

#### Task 11b: 1:1 chat screen with realtime

**Description:** The chat screen loads historical messages on mount, subscribes to `postgres_changes` on the `messages` table filtered by `conversation_id`, and supports sending new messages via direct Supabase insert (RLS policy already allows participant inserts).

**Acceptance criteria:**
- [ ] `app/(chat)/[id].tsx` reads `id` param, loads last 50 messages ordered ascending, auto-scrolls to bottom
- [ ] Subscribes to `supabase.channel('messages:' + id).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: 'conversation_id=eq.' + id }, ...)` and appends new rows to state
- [ ] Input bar at bottom, send button inserts `{ conversation_id, sender_id, body }` via Supabase client
- [ ] Optimistic UI: message appears immediately on send, replaced by the real row when the realtime event arrives
- [ ] Messages styled as bubbles (mine on right with accent, theirs on left with surface)
- [ ] Unsubscribe on screen unmount

**Verification:**
- [ ] Typecheck + lint
- [ ] Manual end-to-end: open chat in two simulators (recovery + supporter), send from one, confirm it arrives in the other without refresh

**Dependencies:** 11a

**Files likely touched:**
- `apps/mobile/app/(chat)/[id].tsx` (new)

**Estimated scope:** Medium

---

#### Task 12: In-app notification center

**Description:** New screen lists all rows from `notifications` for the current user, newest first. Opening the screen marks all unread as read (`read_at = now()`). Subscribes to realtime inserts so new notifications appear without refresh.

**Acceptance criteria:**
- [ ] `app/(notifications)/index.tsx` fetches notifications where `recipient_id = me` ordered `created_at desc`, limit 50
- [ ] Each row renders differently by type: emergency (red card, from name), encouragement (green card, message preview), message (blue card, preview), milestone (purple card, badge label)
- [ ] Tapping navigates to the relevant target (emergency → recovery user card on supporter dash; encouragement → just marks read; message → chat screen)
- [ ] On mount, any rows with `read_at = null` get bulk-updated to `now()`
- [ ] Realtime subscription on `notifications` filtered by `recipient_id` inserts new rows at top
- [ ] Unread badge on the header bell icon on both dashboards (count of `read_at is null`) — live-updated via the same subscription
- [ ] Bell icon added to both recovery and supporter dashboard headers, navigates to notification center

**Verification:**
- [ ] Typecheck + lint
- [ ] Manual: as supporter, receive an emergency notification after recovery user taps the button; confirm it appears without refresh; tap closes and clears the badge

**Dependencies:** 11a (needs header layout in place)

**Files likely touched:**
- `apps/mobile/app/(notifications)/_layout.tsx` (new)
- `apps/mobile/app/(notifications)/index.tsx` (new)
- `apps/mobile/components/NotificationBell.tsx` (new — reusable header icon with live badge)
- `apps/mobile/app/(recovery)/index.tsx` (bell in header)
- `apps/mobile/app/(supporter)/index.tsx` (bell in header)

**Estimated scope:** Medium

---

### ✅ Checkpoint: Phase 4 complete

- [ ] Two-account end-to-end flow: recovery creates invite → supporter accepts → chat works realtime → emergency button → supporter sees notification → encouragement sent → recovery sees notification
- [ ] All workspaces clean
- [ ] Commit: "feat: realtime chat + in-app notifications (Phase 4)"
- [ ] Update `summary.md` with shipped tasks and any new gotchas discovered

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Supabase JWT verification in Express might be slow if called per request | Medium | `supabase.auth.getUser()` hits Supabase's auth API — if latency is noticeable, cache verified tokens in-memory with a 5-minute TTL. Measure first. |
| Two-account testing is tedious in one simulator | Medium | Run a second iOS simulator (`Device → Manage Devices → add another`). Or use Expo Go on a physical phone for the supporter side while simulator is recovery. |
| Realtime subscription leaks on fast screen navigation | Medium | Always unsubscribe in the cleanup function of `useEffect` / `useFocusEffect`. Add a linter rule or review checklist item. |
| Server route tests need a real Supabase project or complex mocking | Low | Reuse the existing live project with a test prefix, or mock the `@supabase/supabase-js` createClient for unit tests. Prefer mocking for fast tests. |
| Invite code collisions for 6-char codes | Low | Retry on unique-constraint violation (up to 5 times). 36^6 ≈ 2B combinations; collisions only matter at scale. |
| Share code workflow friction (users must type 6 chars) | Low | Add "copy code" + native Share sheet integration. Type-in stays clear and works everywhere. |
| Empty supporter dashboard if privacy is fully locked down | Low | Explicit empty state: "this person hasn't shared anything yet". Not an error. |

## Deferred (not in this plan)

- **Push notifications via Expo Push API** — requires dev build + real device. Flag as a follow-up task after Phase 4.
- **Sponsor verification flow** — Phase 2 post-MVP per the original spec.
- **Group chats** — post-MVP.
- **Message read receipts** — post-MVP.
- **Block / report supporters** — safety feature for later.

## Verification (full plan)

After every task: `npm run typecheck && npm run lint` in the touched workspace, plus any new server tests. After each phase checkpoint: full two-account manual walkthrough of the flows that phase unlocked.

**End-to-end smoke test after Phase 4:**
1. Create recovery account A, set sobriety start, do a check-in, write a journal entry
2. Create supporter account B in a second simulator
3. From A: generate invite code
4. From B: enter code
5. B sees A's card on their dashboard with streak + check-in status
6. B sends encouragement → A sees notification within ~1s
7. A taps emergency → B sees red notification within ~1s
8. Either side taps the chat icon → exchange messages in realtime
9. A toggles check-in visibility off from settings → B's card refreshes and now shows "not shared"
10. A removes B → B disappears from dashboard, conversation still exists but marked inactive (TBD: decide on conversation lifecycle in Task 9)

## Notes for implementation

- The plan file location is `/Users/emmanuelokusanya/.claude/plans/bright-discovering-scone.md` per plan mode constraints. The user's slash command requested saving to `tasks/plan.md` and `tasks/todo.md` — this can be done after plan mode exits, by copying from here.
- Key reusable utilities already in place:
  - `apps/mobile/lib/streak.ts` — reuse for supporter-side streak computation
  - `apps/mobile/hooks/useColors.ts` — all new screens must use this for theme tokens
  - `apps/mobile/components/Button.tsx`, `TextInput.tsx` — reuse throughout
- RLS policies are already fully in place for every table touched in this plan. No new migration needed except `003_invite_codes.sql` in Task 8a.
- Every new server route must be mounted in `server/src/app.ts` and behind `requireAuth` unless explicitly public.
