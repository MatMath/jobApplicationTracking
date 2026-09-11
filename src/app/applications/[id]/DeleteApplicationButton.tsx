'use client';

import { useFormStatus } from 'react-dom';
import { deleteApplication } from '../actions';

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded border border-red-500/40 px-3 py-2 text-sm text-red-600 hover:bg-red-500/10 disabled:opacity-50 dark:text-red-400"
    >
      {pending ? 'Deleting…' : 'Delete application'}
    </button>
  );
}

export function DeleteApplicationButton({
  id,
  label,
}: {
  id: string;
  label: string;
}) {
  return (
    <form
      action={deleteApplication}
      onSubmit={(e) => {
        // Irreversible and takes every interview round with it, so it earns a
        // confirmation; nothing else on the page does.
        if (!window.confirm(`Delete "${label}" and all of its interview rounds and notes? This cannot be undone.`)) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={id} />
      <Submit />
    </form>
  );
}
