'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { fromDateInput } from '@/lib/date';

export type FormState = { error: string | null };

/** Statuses that mean the company came back to us in some form. */
const RESPONDED = new Set(['phone_screen', 'interview', 'offer', 'rejected']);

/** Statuses that end the application's life. */
const CLOSED = new Set(['rejected', 'withdrawn']);

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
  website: string | null,
): Promise<{ id: string } | { error: string }> {
  const { data: existing, error: findError } = await supabase
    .from('companies')
    .select('id, website')
    .eq('user_id', userId)
    .ilike('name', name)
    .maybeSingle();

  if (findError) return { error: findError.message };

  if (existing) {
    // Fill in a website we did not have before, so the logo starts resolving by
    // domain instead of by name. Never blank out one already recorded.
    if (website && !existing.website) {
      await supabase.from('companies').update({ website }).eq('id', existing.id);
    }
    return { id: existing.id };
  }

  const { data: created, error: insertError } = await supabase
    .from('companies')
    .insert({ user_id: userId, name, website })
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

  const company = await resolveCompanyId(
    supabase,
    user.id,
    companyName,
    optional(formData.get('company_website')),
  );
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
      applied_at:
        fromDateInput(appliedAt) ??
        (status !== 'wishlist' ? new Date().toISOString() : null),
      // Created already past 'applied' (logging an older application that has
      // since moved on) still means the company replied.
      first_response_at: RESPONDED.has(status) ? new Date().toISOString() : null,
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


export async function updateApplication(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Not signed in.' };

  const id = optional(formData.get('id'));
  if (!id) return { error: 'Missing application id.' };

  const companyName = optional(formData.get('company'));
  const role = optional(formData.get('role'));
  if (!companyName || !role) return { error: 'Company and role are required.' };

  const { data: current, error: loadError } = await supabase
    .from('applications')
    .select('status, first_response_at, closed_at')
    .eq('id', id)
    .single();
  if (loadError) return { error: loadError.message };

  const company = await resolveCompanyId(
    supabase,
    user.id,
    companyName,
    optional(formData.get('company_website')),
  );
  if ('error' in company) return { error: company.error };

  const status = String(formData.get('status') ?? current.status);
  const statusChanged = status !== current.status;
  const now = new Date().toISOString();

  const { error } = await supabase
    .from('applications')
    .update({
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
      outcome: optional(formData.get('outcome')),
      rejection_reason: optional(formData.get('rejection_reason')),
      status,
      applied_at: fromDateInput(optional(formData.get('applied_at'))),
      // Stamp the first reply the moment the pipeline first moves past applied.
      // A rejection counts: it is still a response, and treating it otherwise
      // would flatter the response-rate stats.
      first_response_at:
        current.first_response_at ??
        (RESPONDED.has(status) ? now : null),
      closed_at: CLOSED.has(status) ? (current.closed_at ?? now) : null,
    })
    .eq('id', id);

  if (error) return { error: error.message };

  if (statusChanged) {
    await supabase
      .from('status_history')
      .insert({ user_id: user.id, application_id: id, status });
  }

  revalidatePath(`/applications/${id}`);
  revalidatePath('/applications');
  return { error: null };
}

/**
 * Records one interview round. Kept separate from the application form because
 * rounds accumulate over time — the point is to add the next one without
 * touching anything already recorded.
 */
export async function addMeeting(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Not signed in.' };

  const applicationId = optional(formData.get('application_id'));
  if (!applicationId) return { error: 'Missing application id.' };

  const participantsRaw = optional(formData.get('participants'));
  const participants = participantsRaw
    ? participantsRaw.split(',').map((p) => p.trim()).filter(Boolean)
    : null;

  const scheduledAt = optional(formData.get('scheduled_at'));

  const { error } = await supabase.from('meetings').insert({
    user_id: user.id,
    application_id: applicationId,
    scheduled_at: scheduledAt ? new Date(scheduledAt).toISOString() : null,
    purpose: optional(formData.get('purpose')),
    participants,
    challenge: optional(formData.get('challenge')),
    outcome: optional(formData.get('outcome')) ?? 'pending',
    notes: optional(formData.get('notes')),
  });

  if (error) return { error: error.message };

  revalidatePath(`/applications/${applicationId}`);
  return { error: null };
}

export async function deleteMeeting(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const id = String(formData.get('meeting_id') ?? '');
  const applicationId = String(formData.get('application_id') ?? '');
  if (!id) return;

  await supabase.from('meetings').delete().eq('id', id);
  revalidatePath(`/applications/${applicationId}`);
}

export async function addNote(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Not signed in.' };

  const applicationId = optional(formData.get('application_id'));
  const content = optional(formData.get('content'));
  if (!applicationId || !content) return { error: 'Note cannot be empty.' };

  const { error } = await supabase
    .from('notes')
    .insert({ user_id: user.id, application_id: applicationId, content });

  if (error) return { error: error.message };

  revalidatePath(`/applications/${applicationId}`);
  return { error: null };
}

/**
 * Deletes an application. Meetings, notes, status history, and documents go
 * with it via ON DELETE CASCADE; the company row stays, since other
 * applications may point at it and it keeps its website for the logo.
 */
export async function deleteApplication(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const id = String(formData.get('id') ?? '');
  if (!id) return;

  // RLS scopes the delete to the caller's own rows; another user's id simply
  // matches nothing.
  await supabase.from('applications').delete().eq('id', id);

  revalidatePath('/applications');
  redirect('/applications');
}

export async function deleteNote(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const id = String(formData.get('note_id') ?? '');
  const applicationId = String(formData.get('application_id') ?? '');
  if (!id) return;

  await supabase.from('notes').delete().eq('id', id);
  revalidatePath(`/applications/${applicationId}`);
}
