import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { CompanyLogo } from '@/components/CompanyLogo';
import { ApplicationForm } from '../ApplicationForm';
import { updateApplication } from '../actions';
import { MeetingSection } from './MeetingSection';
import { DeleteApplicationButton } from './DeleteApplicationButton';
import { todayISO, formatDate } from '@/lib/date';
import { STATUS_LABELS, type MeetingRow } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function ApplicationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: application, error } = await supabase
    .from('applications')
    .select('*, companies (id, name, website)')
    .eq('id', id)
    .maybeSingle();

  // RLS means another user's row is indistinguishable from a missing one, which
  // is the behaviour we want: no existence oracle.
  if (error || !application) notFound();

  const [{ data: meetings }, { data: history }] = await Promise.all([
    supabase
      .from('meetings')
      .select('*')
      .eq('application_id', id)
      .order('scheduled_at', { ascending: true, nullsFirst: false }),
    supabase
      .from('status_history')
      .select('status, changed_at')
      .eq('application_id', id)
      .order('changed_at', { ascending: true }),
  ]);

  const company = application.companies as {
    id: string;
    name: string;
    website: string | null;
  } | null;

  return (
    <main className="mx-auto max-w-2xl p-8">
      <Link href="/applications" className="text-sm underline opacity-60">
        ← Applications
      </Link>

      <header className="mt-4 flex items-center gap-4">
        {company ? <CompanyLogo company={company} size={48} /> : null}
        <div>
          <h1 className="text-2xl font-semibold">{application.role}</h1>
          <p className="text-sm opacity-60">{company?.name}</p>
        </div>
      </header>

      <div className="mt-4 flex flex-wrap gap-2 text-xs">
        <span className="rounded bg-black/5 px-2 py-1 dark:bg-white/10">
          {STATUS_LABELS[application.status] ?? application.status}
        </span>
        {application.applied_at ? (
          <span className="rounded bg-black/5 px-2 py-1 dark:bg-white/10">
            Applied {formatDate(application.applied_at)}
          </span>
        ) : null}
        {application.first_response_at ? (
          <span className="rounded bg-black/5 px-2 py-1 dark:bg-white/10">
            First reply {formatDate(application.first_response_at)}
          </span>
        ) : null}
      </div>

      {history && history.length > 1 ? (
        <p className="mt-3 text-xs opacity-50">
          {history
            .map((h) => `${STATUS_LABELS[h.status] ?? h.status} ${formatDate(h.changed_at)}`)
            .join('  →  ')}
        </p>
      ) : null}

      <MeetingSection
        applicationId={id}
        meetings={(meetings ?? []) as unknown as MeetingRow[]}
      />

      <section className="mt-12">
        <h2 className="text-lg font-semibold">Details</h2>
        <div className="mt-4">
          <ApplicationForm
            action={updateApplication}
            today={todayISO()}
            submitLabel="Save changes"
            values={{
              ...application,
              company: company?.name ?? '',
              company_website: company?.website ?? '',
            }}
          />
        </div>
      </section>

      <section className="mt-12 border-t border-black/10 pt-6 dark:border-white/10">
        <DeleteApplicationButton
          id={id}
          label={`${application.role} at ${company?.name ?? 'this company'}`}
        />
      </section>
    </main>
  );
}
