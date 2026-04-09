-- ============================================================
-- INVITE CODES (Task 8a)
-- ============================================================
-- Short uppercase codes a recovery user shares to link a supporter.
-- Server-generated, server-validated. RLS enabled with NO client
-- policies — only the service-role server ever reads/writes this
-- table, so mobile clients get no direct access.
--
-- Note on numbering: the plan originally called this `003_invite_codes`
-- but 003/004/005 were taken by the Circly rebrand migrations landed
-- in 2026-04-08. This file is the same schema, renumbered to 006.
-- ============================================================

create table public.invite_codes (
  code              text primary key,
  recovery_user_id  uuid not null references public.users(id) on delete cascade,
  expires_at        timestamptz not null,
  used_at           timestamptz,
  created_at        timestamptz not null default now()
);

create index on public.invite_codes (recovery_user_id);
create index on public.invite_codes (expires_at);

alter table public.invite_codes enable row level security;

-- Intentionally no policies: all access goes through the server's
-- service-role client. Any direct client query will be rejected.
