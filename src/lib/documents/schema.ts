import { z } from 'zod';
import { DOCUMENT_TYPES } from '@/db/schema';

/**
 * Validation for the document write paths. Same arrangement as
 * lib/applications/schema.ts: the form and the MCP tools both parse through
 * here, and the two disagree about what "absent" looks like, so blank, null and
 * missing are all folded to null before anything reads them.
 *
 * The file itself is not validated here. Its name and bytes go to
 * lib/documents/files.ts, which is the only thing that decides what is
 * acceptable; these schemas cover what surrounds the file.
 */

const optionalId = z.preprocess(
  (v) => (v === null || v === undefined || v === '' ? null : v),
  z.uuid().nullable(),
);

/** A form checkbox sends "on"; a tool sends a boolean. */
const flag = z.preprocess((v) => v === true || v === 'true' || v === 'on', z.boolean());

export const documentUploadInput = z.object({
  type: z.preprocess(
    (v) => (v === null || v === undefined || v === '' ? 'other' : v),
    z.enum(DOCUMENT_TYPES),
  ),
  /** Attach to this application in the same step. */
  applicationId: optionalId.default(null),
  /** The interview round an assignment belongs to. Needs `applicationId`. */
  meetingId: optionalId.default(null),
  makeDefaultResume: flag.default(false),
});

export const attachInput = z.object({
  applicationId: z.uuid(),
  documentId: z.uuid(),
  meetingId: optionalId.default(null),
});

export const detachInput = z.object({
  applicationId: z.uuid(),
  documentId: z.uuid(),
});

export const documentListInput = z.object({
  type: z.preprocess(
    (v) => (v === null || v === undefined || v === '' ? null : v),
    z.enum(DOCUMENT_TYPES).nullable(),
  ).default(null),
});

export type DocumentUploadInput = z.infer<typeof documentUploadInput>;
export type AttachInput = z.infer<typeof attachInput>;
export type DetachInput = z.infer<typeof detachInput>;
export type DocumentListInput = z.infer<typeof documentListInput>;
