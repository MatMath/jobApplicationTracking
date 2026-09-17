import { z } from 'zod';
import {
  APPLICATION_TYPES,
  MEETING_OUTCOMES,
  MEETING_PURPOSES,
  OUTCOMES,
  REMOTE_TYPES,
  STATUSES,
} from '@/db/schema';

/**
 * Validation for every write path — the form and the MCP tools both parse
 * through here.
 *
 * Until now the enum columns were unchecked: they are `text` in Postgres with no
 * constraint (a deliberate choice, see db/schema.ts), and the Server Actions
 * passed whatever string arrived straight to the insert. A typo in the form was
 * survivable because the form only ever emitted values from its own <select>.
 * A model calling a tool is not so constrained, so the value sets that were
 * documentation in db/schema.ts become enforcement here.
 *
 * The preprocessors exist because the two callers disagree about "absent": a
 * form sends "", JSON sends null or omits the key. Normalizing both to null in
 * the schema keeps that difference out of the write logic.
 */

/** "" | undefined | whitespace -> null, so the column stores null, not blank. */
const optionalText = z.preprocess((v) => {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}, z.string().nullable());

/** Same, but rejecting blank rather than nulling it. */
const requiredText = z.preprocess(
  (v) => (v === null || v === undefined ? '' : String(v).trim()),
  z.string().min(1),
);

/**
 * Unparseable numbers become null rather than an error, matching what the form
 * did before: a salary field holding "competitive" should not block the write.
 */
const optionalInt = z.preprocess((v) => {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? Math.trunc(v) : null;
  const n = Number.parseInt(String(v), 10);
  return Number.isNaN(n) ? null : n;
}, z.number().int().nullable());

function optionalEnum<const T extends readonly [string, ...string[]]>(values: T) {
  return z.preprocess(
    (v) => (v === null || v === undefined || v === '' ? null : v),
    z.enum(values).nullable(),
  );
}

/** A calendar date, converted to local midnight on write (see lib/date.ts). */
const optionalDate = z.preprocess(
  (v) => (v === null || v === undefined || v === '' ? null : String(v).trim()),
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected a date as YYYY-MM-DD')
    .nullable(),
);

/** An instant. The form sends datetime-local; a tool sends ISO 8601. */
const optionalTimestamp = z.preprocess((v) => {
  if (v === null || v === undefined || v === '') return null;
  const parsed = new Date(String(v));
  return Number.isNaN(parsed.getTime()) ? String(v) : parsed.toISOString();
}, z.string().datetime({ offset: true }).nullable());

const optionalUrl = z.preprocess((v) => {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (s === '') return null;
  // A pasted domain is a URL with the scheme left off, not an error.
  return /^https?:\/\//i.test(s) ? s : `https://${s}`;
}, z.url().nullable());

const applicationFields = z.object({
  company: requiredText,
  companyWebsite: optionalUrl.default(null),
  role: requiredText,
  description: optionalText.default(null),
  jobUrl: optionalUrl.default(null),
  applicationType: optionalEnum(APPLICATION_TYPES).default(null),
  platformFound: optionalText.default(null),
  platformApplied: optionalText.default(null),
  location: optionalText.default(null),
  /** Google's place id, when the address came from a Places lookup. */
  locationPlaceId: optionalText.default(null),
  remoteType: optionalEnum(REMOTE_TYPES).default(null),
  salaryMin: optionalInt.default(null),
  salaryMax: optionalInt.default(null),
  salaryCurrency: optionalText.default(null),
  coverLetter: optionalText.default(null),
  status: z.enum(STATUSES).default('wishlist'),
  appliedAt: optionalDate.default(null),
});

/**
 * An office address is required unless the role is fully remote.
 *
 * Only `remote` excuses it — hybrid and onsite both mean showing up somewhere,
 * and a blank arrangement means nobody has established that the job is remote.
 * The rule is one-directional on purpose: a remote role may still record an
 * address (a head office to visit quarterly is worth knowing, and a remote
 * posting is often remote-within-a-region), it simply is not made to.
 */
function requireOfficeLocation<T extends { location: string | null; remoteType: string | null }>(
  value: T,
  ctx: z.RefinementCtx,
): void {
  if (value.location || value.remoteType === 'remote') return;
  ctx.addIssue({
    code: 'custom',
    path: ['location'],
    message: 'Where is the office? Required unless the role is fully remote.',
  });
}

export const applicationInput = applicationFields.superRefine(requireOfficeLocation);

/**
 * Editing carries the id and may close the application out. Built from the
 * field set rather than from `applicationInput` so the refinement applies to
 * the extended shape too — extending a refined schema drops the refinement.
 */
export const applicationUpdateInput = applicationFields
  .extend({
    id: z.uuid(),
    outcome: optionalEnum(OUTCOMES).default(null),
    rejectionReason: optionalText.default(null),
  })
  .superRefine(requireOfficeLocation);

/**
 * Changing where the office is, without touching anything else. The form
 * rewrites every column on save, which is right for a form and wrong for "that
 * role is at their Toronto office, not Montreal".
 */
export const locationChangeInput = z
  .object({
    id: z.uuid(),
    location: optionalText.default(null),
    locationPlaceId: optionalText.default(null),
  })
  .refine((v) => v.location !== null || v.locationPlaceId !== null, {
    path: ['location'],
    message: 'Pass an address, a place id, or both.',
  });

/** Status-only move, for "I got a phone screen at Acme". */
export const statusChangeInput = z.object({
  id: z.uuid(),
  status: z.enum(STATUSES),
  outcome: optionalEnum(OUTCOMES).default(null),
  rejectionReason: optionalText.default(null),
});

export const noteInput = z.object({
  applicationId: z.uuid(),
  content: requiredText,
});

export const meetingInput = z.object({
  applicationId: z.uuid(),
  scheduledAt: optionalTimestamp.default(null),
  purpose: optionalEnum(MEETING_PURPOSES).default(null),
  participants: z.preprocess((v) => {
    if (v === null || v === undefined || v === '') return null;
    // The form sends one comma-separated string; a tool sends an array.
    const list = Array.isArray(v) ? v.map(String) : String(v).split(',');
    const cleaned = list.map((p) => p.trim()).filter(Boolean);
    return cleaned.length > 0 ? cleaned : null;
  }, z.array(z.string()).nullable()).default(null),
  challenge: optionalText.default(null),
  outcome: z.enum(MEETING_OUTCOMES).default('pending'),
  notes: optionalText.default(null),
});

export const applicationSearchInput = z.object({
  query: optionalText.default(null),
  status: optionalEnum(STATUSES).default(null),
  company: optionalText.default(null),
  limit: z.number().int().min(1).max(100).default(25),
});

export type ApplicationInput = z.infer<typeof applicationInput>;
export type LocationChangeInput = z.infer<typeof locationChangeInput>;
export type ApplicationUpdateInput = z.infer<typeof applicationUpdateInput>;
export type StatusChangeInput = z.infer<typeof statusChangeInput>;
export type NoteInput = z.infer<typeof noteInput>;
export type MeetingInput = z.infer<typeof meetingInput>;
export type ApplicationSearchInput = z.infer<typeof applicationSearchInput>;

/**
 * Collapses a ZodError into one line. Both callers surface errors as a string:
 * the form renders it in its alert, a tool returns it as text for the model to
 * act on, so both want the field name in the message.
 */
export function formatIssues(error: z.ZodError): string {
  return error.issues
    .map((i) => (i.path.length > 0 ? `${i.path.join('.')}: ${i.message}` : i.message))
    .join('; ');
}
