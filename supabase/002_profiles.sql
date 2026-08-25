-- Incremental migration: user provisioning for SSO sign-in.
-- Run in the Supabase SQL editor. Safe to re-run.
--
-- bootstrap.sql carries the same statements for a fresh project; this file
-- exists for the database that was already provisioned before SSO was added.

create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text,
  full_name   text,
  avatar_url  text,
  created_at  timestamptz not null default now()
);

alter table public.profiles enable row level security;
drop policy if exists self_all on public.profiles;
create policy self_all on public.profiles for all to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Provisioning. Runs inside the same transaction that creates the auth user, so
-- a signed-in user always has a profile — there is no window where the app sees
-- a session without one.
--
-- security definer: the caller during signup is the auth system, which has no
-- rights on public.profiles. search_path is pinned empty and every name below is
-- schema-qualified, so a definer function cannot be hijacked by a caller-set
-- search_path.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    -- Google returns full_name; name is the fallback for other providers.
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill anyone who signed up before this migration.
insert into public.profiles (id, email, full_name, avatar_url)
select u.id,
       u.email,
       coalesce(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name'),
       coalesce(u.raw_user_meta_data ->> 'avatar_url', u.raw_user_meta_data ->> 'picture')
from auth.users u
on conflict (id) do nothing;
