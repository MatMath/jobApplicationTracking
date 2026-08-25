'use client';

import { useActionState } from 'react';
import { signIn, signUp, type AuthState } from './actions';

const initial: AuthState = { error: null };

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(signIn, initial);
  const [signUpState, signUpAction, signUpPending] = useActionState(
    signUp,
    initial,
  );

  const message = state.error ?? signUpState.error;

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center p-8">
      <h1 className="text-2xl font-semibold">Job Application Tracker</h1>
      <p className="mt-1 text-sm opacity-60">Sign in to continue.</p>

      <form className="mt-6 flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm">
          Email
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            className="rounded border border-black/20 px-3 py-2 dark:border-white/20"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Password
          <input
            name="password"
            type="password"
            required
            minLength={6}
            autoComplete="current-password"
            className="rounded border border-black/20 px-3 py-2 dark:border-white/20"
          />
        </label>

        {message ? (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {message}
          </p>
        ) : null}

        <div className="mt-2 flex gap-2">
          <button
            formAction={formAction}
            disabled={pending || signUpPending}
            className="flex-1 rounded bg-black px-3 py-2 text-sm text-white disabled:opacity-50 dark:bg-white dark:text-black"
          >
            {pending ? 'Signing in…' : 'Sign in'}
          </button>
          <button
            formAction={signUpAction}
            disabled={pending || signUpPending}
            className="flex-1 rounded border border-black/20 px-3 py-2 text-sm disabled:opacity-50 dark:border-white/20"
          >
            {signUpPending ? 'Creating…' : 'Sign up'}
          </button>
        </div>
      </form>
    </main>
  );
}
