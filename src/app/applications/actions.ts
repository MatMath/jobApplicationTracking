'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export type FormState = { error: string | null };

function optional(v: FormDataEntryValue | null): string | null {
  const s = String(v ?? '').trim();
  return s === '' ? null : s;
}

function optionalInt(v: FormDataEntryValue | null): number | null {
  const s = optional(v);
  if (s === null) return null;
  const n = Number.parseInt(s, 10);
  return Number.isNaN(n) ? null : n;
}

/**
 * Resolves a company name to an id, creating the row on first use. The old
 * system stored the company as free text on each application, which split one
 * employer's stats across every spelling variant; this keeps entry just as fast
 * while still normalizing.
 */
async function resolveCompanyId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  name: string,
): Promise<{ id: string } | { error: string }> {
  const { data: existing, error: findError } = await supabase
    .from('companies')
    .select('id')
    .eq('user_id', userId)
    .ilike('name', name)
    .maybeSingle();

  if (findError) return { error: findError.message };
  if (existing) return { id: existing.id };

  const { data: created, error: insertError } = await supabase
    .from('companies')
    .insert({ user_id: userId, name })
    .select('id')
    .single();

  if (insertError) return { error: insertError.message };
  return { id: created.id };
}

export async function createApplication(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Not signed in.' };

  const companyName = optional(formData.get('company'));
  const role = optional(formData.get('role'));
  if (!companyName || !role) return { error: 'Company and role are required.' };

  const company = await resolveCompanyId(supabase, user.id, companyName);
  if ('error' in company) return { error: company.error };

  const status = String(formData.get('status') ?? 'wishlist');
  const appliedAt = optional(formData.get('applied_at'));

  const { data: created, error } = await supabase
    .from('applications')
    .insert({
      user_id: user.id,
      company_id: company.id,
      role,
      description: optional(formData.get('description')),
      job_url: optional(formData.get('job_url')),
      application_type: optional(formData.get('application_type')),
      platform_found: optional(formData.get('platform_found')),
      platform_applied: optional(formData.get('platform_applied')),
      location: optional(formData.get('location')),
      remote_type: optional(formData.get('remote_type')),
      salary_min: optionalInt(formData.get('salary_min')),
      salary_max: optionalInt(formData.get('salary_max')),
      status,
      // Applying is the event worth timestamping; a wishlist entry has no date.
      applied_at: appliedAt ?? (status !== 'wishlist' ? new Date().toISOString() : null),
    })
    .select('id')
    .single();

  if (error) return { error: error.message };

  // Seed the history so time-in-stage has a starting point.
  await supabase
    .from('status_history')
    .insert({ user_id: user.id, application_id: created.id, status });

  revalidatePath('/applications');
  redirect('/applications');
}
