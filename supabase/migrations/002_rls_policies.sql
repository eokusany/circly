-- ============================================================
-- Reeco — Row-Level Security Policies
-- Core principle: the recovery user always owns their data.
-- Supporters see only what the recovery user has permitted.
-- Journals are NEVER visible to supporters — enforced here.
-- ============================================================

-- Enable RLS on all tables
alter table public.users            enable row level security;
alter table public.profiles         enable row level security;
alter table public.relationships    enable row level security;
alter table public.check_ins        enable row level security;
alter table public.journal_entries  enable row level security;
alter table public.milestones       enable row level security;
alter table public.conversations    enable row level security;
alter table public.messages         enable row level security;
alter table public.notifications    enable row level security;

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================

-- Returns true if the current user is an active supporter of `recovery_uid`
create or replace function public.is_active_supporter(recovery_uid uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from public.relationships
    where supporter_id = auth.uid()
      and recovery_user_id = recovery_uid
      and status = 'active'
  )
$$;

-- Returns true if check-ins are shared with the current supporter for `recovery_uid`
create or replace function public.can_see_check_ins(recovery_uid uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from public.relationships
    where supporter_id = auth.uid()
      and recovery_user_id = recovery_uid
      and status = 'active'
      and (permissions->>'check_ins')::boolean = true
  )
$$;

-- Returns true if milestones are shared with the current supporter for `recovery_uid`
create or replace function public.can_see_milestones(recovery_uid uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from public.relationships
    where supporter_id = auth.uid()
      and recovery_user_id = recovery_uid
      and status = 'active'
      and (permissions->>'milestones')::boolean = true
  )
$$;

-- ============================================================
-- USERS
-- ============================================================

-- Users can read their own row
create policy "users: read own"
  on public.users for select
  using (id = auth.uid());

-- Users can read display_name + avatar of users they have a relationship with
create policy "users: read linked users"
  on public.users for select
  using (
    exists (
      select 1 from public.relationships r
      where r.status = 'active'
        and (
          (r.recovery_user_id = auth.uid() and r.supporter_id = users.id) or
          (r.supporter_id = auth.uid() and r.recovery_user_id = users.id)
        )
    )
  );

-- Users can insert their own row (called right after sign-up)
create policy "users: insert own"
  on public.users for insert
  with check (id = auth.uid());

-- Users can update their own display_name, avatar_url
create policy "users: update own"
  on public.users for update
  using (id = auth.uid());

-- ============================================================
-- PROFILES
-- ============================================================

create policy "profiles: read own"
  on public.profiles for select
  using (user_id = auth.uid());

create policy "profiles: insert own"
  on public.profiles for insert
  with check (user_id = auth.uid());

create policy "profiles: update own"
  on public.profiles for update
  using (user_id = auth.uid());

-- ============================================================
-- RELATIONSHIPS
-- ============================================================

-- Recovery user sees all their relationships
create policy "relationships: recovery user reads own"
  on public.relationships for select
  using (recovery_user_id = auth.uid());

-- Supporter sees relationships where they are the supporter
create policy "relationships: supporter reads own"
  on public.relationships for select
  using (supporter_id = auth.uid());

-- Only the recovery user can create a relationship (invite)
create policy "relationships: recovery user inserts"
  on public.relationships for insert
  with check (recovery_user_id = auth.uid());

-- Recovery user can update status and permissions for their relationships
create policy "relationships: recovery user updates"
  on public.relationships for update
  using (recovery_user_id = auth.uid());

-- Supporter can accept a pending invite (set status to active)
create policy "relationships: supporter accepts invite"
  on public.relationships for update
  using (
    supporter_id = auth.uid()
    and status = 'pending'
  );

-- ============================================================
-- CHECK-INS
-- ============================================================

-- Recovery user reads their own check-ins
create policy "check_ins: owner reads"
  on public.check_ins for select
  using (user_id = auth.uid());

-- Active supporters read check-ins only if permission is granted
create policy "check_ins: supporter reads if permitted"
  on public.check_ins for select
  using (public.can_see_check_ins(user_id));

-- Only the owner can insert
create policy "check_ins: owner inserts"
  on public.check_ins for insert
  with check (user_id = auth.uid());

-- Owner can update their own check-in (e.g. add a note)
create policy "check_ins: owner updates"
  on public.check_ins for update
  using (user_id = auth.uid());

-- ============================================================
-- JOURNAL ENTRIES — ALWAYS PRIVATE
-- No supporter or sponsor policy. Journals are never shared.
-- ============================================================

create policy "journal_entries: owner reads"
  on public.journal_entries for select
  using (user_id = auth.uid());

create policy "journal_entries: owner inserts"
  on public.journal_entries for insert
  with check (user_id = auth.uid());

create policy "journal_entries: owner updates"
  on public.journal_entries for update
  using (user_id = auth.uid());

create policy "journal_entries: owner deletes"
  on public.journal_entries for delete
  using (user_id = auth.uid());

-- ============================================================
-- MILESTONES
-- ============================================================

create policy "milestones: owner reads"
  on public.milestones for select
  using (user_id = auth.uid());

-- Active supporters read milestones only if permission is granted
create policy "milestones: supporter reads if permitted"
  on public.milestones for select
  using (public.can_see_milestones(user_id));

create policy "milestones: owner inserts"
  on public.milestones for insert
  with check (user_id = auth.uid());

-- ============================================================
-- CONVERSATIONS
-- ============================================================

-- Users can read conversations they participate in
create policy "conversations: participant reads"
  on public.conversations for select
  using (auth.uid() = any(participant_ids));

create policy "conversations: participant inserts"
  on public.conversations for insert
  with check (auth.uid() = any(participant_ids));

-- ============================================================
-- MESSAGES
-- ============================================================

-- Only participants of the conversation can read messages
create policy "messages: participant reads"
  on public.messages for select
  using (
    exists (
      select 1 from public.conversations c
      where c.id = conversation_id
        and auth.uid() = any(c.participant_ids)
    )
  );

-- Only participants can send messages
create policy "messages: participant inserts"
  on public.messages for insert
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_id
        and auth.uid() = any(c.participant_ids)
    )
  );

-- ============================================================
-- NOTIFICATIONS
-- ============================================================

create policy "notifications: recipient reads"
  on public.notifications for select
  using (recipient_id = auth.uid());

-- Only the server (service role) inserts notifications.
-- No client insert policy — notifications are created server-side only.

create policy "notifications: recipient updates read_at"
  on public.notifications for update
  using (recipient_id = auth.uid());
