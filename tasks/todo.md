# Circly — Task List

See [tasks/plan.md](plan.md) for full context, acceptance criteria, and verification steps.

> **Rebrand note (2026-04-08):** Reeco is now Circly. Context-aware copy map in `apps/mobile/lib/copy.ts` adapts the app to `recovery` or `family` contexts. "Emergency" was renamed "get support" — it's universal across contexts.

## Phase 1: Foundation ✅
- [x] Task 1: Project scaffold and tooling (Expo + Express + TypeScript + lint)
- [x] Task 2: Supabase schema and RLS migrations (all 8 tables + policies)
- [x] Task 3: Auth — sign up, sign in, role selection

---

## Phase 2: Recovery User Core
- [x] Task 4: Recovery dashboard — sobriety streak and milestone badges
- [x] Task 5: Daily check-in (3 states, one per day, history log)
- [x] Task 6: Journal entry (private by default, mood tag)
- [x] Task 7a — Server auth middleware (`requireAuth`) + mobile `lib/api.ts` helper + `GET /api/me` test endpoint + vitest coverage
- [x] Task 7b — `POST /api/emergency` (wired to "get support" tile) + confirm dialog + success feedback

---

## Phase 2.5: Rebrand + Profile (Session 2026-04-08) ✅
- [x] Rename Reeco → Circly across the codebase
- [x] Migration `003_add_user_context.sql` — add `context` column to public.users
- [x] `lib/copy.ts` context-aware copy map + `useCopy()` hook
- [x] `(auth)/context-select.tsx` onboarding screen (stashes in auth metadata)
- [x] `role-select.tsx` reads context, hides sponsor role in family mode
- [x] Auth guard routes mid-onboarding sessions to context-select
- [x] Dashboard pulls all labels from `useCopy()` + profile button in header
- [x] Migration `004_profile_additions.sql` — notification_preferences + delete policy
- [x] `(profile)` route group: index, edit-name, change-email, change-password, switch-context, reset-sobriety, notifications, delete-account
- [x] `SettingRow` / `SettingSection` shared components
- [x] Migration `005_self_delete_function.sql` — RPC for self-delete of auth.users (fixes "deleted account can sign back in" bug). **Needs to be applied in Supabase SQL editor.**
- [x] Remove em-dashes from user-facing strings

### Checkpoint: Recovery User Core
- [ ] Emergency row appears in `notifications` after tap
- [ ] Both workspaces clean (typecheck + lint + tests)
- [ ] Commit: `feat: emergency support button + server auth scaffolding (Task 7)`

---

## Phase 3: Relationships and Supporter Flow
- [x] Task 8a — Migration `006_invite_codes.sql` + `POST /api/invites` (generate) + `POST /api/invites/accept` (creates relationship + conversation) + vitest coverage
- [x] Task 8b — Recovery `settings.tsx` + generate-code UI + `(auth)/invite-code.tsx` + route supporter onboarding through it
- [x] Task 9 — `supporter-settings.tsx` with per-supporter permission toggles + remove supporter
- [x] Task 10 — Supporter dashboard (linked recovery user cards + encouragement sheet) + `POST /api/encouragements`

### Checkpoint: Relationships and Supporter Flow
- [ ] Full invite → accept → support loop works across two accounts
- [ ] Privacy toggles verified end-to-end
- [ ] All workspaces clean
- [ ] Commit: `feat: relationships + supporter flow (Phase 3)`

---

## Phase 4: Chat and Notifications
- [x] **Task 11a** — `(chat)` route group + conversations list screen + header entry points on recovery + supporter dashboards
- [ ] **Task 11b** — `(chat)/[id].tsx` chat screen with Supabase Realtime subscription + optimistic send
- [ ] **Task 12** — `(notifications)` route + in-app notification center + `NotificationBell` header component with live unread badge

### Checkpoint: Full MVP
- [ ] End-to-end smoke test (see tasks/plan.md § Verification)
- [ ] All workspaces clean
- [ ] Commit: `feat: realtime chat + in-app notifications (Phase 4)`
- [ ] Update `summary.md`

---

## Deferred (not in this plan)

- Push notifications via Expo Push API (needs dev build)
- Sponsor verification flow
- Group chats
- Message read receipts
- Block / report supporters
