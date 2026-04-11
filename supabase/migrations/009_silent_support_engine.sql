-- ============================================================
-- SILENT SUPPORT ENGINE
-- ============================================================
-- Three tables powering Circly's core differentiator:
--   okay_taps       — daily liveness signal ("I'm okay" tap)
--   warm_pings      — one-directional presence signal (supporter → recovery)
--   silence_settings — per-user detection thresholds and snooze
--
-- The system detects absence patterns and nudges supporters
-- without the person at the center ever having to ask for help.
-- ============================================================

-- 1. okay_taps — records each "I'm okay" tap from a recovery/center user
create table public.okay_taps (
  id        uuid primary key default gen_random_uuid(),
  user_id   uuid not null references public.users(id) on delete cascade,
  tapped_at timestamptz not null default now()
);

create index on public.okay_taps (user_id, tapped_at desc);

alter table public.okay_taps enable row level security;

create policy "okay_taps: owner reads"
  on public.okay_taps for select
  using (user_id = auth.uid());

create policy "okay_taps: owner inserts"
  on public.okay_taps for insert
  with check (user_id = auth.uid());


-- 2. warm_pings — one-tap presence signals from supporter to recovery user
create table public.warm_pings (
  id           uuid primary key default gen_random_uuid(),
  sender_id    uuid not null references public.users(id) on delete cascade,
  recipient_id uuid not null references public.users(id) on delete cascade,
  created_at   timestamptz not null default now()
);

create index on public.warm_pings (recipient_id, created_at desc);
create index on public.warm_pings (sender_id, created_at desc);

alter table public.warm_pings enable row level security;

-- Sender can insert if they have an active relationship with the recipient
create policy "warm_pings: sender inserts"
  on public.warm_pings for insert
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.relationships
      where status = 'active'
        and (
          (supporter_id = auth.uid() and recovery_user_id = warm_pings.recipient_id)
          or
          (recovery_user_id = auth.uid() and supporter_id = warm_pings.recipient_id)
        )
    )
  );

-- Recipient can read pings sent to them
create policy "warm_pings: recipient reads"
  on public.warm_pings for select
  using (recipient_id = auth.uid());

-- Sender can read their own sent pings (for rate limit display)
create policy "warm_pings: sender reads own"
  on public.warm_pings for select
  using (sender_id = auth.uid());


-- 3. silence_settings — per-user detection configuration
create table public.silence_settings (
  user_id                uuid primary key references public.users(id) on delete cascade,
  okay_tap_enabled       boolean not null default true,
  okay_tap_time          time not null default '09:00',
  silence_threshold_days int not null default 2
    check (silence_threshold_days between 1 and 7),
  snooze_until           date,
  updated_at             timestamptz not null default now()
);

alter table public.silence_settings enable row level security;

create policy "silence_settings: owner reads"
  on public.silence_settings for select
  using (user_id = auth.uid());

create policy "silence_settings: owner inserts"
  on public.silence_settings for insert
  with check (user_id = auth.uid());

create policy "silence_settings: owner updates"
  on public.silence_settings for update
  using (user_id = auth.uid());
