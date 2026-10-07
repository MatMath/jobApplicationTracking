import Link from 'next/link';
import { DocumentUpload } from '@/components/DocumentUpload';
import { formatDate } from '@/lib/date';
import { formatBytes } from '@/lib/documents/files';
import { listDocuments } from '@/lib/documents/write';
import { createClient, getUser } from '@/lib/supabase/server';
import { DOCUMENT_TYPE_LABELS } from '@/lib/types';
import { deleteDocument, setDefaultResume } from './actions';

/**
 * The file library: every CV, cover letter, posting and assignment uploaded,
 * whether or not anything is attached to an application yet.
 *
 * This is where the generic CV is kept and named as the default. Files here
 * are never edited — a revised CV is uploaded as a new file and made the
 * default, and the applications that went out with the old one keep it.
 */

export const dynamic = 'force-dynamic';

const quiet = 'text-xs underline opacity-50 hover:opacity-100';

export default async function DocumentsPage() {
  const user = await getUser();
  const supabase = await createClient();
  const result = user ? await listDocuments(supabase, user.id) : null;
  const documents = result?.data ?? [];
  const hasDefault = documents.some((d) => d.is_default_resume);

  return (
    <main className="mx-auto max-w-2xl p-6">
      <Link href="/applications" className="text-sm underline opacity-60">
        Back to applications
      </Link>

      <h1 className="mt-6 text-2xl font-semibold">Documents</h1>
      <p className="mt-1 text-sm opacity-60">
        Your CVs, cover letters, saved postings and assignments. Attach them to an
        application from its page, so there is a record of exactly what was sent.
      </p>

      {result?.error ? (
        <p
          role="alert"
          className="mt-6 rounded border border-red-500/40 bg-red-500/5 px-3 py-2 text-sm text-red-600 dark:text-red-400"
        >
          Could not load documents: {result.error}
        </p>
      ) : null}

      <div className="mt-6">
        <DocumentUpload />
      </div>

      {!hasDefault ? (
        <p className="mt-6 rounded border border-black/15 px-4 py-3 text-sm opacity-70 dark:border-white/15">
          No default résumé yet. Upload your generic CV as a résumé and it will be
          attached to each application when you mark it applied.
        </p>
      ) : null}

      <ul className="mt-6 flex flex-col gap-3">
        {documents.map((d) => (
          <li
            key={d.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded border border-black/15 p-4 dark:border-white/15"
          >
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-2">
                <a
                  href={`/api/documents/${d.id}/download`}
                  className="break-all font-medium underline"
                >
                  {d.file_name}
                </a>
                {d.is_default_resume ? (
                  <span className="rounded bg-black/5 px-2 py-0.5 text-xs dark:bg-white/10">
                    Default résumé
                  </span>
                ) : null}
              </p>
              <p className="mt-0.5 text-xs opacity-60">
                {DOCUMENT_TYPE_LABELS[d.type] ?? d.type} · {formatBytes(d.size_bytes)} · uploaded{' '}
                {formatDate(d.uploaded_at)} ·{' '}
                {d.attached_to === 0
                  ? 'not attached to anything'
                  : `attached to ${d.attached_to} application${d.attached_to === 1 ? '' : 's'}`}
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-3">
              {d.type === 'resume' && !d.is_default_resume ? (
                <form action={setDefaultResume}>
                  <input type="hidden" name="document_id" value={d.id} />
                  <button className={quiet}>Make default</button>
                </form>
              ) : null}
              {/* Only offered when nothing cites the file: one that an application
                  records as sent has to be detached there first. */}
              {d.attached_to === 0 ? (
                <form action={deleteDocument}>
                  <input type="hidden" name="document_id" value={d.id} />
                  <button className={quiet}>Delete</button>
                </form>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
