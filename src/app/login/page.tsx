import { signInWithGoogle } from './actions';

/** Google's mark. Inlined rather than fetched: the CSP blocks external assets. */
function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#4285F4" d="M45.1 24.5c0-1.6-.1-3.2-.4-4.7H24v8.9h11.8c-.5 2.7-2 5-4.4 6.6v5.5h7.1c4.1-3.8 6.6-9.4 6.6-16.3z" />
      <path fill="#34A853" d="M24 46c5.9 0 10.9-2 14.5-5.2l-7.1-5.5c-2 1.3-4.5 2.1-7.4 2.1-5.7 0-10.5-3.8-12.2-9H4.5v5.7C8.1 41.4 15.5 46 24 46z" />
      <path fill="#FBBC05" d="M11.8 28.4c-.4-1.3-.7-2.7-.7-4.4s.3-3.1.7-4.4v-5.7H4.5C2.9 17.1 2 20.4 2 24s.9 6.9 2.5 10.1l7.3-5.7z" />
      <path fill="#EA4335" d="M24 10.6c3.2 0 6.1 1.1 8.4 3.3l6.3-6.3C34.9 4 29.9 2 24 2 15.5 2 8.1 6.6 4.5 13.9l7.3 5.7c1.7-5.2 6.5-9 12.2-9z" />
    </svg>
  );
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center p-8">
      <h1 className="text-2xl font-semibold">Job Application Tracker</h1>
      <p className="mt-1 text-sm opacity-60">
        Sign in with Google to continue.
      </p>

      {error ? (
        <p
          role="alert"
          className="mt-4 rounded border border-red-500/40 bg-red-500/5 px-3 py-2 text-sm text-red-600 dark:text-red-400"
        >
          {error === 'auth'
            ? 'Sign-in did not complete. Please try again.'
            : error}
        </p>
      ) : null}

      <form action={signInWithGoogle} className="mt-6">
        <button
          type="submit"
          className="flex w-full items-center justify-center gap-3 rounded border border-black/20 px-4 py-2.5 text-sm font-medium transition-colors hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
        >
          <GoogleMark />
          Continue with Google
        </button>
      </form>

      <p className="mt-6 text-xs opacity-50">
        Your account is created automatically on first sign-in. No password is
        stored by this app.
      </p>
    </main>
  );
}
