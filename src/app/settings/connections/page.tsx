import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { formatDate } from '@/lib/date';
import { revokeConnection } from './actions';

/**
 * The apps allowed to reach this account through the MCP endpoint, and the way
 * to cut one off. The consent screen is where access is granted; without a
 * matching page to see and revoke it, a grant made once would be invisible
 * afterwards.
 */

export const dynamic = 'force-dynamic';

export default async function ConnectionsPage() {
  const supabase = await createClient();
  const { data: grants, error } = await supabase.auth.oauth.listGrants();

  return (
    <main className="mx-auto max-w-2xl p-6">
      <Link href="/applications" className="text-sm underline opacity-60">
        Back to applications
      </Link>

      <h1 className="mt-6 text-2xl font-semibold">Connected apps</h1>
      <p className="mt-1 text-sm opacity-60">
        Apps you have allowed to read and add job applications on your behalf,
        through this tracker&apos;s MCP endpoint.
      </p>

      {error ? (
        <p
          role="alert"
          className="mt-6 rounded border border-red-500/40 bg-red-500/5 px-3 py-2 text-sm text-red-600 dark:text-red-400"
        >
          Could not load connected apps: {error.message}
        </p>
      ) : null}

      {!error && (!grants || grants.length === 0) ? (
        <p className="mt-6 rounded border border-black/15 p-4 text-sm opacity-70 dark:border-white/15">
          Nothing is connected yet. Add this tracker as a custom connector in
          Claude to get started.
        </p>
      ) : null}

      <ul className="mt-6 flex flex-col gap-3">
        {(grants ?? []).map((grant) => (
          <li
            key={grant.client.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded border border-black/15 p-4 dark:border-white/15"
          >
            <div>
              <p className="font-medium">{grant.client.name}</p>
              <p className="mt-0.5 text-xs opacity-60">
                Connected {formatDate(grant.granted_at)}
                {grant.scopes.length > 0 ? ` · ${grant.scopes.join(', ')}` : ''}
              </p>
            </div>
            <form action={revokeConnection}>
              <input type="hidden" name="client_id" value={grant.client.id} />
              <button className="rounded border border-black/20 px-3 py-1.5 text-sm dark:border-white/20">
                Revoke
              </button>
            </form>
          </li>
        ))}
      </ul>
    </main>
  );
}
