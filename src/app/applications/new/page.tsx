'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { createApplication, type FormState } from '../actions';
import {
  APPLICATION_TYPE_LABELS,
  COMMON_PLATFORMS,
  REMOTE_LABELS,
  STATUS_LABELS,
} from '@/lib/types';

const initial: FormState = { error: null };

const field =
  'rounded border border-black/20 px-3 py-2 text-sm dark:border-white/20 bg-transparent';

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="opacity-70">{label}</span>
      {children}
    </label>
  );
}

export default function NewApplicationPage() {
  const [state, formAction, pending] = useActionState(
    createApplication,
    initial,
  );

  return (
    <main className="mx-auto max-w-2xl p-8">
      <Link href="/applications" className="text-sm underline opacity-60">
        ← Applications
      </Link>
      <h1 className="mt-3 text-2xl font-semibold">Add application</h1>

      <form action={formAction} className="mt-6 flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Company *">
            <input name="company" required className={field} />
          </Field>
          <Field label="Role *">
            <input name="role" required className={field} />
          </Field>
        </div>

        <Field label="Job posting URL">
          <input name="job_url" type="url" className={field} />
        </Field>

        <Field label="Job description">
          {/* Kept because postings get taken down and the URL stops resolving. */}
          <textarea name="description" rows={4} className={field} />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Found on">
            <input name="platform_found" list="platforms" className={field} />
          </Field>
          <Field label="Applied through">
            <input name="platform_applied" list="platforms" className={field} />
          </Field>
        </div>
        <datalist id="platforms">
          {COMMON_PLATFORMS.map((p) => (
            <option key={p} value={p} />
          ))}
        </datalist>

        <div className="grid grid-cols-3 gap-4">
          <Field label="Sourcing">
            <select name="application_type" className={field} defaultValue="">
              <option value="">—</option>
              {Object.entries(APPLICATION_TYPE_LABELS).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Location">
            <input name="location" className={field} />
          </Field>
          <Field label="Arrangement">
            <select name="remote_type" className={field} defaultValue="">
              <option value="">—</option>
              {Object.entries(REMOTE_LABELS).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <Field label="Salary min">
            <input name="salary_min" type="number" min={0} className={field} />
          </Field>
          <Field label="Salary max">
            <input name="salary_max" type="number" min={0} className={field} />
          </Field>
          <Field label="Status">
            <select name="status" className={field} defaultValue="applied">
              {Object.entries(STATUS_LABELS).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="Date applied">
          <input name="applied_at" type="date" className={field} />
        </Field>

        {state.error ? (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {state.error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={pending}
          className="mt-2 self-start rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-50 dark:bg-white dark:text-black"
        >
          {pending ? 'Saving…' : 'Save application'}
        </button>
      </form>
    </main>
  );
}
