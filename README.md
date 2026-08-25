# Job Application Tracker

Tracks job applications through a pipeline (Wishlist → Applied → Phone Screen →
Interview → Offer → Rejected/Withdrawn), with a stats dashboard as a core
feature. See [PLAN.md](PLAN.md) for the full spec and the reasoning behind the
data model.

## Prerequisites

- **Node.js 20+** — <https://nodejs.org> (or via `nvm`). Not currently installed.
- A **Supabase project** — <https://supabase.com/dashboard>

## Setup

1. In the Supabase SQL editor, run [`supabase/bootstrap.sql`](supabase/bootstrap.sql).
   Creates all tables, indexes, the `updated_at` trigger, and the RLS policies.
   This step needs no Node and is safe to re-run.
2. `cp .env.example .env` and fill in all four values.
3. Then:

```bash
npm install
npm run db:push   # confirms schema.ts and the live DB agree (expect no changes)
npm run dev
```

The publishable key is browser-safe and bound by RLS. The secret key bypasses
RLS — keep it server-side and never prefix it `NEXT_PUBLIC_`.

## Layout

| Path | What |
|---|---|
| `src/db/schema.ts` | Single source of truth for the data model |
| `src/db/scope.ts` | Ownership predicate for Drizzle queries, which bypass RLS |
| `supabase/bootstrap.sql` | One-time DDL + RLS, mirrors `schema.ts` |
| `src/db/index.ts` | Drizzle client |
| `drizzle/` | Generated migrations once Node is available — commit, never edit |

## Prior art

`../jobApplicationTracking_old` is the 2019-era version (Express + Mongo +
Angular). Its data model is the reason this one tracks meetings, recruiters, and
recruiter-vs-direct sourcing; see the table at the top of [PLAN.md](PLAN.md).
