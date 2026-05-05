-- 019: push tokens table
--
-- Stores Expo push tokens per user so the server can fan out push notifications
-- via the Expo push service. A user can have multiple tokens (one per device).
-- The (user_id, token) pair is unique so re-registering from the same device
-- is an idempotent upsert (see server/src/routes/push-token.ts).

create table if not exists public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, token)
);

create index if not exists push_tokens_user_id_idx on public.push_tokens(user_id);

alter table public.push_tokens enable row level security;

-- Owner can read/insert/update/delete their own tokens. The server uses the
-- service-role key for fan-out reads, which bypasses RLS.
create policy "push_tokens: owner select"
  on public.push_tokens for select
  using (user_id = auth.uid());

create policy "push_tokens: owner insert"
  on public.push_tokens for insert
  with check (user_id = auth.uid());

create policy "push_tokens: owner update"
  on public.push_tokens for update
  using (user_id = auth.uid());

create policy "push_tokens: owner delete"
  on public.push_tokens for delete
  using (user_id = auth.uid());
