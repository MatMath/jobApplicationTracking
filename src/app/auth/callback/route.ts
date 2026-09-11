import type { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { redirectTo, safeNextPath } from '@/lib/redirect';

/** OAuth landing point: trades the code for a session. */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get('code');
  const next = safeNextPath(searchParams.get('next'));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return redirectTo(request, next);
  }

  return redirectTo(request, '/login?error=auth');
}
