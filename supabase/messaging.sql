-- SkillSwap messaging upgrade
-- Run this in Supabase SQL Editor once on the existing project.

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references public.profiles(id) on delete cascade,
  user_b uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (user_a <> user_b),
  unique (least(user_a, user_b), greatest(user_a, user_b))
);

alter table public.conversations add column if not exists updated_at timestamptz not null default now();

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null default '',
  message_type text not null default 'text' check (message_type in ('text','image','document','audio')),
  media_path text,
  media_name text,
  media_size bigint,
  mime_type text,
  duration_ms integer,
  delivered_at timestamptz,
  read_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.messages add column if not exists message_type text not null default 'text';
alter table public.messages add column if not exists media_path text;
alter table public.messages add column if not exists media_name text;
alter table public.messages add column if not exists media_size bigint;
alter table public.messages add column if not exists mime_type text;
alter table public.messages add column if not exists duration_ms integer;
alter table public.messages add column if not exists delivered_at timestamptz;
alter table public.messages add column if not exists read_at timestamptz;
alter table public.messages add column if not exists deleted_at timestamptz;

create index if not exists messages_conversation_created_idx on public.messages(conversation_id, created_at);
create index if not exists messages_sender_idx on public.messages(sender_id);

create table if not exists public.message_deletions (
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  deleted_at timestamptz not null default now(),
  primary key (message_id, user_id)
);

create index if not exists message_deletions_user_idx on public.message_deletions(user_id, message_id);

create or replace function public.touch_conversation_on_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.conversations
  set updated_at = now()
  where id = new.conversation_id;
  return new;
end;
$$;

drop trigger if exists messages_touch_conversation on public.messages;
create trigger messages_touch_conversation
after insert on public.messages
for each row execute function public.touch_conversation_on_message();

-- Existing installations may already have conversations/messages policies.
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.message_deletions enable row level security;

drop policy if exists conversations_select_participant on public.conversations;
create policy conversations_select_participant on public.conversations
for select to authenticated
using (user_a = auth.uid() or user_b = auth.uid());

drop policy if exists conversations_insert_participant on public.conversations;
create policy conversations_insert_participant on public.conversations
for insert to authenticated
with check (user_a = auth.uid() or user_b = auth.uid());

drop policy if exists conversations_update_participant on public.conversations;
create policy conversations_update_participant on public.conversations
for update to authenticated
using (user_a = auth.uid() or user_b = auth.uid())
with check (user_a = auth.uid() or user_b = auth.uid());

drop policy if exists messages_select_participant on public.messages;
create policy messages_select_participant on public.messages
for select to authenticated
using (exists (
  select 1 from public.conversations c
  where c.id = conversation_id and (c.user_a = auth.uid() or c.user_b = auth.uid())
) and not exists (
  select 1 from public.message_deletions md
  where md.message_id = id and md.user_id = auth.uid()
));

drop policy if exists messages_insert_sender on public.messages;
create policy messages_insert_sender on public.messages
for insert to authenticated
with check (
  sender_id = auth.uid()
  and exists (
    select 1 from public.conversations c
    where c.id = conversation_id and (c.user_a = auth.uid() or c.user_b = auth.uid())
  )
);

drop policy if exists messages_update_participant on public.messages;
create policy messages_update_participant on public.messages
for update to authenticated
using (exists (
  select 1 from public.conversations c
  where c.id = conversation_id and (c.user_a = auth.uid() or c.user_b = auth.uid())
))
with check (exists (
  select 1 from public.conversations c
  where c.id = conversation_id and (c.user_a = auth.uid() or c.user_b = auth.uid())
));

drop policy if exists message_deletions_select_self on public.message_deletions;
create policy message_deletions_select_self on public.message_deletions
for select to authenticated using (user_id = auth.uid());

drop policy if exists message_deletions_insert_self on public.message_deletions;
create policy message_deletions_insert_self on public.message_deletions
for insert to authenticated
with check (user_id = auth.uid() and exists (
  select 1
  from public.messages m
  join public.conversations c on c.id = m.conversation_id
  where m.id = message_id and (c.user_a = auth.uid() or c.user_b = auth.uid())
));

-- Realtime support.
alter table public.messages replica identity full;

-- Private bucket for images, documents and voice notes.
insert into storage.buckets (id, name, public)
values ('message-media', 'message-media', false)
on conflict (id) do update set public = false;

drop policy if exists message_media_insert on storage.objects;
create policy message_media_insert on storage.objects
for insert to authenticated
with check (
  bucket_id = 'message-media'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists message_media_select on storage.objects;
create policy message_media_select on storage.objects
for select to authenticated
using (
  bucket_id = 'message-media'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or exists (
      select 1
      from public.messages m
      join public.conversations c on c.id = m.conversation_id
      where m.media_path = name
      and (c.user_a = auth.uid() or c.user_b = auth.uid())
    )
  )
);

drop policy if exists message_media_delete on storage.objects;
create policy message_media_delete on storage.objects
for delete to authenticated
using (
  bucket_id = 'message-media'
  and (storage.foldername(name))[1] = auth.uid()::text
);
