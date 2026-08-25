import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Provisioned by the on_auth_user_created trigger, so this exists for every
  // signed-in user. Fall back to the auth record only if the trigger is missing.
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, email')
    .eq('id', user!.id)
    .maybeSingle();

  const name = profile?.full_name ?? profile?.email ?? user?.email;

  return (
    <main className="mx-auto max-w-2xl p-8">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold">Job Application Tracker</h1>
        <form action="/auth/signout" method="post">
          <button className="text-sm underline opacity-70">Sign out</button>
        </form>
      </div>
      <p className="mt-2 text-sm opacity-70">Signed in as {name}</p>

      <Link
        href="/applications"
        className="mt-8 inline-block rounded bg-black px-4 py-2 text-sm text-white dark:bg-white dark:text-black"
      >
        View applications
      </Link>
    </main>
  );
}
