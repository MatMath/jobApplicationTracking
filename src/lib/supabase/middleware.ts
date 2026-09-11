import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { redirectTo } from '@/lib/redirect';

const PUBLIC_PATHS = ['/login', '/auth'];

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
  if (!user && !isPublic) return redirectTo(request, '/login', 307, response);
  if (user && pathname === '/login') return redirectTo(request, '/', 307, response);

  return response;
}
