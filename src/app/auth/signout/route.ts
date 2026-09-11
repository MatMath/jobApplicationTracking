import type { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { redirectTo } from '@/lib/redirect';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  // 303 so the browser follows with GET rather than re-POSTing.
  return redirectTo(request, '/login', 303);
}
