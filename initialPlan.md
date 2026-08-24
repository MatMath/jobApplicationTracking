> **Superseded by [PLAN.md](PLAN.md)** (v2), which restores the data model from
> `jobApplicationTracking_old`. Kept here as the original input for reference.

# Job Application Tracker — Build Spec

## Overview
A web app for tracking job applications through a pipeline (Wishlist → Applied → Phone Screen → Interview → Offer → Rejected/Withdrawn), with a stats dashboard as a core feature. Single-user-per-account (auth required), no team/multi-tenant features needed.

---

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js (App Router) + TypeScript |
| Styling/UI | Tailwind CSS + shadcn/ui |
| Database | Postgres via Supabase |
| Auth | Supabase Auth (email/password + Google OAuth) |
| ORM | Drizzle |
| File storage | Supabase Storage (resume/cover letter uploads) |
| Hosting | Vercel |
| Data fetching | TanStack Query or React Server Components |
| Charts | Recharts or Tremor |

### Why Drizzle (ORM)
- **Type safety**: schema defined once in TypeScript; queries are autocompleted and type-checked at compile time instead of failing at runtime like raw SQL strings.
- **Migrations**: Drizzle diffs the schema file against the live database and generates the SQL to reconcile them — no hand-written migration scripts.
- **Single source of truth**: the schema file doubles as documentation of the data model.
- Queries stay close to real SQL (vs. Prisma's more abstracted query syntax), which matters here since the dashboard needs custom aggregation queries.

---

## Core Features (MVP — build first)

- **Application entries**: company, role, job posting URL, salary range, location, date applied
- **Source/platform tracking**: 
  - `platform_found` — where the listing was discovered (LinkedIn, Indeed, Glassdoor, company site, referral, other)
  - `platform_applied` — where the application was submitted (can differ from where it was found)
- **Status pipeline** (kanban board view): Wishlist → Applied → Phone Screen → Interview → Offer → Rejected → Withdrawn
- **Notes** per application (free text, timestamped)
- **Document attachments**: resume/cover letter versions, tied to specific applications, stored in Supabase Storage
- **Search, filter, sort**: by status, company, platform, date

## Explicitly Out of Scope (for now — do not build)
- Reminders / follow-up notifications
- Browser extension / bookmarklet capture
- Email parsing / inbox integration
- Any AI/LLM features (auto-extraction, resume matching, drafted emails)

## Phase 2 (after MVP is working)
- Contact/networking tracker (recruiters, referrals)
- Calendar view for interviews
- Timeline view per application (visual status history)
- Tags (remote, dream job, referral, etc.)

---

## Dashboard Requirements

The dashboard is a core MVP feature, not an afterthought. Stats should be computed via SQL aggregation queries (GROUP BY, not client-side reduction).

**Funnel & conversion**
- Overall response rate, and response rate broken down by platform
- Conversion rate at each pipeline stage (Applied → Screen → Interview → Offer)
- Which platform produces the most offers (not just most applications)

**Time-based**
- Applications per week/month (bar chart)
- Average time-to-first-response, overall and by platform
- Average time spent in each pipeline stage
- Oldest application still awaiting a response

**Motivational / fun**
- Ghosting rate: % of applications with no response after 30 days, by platform
- Busiest application day of the week
- Streak tracker: consecutive days/weeks with at least one application
- Salary range applied-to vs. salary range that converted to interviews
- Top 3 companies/platforms by response rate

**Patterns**
- Most-applied-to industries or role titles
- Remote vs. hybrid vs. onsite split, and which converts better

---

## Proposed Database Schema

Auth/users handled entirely by Supabase Auth — no custom `users` table needed unless extra profile fields are required later.

```ts
// applications
export const applications = pgTable('applications', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull(), // references auth.users
  company: text('company').notNull(),
  role: text('role').notNull(),
  jobUrl: text('job_url'),
  platformFound: text('platform_found'), // LinkedIn, Indeed, Glassdoor, Referral, Company Site, Other
  platformApplied: text('platform_applied'),
  location: text('location'),
  remoteType: text('remote_type'), // remote | hybrid | onsite
  salaryMin: integer('salary_min'),
  salaryMax: integer('salary_max'),
  status: text('status').notNull().default('wishlist'),
  appliedAt: timestamp('applied_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// status_history — powers timeline view + "time in stage" stats
export const statusHistory = pgTable('status_history', {
  id: uuid('id').defaultRandom().primaryKey(),
  applicationId: uuid('application_id').notNull().references(() => applications.id),
  status: text('status').notNull(),
  changedAt: timestamp('changed_at').defaultNow(),
});

// notes
export const notes = pgTable('notes', {
  id: uuid('id').defaultRandom().primaryKey(),
  applicationId: uuid('application_id').notNull().references(() => applications.id),
  content: text('content').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// documents — resume/cover letter uploads
export const documents = pgTable('documents', {
  id: uuid('id').defaultRandom().primaryKey(),
  applicationId: uuid('application_id').notNull().references(() => applications.id),
  fileName: text('file_name').notNull(),
  fileUrl: text('file_url').notNull(), // Supabase Storage path
  type: text('type'), // resume | cover_letter | other
  uploadedAt: timestamp('uploaded_at').defaultNow(),
});
```

**Phase 2 schema (not needed for MVP, listed for reference):**
```ts
// contacts
export const contacts = pgTable('contacts', {
  id: uuid('id').defaultRandom().primaryKey(),
  applicationId: uuid('application_id').references(() => applications.id),
  name: text('name'),
  role: text('role'), // recruiter, referral, hiring manager
  email: text('email'),
  notes: text('notes'),
});

// tags + join table
export const tags = pgTable('tags', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
});

export const applicationTags = pgTable('application_tags', {
  applicationId: uuid('application_id').notNull().references(() => applications.id),
  tagId: uuid('tag_id').notNull().references(() => tags.id),
});
```

---

## Suggested Build Order

1. Scaffold Next.js project, connect Supabase (auth + Postgres), set up Drizzle schema/migrations
2. Build application CRUD (add/edit/delete) with the core fields above
3. Build kanban board view with drag-to-update-status (write to `status_history` on every change)
4. Add notes + document upload per application
5. Build search/filter/sort on the list view
6. Build dashboard: start with response rate by platform and applications-per-week, then layer in the rest
7. Polish: empty states, loading states, mobile responsiveness