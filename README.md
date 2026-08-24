# Job Application Tracker

Tracks job applications through a pipeline (Wishlist → Applied → Phone Screen →
Interview → Offer → Rejected/Withdrawn), with a stats dashboard as a core
feature. See [PLAN.md](PLAN.md) for the full spec and the reasoning behind the
data model.

## Prerequisites

Neither is currently installed on this machine:

- **Node.js 20+** — <https://nodejs.org> (or via `nvm`)
- **Docker Desktop** or **OrbStack** — for local Postgres

## Setup

```bash
cp .env.example .env      # then fill in AUTH_SECRET
npm install
npm run db:up             # starts Postgres on :5432
npm run db:generate       # generate SQL from src/db/schema.ts
npm run db:migrate        # apply it
npm run dev
```

To skip Google OAuth during development, set `DEV_USER_ID` in `.env` to a user
row's uuid. It is ignored unless `NODE_ENV=development`.

## Layout

| Path | What |
|---|---|
| `src/db/schema.ts` | Single source of truth for the data model |
| `src/db/scope.ts` | Ownership predicate — every user query goes through it |
| `src/db/index.ts` | Drizzle client |
| `drizzle/` | Generated migrations — commit these, never edit them |

## Prior art

`../jobApplicationTracking_old` is the 2019-era version (Express + Mongo +
Angular). Its data model is the reason this one tracks meetings, recruiters, and
recruiter-vs-direct sourcing; see the table at the top of [PLAN.md](PLAN.md).
