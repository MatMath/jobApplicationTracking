-- Job Application Tracker — initial schema.
--
-- Run ONCE in the Supabase SQL editor (Dashboard -> SQL Editor -> New query).
-- Hand-written to mirror src/db/schema.ts, because drizzle-kit needs Node and
-- Node is not installed yet. Once it is, `npm run db:push` diffs this against
-- the schema file; a clean no-op result confirms the two agree.
--
-- Safe to re-run: every statement is guarded.

-- ---------------------------------------------------------------- companies
create table if not exists public.companies (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  name        text not null,
  location    text,
  lat         double precision,
  lng         double precision,
  website     text,
  notes       text,
  created_at  timestamptz not null default now(),
  constraint companies_user_name_unique unique (user_id, name)
);
create index if not exists companies_user_idx on public.companies (user_id);

-- ----------------------------------------------------------------- contacts
create table if not exists public.contacts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  name        text not null,
  kind        text default 'recruiter',
  agency      text,
  company_id  uuid references public.companies (id) on delete set null,
  email       text,
  phone       text,
  notes       text,
  created_at  timestamptz not null default now()
);
create index if not exists contacts_user_idx on public.contacts (user_id);

-- ------------------------------------------------------------- applications
create table if not exists public.applications (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users (id) on delete cascade,
  company_id        uuid not null references public.companies (id) on delete restrict,
  role              text not null,
  description       text,
  job_url           text,
  application_type  text,
  recruiter_id      uuid references public.contacts (id) on delete set null,
  platform_found    text,
  platform_applied  text,
  location          text,
  remote_type       text,
  salary_min        integer,
  salary_max        integer,
  salary_currency   text default 'CAD',
  cover_letter      text,
  status            text not null default 'wishlist',
  outcome           text,
  rejection_reason  text,
  applied_at        timestamptz,
  first_response_at timestamptz,
  closed_at         timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists applications_user_idx on public.applications (user_id);
create index if not exists applications_user_status_idx on public.applications (user_id, status);
create index if not exists applications_user_applied_idx on public.applications (user_id, applied_at);
create index if not exists applications_company_idx on public.applications (company_id);

-- ----------------------------------------------------------------- meetings
create table if not exists public.meetings (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  application_id  uuid not null references public.applications (id) on delete cascade,
  scheduled_at    timestamptz,
  purpose         text,
  participants    text[],
  challenge       text,
  outcome         text default 'pending',
  notes           text,
  created_at      timestamptz not null default now()
);
create index if not exists meetings_user_idx on public.meetings (user_id);
create index if not exists meetings_application_idx on public.meetings (application_id);

-- ----------------------------------------------------------- status_history
create table if not exists public.status_history (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  application_id  uuid not null references public.applications (id) on delete cascade,
  status          text not null,
  changed_at      timestamptz not null default now()
);
create index if not exists status_history_user_idx on public.status_history (user_id);
create index if not exists status_history_application_idx on public.status_history (application_id);

-- -------------------------------------------------------------------- notes
create table if not exists public.notes (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  application_id  uuid not null references public.applications (id) on delete cascade,
  content         text not null,
  created_at      timestamptz not null default now()
);
create index if not exists notes_application_idx on public.notes (application_id);

-- ---------------------------------------------------------------- documents
create table if not exists public.documents (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  application_id  uuid not null references public.applications (id) on delete cascade,
  file_name       text not null,
  file_url        text not null,
  type            text,
  uploaded_at     timestamptz not null default now()
);
create index if not exists documents_application_idx on public.documents (application_id);

-- ------------------------------------------------------- updated_at trigger
-- defaults only fire on insert; without this, updated_at never moves.
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists applications_touch_updated_at on public.applications;
create trigger applications_touch_updated_at
  before update on public.applications
  for each row execute function public.touch_updated_at();

-- ----------------------------------------------------------- Row Level Security
-- Without this, the publishable key would let any authenticated user read every
-- other user's rows. Each table carries user_id directly, so the check is one
-- indexed comparison rather than a join back through applications.
do $$
declare t text;
begin
  foreach t in array array[
    'companies', 'contacts', 'applications',
    'meetings', 'status_history', 'notes', 'documents'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists owner_all on public.%I', t);
    execute format(
      'create policy owner_all on public.%I for all to authenticated
         using (user_id = (select auth.uid()))
         with check (user_id = (select auth.uid()))', t);
  end loop;
end $$;
