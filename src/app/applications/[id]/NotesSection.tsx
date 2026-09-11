'use client';

import { useActionState, useRef } from 'react';
import { addNote, deleteNote, type FormState } from '../actions';

const initialState: FormState = { error: null };

export type NoteRow = { id: string; content: string; created_at: string };

function formatTimestamp(value: string): string {
  return new Date(value).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/**
 * Free-form, timestamped log for anything that is not an interview round:
 * a recruiter's follow-up, a salary conversation, a gut feeling. Newest first,
 * since the latest note is the one you came to read.
 */
export function NotesSection({
  applicationId,
  notes,
}: {
  applicationId: string;
  notes: NoteRow[];
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState(
    async (prev: FormState, formData: FormData) => {
      const result = await addNote(prev, formData);
      if (!result.error) formRef.current?.reset();
      return result;
    },
    initialState,
  );

  return (
    <section className="mt-10">
      <h2 className="text-lg font-semibold">
        Notes <span className="text-sm font-normal opacity-50">({notes.length})</span>
      </h2>

      <form ref={formRef} action={formAction} className="mt-4 flex flex-col gap-2">
        <input type="hidden" name="application_id" value={applicationId} />
        <textarea
          name="content"
          rows={3}
          required
          placeholder="Recruiter followed up, salary discussed, next steps…"
          className="w-full rounded border border-black/20 bg-transparent px-3 py-2 text-sm dark:border-white/20"
        />
        {state.error ? (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {state.error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={pending}
          className="self-start rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-50 dark:bg-white dark:text-black"
        >
          {pending ? 'Saving…' : 'Add note'}
        </button>
      </form>

      {notes.length ? (
        <ul className="mt-4 flex flex-col gap-3">
          {notes.map((n) => (
            <li key={n.id} className="rounded border border-black/10 p-3 dark:border-white/10">
              <div className="flex items-baseline justify-between gap-4">
                <time dateTime={n.created_at} className="text-xs opacity-50">
                  {formatTimestamp(n.created_at)}
                </time>
                <form action={deleteNote}>
                  <input type="hidden" name="note_id" value={n.id} />
                  <input type="hidden" name="application_id" value={applicationId} />
                  <button className="text-xs underline opacity-50 hover:opacity-100">
                    Remove
                  </button>
                </form>
              </div>
              <p className="mt-1 whitespace-pre-wrap text-sm">{n.content}</p>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
