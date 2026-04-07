-- ============================================================
-- Reeco — Initial Schema
-- ============================================================

-- Enable UUID generation
create extension if not exists "pgcrypto";

-- ============================================================
-- ENUM TYPES
-- ============================================================

create type user_role as enum ('recovery', 'supporter', 'sponsor');
create type relationship_status as enum ('pending', 'active', 'removed');
create type check_in_status as enum ('sober', 'struggling', 'good_day');
create type milestone_type as enum ('1d', '7d', '30d', '90d', '1y', 'custom');
create type verification_status as enum ('unverified', 'pending', 'verified', 'rejected');
create type conversation_type as enum ('direct', 'group');

-- ============================================================
-- USERS
-- Extends Supabase auth.users. One row per authenticated user.
-- ============================================================

create table public.users (
  id           uuid primary key references auth.users(id) on delete cascade,
  email        text not null,
  display_name text not null,
  avatar_url   text,
  role         user_role not null,
  created_at   timestamptz not null default now()
);

-- ============================================================
-- PROFILES
-- Role-specific data. One row per user.
-- ============================================================

create table public.profiles (
  user_id             uuid primary key references public.users(id) on delete cascade,
  sobriety_start_date date,                          -- recovery users only
  bio                 text,
  push_token          text,                          -- expo push token
  verification_status verification_status not null default 'unverified',
  updated_at          timestamptz not null default now()
);

-- ============================================================
-- RELATIONSHIPS
-- Links a recovery user to a supporter (or sponsor).
-- permissions jsonb controls what the supporter can see.
-- Default: check-ins and milestones shared, journals never.
-- ============================================================

create table public.relationships (
  id                uuid primary key default gen_random_uuid(),
  recovery_user_id  uuid not null references public.users(id) on delete cascade,
  supporter_id      uuid not null references public.users(id) on delete cascade,
  status            relationship_status not null default 'pending',
  permissions       jsonb not null default '{"check_ins": true, "milestones": true}'::jsonb,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (recovery_user_id, supporter_id)
);

-- ============================================================
-- CHECK-INS
-- One per recovery user per calendar day.
-- ============================================================

create table public.check_ins (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.users(id) on delete cascade,
  status     check_in_status not null,
  note       text,
  created_at timestamptz not null default now(),
  -- enforce one check-in per user per UTC calendar day
  unique (user_id, (created_at::date))
);

-- ============================================================
-- JOURNAL ENTRIES
-- Always private. Never exposed to supporters via RLS.
-- ============================================================

create table public.journal_entries (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.users(id) on delete cascade,
  body       text not null,
  mood_tag   text,
  is_private boolean not null default true,
  created_at timestamptz not null default now()
);

-- ============================================================
-- MILESTONES
-- Auto-created when streak thresholds are crossed.
-- ============================================================

create table public.milestones (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users(id) on delete cascade,
  type        milestone_type not null,
  label       text,            -- used for 'custom' type
  achieved_at timestamptz not null default now(),
  unique (user_id, type)       -- one row per milestone type per user
);

-- ============================================================
-- CONVERSATIONS
-- ============================================================

create table public.conversations (
  id               uuid primary key default gen_random_uuid(),
  type             conversation_type not null default 'direct',
  participant_ids  uuid[] not null,
  created_at       timestamptz not null default now()
);

-- ============================================================
-- MESSAGES
-- ============================================================

create table public.messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id       uuid not null references public.users(id) on delete cascade,
  body            text not null,
  created_at      timestamptz not null default now()
);

-- ============================================================
-- NOTIFICATIONS
-- ============================================================

create table public.notifications (
  id           uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.users(id) on delete cascade,
  type         text not null,   -- e.g. 'emergency', 'encouragement', 'message', 'milestone'
  payload      jsonb not null default '{}'::jsonb,
  read_at      timestamptz,
  created_at   timestamptz not null default now()
);

-- ============================================================
-- INDEXES
-- ============================================================

create index on public.check_ins (user_id, created_at desc);
create index on public.journal_entries (user_id, created_at desc);
create index on public.milestones (user_id);
create index on public.messages (conversation_id, created_at asc);
create index on public.notifications (recipient_id, created_at desc);
create index on public.relationships (recovery_user_id, status);
create index on public.relationships (supporter_id, status);
