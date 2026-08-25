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
export const DOCUMENT_TYPES = ['resume', 'cover_letter', 'other'] as const;

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
    location: text('location'),
    remoteType: text('remote_type').$type<RemoteType>(),
    salaryMin: integer('salary_min'),
    salaryMax: integer('salary_max'),
    salaryCurrency: text('salary_currency').default('CAD'),
    // The old system stored the cover letter inline as text; `documents` covers
    // uploaded file versions. Both are useful, so both exist.
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

export const documents = pgTable(
  'documents',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => authUsers.id, { onDelete: 'cascade' }),
    applicationId: uuid('application_id')
      .notNull()
      .references(() => applications.id, { onDelete: 'cascade' }),
    fileName: text('file_name').notNull(),
    fileUrl: text('file_url').notNull(),
    type: text('type').$type<(typeof DOCUMENT_TYPES)[number]>(),
    uploadedAt: timestamp('uploaded_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('documents_application_idx').on(t.applicationId)],
);
