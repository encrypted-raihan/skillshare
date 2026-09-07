-- SkillSwap messaging fix
-- Run once in Supabase SQL Editor after the existing messaging.sql.
-- Creates conversations automatically when an accepted swap becomes a friendship.

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
  if p_user_a is null or p_user_b is null or p_user_a = p_user_b then
    raise exception 'Invalid conversation participants.';
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
    select id into conversation_id
    from public.conversations
    where user_a = a and user_b = b;
  end if;

  return conversation_id;
end;
$$;

revoke all on function public.ensure_conversation(uuid, uuid) from public, anon;
grant execute on function public.ensure_conversation(uuid, uuid) to authenticated;

-- Replace the swap-request response handler so ACCEPT also creates the chat.
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

-- Backfill conversations for every already-accepted friendship.
insert into public.conversations (user_a, user_b)
select
  case when sr.sender_id::text < sr.receiver_id::text then sr.sender_id else sr.receiver_id end,
  case when sr.sender_id::text < sr.receiver_id::text then sr.receiver_id else sr.sender_id end
from public.swap_requests sr
where sr.status = 'ACCEPTED'
  and sr.sender_id <> sr.receiver_id
on conflict ((least(user_a, user_b)), (greatest(user_a, user_b))) do nothing;

-- Realtime for new conversation rows and message updates.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'conversations'
  ) then
    alter publication supabase_realtime add table public.conversations;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end $$;
