-- Documents: a file library, attachments to applications, and the bucket the
-- bytes live in. Run in the Supabase SQL editor. Safe to re-run.
--
-- What this is for: knowing, months later, exactly which CV and cover letter
-- went to which company, and keeping the posting and any take-home assignment
-- next to the application they belong to.
--
-- The shape that makes that trustworthy is immutability. A file is uploaded
-- once and never edited; a revised CV is a new row. So "the CV attached to this
-- application" keeps meaning the file that was sent, without copying it per
-- application. Nothing below grants UPDATE on a file or on its row.

-- ---------------------------------------------------------------- documents
-- The table has existed since bootstrap.sql but nothing ever wrote to it (it
-- held 0 rows when this was written), so it is reshaped in place rather than
-- migrated: it stops belonging to one application and stops storing a URL.
-- If it somehow does hold rows, the NOT NULL additions below fail loudly, which
-- is the right outcome — there would be no storage path to give them.
alter table public.documents
  drop column if exists application_id,
  drop column if exists file_url;

alter table public.documents
  add column if not exists storage_path text not null,
  add column if not exists mime_type    text not null,
  add column if not exists size_bytes   integer not null,
  add column if not exists sha256       text not null;

update public.documents set type = 'other' where type is null;
alter table public.documents
  alter column type set default 'other',
  alter column type set not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'documents_storage_path_unique') then
    alter table public.documents
      add constraint documents_storage_path_unique unique (storage_path);
  end if;
  -- One row per distinct file per user. Uploading the same bytes again resolves
  -- to the row already there instead of storing a second copy.
  if not exists (select 1 from pg_constraint where conname = 'documents_user_sha256_unique') then
    alter table public.documents
      add constraint documents_user_sha256_unique unique (user_id, sha256);
  end if;
  -- The application layer enforces 1 MB too, and so does the bucket. This one
  -- is here because it is the only one of the three that cannot be bypassed by
  -- talking to a different API.
  if not exists (select 1 from pg_constraint where conname = 'documents_size_limit') then
    alter table public.documents
      add constraint documents_size_limit check (size_bytes > 0 and size_bytes <= 1048576);
  end if;
end $$;

create index if not exists documents_user_idx on public.documents (user_id);

-- Select, insert, delete — and no update. The bootstrap policy was a blanket
-- `for all`, which would let the owner repoint a row at a different file or
-- rewrite its hash through the REST API; with no UPDATE policy, RLS refuses.
alter table public.documents enable row level security;
drop policy if exists owner_all on public.documents;
drop policy if exists owner_select on public.documents;
drop policy if exists owner_insert on public.documents;
drop policy if exists owner_delete on public.documents;
create policy owner_select on public.documents for select to authenticated
  using (user_id = (select auth.uid()));
create policy owner_insert on public.documents for insert to authenticated
  with check (
    user_id = (select auth.uid())
    -- The row may only describe a file in the caller's own folder.
    and storage_path like (select auth.uid())::text || '/%'
  );
create policy owner_delete on public.documents for delete to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------- application_documents
-- document_id is RESTRICT: a file that an application records as "what I sent"
-- cannot be deleted while that record stands. application_id is CASCADE:
-- deleting an application removes its attachments, and leaves the files in the
-- library, since the CV among them is attached to other applications too.
create table if not exists public.application_documents (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  application_id  uuid not null references public.applications (id) on delete cascade,
  document_id     uuid not null references public.documents (id) on delete restrict,
  -- The interview round that set an assignment, when there was one.
  meeting_id      uuid references public.meetings (id) on delete set null,
  attached_at     timestamptz not null default now(),
  constraint application_documents_unique unique (application_id, document_id)
);
create index if not exists application_documents_application_idx on public.application_documents (application_id);
create index if not exists application_documents_document_idx on public.application_documents (document_id);

-- A foreign key proves the application and the document exist, not that they
-- are the caller's. The two `exists` do: each subquery runs under the caller's
-- own RLS, so another user's id simply finds nothing.
alter table public.application_documents enable row level security;
drop policy if exists owner_all on public.application_documents;
create policy owner_all on public.application_documents for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.applications a where a.id = application_id)
    and exists (select 1 from public.documents d where d.id = document_id)
  );

-- ------------------------------------------------------------ default résumé
-- The generic CV. On the profile rather than a flag on documents, so there is
-- exactly one and replacing it is one write. SET NULL: deleting the file leaves
-- the account without a default rather than blocking the delete.
alter table public.profiles
  add column if not exists default_resume_id uuid references public.documents (id) on delete set null;

-- ------------------------------------------------------------------- bucket
-- Private, 1 MB per file, and a closed list of content types. The app decides
-- a file's type itself from its extension and first bytes and uploads it under
-- one of these (source code goes up as text/plain), so the list is short.
-- Images, audio, video and archives are absent on purpose: this is a place for
-- CVs, letters, postings and take-home work, and the limits are what keep it
-- inside the free storage tier.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documents', 'documents', false, 1048576,
  array[
    'text/plain',
    'text/markdown',
    'text/csv',
    'application/pdf',
    'application/rtf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.oasis.opendocument.text'
  ]
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Objects are keyed `<user id>/<document id>.<ext>`, so the first path segment
-- is the owner and the policy needs nothing but the name. No UPDATE policy:
-- an object cannot be overwritten, which is the storage half of immutability.
drop policy if exists documents_owner_select on storage.objects;
drop policy if exists documents_owner_insert on storage.objects;
drop policy if exists documents_owner_delete on storage.objects;
create policy documents_owner_select on storage.objects for select to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy documents_owner_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'documents' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy documents_owner_delete on storage.objects for delete to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- PostgREST caches the schema; without this the new columns and the
-- application_documents relationship are invisible until its next reload.
notify pgrst, 'reload schema';
