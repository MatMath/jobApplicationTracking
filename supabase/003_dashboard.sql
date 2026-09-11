-- Dashboard aggregation. Run in the Supabase SQL editor. Safe to re-run.
--
-- One function, one round trip, all GROUP BY work in Postgres.
--
-- security invoker is the point: the function runs as the calling user, so RLS
-- scopes every table it touches to that user's rows. No user predicate is
-- written here and none is needed - and the app never needs a DATABASE_URL at
-- runtime, which would connect as table owner and bypass RLS entirely.
--
-- p_tz buckets weeks in the caller's timezone rather than the database's UTC,
-- so an application sent on a Sunday evening in Montreal lands in that week.

create or replace function public.dashboard_stats(p_tz text default 'UTC')
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
with apps as (
  -- Wishlist entries were never sent, so they are excluded from every rate.
  select a.*,
         -- first_response_at is the explicit signal; status is the fallback for
         -- rows created directly past 'applied'. A rejection is a response.
         (a.first_response_at is not null
          or a.status in ('phone_screen', 'interview', 'offer', 'rejected')) as responded
  from public.applications a
  where a.status <> 'wishlist'
),
totals as (
  select count(*)::int                                                   as applied,
         count(*) filter (where responded)::int                          as responded,
         count(*) filter (where status in ('applied', 'phone_screen',
                                           'interview', 'offer'))::int   as active,
         count(*) filter (where status = 'offer'
                          or outcome in ('accepted', 'declined'))::int   as offers
  from apps
),
weeks as (
  select gs::date as week_start
  from generate_series(
         date_trunc('week', now() at time zone p_tz) - interval '11 weeks',
         date_trunc('week', now() at time zone p_tz),
         interval '1 week') as gs
),
weekly as (
  select w.week_start,
         count(a.id)::int as applications
  from weeks w
  left join apps a
    on date_trunc('week', a.applied_at at time zone p_tz)::date = w.week_start
  group by w.week_start
),
by_platform as (
  -- Where the application was submitted, falling back to where it was found:
  -- the old system's /analytic/website grouped the same way.
  select coalesce(nullif(platform_applied, ''), nullif(platform_found, ''), 'Unknown') as platform,
         count(*)::int                         as applied,
         count(*) filter (where responded)::int as responded
  from apps
  group by 1
),
by_type as (
  select coalesce(application_type, 'unspecified') as application_type,
         count(*)::int                              as applied,
         count(*) filter (where responded)::int     as responded,
         count(*) filter (
           where status in ('interview', 'offer')
              or exists (select 1 from public.meetings m where m.application_id = apps.id)
         )::int                                     as interviewed
  from apps
  group by 1
),
rounds as (
  select count(*)::int                             as applications_with_rounds,
         coalesce(round(avg(n)::numeric, 1), 0)    as avg_rounds
  from (select application_id, count(*) as n
        from public.meetings
        group by application_id) per_app
)
select jsonb_build_object(
  'totals',      (select to_jsonb(t) from totals t),
  'weekly',      coalesce((select jsonb_agg(to_jsonb(w) order by w.week_start) from weekly w), '[]'::jsonb),
  'by_platform', coalesce((select jsonb_agg(to_jsonb(p) order by p.applied desc, p.platform) from by_platform p), '[]'::jsonb),
  'by_type',     coalesce((select jsonb_agg(to_jsonb(b) order by b.application_type) from by_type b), '[]'::jsonb),
  'rounds',      (select to_jsonb(r) from rounds r)
);
$$;

-- Supabase grants EXECUTE on new public functions to anon by default. RLS would
-- return an empty dashboard to anon anyway; revoking makes that explicit.
revoke all on function public.dashboard_stats(text) from public, anon;
grant execute on function public.dashboard_stats(text) to authenticated;
