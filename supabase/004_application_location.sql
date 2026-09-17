-- Office location on an application: the address as written, Google's id for it,
-- and the coordinates the dashboard map plots. Safe to re-run.
--
-- On `applications` rather than `companies` (which has had unused lat/lng since
-- day one) because one employer has several offices, and the map answers "where
-- are the jobs I applied to", not "where are the companies".
--
-- Nullable on purpose. A fully remote role has no office, an older row was
-- entered before this existed, and a posting whose address Google cannot resolve
-- still keeps its text. The requirement that non-remote roles carry a location
-- is enforced in the application layer, where it can be explained to whoever
-- tripped it; a NOT NULL here would reject every historical row instead.

alter table public.applications
  add column if not exists location_place_id text,
  add column if not exists location_lat      double precision,
  add column if not exists location_lng      double precision;

-- Partial: the map only ever asks for rows that have coordinates, and skipping
-- the nulls keeps the index the size of the answer rather than the table.
create index if not exists applications_user_located_idx
  on public.applications (user_id, location_lat)
  where location_lat is not null;
