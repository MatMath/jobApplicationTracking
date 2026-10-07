'use server';

import { revalidatePath } from 'next/cache';
import { createClient, getUser } from '@/lib/supabase/server';
import { formatIssues } from '@/lib/applications/schema';
import { attachInput, detachInput, documentUploadInput } from '@/lib/documents/schema';
import * as write from '@/lib/documents/write';

export type DocumentFormState = { error: string | null; notice: string | null };

/**
 * The form's half of the document write path — the same arrangement as
 * app/applications/actions.ts. Everything that decides whether a file is
 * acceptable or where it goes lives in lib/documents; these translate FormData
 * into it and tell Next what to revalidate.
 *
 * Used from two pages: the library under settings, and the documents section
 * of an application.
 */

function revalidate(applicationId?: string | null) {
  revalidatePath('/settings/documents');
  if (applicationId) revalidatePath(`/applications/${applicationId}`);
}

export async function uploadDocument(
  _prev: DocumentFormState,
  formData: FormData,
): Promise<DocumentFormState> {
  const user = await getUser();
  if (!user) return { error: 'Not signed in.', notice: null };

  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return { error: 'Choose a file to upload.', notice: null };
  }

  const parsed = documentUploadInput.safeParse({
    type: formData.get('type'),
    applicationId: formData.get('application_id'),
    meetingId: formData.get('meeting_id'),
    makeDefaultResume: formData.get('make_default_resume'),
  });
  if (!parsed.success) return { error: formatIssues(parsed.error), notice: null };

  const supabase = await createClient();
  const result = await write.storeDocument(
    supabase,
    user.id,
    { fileName: file.name, bytes: new Uint8Array(await file.arrayBuffer()) },
    parsed.data,
  );
  if (result.error !== null) return { error: result.error, notice: null };

  revalidate(parsed.data.applicationId);

  // Say what happened beyond "uploaded" — each of these is a thing the person
  // did not explicitly ask for and would otherwise have to notice.
  const notes: string[] = [];
  if (result.data.already_stored) {
    notes.push(`This file was already in your library as "${result.data.file_name}"; no second copy was stored.`);
  }
  if (result.data.became_default_resume) notes.push('It is now your default résumé.');
  return { error: null, notice: notes.length > 0 ? notes.join(' ') : null };
}

/** Attaches a file already in the library to an application. */
export async function attachDocument(formData: FormData): Promise<void> {
  const user = await getUser();
  if (!user) return;

  const parsed = attachInput.safeParse({
    applicationId: formData.get('application_id'),
    documentId: formData.get('document_id'),
    meetingId: formData.get('meeting_id'),
  });
  if (!parsed.success) return;

  const supabase = await createClient();
  await write.attachDocument(supabase, user.id, parsed.data);
  revalidate(parsed.data.applicationId);
}

/** Removes the attachment; the file stays in the library. */
export async function detachDocument(formData: FormData): Promise<void> {
  const user = await getUser();
  if (!user) return;

  const parsed = detachInput.safeParse({
    applicationId: formData.get('application_id'),
    documentId: formData.get('document_id'),
  });
  if (!parsed.success) return;

  const supabase = await createClient();
  await write.detachDocument(supabase, user.id, parsed.data);
  revalidate(parsed.data.applicationId);
}

export async function setDefaultResume(formData: FormData): Promise<void> {
  const user = await getUser();
  if (!user) return;

  const id = String(formData.get('document_id') ?? '');
  const supabase = await createClient();
  // An empty id clears the default.
  await write.setDefaultResume(supabase, user.id, id || null);
  revalidate();
}

/**
 * Deletes a file from the library. The page only offers this for a file that
 * no application cites; lib/documents refuses the rest regardless.
 */
export async function deleteDocument(formData: FormData): Promise<void> {
  const user = await getUser();
  if (!user) return;

  const id = String(formData.get('document_id') ?? '');
  if (!id) return;

  const supabase = await createClient();
  await write.deleteDocument(supabase, user.id, id);
  revalidate();
}
