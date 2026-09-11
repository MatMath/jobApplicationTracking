import { NextResponse } from 'next/server';
import { publicOrigin } from './origin';

/**
 * Redirects to a path on this site, using the public origin rather than
 * request.nextUrl (which is localhost behind Cloud Run - see origin.ts).
 *
 * `carry` copies cookies from another response: when the middleware has just
 * refreshed the Supabase session, the redirect must not drop the new tokens.
 */
export function redirectTo(
  request: { headers: Headers },
  path: string,
  status: 303 | 307 = 307,
  carry?: NextResponse,
): NextResponse {
  const res = NextResponse.redirect(new URL(path, publicOrigin(request.headers)), status);
  carry?.cookies.getAll().forEach((cookie) => res.cookies.set(cookie));
  return res;
}

/**
 * Restricts a user-supplied return path to this site. "//evil.example" is a
 * protocol-relative URL: resolved against our origin it leaves the site, an
 * open redirect handed to anyone who can craft a sign-in link.
 */
export function safeNextPath(next: string | null | undefined): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) {
    return '/';
  }
  return next;
}
