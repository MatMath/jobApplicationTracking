'use client';

import { useActionState } from 'react';
import {
  APPLICATION_TYPE_LABELS,
  COMMON_PLATFORMS,
  OUTCOME_LABELS,
  REMOTE_LABELS,
  STATUS_LABELS,
  type ApplicationRow,
} from '@/lib/types';
import type { FormState } from './actions';
import { toDateInput } from '@/lib/date';

const initialState: FormState = { error: null };

const field =
  'w-full rounded border border-black/20 bg-transparent px-3 py-2 text-sm dark:border-white/20';

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

export type ApplicationFormValues = Partial<ApplicationRow> & {
  company?: string;
  company_website?: string | null;
};

export function ApplicationForm({
  action,
  values,
  today,
  submitLabel,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  values?: ApplicationFormValues;
  /** Computed on the server so the default date cannot drift on hydration. */
  today: string;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const v = values ?? {};
  const isEdit = Boolean(v.id);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {isEdit ? <input type="hidden" name="id" value={v.id} /> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Company *">
          <input name="company" required defaultValue={v.company ?? ''} className={field} />
        </Field>
        <Field label="Company website">
          {/* Drives the logo lookup: a domain resolves far more reliably than a name. */}
          <input
            name="company_website"
            placeholder="shopify.com"
            defaultValue={v.company_website ?? ''}
            className={field}
          />
        </Field>
      </div>

      <Field label="Role *">
        <input name="role" required defaultValue={v.role ?? ''} className={field} />
      </Field>

      <Field label="Job posting URL">
        <input name="job_url" type="url" defaultValue={v.job_url ?? ''} className={field} />
      </Field>

      <Field label="Job description">
        <textarea name="description" rows={4} defaultValue={v.description ?? ''} className={field} />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Found on">
          <input name="platform_found" list="platforms" defaultValue={v.platform_found ?? ''} className={field} />
        </Field>
        <Field label="Applied through">
          <input name="platform_applied" list="platforms" defaultValue={v.platform_applied ?? ''} className={field} />
        </Field>
      </div>
      <datalist id="platforms">
        {COMMON_PLATFORMS.map((p) => (
          <option key={p} value={p} />
        ))}
      </datalist>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Sourcing">
          <select name="application_type" defaultValue={v.application_type ?? ''} className={field}>
            <option value="">—</option>
            {Object.entries(APPLICATION_TYPE_LABELS).map(([val, l]) => (
              <option key={val} value={val}>{l}</option>
            ))}
          </select>
        </Field>
        <Field label="Location">
          <input name="location" defaultValue={v.location ?? ''} className={field} />
        </Field>
        <Field label="Arrangement">
          <select name="remote_type" defaultValue={v.remote_type ?? ''} className={field}>
            <option value="">—</option>
            {Object.entries(REMOTE_LABELS).map(([val, l]) => (
              <option key={val} value={val}>{l}</option>
            ))}
          </select>
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Salary min">
          <input name="salary_min" type="number" min={0} defaultValue={v.salary_min ?? ''} className={field} />
        </Field>
        <Field label="Salary max">
          <input name="salary_max" type="number" min={0} defaultValue={v.salary_max ?? ''} className={field} />
        </Field>
        <Field label="Date applied">
          {/* Defaults to today; almost always right, and one click to change. */}
          <input
            name="applied_at"
            type="date"
            defaultValue={toDateInput(v.applied_at as string | undefined) ?? today}
            className={field}
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Status">
          <select name="status" defaultValue={v.status ?? 'applied'} className={field}>
            {Object.entries(STATUS_LABELS).map(([val, l]) => (
              <option key={val} value={val}>{l}</option>
            ))}
          </select>
        </Field>
        {isEdit ? (
          <Field label="Outcome">
            <select name="outcome" defaultValue={v.outcome ?? ''} className={field}>
              <option value="">—</option>
              {Object.entries(OUTCOME_LABELS).map(([val, l]) => (
                <option key={val} value={val}>{l}</option>
              ))}
            </select>
          </Field>
        ) : null}
      </div>

      {isEdit ? (
        <Field label="Rejection reason">
          <input name="rejection_reason" defaultValue={v.rejection_reason ?? ''} className={field} />
        </Field>
      ) : null}

      {state.error ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {state.error}
        </p>
      ) : null}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-50 dark:bg-white dark:text-black"
        >
          {pending ? 'Saving…' : submitLabel}
        </button>
        {isEdit && state.error === null && !pending ? (
          <span aria-live="polite" className="text-xs opacity-50">
            Changes are saved when you press Save.
          </span>
        ) : null}
      </div>
    </form>
  );
}
