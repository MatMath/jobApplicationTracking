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
   Creates all tables, indexes, the `updated_at` trigger, the `profiles`
   provisioning trigger, and the RLS policies. Safe to re-run.
   (An already-provisioned database instead needs only
   [`supabase/002_profiles.sql`](supabase/002_profiles.sql).)
2. In Authentication → Sign In / Providers: enable **Google** (Client ID and
   Secret from Google Cloud Console, with
   `https://<project-ref>.supabase.co/auth/v1/callback` as an authorized
   redirect URI), and **disable Email**.

   Disabling Email matters. Removing the password fields from the UI does not
   remove the password path — while the Email provider is on, anyone can still
   register straight against the Supabase API. SSO-only has to be enforced at
   the provider, not the form.
3. `cp .env.example .env` and fill in the values.
4. Then:

```bash
npm install
npm run db:push   # confirms schema.ts and the live DB agree (expect no changes)
npm run dev
```

Use `npm run build:check` rather than `npm run build` while the dev server is
running. A plain build writes to the same `.next` the dev server serves from and
corrupts its chunks, producing a blank page and a `__webpack_modules__[moduleId]
is not a function` exception. `build:check` targets `.next-build` instead.

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

The 2019-era version (Express + Mongo + Angular). Its data model is the reason this one tracks meetings, recruiters, and
recruiter-vs-direct sourcing; see the table at the top of [PLAN.md](PLAN.md).
