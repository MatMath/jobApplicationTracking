import type { AuthInfo } from '@modelcontextprotocol/server';
import { createTokenClient } from '@/lib/supabase/token';

/**
 * Turns a bearer token into an identity, or nothing.
 *
 * The token comes from Supabase Auth's OAuth 2.1 server, which the MCP client
 * discovered through /.well-known/oauth-protected-resource. Verification is
 * just `getUser()`: it calls the auth server rather than trusting the JWT's
 * signature locally, which is the same trade-off middleware.ts already makes
 * for cookies, and it means a revoked grant stops working immediately instead
 * of at token expiry.
 *
 * Returning undefined makes withMcpAuth answer 401 with a WWW-Authenticate
 * header pointing back at the resource metadata, which is how a client knows to
 * start the OAuth flow.
 */
export async function verifyToken(
  _req: Request,
  bearerToken?: string,
): Promise<AuthInfo | undefined> {
  if (!bearerToken) return undefined;

  const supabase = createTokenClient(bearerToken);
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return undefined;

  return {
    token: bearerToken,
    // Supabase does not surface the OAuth client id on the user object; the
    // grant itself is visible under /settings/connections.
    clientId: data.user.id,
    // No custom scopes are defined, so no tool gates on one. Authorization is
    // RLS: the token identifies a user, and the policies do the rest.
    scopes: [],
    extra: { userId: data.user.id, email: data.user.email },
  };
}

/** The user id a tool should act as, read back from the verified token. */
export function userIdFrom(authInfo: AuthInfo | undefined): string | null {
  const userId = authInfo?.extra?.userId;
  return typeof userId === 'string' ? userId : null;
}
