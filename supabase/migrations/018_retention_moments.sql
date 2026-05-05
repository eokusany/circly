-- Migration 014: retention moments
--
-- Adds five gating fields to profiles plus one audit table for sobriety
-- resets. Backs the spec at
-- docs/superpowers/specs/2026-05-04-retention-moments-design.md.
--
-- 1. profiles.first_checkin_intro_seen        — gates §4.1 (one-shot)
-- 2. profiles.first_checkin_celebration_seen  — gates §4.3 (one-shot)
-- 3. profiles.supporter_first_run_seen        — gates §5.1/§5.2 (one-shot)
-- 4. profiles.last_milestone_celebrated_days  — highest substance-context
--    day-count milestone already celebrated for the *current* sobriety
--    start date; reset to 0 by the start-fresh flow per §2.2.
-- 5. profiles.last_milestone_celebrated_checkins — highest life-context
--    cumulative-check-in milestone already celebrated; never reset.
--
-- 6. public.sobriety_resets — one row per "start fresh" event, used to
--    derive the §2.3 supporter "started fresh" feed card. Append-only.

alter table public.profiles
  add column if not exists first_checkin_intro_seen boolean not null default false;

alter table public.profiles
  add column if not exists first_checkin_celebration_seen boolean not null default false;

alter table public.profiles
  add column if not exists supporter_first_run_seen boolean not null default false;

alter table public.profiles
  add column if not exists last_milestone_celebrated_days integer not null default 0;

alter table public.profiles
  add column if not exists last_milestone_celebrated_checkins integer not null default 0;

comment on column public.profiles.first_checkin_intro_seen is
  'One-shot flag: has the user seen the first-check-in intro screen (spec §4.1).';
comment on column public.profiles.first_checkin_celebration_seen is
  'One-shot flag: has the user seen the day-one celebratory screen after their first check-in (spec §4.3).';
comment on column public.profiles.supporter_first_run_seen is
  'One-shot flag: has the supporter seen the first-run intro (connected or cold path, spec §5).';
comment on column public.profiles.last_milestone_celebrated_days is
  'Highest substance-context day-count milestone (in days) already celebrated for the current sobriety_start_date. Reset to 0 by the start-fresh flow (spec §2.2). Gates §6.2 for context=recovery users.';
comment on column public.profiles.last_milestone_celebrated_checkins is
  'Highest life-context cumulative-check-in milestone already celebrated. Never reset. Gates §6.2 for context=life users.';

create table if not exists public.sobriety_resets (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users(id) on delete cascade,
  reset_at    timestamptz not null default now(),
  previous_start_date date
);

create index if not exists sobriety_resets_user_id_idx
  on public.sobriety_resets (user_id, reset_at desc);

comment on table public.sobriety_resets is
  'Append-only audit of "start fresh" events. Drives the §2.3 supporter "started fresh" feed card. One row per reset.';

alter table public.sobriety_resets enable row level security;

create policy "sobriety_resets: insert own"
  on public.sobriety_resets for insert
  with check (user_id = auth.uid());

create policy "sobriety_resets: select own"
  on public.sobriety_resets for select
  using (user_id = auth.uid());

create policy "sobriety_resets: select linked supporter"
  on public.sobriety_resets for select
  using (
    exists (
      select 1 from public.relationships r
      where r.recovery_user_id = sobriety_resets.user_id
        and r.supporter_id = auth.uid()
        and r.status = 'active'
    )
  );
