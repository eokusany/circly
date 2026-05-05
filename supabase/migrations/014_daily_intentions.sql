create table if not exists daily_intentions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users(id) on delete cascade,
  intention   text not null,
  created_at  timestamptz not null default now(),
  date        date not null default current_date,
  unique (user_id, date)
);

alter table daily_intentions enable row level security;

create policy "Users manage own intentions"
  on daily_intentions
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Supporters read linked intentions"
  on daily_intentions
  for select
  using (
    exists (
      select 1 from relationships r
      where r.supporter_id = auth.uid()
        and r.recovery_user_id = daily_intentions.user_id
        and r.status = 'active'
    )
  );
