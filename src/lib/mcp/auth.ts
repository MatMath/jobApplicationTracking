import type { AuthInfo } from '@modelcontextprotocol/server';
import { createTokenClient } from '@/lib/supabase/token';

/**
 * Turns a bearer token into an identity, or nothing.
 *
 * The token comes from Supabase Auth's OAuth 2.1 server, which the MCP client
 * discovered through /.well-known/oauth-protected-resource. Verification is
 * `getUser()`: it calls the auth server rather than trusting the JWT's
 * signature locally, which is the same trade-off middleware.ts already makes
 * for cookies, and it means a revoked grant stops working immediately instead
 * of at token expiry.
 *
 * Returning undefined makes withMcpAuth answer 401 with a WWW-Authenticate
 * header pointing back at the resource metadata, which is how a client knows to
 * start the OAuth flow.
 */

const ISSUER = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1`;

/** Tolerance for the two clocks disagreeing, so a live token is never dropped. */
const CLOCK_SKEW_SECONDS = 60;

function decodeClaims(segment: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(Buffer.from(segment, 'base64url').toString('utf8'));
    return typeof parsed === 'object' && parsed !== null
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

/**
 * Cheap reject filter, run before the network call.
 *
 * `getUser()` is a round trip to Supabase, so every request carrying a token
 * costs one — including the ones that were never going to succeed. That is an
 * amplifier: a request an attacker can generate for nothing makes this service
 * wake up and call out. It also wastes a round trip on the ordinary case of a
 * user's token simply having expired.
 *
 * This is NOT verification and must never be treated as any: it does not check
 * the signature, and a token that passes still goes to Supabase to be properly
 * verified. It only answers "could this possibly be one of ours?", and so it
 * rejects only what is definitively wrong — not a JWT at all, issued by someone
 * else, or expired. Anything ambiguous (no `exp` claim, no `iss` claim) is
 * passed through for the auth server to rule on, because being wrong in that
 * direction costs a round trip while being wrong in the other rejects a
 * legitimate caller.
 *
 * It follows that this stops accidents and spray, not a determined attacker:
 * crafting a string that passes is trivial. Removing the amplifier entirely
 * would mean verifying the signature locally against Supabase's JWKS, which
 * would cost the instant revocation described above, or rate limiting at the
 * edge.
 */
function couldBeOurToken(token: string): boolean {
  const parts = token.split('.');
  if (parts.length !== 3 || parts.some((p) => p === '')) return false;

  const claims = decodeClaims(parts[1]);
  if (!claims) return false;

  if (typeof claims.iss === 'string' && claims.iss !== ISSUER) return false;

  if (typeof claims.exp === 'number') {
    const now = Math.floor(Date.now() / 1000);
    if (claims.exp + CLOCK_SKEW_SECONDS < now) return false;
  }

  return true;
}

export async function verifyToken(
  _req: Request,
  bearerToken?: string,
): Promise<AuthInfo | undefined> {
  if (!bearerToken) return undefined;
  if (!couldBeOurToken(bearerToken)) return undefined;

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
