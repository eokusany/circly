-- Migration 005: self-delete RPC function
--
-- Supabase does not expose a client-side API to delete your own auth.users
-- row. Clients cannot call auth.admin.deleteUser() without the service-role
-- key, which must never live on the client.
--
-- This function lets authenticated users delete their own auth row via RPC.
-- It runs with SECURITY DEFINER (owner's privileges) so it has access to
-- the auth schema. The WHERE clause pins the delete to auth.uid(), so a
-- user can only ever delete themselves, never another account.
--
-- Once the auth.users row is deleted, the FK cascade in migration 001
-- (public.users.id references auth.users(id) on delete cascade) wipes the
-- public.users row, which in turn cascades to profiles, relationships,
-- check_ins, journal_entries, milestones, messages, and notifications.
--
-- After calling this, the client should sign out to clear the now-invalid
-- local session.

create or replace function public.delete_self_account()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  current_uid uuid;
begin
  current_uid := auth.uid();

  -- Reject unauthenticated calls. Belt-and-braces: grant is revoked from
  -- anon below, but this keeps the function safe if permissions shift.
  if current_uid is null then
    raise exception 'not authenticated';
  end if;

  delete from auth.users where id = current_uid;
end;
$$;

-- Only authenticated users can invoke this. The anon role must not be able
-- to call it even by accident.
revoke execute on function public.delete_self_account() from public, anon;
grant execute on function public.delete_self_account() to authenticated;

comment on function public.delete_self_account() is
  'Deletes the calling user''s auth.users row. Pinned to auth.uid() so a user can only ever delete themselves. Cascade wipes all dependent public data via FKs from migration 001.';
