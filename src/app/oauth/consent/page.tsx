import type { Route } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { recognizeClient } from '@/lib/mcp/clients';
import { ConsentForm } from './ConsentForm';

/**
 * The consent screen for Supabase Auth's OAuth 2.1 server, which redirects here
 * (the project's configured authorization path) with an authorization_id.
 *
 * This page is the whole access-control story for the MCP endpoint. With
 * dynamic client registration on, any client can ask and any client can call
 * itself whatever it likes; nothing is granted until someone signed in clicks
 * Allow here. So the name is presented as a claim, and the redirect URI — the
 * one field an attacker cannot fake usefully, since it is where the code gets
 * delivered — is what the page actually vouches for. See lib/mcp/clients.ts.
 *
 * `logo_uri` is deliberately never rendered: it is client-supplied, and loading
 * it would let an unapproved stranger put an image of their choosing on this
 * page and learn when it was viewed.
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
  const client = recognizeClient(data.redirect_uri);

  return (
    <Shell>
      <h1 className="text-xl font-semibold">
        Connect {data.client.name} to your tracker?
      </h1>
      <p className="mt-2 text-sm opacity-70">
        Signed in as {data.user.email}.
      </p>

      {client.known ? (
        <p className="mt-4 rounded border border-black/15 px-3 py-2 text-sm dark:border-white/15">
          This request will return to <strong>{client.label}</strong> at{' '}
          <span className="font-mono text-xs">{client.host}</span>.
        </p>
      ) : (
        <p
          role="alert"
          className="mt-4 rounded border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-sm text-amber-700 dark:text-amber-400"
        >
          <strong>Unrecognised app.</strong> It calls itself
          &ldquo;{data.client.name}&rdquo;, but any app can pick any name. Access
          would be handed to{' '}
          <span className="break-all font-mono text-xs">{client.host}</span>
          {client.insecure ? ', over an unencrypted connection' : ''}. Only
          continue if you started this and that address is what you expect.
        </p>
      )}

      <dl className="mt-4 flex flex-col gap-3 rounded border border-black/15 p-4 text-sm dark:border-white/15">
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
        rounds on your behalf.
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
