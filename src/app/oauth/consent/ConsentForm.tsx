'use client';

import { useActionState } from 'react';
import { approveConsent, denyConsent, type ConsentState } from './actions';

const initialState: ConsentState = { error: null };

/**
 * Two forms rather than one with two submit buttons: each decision is its own
 * action with its own pending state, so neither button can be pressed while the
 * other is mid-flight.
 */
export function ConsentForm({ authorizationId }: { authorizationId: string }) {
  const [approveState, approve, approving] = useActionState(approveConsent, initialState);
  const [denyState, deny, denying] = useActionState(denyConsent, initialState);
  const busy = approving || denying;
  const error = approveState.error ?? denyState.error;

  return (
    <div className="mt-6 flex flex-col gap-3">
      {error ? (
        <p
          role="alert"
          className="rounded border border-red-500/40 bg-red-500/5 px-3 py-2 text-sm text-red-600 dark:text-red-400"
        >
          {error}
        </p>
      ) : null}

      <div className="flex gap-3">
        <form action={approve} className="flex-1">
          <input type="hidden" name="authorization_id" value={authorizationId} />
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded bg-black px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
          >
            {approving ? 'Connecting…' : 'Allow access'}
          </button>
        </form>

        <form action={deny} className="flex-1">
          <input type="hidden" name="authorization_id" value={authorizationId} />
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded border border-black/20 px-4 py-2.5 text-sm disabled:opacity-50 dark:border-white/20"
          >
            {denying ? 'Cancelling…' : 'Deny'}
          </button>
        </form>
      </div>
    </div>
  );
}
