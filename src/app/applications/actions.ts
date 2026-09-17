'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient, getUser } from '@/lib/supabase/server';
import {
  applicationInput,
  applicationUpdateInput,
  formatIssues,
  meetingInput,
  noteInput,
} from '@/lib/applications/schema';
import * as write from '@/lib/applications/write';

export type FormState = { error: string | null };

/**
 * The form's half of the write path.
 *
 * Everything that decides what lands in the database lives in
 * lib/applications — these functions only translate FormData into it and tell
 * Next what to revalidate. The MCP tools call the same core with the same
 * schemas, which is the point: the rules about when `applied_at` is stamped or
 * history appended exist once.
 */

/** FormData's flat string map, as the schemas expect to receive it. */
function fields(formData: FormData): Record<string, unknown> {
  return Object.fromEntries(formData.entries());
}

export async function createApplication(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await getUser();
  if (!user) return { error: 'Not signed in.' };

  const parsed = applicationInput.safeParse({
    ...fields(formData),
    companyWebsite: formData.get('company_website'),
    jobUrl: formData.get('job_url'),
    applicationType: formData.get('application_type'),
    platformFound: formData.get('platform_found'),
    platformApplied: formData.get('platform_applied'),
    locationPlaceId: formData.get('location_place_id'),
    remoteType: formData.get('remote_type'),
    salaryMin: formData.get('salary_min'),
    salaryMax: formData.get('salary_max'),
    appliedAt: formData.get('applied_at'),
  });
  if (!parsed.success) return { error: formatIssues(parsed.error) };

  const supabase = await createClient();
  const result = await write.createApplication(supabase, user.id, parsed.data);
  if (result.error !== null) return { error: result.error };

  revalidatePath('/applications');
  redirect('/applications');
}

export async function updateApplication(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await getUser();
  if (!user) return { error: 'Not signed in.' };

  const parsed = applicationUpdateInput.safeParse({
    ...fields(formData),
    companyWebsite: formData.get('company_website'),
    jobUrl: formData.get('job_url'),
    applicationType: formData.get('application_type'),
    platformFound: formData.get('platform_found'),
    platformApplied: formData.get('platform_applied'),
    locationPlaceId: formData.get('location_place_id'),
    remoteType: formData.get('remote_type'),
    salaryMin: formData.get('salary_min'),
    salaryMax: formData.get('salary_max'),
    appliedAt: formData.get('applied_at'),
    rejectionReason: formData.get('rejection_reason'),
  });
  if (!parsed.success) return { error: formatIssues(parsed.error) };

  const supabase = await createClient();
  const result = await write.updateApplication(supabase, user.id, parsed.data);
  if (result.error !== null) return { error: result.error };

  revalidatePath(`/applications/${parsed.data.id}`);
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
  const user = await getUser();
  if (!user) return { error: 'Not signed in.' };

  const parsed = meetingInput.safeParse({
    ...fields(formData),
    applicationId: formData.get('application_id'),
    scheduledAt: formData.get('scheduled_at'),
  });
  if (!parsed.success) return { error: formatIssues(parsed.error) };

  const supabase = await createClient();
  const result = await write.addMeeting(supabase, user.id, parsed.data);
  if (result.error !== null) return { error: result.error };

  revalidatePath(`/applications/${parsed.data.applicationId}`);
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
  const user = await getUser();
  if (!user) return { error: 'Not signed in.' };

  const parsed = noteInput.safeParse({
    applicationId: formData.get('application_id'),
    content: formData.get('content'),
  });
  if (!parsed.success) return { error: 'Note cannot be empty.' };

  const supabase = await createClient();
  const result = await write.addNote(supabase, user.id, parsed.data);
  if (result.error !== null) return { error: result.error };

  revalidatePath(`/applications/${parsed.data.applicationId}`);
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
