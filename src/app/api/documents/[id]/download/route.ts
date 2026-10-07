import { createClient, getUser } from '@/lib/supabase/server';
import { signedDownloadUrl } from '@/lib/documents/write';

/**
 * Downloads one document.
 *
 * The bucket is private, so there is no URL to put in a link. This checks the
 * caller, signs a link that lasts a minute, and redirects to it — the page can
 * then use an ordinary <a href>, and a link copied out of the page stops
 * working for anyone without a session here.
 *
 * Not in the middleware's public paths, on purpose: this is navigated to, not
 * fetched, so a signed-out visitor is better served by the sign-in redirect
 * than by a bare 401.
 */

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUser();
  if (!user) return new Response('Not signed in.', { status: 401 });

  const { id } = await params;
  const supabase = await createClient();
  const result = await signedDownloadUrl(supabase, user.id, id);

  // Another user's document and a missing one are the same answer: RLS returns
  // no row for either, and there is no reason to tell them apart.
  if (result.error !== null) return new Response('No such document.', { status: 404 });

  return new Response(null, {
    status: 302,
    headers: { Location: result.data.url, 'Cache-Control': 'no-store' },
  });
}
