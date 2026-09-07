-- SkillSwap Messaging V2
-- CLEAN RESET: run this once in Supabase SQL Editor.
-- This intentionally removes the old messaging tables and recreates a tiny,
-- reliable text-chat system. Attachments, read receipts, voice notes, etc.
-- can be added later after the basic chat is verified.

begin;

-- ---------------------------------------------------------------------------
-- 1. Remove the old messaging database objects.
-- ---------------------------------------------------------------------------

drop trigger if exists messages_touch_conversation on public.messages;

drop function if exists public.touch_conversation_on_message();
drop function if exists public.mark_conversation_read(uuid);
drop function if exists public.delete_message_for_everyone(uuid);
drop function if exists public.ensure_conversation(uuid, uuid);

drop table if exists public.message_deletions cascade;
drop table if exists public.messages cascade;
drop table if exists public.conversations cascade;

-- Old storage policies are no longer used by the v2 chat.
drop policy if exists message_media_insert on storage.objects;
drop policy if exists message_media_select on storage.objects;
drop policy if exists message_media_delete on storage.objects;

-- ---------------------------------------------------------------------------
-- 2. Conversations: exactly one row per accepted friend pair.
-- ---------------------------------------------------------------------------

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references public.profiles(id) on delete cascade,
  user_b uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (user_a <> user_b)
);

create unique index conversations_pair_unique_idx
  on public.conversations (least(user_a, user_b), greatest(user_a, user_b));

create index conversations_user_a_idx on public.conversations(user_a);
create index conversations_user_b_idx on public.conversations(user_b);

-- ---------------------------------------------------------------------------
-- 3. Messages: intentionally minimal for v2.
-- ---------------------------------------------------------------------------

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create index messages_conversation_created_idx
  on public.messages(conversation_id, created_at);

-- ---------------------------------------------------------------------------
-- 4. Conversation helper.
--    It can only create a chat between two users when:
--      - the caller is one of them
--      - an ACCEPTED swap request exists between them
-- ---------------------------------------------------------------------------

create or replace function public.ensure_conversation(p_user_a uuid, p_user_b uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  conversation_id uuid;
  a uuid;
  b uuid;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in.' using errcode = '42501';
  end if;

  if p_user_a is null or p_user_b is null or p_user_a = p_user_b then
    raise exception 'Invalid conversation participants.';
  end if;

  if auth.uid() <> p_user_a and auth.uid() <> p_user_b then
    raise exception 'You can only create a conversation you participate in.' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.swap_requests sr
    where sr.status = 'ACCEPTED'
      and (
        (sr.sender_id = p_user_a and sr.receiver_id = p_user_b)
        or
        (sr.sender_id = p_user_b and sr.receiver_id = p_user_a)
      )
  ) then
    raise exception 'You can only message an accepted SkillSwap friend.' using errcode = '42501';
  end if;

  if p_user_a::text < p_user_b::text then
    a := p_user_a;
    b := p_user_b;
  else
    a := p_user_b;
    b := p_user_a;
  end if;

  insert into public.conversations (user_a, user_b)
  values (a, b)
  on conflict ((least(user_a, user_b)), (greatest(user_a, user_b)))
  do update set updated_at = public.conversations.updated_at
  returning id into conversation_id;

  if conversation_id is null then
    select c.id
      into conversation_id
    from public.conversations c
    where c.user_a = a and c.user_b = b;
  end if;

  return conversation_id;
end;
$$;

revoke all on function public.ensure_conversation(uuid, uuid) from public, anon;
grant execute on function public.ensure_conversation(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Keep the existing Requests-page contract working.
--    ACCEPT creates the conversation; DECLINE/CANCEL do not.
-- ---------------------------------------------------------------------------

create or replace function public.respond_to_swap_request(request_id uuid, action text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  request_row public.swap_requests%rowtype;
  next_status text;
begin
  select * into request_row
  from public.swap_requests
  where id = request_id
  for update;

  if request_row.id is null then
    raise exception 'Swap request not found.';
  end if;

  if action = 'ACCEPT' then
    if request_row.receiver_id <> auth.uid() or request_row.status <> 'PENDING' then
      raise exception 'You cannot accept this request.' using errcode = '42501';
    end if;
    next_status := 'ACCEPTED';
  elsif action = 'DECLINE' then
    if request_row.receiver_id <> auth.uid() or request_row.status <> 'PENDING' then
      raise exception 'You cannot decline this request.' using errcode = '42501';
    end if;
    next_status := 'DECLINED';
  elsif action = 'CANCEL' then
    if request_row.sender_id <> auth.uid() or request_row.status <> 'PENDING' then
      raise exception 'You cannot cancel this request.' using errcode = '42501';
    end if;
    next_status := 'CANCELLED';
  else
    raise exception 'Unknown action.';
  end if;

  update public.swap_requests
  set status = next_status,
      updated_at = now()
  where id = request_row.id;

  if next_status = 'ACCEPTED' then
    perform public.ensure_conversation(request_row.sender_id, request_row.receiver_id);
  end if;
end;
$$;

grant execute on function public.respond_to_swap_request(uuid, text) to authenticated;

-- Backfill a conversation for every friendship already accepted before v2.
insert into public.conversations (user_a, user_b)
select
  least(sr.sender_id, sr.receiver_id),
  greatest(sr.sender_id, sr.receiver_id)
from public.swap_requests sr
where sr.status = 'ACCEPTED'
  and sr.sender_id <> sr.receiver_id
on conflict ((least(user_a, user_b)), (greatest(user_a, user_b))) do nothing;

-- ---------------------------------------------------------------------------
-- 6. RLS: participants can read their conversations/messages and send only
--    as themselves. Conversations are created through the RPC above.
-- ---------------------------------------------------------------------------

alter table public.conversations enable row level security;
alter table public.messages enable row level security;

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

-- No client-side update/delete in v2.

-- ---------------------------------------------------------------------------
-- 7. Realtime for the actual message table.
-- ---------------------------------------------------------------------------

alter table public.messages replica identity full;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end $$;

commit;
