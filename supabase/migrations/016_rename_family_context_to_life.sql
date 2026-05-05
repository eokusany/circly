-- Rename context value 'family' to 'life' across all user rows,
-- then tighten the CHECK constraint to only allow ('recovery', 'life').
update public.users set context = 'life' where context = 'family';

alter table public.users drop constraint if exists users_context_check;
alter table public.users add constraint users_context_check
  check (context is null or context in ('recovery', 'life'));
