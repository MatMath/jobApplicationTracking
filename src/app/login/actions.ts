'use server';

import type { Route } from 'next';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { publicOrigin } from '@/lib/origin';
import { safeNextPath } from '@/lib/redirect';

/**
 * Starts the Google OAuth flow. Supabase returns a consent URL; the browser is
 * sent there, and Google redirects back to /auth/callback with a code.
 *
 * No password is ever handled by this app — there is no credential to phish,
 * leak, or store, and account recovery is Google's problem rather than ours.
 *
 * `next` carries the page the user was trying to reach through both hops, so
 * they land back on it rather than on the dashboard. /auth/callback has always
 * honoured it; until now nothing set it.
 */
export async function signInWithGoogle(formData: FormData) {
  const supabase = await createClient();

  // safeNextPath keeps this from becoming an open redirect: the value reaches
  // us through a query parameter anyone can craft into a sign-in link.
  const next = safeNextPath(formData.get('next')?.toString());
  const callback = `${publicOrigin(await headers())}/auth/callback?next=${encodeURIComponent(next)}`;

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: callback,
      queryParams: {
        // Ask for a refresh token, and let the user pick when they hold
        // several Google accounts rather than silently reusing the last one.
        access_type: 'offline',
        prompt: 'select_account',
      },
    },
  });

  if (error) redirect(`/login?error=${encodeURIComponent(error.message)}`);
  // Google's consent URL is external, so it sits outside typedRoutes' map.
  if (data.url) redirect(data.url as Route);
}
