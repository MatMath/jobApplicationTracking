import type { Route } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ConsentForm } from './ConsentForm';

/**
 * The consent screen for Supabase Auth's OAuth 2.1 server, which redirects here
 * (the project's configured authorization path) with an authorization_id.
 *
 * This page is the whole access-control story for the MCP endpoint. Dynamic
 * client registration is open, so any client can ask; nothing is granted until
 * someone signed in clicks Allow here. That is why the client's name and its
 * redirect URI are shown plainly rather than prettified away — the redirect URI
 * is the only thing that distinguishes Claude from something merely calling
 * itself Claude.
 *
 * Not in middleware.ts's PUBLIC_PATHS on purpose: a signed-out visitor must be
 * bounced to /login and returned here with the authorization_id intact.
 */

export const dynamic = 'force-dynamic';

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center p-8">
      {children}
    </main>
  );
}

export default async function ConsentPage({
  searchParams,
}: {
  searchParams: Promise<{ authorization_id?: string }>;
}) {
  const { authorization_id: authorizationId } = await searchParams;

  if (!authorizationId) {
    return (
      <Shell>
        <h1 className="text-xl font-semibold">Nothing to authorize</h1>
        <p className="mt-2 text-sm opacity-70">
          This page is the approval step for connecting an app to your tracker.
          Start the connection from that app.
        </p>
        <Link href="/applications" className="mt-4 text-sm underline opacity-70">
          Back to applications
        </Link>
      </Shell>
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.oauth.getAuthorizationDetails(authorizationId);

  if (error || !data) {
    return (
      <Shell>
        <h1 className="text-xl font-semibold">This request has expired</h1>
        <p className="mt-2 text-sm opacity-70">
          Authorization requests are only valid for a few minutes. Start the
          connection again from the app you were connecting.
        </p>
        <Link href="/applications" className="mt-4 text-sm underline opacity-70">
          Back to applications
        </Link>
      </Shell>
    );
  }

  // Already consented to these scopes: Supabase returns the redirect instead of
  // details, and asking again would be noise.
  if (!('authorization_id' in data)) redirect(data.redirect_url as Route);

  const scopes = data.scope.split(' ').filter(Boolean);

  return (
    <Shell>
      <h1 className="text-xl font-semibold">
        Connect {data.client.name} to your tracker?
      </h1>
      <p className="mt-2 text-sm opacity-70">
        Signed in as {data.user.email}.
      </p>

      <dl className="mt-6 flex flex-col gap-3 rounded border border-black/15 p-4 text-sm dark:border-white/15">
        <div className="flex flex-col gap-0.5">
          <dt className="text-xs uppercase tracking-wide opacity-50">Returns to</dt>
          <dd className="break-all font-mono text-xs">{data.redirect_uri}</dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="text-xs uppercase tracking-wide opacity-50">Requesting</dt>
          <dd>{scopes.length > 0 ? scopes.join(', ') : 'Access to your account'}</dd>
        </div>
      </dl>

      <p className="mt-4 text-sm opacity-70">
        It will be able to read and add job applications, notes and interview
        rounds on your behalf. Only allow this if you started the connection and
        recognise the address above.
      </p>

      <ConsentForm authorizationId={authorizationId} />

      <p className="mt-6 text-xs opacity-50">
        You can revoke this at any time from{' '}
        <Link href="/settings/connections" className="underline">
          connected apps
        </Link>
        .
      </p>
    </Shell>
  );
}
