-- H1: Enforce relationships.permissions.messages at the RLS layer.
--
-- Before this migration the WITH CHECK on messages only verified that the
-- sender was a participant of the conversation. A supporter whose recovery
-- partner had revoked messaging permission could still post messages by
-- inserting through PostgREST directly with their own JWT, bypassing the
-- server's /api/messages permission check.
--
-- This recreates the insert policy to additionally reject inserts when any
-- active relationship between the sender and the other participants has
-- permissions->>'messages' = 'false'.

drop policy if exists "messages: participant inserts" on public.messages;

create policy "messages: participant inserts"
  on public.messages for insert
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_id
        and auth.uid() = any(c.participant_ids)
    )
    and not exists (
      select 1
      from public.conversations c
      join public.relationships r
        on r.status = 'active'
        and (r.permissions->>'messages') = 'false'
        and (
          (r.recovery_user_id = auth.uid() and r.supporter_id = any(c.participant_ids))
          or
          (r.supporter_id = auth.uid() and r.recovery_user_id = any(c.participant_ids))
        )
      where c.id = conversation_id
    )
  );
