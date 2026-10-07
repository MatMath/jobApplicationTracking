import { createHash, randomUUID } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { DocumentType } from '@/db/schema';
import type { WriteResult } from '@/lib/applications/write';
import { STORAGE_BUCKET, checkFile, isTextMimeType } from './files';
import type { AttachInput, DetachInput, DocumentListInput, DocumentUploadInput } from './schema';

/**
 * Every read and write against the file library, as plain data logic.
 *
 * Same arrangement as lib/applications/write.ts, and for the same reason: the
 * web form and the MCP tools both store files, and "what may be stored" must
 * not have two implementations. Both hand this module a name and some bytes;
 * neither talks to Storage on its own.
 *
 * That is also why uploads pass through the server rather than going from the
 * browser straight to the bucket. A direct upload is the usual advice, and it
 * exists to dodge request-size limits — which a 1 MB cap sits comfortably
 * under. Going through here buys a content check on the real bytes, a hash
 * computed by something the caller does not control, and a row that is never
 * written for a file that failed to land.
 *
 * Files are immutable. Nothing in this module updates a stored file or its
 * row, and the policies in supabase/005_documents.sql would refuse it anyway.
 */

const ok = <T>(data: T): WriteResult<T> => ({ data, error: null });
const fail = (error: string): WriteResult<never> => ({ data: null, error });

/** A library row, as PostgREST returns it. */
export type DocumentRow = {
  id: string;
  file_name: string;
  type: DocumentType;
  mime_type: string;
  size_bytes: number;
  uploaded_at: string;
};

const DOCUMENT_COLUMNS = 'id, file_name, type, mime_type, size_bytes, uploaded_at';

export type LibraryDocument = DocumentRow & {
  /** Whether this is the generic CV attached to applications by default. */
  is_default_resume: boolean;
  /** How many applications cite it. Above zero, it cannot be deleted. */
  attached_to: number;
};

export type AttachedDocument = DocumentRow & {
  meeting_id: string | null;
  attached_at: string;
};

export type StoredDocument = DocumentRow & {
  /** True when these exact bytes were already in the library. */
  already_stored: boolean;
  became_default_resume: boolean;
  attached: boolean;
};

async function defaultResumeId(supabase: SupabaseClient, userId: string): Promise<string | null> {
  const { data } = await supabase
    .from('profiles')
    .select('default_resume_id')
    .eq('id', userId)
    .maybeSingle();
  return (data?.default_resume_id as string | null) ?? null;
}

/**
 * Stores a file, and optionally attaches it and makes it the default résumé.
 *
 * Re-uploading bytes that are already in the library returns the existing row
 * instead of a second copy. That is what makes the call safe to repeat — a
 * model that is unsure whether the CV is already there can just send it.
 *
 * The object is written before the row, and removed again if the row fails. The
 * other order would leave rows that point at nothing, and a row is what the
 * rest of the app trusts.
 */
export async function storeDocument(
  supabase: SupabaseClient,
  userId: string,
  file: { fileName: string; bytes: Uint8Array },
  input: DocumentUploadInput,
): Promise<WriteResult<StoredDocument>> {
  if (input.meetingId && !input.applicationId) {
    return fail('meetingId: an interview round can only be named together with its application.');
  }

  const verdict = checkFile(file.fileName, file.bytes);
  if (!verdict.ok) return fail(verdict.error);

  const sha256 = createHash('sha256').update(file.bytes).digest('hex');

  const { data: existing, error: findError } = await supabase
    .from('documents')
    .select(DOCUMENT_COLUMNS)
    .eq('user_id', userId)
    .eq('sha256', sha256)
    .maybeSingle();
  if (findError) return fail(findError.message);

  let row = existing as DocumentRow | null;
  const alreadyStored = row !== null;

  if (!row) {
    const id = randomUUID();
    // Named by id, not by the uploaded name: a storage key has its own rules
    // about characters, and the display name lives in the row.
    const storagePath = `${userId}/${id}.${verdict.extension}`;

    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, file.bytes, { contentType: verdict.mimeType, upsert: false });
    if (uploadError) return fail(`Could not store the file: ${uploadError.message}`);

    const { data: created, error: insertError } = await supabase
      .from('documents')
      .insert({
        id,
        user_id: userId,
        file_name: verdict.fileName,
        storage_path: storagePath,
        type: input.type,
        mime_type: verdict.mimeType,
        size_bytes: file.bytes.byteLength,
        sha256,
      })
      .select(DOCUMENT_COLUMNS)
      .single();

    if (insertError) {
      await supabase.storage.from(STORAGE_BUCKET).remove([storagePath]);
      return fail(insertError.message);
    }
    row = created as DocumentRow;
  }

  // The first résumé in the library is the generic one until told otherwise —
  // otherwise "upload my CV" would need a second step nobody would guess.
  let becameDefault = false;
  if (row.type === 'resume') {
    const makeDefault = input.makeDefaultResume || (await defaultResumeId(supabase, userId)) === null;
    if (makeDefault) {
      const set = await setDefaultResume(supabase, userId, row.id);
      if (set.error !== null) return fail(set.error);
      becameDefault = true;
    }
  } else if (input.makeDefaultResume) {
    return fail('makeDefaultResume: only a file of type "resume" can be the default résumé.');
  }

  let attached = false;
  if (input.applicationId) {
    const result = await attachDocument(supabase, userId, {
      applicationId: input.applicationId,
      documentId: row.id,
      meetingId: input.meetingId,
    });
    if (result.error !== null) return fail(`The file was stored, but not attached: ${result.error}`);
    attached = true;
  }

  return ok({ ...row, already_stored: alreadyStored, became_default_resume: becameDefault, attached });
}

/** The whole library, newest first, with what each file is attached to. */
export async function listDocuments(
  supabase: SupabaseClient,
  userId: string,
  input: DocumentListInput = { type: null },
): Promise<WriteResult<LibraryDocument[]>> {
  let q = supabase
    .from('documents')
    .select(`${DOCUMENT_COLUMNS}, application_documents (application_id)`)
    .eq('user_id', userId)
    .order('uploaded_at', { ascending: false });
  if (input.type) q = q.eq('type', input.type);

  const [{ data, error }, defaultId] = await Promise.all([q, defaultResumeId(supabase, userId)]);
  if (error) return fail(error.message);

  return ok(
    (data ?? []).map((raw) => {
      const { application_documents: links, ...row } = raw as unknown as DocumentRow & {
        application_documents: unknown[] | null;
      };
      return { ...row, is_default_resume: row.id === defaultId, attached_to: links?.length ?? 0 };
    }),
  );
}

/** The files attached to one application, oldest attachment first. */
export async function listApplicationDocuments(
  supabase: SupabaseClient,
  userId: string,
  applicationId: string,
): Promise<WriteResult<AttachedDocument[]>> {
  const { data, error } = await supabase
    .from('application_documents')
    .select(`meeting_id, attached_at, documents (${DOCUMENT_COLUMNS})`)
    .eq('user_id', userId)
    .eq('application_id', applicationId)
    .order('attached_at', { ascending: true });
  if (error) return fail(error.message);

  return ok(
    (data ?? []).flatMap((raw) => {
      const link = raw as unknown as {
        meeting_id: string | null;
        attached_at: string;
        documents: DocumentRow | null;
      };
      return link.documents
        ? [{ ...link.documents, meeting_id: link.meeting_id, attached_at: link.attached_at }]
        : [];
    }),
  );
}

type StoredRow = DocumentRow & { storage_path: string };

async function loadDocument(
  supabase: SupabaseClient,
  userId: string,
  id: string,
): Promise<WriteResult<StoredRow>> {
  const { data, error } = await supabase
    .from('documents')
    .select(`${DOCUMENT_COLUMNS}, storage_path`)
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) return fail(error.message);
  if (!data) return fail('No such document.');
  return ok(data as unknown as StoredRow);
}

/**
 * Attaches a library file to an application. Attaching twice is not an error:
 * the second call only updates which interview round it is filed under.
 *
 * Ownership of all three ids is checked here as well as by the policy, so a
 * wrong id comes back as a sentence rather than as "new row violates row-level
 * security policy".
 */
export async function attachDocument(
  supabase: SupabaseClient,
  userId: string,
  input: AttachInput,
): Promise<WriteResult<DocumentRow>> {
  const document = await loadDocument(supabase, userId, input.documentId);
  if (document.error !== null) return fail(document.error);

  const { data: application, error: applicationError } = await supabase
    .from('applications')
    .select('id')
    .eq('id', input.applicationId)
    .eq('user_id', userId)
    .maybeSingle();
  if (applicationError) return fail(applicationError.message);
  if (!application) return fail('No such application.');

  if (input.meetingId) {
    const { data: meeting, error: meetingError } = await supabase
      .from('meetings')
      .select('id')
      .eq('id', input.meetingId)
      .eq('application_id', input.applicationId)
      .eq('user_id', userId)
      .maybeSingle();
    if (meetingError) return fail(meetingError.message);
    if (!meeting) return fail('meetingId: that interview round does not belong to this application.');
  }

  const { error } = await supabase.from('application_documents').upsert(
    {
      user_id: userId,
      application_id: input.applicationId,
      document_id: input.documentId,
      meeting_id: input.meetingId,
    },
    { onConflict: 'application_id,document_id' },
  );
  if (error) return fail(error.message);

  const { storage_path: _path, ...row } = document.data;
  return ok(row);
}

/** Removes the attachment. The file stays in the library. */
export async function detachDocument(
  supabase: SupabaseClient,
  userId: string,
  input: DetachInput,
): Promise<WriteResult> {
  const { data, error } = await supabase
    .from('application_documents')
    .delete()
    .eq('user_id', userId)
    .eq('application_id', input.applicationId)
    .eq('document_id', input.documentId)
    .select('id');

  if (error) return fail(error.message);
  if (!data || data.length === 0) return fail('That document is not attached to this application.');
  return ok(null);
}

/**
 * Names the generic CV, or clears it with null.
 *
 * Changing it never touches an application that already has a résumé attached:
 * those keep pointing at the file that was sent, which is the reason there is a
 * pointer here instead of a file that gets replaced.
 */
export async function setDefaultResume(
  supabase: SupabaseClient,
  userId: string,
  documentId: string | null,
): Promise<WriteResult<DocumentRow | null>> {
  let row: DocumentRow | null = null;

  if (documentId) {
    const document = await loadDocument(supabase, userId, documentId);
    if (document.error !== null) return fail(document.error);
    if (document.data.type !== 'resume') {
      return fail(`"${document.data.file_name}" is filed as ${document.data.type}, not as a résumé.`);
    }
    const { storage_path: _path, ...rest } = document.data;
    row = rest;
  }

  const { data, error } = await supabase
    .from('profiles')
    .update({ default_resume_id: documentId })
    .eq('id', userId)
    .select('id');

  if (error) return fail(error.message);
  if (!data || data.length === 0) return fail('No profile to record the default résumé on.');
  return ok(row);
}

/**
 * Attaches the default résumé to an application that has none.
 *
 * Called when an application is first recorded as sent. It is a starting
 * assumption — most applications go out with the generic CV — and it is
 * visible and replaceable, which is better than an empty record nobody
 * remembers to fill in. An application that already has a résumé is left
 * alone: a tailored one must never be joined by the generic one.
 *
 * Returns the file it attached, or null when there was nothing to do. Never an
 * error the caller has to handle: failing to attach a CV is not a reason to
 * fail the status change that triggered it.
 */
export async function attachDefaultResume(
  supabase: SupabaseClient,
  userId: string,
  applicationId: string,
): Promise<DocumentRow | null> {
  const resumeId = await defaultResumeId(supabase, userId);
  if (!resumeId) return null;

  const attached = await listApplicationDocuments(supabase, userId, applicationId);
  if (attached.error !== null || attached.data.some((d) => d.type === 'resume')) return null;

  const result = await attachDocument(supabase, userId, {
    applicationId,
    documentId: resumeId,
    meetingId: null,
  });
  return result.error === null ? result.data : null;
}

/**
 * Deletes a file from the library and from storage.
 *
 * Refused while any application cites it. The database would refuse too (the
 * foreign key is RESTRICT), but its message names a constraint, and the person
 * needs to know which thing to go and detach.
 */
export async function deleteDocument(
  supabase: SupabaseClient,
  userId: string,
  id: string,
): Promise<WriteResult> {
  const document = await loadDocument(supabase, userId, id);
  if (document.error !== null) return fail(document.error);

  const { count, error: countError } = await supabase
    .from('application_documents')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('document_id', id);
  if (countError) return fail(countError.message);
  if (count && count > 0) {
    return fail(
      `"${document.data.file_name}" is attached to ${count} application${count === 1 ? '' : 's'}. ` +
        'Detach it there first — it is the record of what was sent.',
    );
  }

  // Row first. If the object then fails to go, what is left is a file nothing
  // points at; the other order could leave a row pointing at nothing.
  const { error } = await supabase.from('documents').delete().eq('id', id).eq('user_id', userId);
  if (error) return fail(error.message);

  const { error: removeError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .remove([document.data.storage_path]);
  if (removeError) console.warn('[documents] row deleted, object left behind', removeError.message);

  return ok(null);
}

/**
 * A link that downloads the file, valid for `expiresIn` seconds.
 *
 * Signed per request because the bucket is private. `download` makes the
 * response an attachment under the original name, so nothing uploaded here is
 * ever rendered in the browser on the storage origin.
 */
export async function signedDownloadUrl(
  supabase: SupabaseClient,
  userId: string,
  id: string,
  expiresIn = 60,
): Promise<WriteResult<{ url: string; document: DocumentRow }>> {
  const document = await loadDocument(supabase, userId, id);
  if (document.error !== null) return fail(document.error);

  const { storage_path: path, ...row } = document.data;
  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(path, expiresIn, { download: row.file_name });

  if (error || !data) return fail(`Could not sign a download link: ${error?.message ?? 'unknown error'}`);
  return ok({ url: data.signedUrl, document: row });
}

/**
 * The file's contents as text, for a caller that reads rather than downloads.
 * Null for a PDF or a Word file: those are bytes, and passing them off as text
 * would hand a model noise it might try to interpret.
 */
export async function readDocumentText(
  supabase: SupabaseClient,
  userId: string,
  id: string,
): Promise<WriteResult<{ document: DocumentRow; text: string | null }>> {
  const document = await loadDocument(supabase, userId, id);
  if (document.error !== null) return fail(document.error);

  const { storage_path: path, ...row } = document.data;
  if (!isTextMimeType(row.mime_type)) return ok({ document: row, text: null });

  const { data, error } = await supabase.storage.from(STORAGE_BUCKET).download(path);
  if (error || !data) return fail(`Could not read the file: ${error?.message ?? 'unknown error'}`);
  return ok({ document: row, text: await data.text() });
}
