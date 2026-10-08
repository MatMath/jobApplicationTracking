import { sql } from 'drizzle-orm';
import {
  doublePrecision,
  index,
  integer,
  pgSchema,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';

/**
 * Enum-ish value sets. Kept as text columns rather than Postgres enums so that
 * adding a value later is a code change, not a migration. The old system did the
 * same thing via Joi `.allow(...)` lists.
 */
export const APPLICATION_TYPES = ['recruiter', 'direct'] as const;
export const STATUSES = [
  'wishlist',
  'applied',
  'phone_screen',
  'interview',
  'offer',
  'rejected',
  'withdrawn',
] as const;
export const OUTCOMES = [
  'accepted',
  'declined',
  'rejected',
  'withdrawn',
  'ghosted',
] as const;
export const REMOTE_TYPES = ['remote', 'hybrid', 'onsite'] as const;
export const CONTACT_KINDS = [
  'recruiter',
  'referral',
  'hiring_manager',
  'other',
] as const;
export const MEETING_PURPOSES = [
  'phone_screen',
  'technical',
  'behavioral',
  'onsite',
  'final',
  'other',
] as const;
export const MEETING_OUTCOMES = ['pending', 'passed', 'failed'] as const;
export const DOCUMENT_TYPES = [
  'resume',
  'cover_letter',
  'job_posting',
  'assignment',
  'assignment_submission',
  'other',
] as const;

/** Statuses that mean the company got back to us in some form. */
export const RESPONDED_STATUSES = [
  'phone_screen',
  'interview',
  'offer',
  'rejected',
] as const;

export type ApplicationType = (typeof APPLICATION_TYPES)[number];
export type Status = (typeof STATUSES)[number];
export type Outcome = (typeof OUTCOMES)[number];
export type RemoteType = (typeof REMOTE_TYPES)[number];
export type ContactKind = (typeof CONTACT_KINDS)[number];
export type MeetingPurpose = (typeof MEETING_PURPOSES)[number];
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

/**
 * Supabase Auth owns `auth.users` — it is created and managed by the platform,
 * not by our migrations. Declaring it here only gives Drizzle something to point
 * foreign keys at; `db:generate` must never emit DDL for it.
 *
 * This is also what makes RLS work: policies compare `user_id` against
 * `auth.uid()`, which Supabase derives from the request's JWT. That function
 * only returns a value for a Supabase-issued session, which is why the app uses
 * Supabase Auth rather than a separate auth library.
 */
export const authUsers = pgSchema('auth').table('users', {
  id: uuid('id').primaryKey(),
});

/**
 * One row per user, created automatically by an `on auth.users` trigger the
 * first time someone signs in. Supabase keeps identity in `auth.users`, which
 * application code cannot join against or extend; this mirrors the parts we
 * need (display name, avatar from the Google profile) into a table we own, and
 * gives user-level preferences somewhere to live later.
 *
 * The old system did the same thing at the application layer, writing a user
 * document on every login via passport's serializeUser. A database trigger is
 * the equivalent that cannot be bypassed by a second sign-in path.
 */
export const profiles = pgTable('profiles', {
  id: uuid('id')
    .primaryKey()
    .references(() => authUsers.id, { onDelete: 'cascade' }),
  email: text('email'),
  fullName: text('full_name'),
  avatarUrl: text('avatar_url'),
  // The generic CV: the one attached to an application unless a tailored one
  // is. A pointer rather than a flag on `documents` so there can only be one,
  // and replacing it is a single write. Its foreign key is declared in SQL
  // only (supabase/005_documents.sql) — `documents` is defined further down
  // this file, and the two tables would otherwise reference each other.
  defaultResumeId: uuid('default_resume_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

/**
 * Companies. Normalized rather than free text on the application: the dashboard
 * groups by company, and "Shopify" / "shopify " / "Shopify Inc" would otherwise
 * split one company's stats across three rows.
 */
export const companies = pgTable(
  'companies',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => authUsers.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    location: text('location'),
    // Phase 2 map view. The old system stored a full GeoJSON Feature per company;
    // two floats carry the same information for any mapping library.
    lat: doublePrecision('lat'),
    lng: doublePrecision('lng'),
    website: text('website'),
    notes: text('notes'),
    // What the company does, in at most five short labels ("Fintech", "AI",
    // "Insurance") — see lib/applications/schema.ts for the limit. On the
    // company, not the application: it is a fact about the employer, and two
    // postings at one company should not need tagging twice.
    tags: text('tags').array().notNull().default(sql`'{}'::text[]`),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    unique('companies_user_name_unique').on(t.userId, t.name),
    index('companies_user_idx').on(t.userId),
  ],
);

/**
 * Contacts. The old system's standalone `recruiters` collection, widened with a
 * `kind` discriminator so referrals and hiring managers live here too rather
 * than needing a second near-identical table.
 */
export const contacts = pgTable(
  'contacts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => authUsers.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    kind: text('kind').$type<ContactKind>().default('recruiter'),
    // The old `cie` field: the agency a recruiter works *for*, which is usually
    // not the company being hired for.
    agency: text('agency'),
    companyId: uuid('company_id').references(() => companies.id, {
      onDelete: 'set null',
    }),
    email: text('email'),
    phone: text('phone'),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('contacts_user_idx').on(t.userId)],
);

export const applications = pgTable(
  'applications',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => authUsers.id, { onDelete: 'cascade' }),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'restrict' }),
    role: text('role').notNull(),
    // Restored from the old model: job postings are taken down, so the URL alone
    // rots. Keeping the body means the record survives the posting.
    description: text('description'),
    jobUrl: text('job_url'),
    applicationType: text('application_type').$type<ApplicationType>(),
    recruiterId: uuid('recruiter_id').references(() => contacts.id, {
      onDelete: 'set null',
    }),
    // Where the listing was found vs. where the application was submitted. These
    // differ often (found on LinkedIn, applied on the company's own site) and
    // conflating them makes per-platform response rates meaningless.
    platformFound: text('platform_found'),
    platformApplied: text('platform_applied'),
    // The office, not the company. `companies` carries lat/lng too, but one
    // employer has several offices and the question this answers is "where
    // would I be going if I took *this* job" — which is a property of the
    // posting. Required for anything but a fully remote role; see
    // lib/applications/schema.ts.
    location: text('location'),
    // Google's id for the resolved address. Kept so an edit can tell "the user
    // picked a different place" from "the user fixed a typo", and so the
    // coordinates can be re-fetched later without re-guessing from the text.
    locationPlaceId: text('location_place_id'),
    // Written by the server from the Places lookup, never by the client.
    locationLat: doublePrecision('location_lat'),
    locationLng: doublePrecision('location_lng'),
    remoteType: text('remote_type').$type<RemoteType>(),
    salaryMin: integer('salary_min'),
    salaryMax: integer('salary_max'),
    salaryCurrency: text('salary_currency').default('CAD'),
    // The old system stored the cover letter inline as text; an attached file
    // (see `applicationDocuments`) is the record of what was actually sent.
    // Both are useful — the text is searchable — so both exist.
    coverLetter: text('cover_letter'),
    status: text('status').$type<Status>().notNull().default('wishlist'),
    outcome: text('outcome').$type<Outcome>(),
    rejectionReason: text('rejection_reason'),
    appliedAt: timestamp('applied_at', { withTimezone: true }),
    // Explicit rather than derived. A rejection is a response, so inferring this
    // from "reached an advanced status" would undercount and skew time-to-reply.
    firstResponseAt: timestamp('first_response_at', { withTimezone: true }),
    closedAt: timestamp('closed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('applications_user_idx').on(t.userId),
    index('applications_user_status_idx').on(t.userId, t.status),
    index('applications_user_applied_idx').on(t.userId, t.appliedAt),
    index('applications_company_idx').on(t.companyId),
    // The dashboard map only ever asks for rows that have coordinates, so the
    // index carries those and skips the nulls.
    index('applications_user_located_idx')
      .on(t.userId, t.locationLat)
      .where(sql`location_lat is not null`),
  ],
);

/**
 * One row per interview round. The old system carried this as an embedded
 * `meeting[]` array and it was the richest data it held — who you met, what the
 * round was for, and what technical challenge you were given.
 */
export const meetings = pgTable(
  'meetings',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => authUsers.id, { onDelete: 'cascade' }),
    applicationId: uuid('application_id')
      .notNull()
      .references(() => applications.id, { onDelete: 'cascade' }),
    scheduledAt: timestamp('scheduled_at', { withTimezone: true }),
    purpose: text('purpose').$type<MeetingPurpose>(),
    // Free text rather than a join to `contacts`: requiring a contact record for
    // every interviewer is enough friction that the field stops getting filled.
    participants: text('participants').array(),
    challenge: text('challenge'),
    outcome: text('outcome').$type<(typeof MEETING_OUTCOMES)[number]>().default('pending'),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('meetings_user_idx').on(t.userId),
    index('meetings_application_idx').on(t.applicationId),
  ],
);

/** Append-only status log. Powers the timeline view and time-in-stage stats. */
export const statusHistory = pgTable(
  'status_history',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => authUsers.id, { onDelete: 'cascade' }),
    applicationId: uuid('application_id')
      .notNull()
      .references(() => applications.id, { onDelete: 'cascade' }),
    status: text('status').$type<Status>().notNull(),
    changedAt: timestamp('changed_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('status_history_user_idx').on(t.userId),
    index('status_history_application_idx').on(t.applicationId),
  ],
);

export const notes = pgTable(
  'notes',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => authUsers.id, { onDelete: 'cascade' }),
    applicationId: uuid('application_id')
      .notNull()
      .references(() => applications.id, { onDelete: 'cascade' }),
    content: text('content').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('notes_application_idx').on(t.applicationId)],
);

/**
 * The file library. One row per uploaded file, and a row never changes once
 * written: there is no update path, in the code or in the storage policies.
 *
 * That is the whole point of the table. "Which CV did I send them" is only
 * answerable if the file an application points at cannot be edited afterwards,
 * so a revised CV is a new row rather than a new version of an old one, and
 * every application keeps pointing at exactly what was sent.
 *
 * A file belongs to the user, not to an application — the generic CV is one
 * file attached to many. `application_documents` is the attachment.
 *
 * The bytes live in Supabase Storage, in the private `documents` bucket, at
 * `storage_path`. A path rather than a URL because a private bucket has no
 * stable URL; downloads are signed per request.
 */
export const documents = pgTable(
  'documents',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => authUsers.id, { onDelete: 'cascade' }),
    fileName: text('file_name').notNull(),
    storagePath: text('storage_path').notNull(),
    type: text('type').$type<DocumentType>().notNull().default('other'),
    // What the server decided the file is, from its extension and first bytes —
    // never the browser's claim. See lib/documents/files.ts.
    mimeType: text('mime_type').notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    // Content hash. Uploading the same bytes twice resolves to the row already
    // there, which is what lets a caller say "attach this file" without first
    // working out whether it is already in the library.
    sha256: text('sha256').notNull(),
    uploadedAt: timestamp('uploaded_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('documents_user_idx').on(t.userId),
    unique('documents_storage_path_unique').on(t.storagePath),
    unique('documents_user_sha256_unique').on(t.userId, t.sha256),
  ],
);

/**
 * A file attached to an application: the CV and cover letter that were sent,
 * the posting as a PDF, the take-home brief and what was handed back.
 *
 * `document_id` is ON DELETE RESTRICT. A file that some application records as
 * "what I sent" cannot be deleted out from under it; it has to be detached
 * first, which is a decision rather than a side effect.
 *
 * `meeting_id` is optional and ties an assignment to the interview round that
 * set it. It is SET NULL: removing a round should not take the brief with it.
 */
export const applicationDocuments = pgTable(
  'application_documents',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => authUsers.id, { onDelete: 'cascade' }),
    applicationId: uuid('application_id')
      .notNull()
      .references(() => applications.id, { onDelete: 'cascade' }),
    documentId: uuid('document_id')
      .notNull()
      .references(() => documents.id, { onDelete: 'restrict' }),
    meetingId: uuid('meeting_id').references(() => meetings.id, { onDelete: 'set null' }),
    attachedAt: timestamp('attached_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    unique('application_documents_unique').on(t.applicationId, t.documentId),
    index('application_documents_application_idx').on(t.applicationId),
    index('application_documents_document_idx').on(t.documentId),
  ],
);
