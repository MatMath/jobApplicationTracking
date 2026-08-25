'use server';

import type { Route } from 'next';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

/**
 * Starts the Google OAuth flow. Supabase returns a consent URL; the browser is
 * sent there, and Google redirects back to /auth/callback with a code.
 *
 * No password is ever handled by this app — there is no credential to phish,
 * leak, or store, and account recovery is Google's problem rather than ours.
 */
export async function signInWithGoogle() {
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${await siteOrigin()}/auth/callback`,
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

/**
 * The origin to send Google back to. Explicit config wins, because behind a
 * proxy the request headers describe the hop rather than the public URL.
 */
async function siteOrigin(): Promise<string> {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '');
  }
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000';
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  return `${proto}://${host}`;
}
