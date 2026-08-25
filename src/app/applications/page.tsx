import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
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

export default async function ApplicationsPage() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('applications')
    .select('*, companies (id, name)')
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

  const applications = (data ?? []) as unknown as ApplicationWithCompany[];

  return (
    <main className="mx-auto max-w-4xl p-8">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold">Applications</h1>
        <Link
          href="/applications/new"
          className="rounded bg-black px-3 py-2 text-sm text-white dark:bg-white dark:text-black"
        >
          Add application
        </Link>
      </div>

      {applications.length === 0 ? (
        <p className="mt-8 text-sm opacity-60">
          Nothing tracked yet. Add your first application to get started.
        </p>
      ) : (
        <ul className="mt-6 divide-y divide-black/10 dark:divide-white/10">
          {applications.map((app) => {
            const salary = formatSalary(app);
            return (
              <li key={app.id} className="py-3">
                <div className="flex items-baseline justify-between gap-4">
                  <div>
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
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
