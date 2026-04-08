-- Migration 004: profile section additions
--
-- 1. notification_preferences jsonb column on profiles
--    Stores the user's per-type notification toggles. Defaults to all-on so
--    existing profiles get the expected behavior. The server will read this
--    jsonb before creating notification rows once server-side notification
--    creation lands (Task 7b and onward).
--
-- 2. delete own user row policy on public.users
--    Enables the "delete account" flow from the profile screen. Deleting the
--    public.users row cascades to profiles, check_ins, journal_entries,
--    milestones, relationships, and notifications via the FK ON DELETE
--    CASCADE relationships set up in migration 001. The auth.users row is
--    left behind for now — a future server-side cleanup job will hard-delete
--    it, or we'll wire a server endpoint using the service role.

alter table public.profiles
  add column if not exists notification_preferences jsonb
  not null default '{"encouragements": true, "support_alerts": true, "messages": true}'::jsonb;

comment on column public.profiles.notification_preferences is
  'Per-user notification toggles keyed by notification type. Server reads this before creating notification rows.';

-- Users can delete their own row. Cascade handles all dependent data.
create policy "users: delete own"
  on public.users for delete
  using (id = auth.uid());
