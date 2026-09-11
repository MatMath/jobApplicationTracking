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
   An already-provisioned database instead needs the numbered files it has
   not yet run, in order: [`002_profiles.sql`](supabase/002_profiles.sql),
   [`003_dashboard.sql`](supabase/003_dashboard.sql).
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

## Deploy (Google Cloud Run)

Needs the [`gcloud` CLI](https://cloud.google.com/sdk/docs/install) and a GCP
project with billing enabled.

```bash
gcloud auth login
gcloud config set project <PROJECT_ID>
./scripts/gcp/setup.sh     # once: APIs, image repo, service accounts, empty secrets
./scripts/gcp/secrets.sh   # values from .env - or set them in the console
npm run deploy             # build, push, deploy
```

**What goes into Secret Manager: three values, all build-time.**
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`,
`NEXT_PUBLIC_LOGO_DEV_TOKEN`. Cloud Build fetches them itself
(`availableSecrets` in `cloudbuild.yaml`) and passes them to `docker build`;
they exist only inside that build step. Because Next inlines `NEXT_PUBLIC_*`
into the bundle, **changing one means redeploying** - adding a secret version
alone changes nothing that is running.

**What deliberately does not:** `SUPABASE_SECRET_KEY` and `DATABASE_URL`.
Both bypass RLS, and the app needs neither at runtime - the running service is
given no secrets at all.

If you create secrets in the console, paste the bare value. A trailing newline
would be inlined into the JavaScript; the build strips one defensively, but it
is better not to have it.

**After the first deploy**, take the service URL it prints and:

1. Supabase → Authentication → URL Configuration: set the Site URL, and add
   `https://<service-url>/auth/callback` to the redirect URLs. Without this,
   Supabase sends users back to the old Site URL after Google sign-in.
2. Google's redirect URI stays the Supabase one
   (`https://<project-ref>.supabase.co/auth/v1/callback`) - nothing to change.
3. Optional: with a custom domain, redeploy with
   `npm run deploy -- --substitutions=_SITE_URL=https://your.domain`.

Defaults (region `northamerica-northeast1`, `TZ=America/Toronto`, scale to
zero, max 2 instances) live in `cloudbuild.yaml` under `substitutions`. Put
the region near your Supabase project's: every page load makes Supabase calls.

## Layout

| Path | What |
|---|---|
| `src/db/schema.ts` | Single source of truth for the data model |
| `src/db/scope.ts` | Ownership predicate for Drizzle queries, which bypass RLS |
| `supabase/bootstrap.sql` | One-time DDL + RLS, mirrors `schema.ts` |
| `src/db/index.ts` | Drizzle client |
| `drizzle/` | Generated migrations once Node is available — commit, never edit |
| `Dockerfile` | Three-stage build to a standalone Next server |
| `cloudbuild.yaml` | Build, push, deploy; pulls config from Secret Manager |
| `scripts/gcp/` | One-time project setup and secret upload |

## Prior art

The 2019-era version (Express + Mongo + Angular). Its data model is the reason this one tracks meetings, recruiters, and
recruiter-vs-direct sourcing; see the table at the top of [PLAN.md](PLAN.md).
