import Link from 'next/link';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { McpPrompt } from '@/components/McpCallout';
import { publicOrigin } from '@/lib/origin';
import { CompanyLogo } from '@/components/CompanyLogo';
import { AppNav } from '@/components/AppNav';
import {
  STATUS_LABELS,
  APPLICATION_TYPE_LABELS,
  type ApplicationWithCompany,
} from '@/lib/types';

export const dynamic = 'force-dynamic';

function formatSalary(app: ApplicationWithCompany): string | null {
  const min = app.salary_min;
  const max = app.salary_max;
  if (min === null && max === null) return null;
  const fmt = (n: number) => `${Math.round(n / 1000)}k`;
  if (min !== null && max !== null) return `${fmt(min)}–${fmt(max)}`;
  return fmt((min ?? max)!);
}

/** Pseudo-filter for everything still alive: the view you usually want. */
const ACTIVE = new Set(['applied', 'phone_screen', 'interview', 'offer']);

function StatusFilter({
  current,
  counts,
  total,
  activeCount,
}: {
  current: string | null;
  counts: Record<string, number>;
  total: number;
  activeCount: number;
}) {
  const chip = (key: string | null, label: string, n: number) => {
    const selected = current === key;
    return (
      <Link
        key={key ?? 'all'}
        href={key ? { pathname: '/applications', query: { status: key } } : '/applications'}
        aria-current={selected ? 'true' : undefined}
        className={`rounded-full border px-3 py-1 text-xs ${
          selected
            ? 'border-transparent bg-black text-white dark:bg-white dark:text-black'
            : 'border-black/15 opacity-70 hover:opacity-100 dark:border-white/15'
        }`}
      >
        {label} <span className="tabular-nums opacity-60">{n}</span>
      </Link>
    );
  };

  return (
    <nav aria-label="Filter by status" className="mt-6 flex flex-wrap gap-2">
      {chip(null, 'All', total)}
      {chip('active', 'Active', activeCount)}
      {/* Only statuses that have something in them; an empty chip is a dead end. */}
      {Object.entries(STATUS_LABELS)
        .filter(([key]) => counts[key])
        .map(([key, label]) => chip(key, label, counts[key]))}
    </nav>
  );
}

export default async function ApplicationsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status: requested } = await searchParams;
  // Ignore anything that is not a real filter rather than showing an empty list.
  const filter =
    requested && (requested === 'active' || Object.hasOwn(STATUS_LABELS, requested))
      ? requested
      : null;

  const supabase = await createClient();

  const { data, error } = await supabase
    .from('applications')
    .select('*, companies (id, name, website)')
    .order('created_at', { ascending: false });

  if (error) {
    return (
      <main className="mx-auto max-w-4xl p-8">
        <h1 className="text-2xl font-semibold">Applications</h1>
        <div className="mt-6 rounded border border-red-500/40 bg-red-500/5 p-4">
          <p className="text-sm font-medium text-red-600 dark:text-red-400">
            Could not load applications.
          </p>
          <p className="mt-1 font-mono text-xs opacity-70">{error.message}</p>
          <p className="mt-3 text-sm opacity-70">
            If the tables are missing, run{' '}
            <code className="font-mono">supabase/bootstrap.sql</code> in the
            Supabase SQL editor.
          </p>
        </div>
      </main>
    );
  }

  const all = (data ?? []) as unknown as ApplicationWithCompany[];

  // Only while nothing is connected. Failing closed on an error keeps a
  // transient auth hiccup from putting a stray banner on the list.
  const { data: grants } = await supabase.auth.oauth.listGrants();
  const showMcpPrompt = grants !== null && grants.length === 0;
  const origin = publicOrigin(await headers());

  // One personal pipeline is tens to hundreds of rows: fetch once, count and
  // filter in memory, and the chips always show true totals.
  const counts: Record<string, number> = {};
  for (const a of all) counts[a.status] = (counts[a.status] ?? 0) + 1;
  const activeCount = all.filter((a) => ACTIVE.has(a.status)).length;

  const applications = !filter
    ? all
    : filter === 'active'
      ? all.filter((a) => ACTIVE.has(a.status))
      : all.filter((a) => a.status === filter);

  return (
    <main className="mx-auto max-w-4xl p-8">
      <AppNav current="/applications" />
      {showMcpPrompt ? <McpPrompt origin={origin} /> : null}

      {all.length > 0 ? (
        <StatusFilter current={filter} counts={counts} total={all.length} activeCount={activeCount} />
      ) : null}

      {all.length === 0 ? (
        <p className="mt-8 text-sm opacity-60">
          Nothing tracked yet. Add your first application to get started.
        </p>
      ) : applications.length === 0 ? (
        <p className="mt-8 text-sm opacity-60">
          Nothing here right now.{' '}
          <Link href="/applications" className="underline">
            Show all
          </Link>
        </p>
      ) : (
        <ul className="mt-6 divide-y divide-black/10 dark:divide-white/10">
          {applications.map((app) => {
            const salary = formatSalary(app);
            return (
              <li key={app.id}>
                <Link
                  href={`/applications/${app.id}`}
                  className="flex items-start gap-3 rounded py-3 transition-colors hover:bg-black/5 dark:hover:bg-white/5"
                >
                  {app.companies ? (
                    <CompanyLogo company={app.companies} size={36} />
                  ) : null}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-4">
                      <div className="truncate">
                        <span className="font-medium">{app.role}</span>
                        <span className="opacity-60"> · {app.companies?.name}</span>
                      </div>
                      <span className="shrink-0 rounded bg-black/5 px-2 py-0.5 text-xs dark:bg-white/10">
                        {STATUS_LABELS[app.status] ?? app.status}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-3 text-xs opacity-60">
                      {app.location ? <span>{app.location}</span> : null}
                      {app.platform_found ? <span>{app.platform_found}</span> : null}
                      {app.application_type ? (
                        <span>{APPLICATION_TYPE_LABELS[app.application_type]}</span>
                      ) : null}
                      {salary ? <span>{salary}</span> : null}
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
