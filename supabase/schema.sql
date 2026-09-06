-- SkillSwap clean database
-- Run this in Supabase SQL Editor after resetting the public schema.

create extension if not exists pgcrypto;

drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_skill_swap_user() cascade;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null check (char_length(trim(full_name)) between 2 and 120),
  bio text not null default '' check (char_length(bio) <= 400),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.profile_private (
  user_id uuid primary key references auth.users(id) on delete cascade,
  phone_number text not null check (char_length(trim(phone_number)) between 8 and 30),
  date_of_birth date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.skills (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 80),
  name_normalized text generated always as (lower(regexp_replace(trim(name), '\s+', ' ', 'g'))) stored,
  created_at timestamptz not null default now(),
  unique (name_normalized)
);

create table if not exists public.user_skills (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  skill_id uuid not null references public.skills(id) on delete cascade,
  skill_type text not null default 'OFFER' check (skill_type in ('OFFER', 'NEED')),
  proficiency text not null default 'INTERMEDIATE' check (proficiency in ('BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT')),
  created_at timestamptz not null default now(),
  unique (user_id, skill_id, skill_type)
);

create index if not exists user_skills_user_id_idx on public.user_skills(user_id);
create index if not exists user_skills_skill_id_idx on public.user_skills(skill_id);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at before update on public.profiles
for each row execute function public.touch_updated_at();

drop trigger if exists profile_private_touch_updated_at on public.profile_private;
create trigger profile_private_touch_updated_at before update on public.profile_private
for each row execute function public.touch_updated_at();

-- The only place where the new Auth user's onboarding metadata is written
-- into application tables. It runs immediately after auth.users creation.
create or replace function public.handle_new_skill_swap_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  skill_text text;
  normalized_skill text;
  current_skill_id uuid;
begin
  insert into public.profiles (id, full_name, bio)
  values (
    new.id,
    trim(coalesce(new.raw_user_meta_data->>'profile_full_name', '')),
    left(trim(coalesce(new.raw_user_meta_data->>'profile_bio', '')), 400)
  );

  insert into public.profile_private (user_id, phone_number, date_of_birth)
  values (
    new.id,
    trim(coalesce(new.raw_user_meta_data->>'private_phone_number', '')),
    (new.raw_user_meta_data->>'private_date_of_birth')::date
  );

  for skill_text in
    select value
    from jsonb_array_elements_text(coalesce(new.raw_user_meta_data->'offered_skills', '[]'::jsonb))
  loop
    normalized_skill := regexp_replace(trim(skill_text), '\s+', ' ', 'g');

    if normalized_skill <> '' then
      insert into public.skills (name)
      values (left(normalized_skill, 80))
      on conflict (name_normalized) do nothing
      returning id into current_skill_id;

      if current_skill_id is null then
        select id into current_skill_id
        from public.skills
        where name_normalized = lower(regexp_replace(trim(normalized_skill), '\s+', ' ', 'g'))
        limit 1;
      end if;

      insert into public.user_skills (user_id, skill_id, skill_type, proficiency)
      values (new.id, current_skill_id, 'OFFER', 'INTERMEDIATE')
      on conflict (user_id, skill_id, skill_type) do nothing;
    end if;
  end loop;

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_skill_swap_user();

alter table public.profiles enable row level security;
alter table public.profile_private enable row level security;
alter table public.skills enable row level security;
alter table public.user_skills enable row level security;

drop policy if exists profiles_select_authenticated on public.profiles;
create policy profiles_select_authenticated on public.profiles
for select to authenticated using (true);

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists profile_private_select_self on public.profile_private;
create policy profile_private_select_self on public.profile_private
for select to authenticated using (user_id = auth.uid());

drop policy if exists profile_private_update_self on public.profile_private;
create policy profile_private_update_self on public.profile_private
for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists skills_select_authenticated on public.skills;
create policy skills_select_authenticated on public.skills
for select to authenticated using (true);

drop policy if exists skills_insert_authenticated on public.skills;
create policy skills_insert_authenticated on public.skills
for insert to authenticated with check (true);

drop policy if exists user_skills_select_authenticated on public.user_skills;
create policy user_skills_select_authenticated on public.user_skills
for select to authenticated using (user_id = auth.uid());

drop policy if exists user_skills_insert_self on public.user_skills;
create policy user_skills_insert_self on public.user_skills
for insert to authenticated with check (user_id = auth.uid());

drop policy if exists user_skills_update_self on public.user_skills;
create policy user_skills_update_self on public.user_skills
for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists user_skills_delete_self on public.user_skills;
create policy user_skills_delete_self on public.user_skills
for delete to authenticated using (user_id = auth.uid());

grant select on public.profiles, public.skills, public.user_skills to authenticated;
grant update on public.profiles, public.profile_private to authenticated;
grant insert, update, delete on public.user_skills to authenticated;
