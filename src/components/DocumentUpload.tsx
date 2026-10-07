'use client';

import { useActionState, useRef, useState } from 'react';
import { DOCUMENT_TYPES } from '@/db/schema';
import {
  ALLOWED_EXTENSIONS,
  ALLOWED_SUMMARY,
  MAX_DOCUMENT_BYTES,
  extensionOf,
  formatBytes,
  tooLargeMessage,
} from '@/lib/documents/files';
import { DOCUMENT_TYPE_LABELS } from '@/lib/types';
import { uploadDocument, type DocumentFormState } from '@/app/settings/documents/actions';

const initialState: DocumentFormState = { error: null, notice: null };
const field =
  'w-full rounded border border-black/20 bg-transparent px-3 py-2 text-sm dark:border-white/20';

const ACCEPT = ALLOWED_EXTENSIONS.map((e) => `.${e}`).join(',');
const ALLOWED = new Set(ALLOWED_EXTENSIONS);

/**
 * Checked in the browser so that picking a 40 MB screen recording says so
 * immediately instead of after uploading it. This is a courtesy, not the rule:
 * the server checks the same things against the real bytes, and the bucket
 * checks them again.
 */
function problemWith(file: File): string | null {
  const extension = extensionOf(file.name);
  if (!ALLOWED.has(extension)) {
    return `${extension ? `.${extension} files are` : 'That file is'} not accepted. Upload ${ALLOWED_SUMMARY}.`;
  }
  if (file.size > MAX_DOCUMENT_BYTES) {
    return tooLargeMessage(file.name, file.size);
  }
  return null;
}

export type RoundOption = { id: string; label: string };

/**
 * The upload form, shared by the library and by an application's documents.
 * Given an `applicationId` the file is attached to it in the same step, and may
 * be filed under one of its interview rounds.
 */
export function DocumentUpload({
  applicationId,
  rounds = [],
  defaultType = 'resume',
}: {
  applicationId?: string;
  rounds?: RoundOption[];
  defaultType?: (typeof DOCUMENT_TYPES)[number];
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [type, setType] = useState<string>(defaultType);
  const [localError, setLocalError] = useState<string | null>(null);

  const [state, formAction, pending] = useActionState(
    async (prev: DocumentFormState, formData: FormData) => {
      const result = await uploadDocument(prev, formData);
      if (!result.error) formRef.current?.reset();
      return result;
    },
    initialState,
  );

  const error = localError ?? state.error;

  return (
    <form
      ref={formRef}
      action={formAction}
      onSubmit={(e) => {
        const file = new FormData(e.currentTarget).get('file');
        const problem = file instanceof File && file.size > 0 ? problemWith(file) : null;
        setLocalError(problem);
        if (problem) e.preventDefault();
      }}
      className="flex flex-col gap-3 rounded border border-dashed border-black/20 p-4 dark:border-white/20"
    >
      {applicationId ? <input type="hidden" name="application_id" value={applicationId} /> : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="opacity-70">File</span>
          <input
            name="file"
            type="file"
            required
            accept={ACCEPT}
            onChange={(e) => {
              const file = e.currentTarget.files?.[0];
              setLocalError(file ? problemWith(file) : null);
            }}
            className={`${field} file:mr-3 file:rounded file:border-0 file:bg-black/5 file:px-2 file:py-1 file:text-xs dark:file:bg-white/10`}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="opacity-70">What is it</span>
          <select
            name="type"
            className={field}
            value={type}
            onChange={(e) => setType(e.currentTarget.value)}
          >
            {DOCUMENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {DOCUMENT_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </label>
      </div>

      {rounds.length > 0 ? (
        <label className="flex flex-col gap-1 text-sm">
          <span className="opacity-70">Interview round (optional)</span>
          <select name="meeting_id" className={field} defaultValue="">
            <option value="">Not tied to a round</option>
            {rounds.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {!applicationId && type === 'resume' ? (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="make_default_resume" />
          <span className="opacity-70">
            Make this my default résumé, attached to new applications
          </span>
        </label>
      ) : null}

      <p className="text-xs opacity-50">
        {formatBytes(MAX_DOCUMENT_BYTES)} per file. PDF, Word, OpenDocument, RTF, or plain
        text and source code. No images, audio, video or archives.
      </p>

      {error ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}
      {!error && state.notice ? (
        <p role="status" className="text-sm opacity-70">
          {state.notice}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending || localError !== null}
        className="self-start rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-50 dark:bg-white dark:text-black"
      >
        {pending ? 'Uploading…' : applicationId ? 'Upload and attach' : 'Upload'}
      </button>
    </form>
  );
}
