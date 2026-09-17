'use server';

import type { Route } from 'next';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export type ConsentState = { error: string | null };

/**
 * The decision half of the consent screen.
 *
 * skipBrowserRedirect is set because these run on the server: the SDK's default
 * is to navigate the browser itself, which there is no browser to do. Supabase
 * hands back a redirect_url already carrying the authorization code (or the
 * access_denied error) and the client's state, and we send the user to it.
 */
async function decide(
  formData: FormData,
  choice: 'approve' | 'deny',
): Promise<ConsentState> {
  const authorizationId = String(formData.get('authorization_id') ?? '');
  if (!authorizationId) return { error: 'Missing authorization id.' };

  const supabase = await createClient();
  const { data, error } =
    choice === 'approve'
      ? await supabase.auth.oauth.approveAuthorization(authorizationId, {
          skipBrowserRedirect: true,
        })
      : await supabase.auth.oauth.denyAuthorization(authorizationId, {
          skipBrowserRedirect: true,
        });

  // Authorizations expire after ten minutes, and a stale one is the likeliest
  // failure here — say so rather than showing the raw API message.
  if (error || !data?.redirect_url) {
    return {
      error:
        'This authorization request is no longer valid. It may have expired — start the connection again from Claude.',
    };
  }

  // Back to the OAuth client's own callback, which is off this site.
  redirect(data.redirect_url as Route);
}

export async function approveConsent(
  _prev: ConsentState,
  formData: FormData,
): Promise<ConsentState> {
  return decide(formData, 'approve');
}

export async function denyConsent(
  _prev: ConsentState,
  formData: FormData,
): Promise<ConsentState> {
  return decide(formData, 'deny');
}
