import { getUser } from '@/lib/supabase/server';

export default async function Home() {
  const user = await getUser();

  return (
    <main className="mx-auto max-w-2xl p-8">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold">Job Application Tracker</h1>
        <form action="/auth/signout" method="post">
          <button className="text-sm underline opacity-70">Sign out</button>
        </form>
      </div>
      <p className="mt-2 text-sm opacity-70">Signed in as {user?.email}</p>
      <p className="mt-6 text-sm opacity-60">
        Auth is wired. Next: companies and applications.
      </p>
    </main>
  );
}
