-- Migration 003: add context column to users
--
-- Context describes the user's situation (e.g. recovery journey, staying close
-- with a family member). It drives copy and UI labeling throughout the app
-- while the underlying data model stays identical across contexts.
--
-- Nullable to support existing rows and to allow the onboarding flow to set
-- it after auth signup but before the dashboard is reached.

alter table public.users
  add column if not exists context text;

alter table public.users
  drop constraint if exists users_context_check;

alter table public.users
  add constraint users_context_check
  check (context is null or context in ('recovery', 'family'));

comment on column public.users.context is
  'User-chosen situational context. Drives UI copy and role labeling. One of: recovery, family. Nullable during onboarding.';
