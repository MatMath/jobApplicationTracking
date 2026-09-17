import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { redirectTo } from '@/lib/redirect';

/**
 * Paths the cookie check does not gate.
 *
 * Nothing here is unauthenticated; each of these checks the caller itself, and
 * a redirect would only get in the way of an answer it can act on.
 *
 * /api/mcp and /.well-known authenticate by OAuth bearer token inside the route
 * (see lib/mcp/auth.ts); running them through the cookie check would answer an
 * MCP client's JSON-RPC POST with a 307 to the sign-in page.
 *
 * /api/places and /api/map are called by fetch() and <img> from pages that are
 * already gated. They check the session themselves and answer 401, which the
 * caller can tell apart from a real answer — a 307 to the sign-in page arrives
 * at a `fetch` as a 200 full of HTML, and at an <img> as a broken image.
 */
const PUBLIC_PATHS = ['/login', '/auth', '/api/mcp', '/.well-known', '/api/places', '/api/map'];

/**
 * Refreshes the auth token on every request and redirects signed-out users away
 * from protected routes. Server Components cannot write cookies, so without this
 * a refreshed token would never be persisted and sessions would expire early.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // getUser() revalidates against the auth server; getSession() only reads the
  // cookie and would trust a forged one.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  // redirectTo, not nextUrl: behind Cloud Run nextUrl says localhost (see
  // lib/origin.ts). `response` carries any session the refresh just set.
  if (!user && !isPublic) {
    // Carry where they were headed. This matters for /oauth/consent, which
    // arrives with an authorization_id that expires in ten minutes: dropping it
    // would land them on the dashboard with the authorization silently lost.
    const next = `${pathname}${request.nextUrl.search}`;
    return redirectTo(request, `/login?next=${encodeURIComponent(next)}`, 307, response);
  }
  if (user && pathname === '/login') return redirectTo(request, '/', 307, response);

  return response;
}
