'use client';

import { useActionState, useRef, useState } from 'react';
import { addMeeting, deleteMeeting, type FormState } from '../actions';
import {
  MEETING_OUTCOME_LABELS,
  MEETING_PURPOSE_LABELS,
  type MeetingRow,
} from '@/lib/types';
import { formatDate } from '@/lib/date';

const initialState: FormState = { error: null };
const field =
  'w-full rounded border border-black/20 bg-transparent px-3 py-2 text-sm dark:border-white/20';

export function MeetingSection({
  applicationId,
  meetings,
}: {
  applicationId: string;
  meetings: MeetingRow[];
}) {
  const [open, setOpen] = useState(meetings.length === 0);
  const formRef = useRef<HTMLFormElement>(null);

  const [state, formAction, pending] = useActionState(
    async (prev: FormState, formData: FormData) => {
      const result = await addMeeting(prev, formData);
      if (!result.error) formRef.current?.reset();
      return result;
    },
    initialState,
  );

  return (
    <section className="mt-10">
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-semibold">
          Interview rounds{' '}
          <span className="text-sm font-normal opacity-50">
            ({meetings.length})
          </span>
        </h2>
        <button
          onClick={() => setOpen((o) => !o)}
          className="text-sm underline opacity-70"
        >
          {open ? 'Cancel' : 'Add round'}
        </button>
      </div>

      {meetings.length === 0 && !open ? (
        <p className="mt-3 text-sm opacity-60">No rounds recorded yet.</p>
      ) : null}

      <ol className="mt-4 flex flex-col gap-3">
        {meetings.map((m, i) => (
          <li
            key={m.id}
            className="rounded border border-black/10 p-4 dark:border-white/10"
          >
            <div className="flex items-baseline justify-between gap-4">
              <div className="text-sm font-medium">
                <span className="opacity-50">#{i + 1}</span>{' '}
                {m.purpose ? MEETING_PURPOSE_LABELS[m.purpose] ?? m.purpose : 'Round'}
                {m.scheduled_at ? (
                  <span className="font-normal opacity-60">
                    {' '}· {formatDate(m.scheduled_at as unknown as string)}
                  </span>
                ) : null}
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <span className="rounded bg-black/5 px-2 py-0.5 text-xs dark:bg-white/10">
                  {MEETING_OUTCOME_LABELS[m.outcome ?? 'pending']}
                </span>
                <form action={deleteMeeting}>
                  <input type="hidden" name="meeting_id" value={m.id} />
                  <input type="hidden" name="application_id" value={applicationId} />
                  <button className="text-xs underline opacity-50 hover:opacity-100">
                    Remove
                  </button>
                </form>
              </div>
            </div>

            {m.participants?.length ? (
              <p className="mt-2 text-xs opacity-70">
                With: {m.participants.join(', ')}
              </p>
            ) : null}
            {m.challenge ? (
              <p className="mt-2 text-sm">
                <span className="opacity-50">Challenge: </span>
                {m.challenge}
              </p>
            ) : null}
            {m.notes ? (
              <p className="mt-2 whitespace-pre-wrap text-sm opacity-80">{m.notes}</p>
            ) : null}
          </li>
        ))}
      </ol>

      {open ? (
        <form
          ref={formRef}
          action={formAction}
          className="mt-4 flex flex-col gap-3 rounded border border-dashed border-black/20 p-4 dark:border-white/20"
        >
          <input type="hidden" name="application_id" value={applicationId} />

          <div className="grid gap-3 sm:grid-cols-3">
            <label className="flex flex-col gap-1 text-sm">
              <span className="opacity-70">Date</span>
              <input name="scheduled_at" type="datetime-local" className={field} />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="opacity-70">Purpose</span>
              <select name="purpose" className={field} defaultValue="">
                <option value="">—</option>
                {Object.entries(MEETING_PURPOSE_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="opacity-70">Outcome</span>
              <select name="outcome" className={field} defaultValue="pending">
                {Object.entries(MEETING_OUTCOME_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </label>
          </div>

          <label className="flex flex-col gap-1 text-sm">
            <span className="opacity-70">Participants</span>
            <input
              name="participants"
              placeholder="Comma separated — Jane Doe, Ali Khan"
              className={field}
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="opacity-70">Technical challenge</span>
            <input
              name="challenge"
              placeholder="Take-home, system design, live coding…"
              className={field}
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="opacity-70">Notes</span>
            <textarea name="notes" rows={3} className={field} />
          </label>

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
            {pending ? 'Saving…' : 'Add round'}
          </button>
        </form>
      ) : null}
    </section>
  );
}
