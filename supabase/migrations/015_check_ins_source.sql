-- 015: notification check-in source
-- Adds a `source` column to check_ins so we can distinguish notification-driven
-- entries from in_app submissions. Backfills existing rows to 'in_app'.

alter table public.check_ins
  add column source text not null default 'in_app'
  check (source in ('in_app', 'notification'));
