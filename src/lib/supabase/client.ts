import { createBrowserClient } from '@supabase/ssr';

/** Browser-side client. Uses the publishable key, so every query is bound by RLS. */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
