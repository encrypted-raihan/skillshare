-- SkillSwap onboarding database
-- Run this after clearing the old public schema.
--
-- Design:
-- 1) The browser collects email/password + onboarding details locally.
-- 2) No Supabase Auth user is created during either onboarding page.
-- 3) The final button calls auth.signUp() exactly once.
-- 4) signUp() passes only non-secret onboarding data in raw_user_meta_data.
-- 5) This trigger creates the public/private profile and OFFER skills for the new user.
--
-- Passwords are NEVER stored in public tables or user metadata.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  bio text not null default '',
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.profile_private (
  id uuid primary key references auth.users(id) on delete cascade,
  phone_number text,
  date_of_birth date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.skills (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.user_skills (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  skill_id uuid not null references public.skills(id) on delete cascade,
  type text not null default 'OFFER' check (type in ('OFFER', 'NEED')),
  proficiency text not null default 'INTERMEDIATE'
    check (proficiency in ('BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT')),
  created_at timestamptz not null default now(),
  unique (user_id, skill_id, type)
);

create unique index if not exists skills_lower_name_uidx
  on public.skills (lower(trim(name)));

create index if not exists user_skills_user_type_idx
  on public.user_skills (user_id, type);

-- Keep updated_at consistent for later profile editing.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists set_profile_private_updated_at on public.profile_private;
create trigger set_profile_private_updated_at
before update on public.profile_private
for each row execute function public.set_updated_at();

-- This trigger is the only place onboarding creates profile rows.
-- It runs after auth.users receives the new user.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_full_name text;
  profile_bio text;
  private_phone text;
  private_dob date;
  skill_name text;
  skill_id uuid;
begin
  profile_full_name := nullif(trim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), '');
  profile_bio := trim(coalesce(new.raw_user_meta_data ->> 'bio', ''));
  private_phone := nullif(trim(coalesce(new.raw_user_meta_data ->> 'phone_number', '')), '');
  private_dob := nullif(new.raw_user_meta_data ->> 'date_of_birth', '')::date;

  if profile_full_name is null then
    raise exception 'Onboarding profile is incomplete: full_name is required';
  end if;

  if char_length(profile_full_name) > 120 then
    raise exception 'Full name is too long';
  end if;

  if char_length(profile_bio) > 500 then
    raise exception 'Bio is too long';
  end if;

  insert into public.profiles (id, full_name, bio)
  values (new.id, profile_full_name, profile_bio);

  insert into public.profile_private (id, phone_number, date_of_birth)
  values (new.id, private_phone, private_dob);

  if jsonb_typeof(new.raw_user_meta_data -> 'offered_skills') = 'array' then
    for skill_name in
      select distinct trim(value)
      from jsonb_array_elements_text(new.raw_user_meta_data -> 'offered_skills')
      where trim(value) <> ''
      limit 10
    loop
      insert into public.skills (name)
      values (skill_name)
      on conflict ((lower(trim(name)))) do update
        set name = public.skills.name
      returning id into skill_id;

      insert into public.user_skills (user_id, skill_id, type)
      values (new.id, skill_id, 'OFFER')
      on conflict (user_id, skill_id, type) do nothing;
    end loop;
  end if;

  return new;
exception
  when unique_violation then
    raise exception 'Unable to create the onboarding profile because a required record already exists';
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Public profile visibility: authenticated users can discover each other.
alter table public.profiles enable row level security;
alter table public.profile_private enable row level security;
alter table public.skills enable row level security;
alter table public.user_skills enable row level security;

drop policy if exists "profiles_select_authenticated" on public.profiles;
create policy "profiles_select_authenticated"
on public.profiles
for select
to authenticated
using ((select auth.uid()) is not null);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles
for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

drop policy if exists "profile_private_select_own" on public.profile_private;
create policy "profile_private_select_own"
on public.profile_private
for select
to authenticated
using ((select auth.uid()) = id);

drop policy if exists "profile_private_update_own" on public.profile_private;
create policy "profile_private_update_own"
on public.profile_private
for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

drop policy if exists "skills_select_authenticated" on public.skills;
create policy "skills_select_authenticated"
on public.skills
for select
to authenticated
using ((select auth.uid()) is not null);

drop policy if exists "user_skills_select_authenticated" on public.user_skills;
create policy "user_skills_select_authenticated"
on public.user_skills
for select
to authenticated
using ((select auth.uid()) is not null);

-- Normal clients do not need direct INSERT access during onboarding.
-- The SECURITY DEFINER trigger performs those inserts when Auth creates the user.

revoke all on table public.profiles from anon;
revoke all on table public.profile_private from anon;
revoke all on table public.skills from anon;
revoke all on table public.user_skills from anon;

grant select on public.profiles to authenticated;
grant update on public.profiles to authenticated;

grant select on public.profile_private to authenticated;
grant update on public.profile_private to authenticated;

grant select on public.skills to authenticated;

grant select on public.user_skills to authenticated;

-- Make the trigger function unavailable through ordinary API calls.
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- Optional sanity query after running:
-- select
--   u.id,
--   u.email,
--   p.full_name,
--   p.bio,
--   pp.phone_number,
--   pp.date_of_birth,
--   coalesce(array_agg(s.name order by s.name) filter (where s.name is not null), '{}') as offered_skills
-- from auth.users u
-- left join public.profiles p on p.id = u.id
-- left join public.profile_private pp on pp.id = u.id
-- left join public.user_skills us on us.user_id = u.id and us.type = 'OFFER'
-- left join public.skills s on s.id = us.skill_id
-- group by u.id, u.email, p.full_name, p.bio, pp.phone_number, pp.date_of_birth
-- order by u.created_at desc;
