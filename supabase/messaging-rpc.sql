-- Secure messaging helpers. Run after supabase/messaging.sql.

create or replace function public.mark_conversation_read(conversation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.messages m
  set read_at = coalesce(read_at, now()), delivered_at = coalesce(delivered_at, now())
  where m.conversation_id = mark_conversation_read.conversation_id
    and m.sender_id <> auth.uid()
    and exists (
      select 1 from public.conversations c
      where c.id = m.conversation_id and (c.user_a = auth.uid() or c.user_b = auth.uid())
    );
end;
$$;

grant execute on function public.mark_conversation_read(uuid) to authenticated;

create or replace function public.delete_message_for_everyone(message_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.messages m
  set deleted_at = coalesce(deleted_at, now()), body = '', media_path = null, media_name = null
  where m.id = delete_message_for_everyone.message_id
    and m.sender_id = auth.uid();

  if not found then
    raise exception 'You can only delete your own messages.' using errcode = '42501';
  end if;
end;
$$;

grant execute on function public.delete_message_for_everyone(uuid) to authenticated;
