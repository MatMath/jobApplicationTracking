import Link from 'next/link';
import { DocumentUpload, type RoundOption } from '@/components/DocumentUpload';
import { formatBytes } from '@/lib/documents/files';
import type { AttachedDocument, LibraryDocument } from '@/lib/documents/write';
import { DOCUMENT_TYPE_LABELS } from '@/lib/types';
import { attachDocument, detachDocument } from '@/app/settings/documents/actions';

const field =
  'w-full rounded border border-black/20 bg-transparent px-3 py-2 text-sm dark:border-white/20';

/**
 * What was sent with this application, and what came back: the CV, the cover
 * letter, the posting as a file, any assignment and its submission.
 *
 * A file is attached, not owned — the same CV appears on every application it
 * went out with. Detaching removes it from this application only; the file
 * itself is managed in the library.
 */
export function DocumentsSection({
  applicationId,
  attached,
  library,
  rounds,
}: {
  applicationId: string;
  attached: AttachedDocument[];
  library: LibraryDocument[];
  rounds: RoundOption[];
}) {
  const attachedIds = new Set(attached.map((d) => d.id));
  const available = library.filter((d) => !attachedIds.has(d.id));
  const roundLabel = new Map(rounds.map((r) => [r.id, r.label]));

  return (
    <section className="mt-10">
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-semibold">
          Documents{' '}
          <span className="text-sm font-normal opacity-50">({attached.length})</span>
        </h2>
        <Link href="/settings/documents" className="text-sm underline opacity-70">
          Library
        </Link>
      </div>

      {attached.length === 0 ? (
        <p className="mt-3 text-sm opacity-60">
          Nothing attached yet. Your default résumé is attached automatically when
          this is marked applied.
        </p>
      ) : (
        <ul className="mt-4 flex flex-col gap-3">
          {attached.map((d) => (
            <li
              key={d.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded border border-black/10 p-3 dark:border-white/10"
            >
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="rounded bg-black/5 px-2 py-0.5 text-xs dark:bg-white/10">
                    {DOCUMENT_TYPE_LABELS[d.type] ?? d.type}
                  </span>
                  <a href={`/api/documents/${d.id}/download`} className="break-all underline">
                    {d.file_name}
                  </a>
                </p>
                <p className="mt-1 text-xs opacity-50">
                  {formatBytes(d.size_bytes)}
                  {d.meeting_id && roundLabel.has(d.meeting_id)
                    ? ` · ${roundLabel.get(d.meeting_id)}`
                    : ''}
                </p>
              </div>
              <form action={detachDocument}>
                <input type="hidden" name="application_id" value={applicationId} />
                <input type="hidden" name="document_id" value={d.id} />
                <button className="text-xs underline opacity-50 hover:opacity-100">Detach</button>
              </form>
            </li>
          ))}
        </ul>
      )}

      {available.length > 0 ? (
        <form action={attachDocument} className="mt-4 flex flex-wrap items-end gap-3">
          <input type="hidden" name="application_id" value={applicationId} />
          <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
            <span className="opacity-70">Attach from your library</span>
            <select name="document_id" className={field} required defaultValue="">
              <option value="" disabled>
                Choose a file…
              </option>
              {available.map((d) => (
                <option key={d.id} value={d.id}>
                  {DOCUMENT_TYPE_LABELS[d.type] ?? d.type} — {d.file_name}
                  {d.is_default_resume ? ' (default)' : ''}
                </option>
              ))}
            </select>
          </label>
          {rounds.length > 0 ? (
            <label className="flex flex-col gap-1 text-sm">
              <span className="opacity-70">Round</span>
              <select name="meeting_id" className={field} defaultValue="">
                <option value="">—</option>
                {rounds.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <button className="rounded border border-black/20 px-4 py-2 text-sm dark:border-white/20">
            Attach
          </button>
        </form>
      ) : null}

      <div className="mt-4">
        <p className="mb-2 text-sm opacity-70">Or upload a new file</p>
        <DocumentUpload
          applicationId={applicationId}
          rounds={rounds}
          defaultType={attached.some((d) => d.type === 'resume') ? 'cover_letter' : 'resume'}
        />
      </div>
    </section>
  );
}
