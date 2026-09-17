import Link from 'next/link';
import { createClient, getUser } from '@/lib/supabase/server';
import { AppNav } from '@/components/AppNav';
import { rate, type DashboardStats } from '@/lib/dashboard';
import { placesConfigured } from '@/lib/geo/places';
import { loadOfficePins, type OfficePin } from '@/lib/geo/pins';
import { APPLICATION_TYPE_LABELS } from '@/lib/types';
import { PlatformChart, WeeklyChart } from './Charts';
import { OfficeMap } from './OfficeMap';

export const dynamic = 'force-dynamic';

function Tile({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded border border-black/10 p-4 dark:border-white/10">
      <div className="text-xs opacity-60">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
      {hint ? <div className="mt-1 text-xs opacity-50">{hint}</div> : null}
    </div>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="text-base font-semibold">{title}</h2>
      {subtitle ? <p className="text-xs opacity-60">{subtitle}</p> : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}

export default async function DashboardPage() {
  const supabase = await createClient();

  // Weeks are bucketed in the server's zone. Locally that is yours; in
  // production the deploy sets TZ so it stays yours rather than UTC.
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const user = await getUser();
  const [{ data, error }, pins] = await Promise.all([
    supabase.rpc('dashboard_stats', { p_tz: tz }),
    user ? loadOfficePins(supabase, user.id) : Promise.resolve<OfficePin[]>([]),
  ]);

  if (error || !data) {
    return (
      <main className="mx-auto max-w-4xl p-8">
        <AppNav current="/dashboard" />
        <div className="mt-8 rounded border border-red-500/40 bg-red-500/5 p-4 text-sm">
          <p className="font-medium text-red-600 dark:text-red-400">Could not load the dashboard.</p>
          <p className="mt-1 font-mono text-xs opacity-70">{error?.message}</p>
          <p className="mt-3 opacity-70">
            If the function is missing, run <code className="font-mono">supabase/003_dashboard.sql</code> in
            the Supabase SQL editor.
          </p>
        </div>
      </main>
    );
  }

  const s = data as DashboardStats;
  const { totals } = s;

  if (totals.applied === 0) {
    return (
      <main className="mx-auto max-w-4xl p-8">
        <AppNav current="/dashboard" />
        <p className="mt-10 text-sm opacity-60">
          Stats appear once you have sent an application. Wishlist entries are not counted.
        </p>
        <Link href="/applications/new" className="mt-4 inline-block text-sm underline">
          Add an application
        </Link>

        {/* Shown even here: a wishlist entry has an office before it has stats. */}
        {pins.length > 0 ? (
          <Section title="Where the jobs are" subtitle="Every application with an office address">
            <OfficeMap pins={pins} configured={placesConfigured()} />
          </Section>
        ) : null}
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl p-8">
      <AppNav current="/dashboard" />

      {/* The one number the page leads with. */}
      <section className="mt-10">
        <div className="text-sm opacity-60">Response rate</div>
        <div className="mt-1 text-5xl font-semibold">{rate(totals.responded, totals.applied)}</div>
        <p className="mt-2 text-sm opacity-60">
          {totals.responded} of {totals.applied} application{totals.applied === 1 ? '' : 's'} got a reply.
          Rejections count as replies.
        </p>
      </section>

      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile label="Applications sent" value={totals.applied} />
        <Tile label="Still in progress" value={totals.active} />
        <Tile label="Offers" value={totals.offers} />
        <Tile
          label="Avg interview rounds"
          value={s.rounds.applications_with_rounds ? s.rounds.avg_rounds : '—'}
          hint={
            s.rounds.applications_with_rounds
              ? `across ${s.rounds.applications_with_rounds} application${s.rounds.applications_with_rounds === 1 ? '' : 's'}`
              : 'no rounds recorded yet'
          }
        />
      </div>

      <Section title="Where the jobs are" subtitle="Every application with an office address">
        <OfficeMap pins={pins} configured={placesConfigured()} />
      </Section>

      <Section title="Applications per week" subtitle="Last 12 weeks, by date applied">
        <WeeklyChart data={s.weekly} />
      </Section>

      <Section title="Response rate by platform" subtitle="Where the application was submitted">
        {s.by_platform.length > 1 ? (
          <PlatformChart data={s.by_platform} />
        ) : (
          // A one-bar bar chart says nothing a sentence does not say better.
          <p className="text-sm">
            All applications so far went through{' '}
            <span className="font-medium">{s.by_platform[0]?.platform}</span>:{' '}
            {rate(s.by_platform[0]?.responded ?? 0, s.by_platform[0]?.applied ?? 0)} replied (
            {s.by_platform[0]?.responded} of {s.by_platform[0]?.applied}).
          </p>
        )}
      </Section>

      <Section title="Recruiter vs direct" subtitle="Two rows compare better as a table than as a chart">
        <table className="w-full max-w-xl border-collapse text-sm">
          <thead>
            <tr className="text-xs opacity-60">
              <th className="py-2 text-left font-medium">Sourcing</th>
              <th className="py-2 text-right font-medium">Sent</th>
              <th className="py-2 text-right font-medium">Replied</th>
              <th className="py-2 text-right font-medium">Reached interview</th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {s.by_type.map((t) => (
              <tr key={t.application_type} className="border-t border-black/10 dark:border-white/10">
                <td className="py-2">
                  {APPLICATION_TYPE_LABELS[t.application_type] ?? 'Not specified'}
                </td>
                <td className="py-2 text-right">{t.applied}</td>
                <td className="py-2 text-right">
                  {rate(t.responded, t.applied)} <span className="opacity-50">({t.responded})</span>
                </td>
                <td className="py-2 text-right">
                  {rate(t.interviewed, t.applied)} <span className="opacity-50">({t.interviewed})</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>
    </main>
  );
}
