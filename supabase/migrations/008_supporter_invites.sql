-- ============================================================
-- SUPPORTER INVITES (bidirectional invite codes)
-- ============================================================
-- Supporters can now generate invite codes too. A supporter
-- shares a code with a recovery user, who accepts it to form
-- the relationship. This mirrors the existing recovery->supporter
-- flow but in reverse.
--
-- We add supporter_user_id alongside recovery_user_id.
-- Exactly one of the two must be set per row (enforced by CHECK).
-- ============================================================

-- Make recovery_user_id nullable (was NOT NULL).
alter table public.invite_codes
  alter column recovery_user_id drop not null;

-- Add the supporter-side creator column.
alter table public.invite_codes
  add column supporter_user_id uuid references public.users(id) on delete cascade;

-- Exactly one creator must be set.
alter table public.invite_codes
  add constraint invite_codes_one_creator
  check (
    (recovery_user_id is not null and supporter_user_id is null)
    or
    (recovery_user_id is null and supporter_user_id is not null)
  );

create index on public.invite_codes (supporter_user_id);
