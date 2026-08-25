'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export type AuthState = { error: string | null };

export async function signIn(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = String(formData.get('email') ?? '');
  const password = String(formData.get('password') ?? '');

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: error.message };

  revalidatePath('/', 'layout');
  redirect('/');
}

export async function signUp(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = String(formData.get('email') ?? '');
  const password = String(formData.get('password') ?? '');

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({ email, password });
  if (error) return { error: error.message };

  // With email confirmation on, no session exists yet — say so rather than
  // redirecting to a page that would bounce straight back to /login.
  return { error: 'Check your email to confirm your account, then sign in.' };
}
