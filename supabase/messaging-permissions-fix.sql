-- SkillSwap Messaging V2 permission fix
-- Run this AFTER messaging-v2.sql in the Supabase SQL Editor.
-- RLS policies control which rows a user can access, but PostgREST also
-- requires table privileges for the authenticated role.

begin;

-- Required table privileges for the browser client.
grant select on public.conversations to authenticated;
grant select, insert on public.messages to authenticated;

-- Re-apply the participant policies defensively.
drop policy if exists conversations_select_participant on public.conversations;
create policy conversations_select_participant
  on public.conversations
  for select
  to authenticated
  using (user_a = auth.uid() or user_b = auth.uid());

drop policy if exists messages_select_participant on public.messages;
create policy messages_select_participant
  on public.messages
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.conversations c
      where c.id = conversation_id
        and (c.user_a = auth.uid() or c.user_b = auth.uid())
    )
  );

drop policy if exists messages_insert_sender on public.messages;
create policy messages_insert_sender
  on public.messages
  for insert
  to authenticated
  with check (
    sender_id = auth.uid()
    and exists (
      select 1
      from public.conversations c
      where c.id = conversation_id
        and (c.user_a = auth.uid() or c.user_b = auth.uid())
    )
  );

commit;
