import { createClient } from '@supabase/supabase-js';

/**
 * Client for a caller that presents a bearer token instead of a cookie — i.e.
 * the MCP server.
 *
 * Still the publishable key, for the same reason as server.ts: RLS is what
 * scopes the data, and the secret key would silently disable it. The access
 * token Supabase's OAuth 2.1 server issues is an ordinary Supabase JWT, so
 * `auth.uid()` resolves inside the policies exactly as it does for a browser
 * session. That is what keeps the Cloud Run service free of secrets.
 *
 * Session persistence is off: there is no browser here, each request carries
 * its own token, and a shared module-level store would leak one caller's
 * identity into another's request.
 */
export function createTokenClient(accessToken: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    },
  );
}
