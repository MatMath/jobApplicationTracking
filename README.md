# Job Application Tracker

Tracks job applications through a pipeline (Wishlist → Applied → Phone Screen →
Interview → Offer → Rejected/Withdrawn), with a stats dashboard as a core
feature. See [PLAN.md](PLAN.md) for the full spec and the reasoning behind the
data model.

## Prerequisites

- **Node.js 20+** — <https://nodejs.org> (or via `nvm`). Not currently installed.
- A **Supabase project** — <https://supabase.com/dashboard>
- A **Google Maps Platform key** for office addresses and the dashboard map —
  optional, see [Office locations](#office-locations-and-the-map). Without it
  addresses still save; they just get no map pin.

## Setup

1. In the Supabase SQL editor, run [`supabase/bootstrap.sql`](supabase/bootstrap.sql).
   Creates all tables, indexes, the `updated_at` trigger, the `profiles`
   provisioning trigger, and the RLS policies. Safe to re-run.
   An already-provisioned database instead needs the numbered files it has
   not yet run, in order: [`002_profiles.sql`](supabase/002_profiles.sql),
   [`003_dashboard.sql`](supabase/003_dashboard.sql),
   [`004_application_location.sql`](supabase/004_application_location.sql).

   Skipping one shows up at runtime, not at build time — saving an application
   against a database missing `004` fails with *"Could not find the
   'location_lat' column of 'applications' in the schema cache"*. `npm test`
   checks that every column in `schema.ts` is declared by some file in
   `supabase/`, but it cannot know which files a given database has run.
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

**What goes into Secret Manager: five values.**

Four are build-time: `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_LOGO_DEV_TOKEN` and
`NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY`. Cloud Build fetches them itself
(`availableSecrets` in `cloudbuild.yaml`) and passes them to `docker build`;
they exist only inside that build step. Secret Manager here is a place to keep
configuration together, not a vault — every one of these is public by design
once the bundle ships. Because Next inlines `NEXT_PUBLIC_*`, **changing one
means redeploying** - adding a secret version alone changes nothing that is
running.

One is runtime: `GOOGLE_MAPS_API_KEY`, mounted into the container by Cloud Run
(`--set-secrets`) and read by the runtime service account, which is the only
identity granted access to it. It stays out of the bundle on purpose — address
lookup and the map are called from the server so that key is never handed to a
browser. Rotating it needs a new revision, not a rebuild.

**What deliberately does not:** `SUPABASE_SECRET_KEY` and `DATABASE_URL`.
Both bypass RLS, and the app needs neither at runtime.

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

## Office locations and the map

Every application records where the office is. It is required unless the role is
fully remote — and a remote role may still record one, since "remote" often
means remote within a region, and a head office you visit quarterly is worth
knowing. The address field suggests real addresses as you type, and the
dashboard plots every one of them on a map.

**How it is wired.** Picking a suggestion stores Google's place id alongside the
text; the coordinates are then looked up again on the server when the form is
saved, so nothing a browser sends can move a pin. Change the address later and
the pin moves with it, on every path — the form, and the MCP tools. When the
lookup fails or no key is configured, the address is saved as plain text with no
pin, and the next save of that application retries.

**"Remote" is not an address.** Google answers almost anything: it resolves
`Remote` to a holiday villa in Greece and `Anywhere` to a tour operator in Costa
Rica, both with real coordinates. Text that is only a placeholder is refused
before the lookup is made (`isPlaceholderLocation` in `src/lib/geo/places.ts`),
so those applications keep their text and stay off the map. A placeholder *next
to* a real place is fine — "Montreal (remote)" still finds Montreal.

**Over MCP**, the same thing happens deliberately rather than by typing:
`lookup_location` takes free text ("Shopify Montreal", "our Toronto office") and
returns the candidates Google matched, each with a `placeId` to pass to
`create_application` or `set_application_location`. The tool descriptions tell
the model to look the office up rather than guess at it.

**The map pans and zooms.** It is a Maps JavaScript map with a pin per office:
drag to move, the zoom buttons or ctrl/⌘-scroll to zoom, Street View and
fullscreen in the corner, and a click on a pin opens the applications at that
address as links. Scrolling the page over the map scrolls the page — zooming
takes a modifier — so the map cannot swallow a scroll aimed past it. It follows
the app's light/dark. The list beside it carries the same places, and is the
part that works with JavaScript off and the part a screen reader can use.

**Two keys, and the difference matters.** `GOOGLE_MAPS_API_KEY` is read only by
the server and never prefixed `NEXT_PUBLIC_`. It can spend Places quota on
geocoding, so it stays out of the bundle: that is why suggestions go through
`/api/places/search` and the still map arrives as an image from
`/api/map/applications` instead of a Google URL in the markup. Both endpoints
require a signed-in session — an open proxy to a metered API is somebody else's
free geocoder.

`NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY` is the opposite and is meant to be public,
because a map that pans has to be drawn by the browser. It is restricted to the
Maps JavaScript API and to this app's own domains, so the worst a scraped copy
can do is draw a map — it cannot geocode. Leave it unset and the map falls back
to the still image, which is also what shows while the library loads and if it
fails to load at all.

### Creating the keys

```bash
gcloud services enable places.googleapis.com static-maps-backend.googleapis.com \
  maps-backend.googleapis.com

# Server key: geocoding and the still map. Never leaves the server, so it gets
# no referrer restriction - a request from a server has no Referer to check.
gcloud services api-keys create --display-name="job-tracker-places" \
  --api-target=service=places.googleapis.com \
  --api-target=service=static-maps-backend.googleapis.com

# Browser key: the interactive map only, locked to the origins it may run on.
gcloud services api-keys create --display-name="job-tracker-maps-browser" \
  --api-target=service=maps-backend.googleapis.com \
  --allowed-referrers="http://localhost:3000/*","https://<your-service>/*"

# Print either one:
gcloud services api-keys get-key-string "$(gcloud services api-keys list \
  --filter='displayName=job-tracker-places' --format='value(name)' | head -1)"
```

Or in the console: **APIs & Services → Library**, enable **Places API (New)**,
**Maps Static API** and **Maps JavaScript API**; then **Credentials → Create
credentials → API key** twice, restricting each under **API restrictions** as
above, and the browser one under **Application restrictions → Websites**.

Put them in `.env` as `GOOGLE_MAPS_API_KEY` and
`NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY`, and for a deploy, in Secret Manager under
the same names (`./scripts/gcp/secrets.sh` does this from `.env`). Add a new
origin to the browser key's referrer list whenever the app gets one, or the map
silently refuses to draw there.

All three APIs are billable with a monthly free allowance. The address lookup
fires at most once per 300ms of typing, the still map is cached five minutes per
viewer, and dynamic map loads have their own free tier.

### Existing applications

Rows recorded before this existed keep their address text and have no pin.
To resolve them all at once:

```bash
npm run geo:backfill -- --dry   # list what would be looked up, spend nothing
npm run geo:backfill            # one Places lookup per row
```

It runs on `SUPABASE_SECRET_KEY` over the REST API, which bypasses RLS and so
touches every user's rows. It deliberately does not use `DATABASE_URL`: the
direct `db.<ref>.supabase.co` host is IPv6-only and unreachable from a network
without an IPv6 route, which would make the script fail to connect on exactly
the machines most likely to run it. Saving an application from the UI
re-resolves it too, so the backfill is a convenience, not a requirement.

## Connect Claude (MCP)

The app exposes an MCP server at `/api/mcp`, so Claude can fill the tracker from
a job posting: give it a URL and it reads the page itself, then calls
`create_application` with the fields it extracted. It can also search, move an
application along the pipeline, add notes and interview rounds, and resolve an
office address to a map pin (`lookup_location`, `set_application_location`).

Authorization is Supabase Auth's own OAuth 2.1 server, not something this app
implements — Claude discovers it via `/.well-known/oauth-protected-resource`,
you approve the connection once at `/oauth/consent`, and the access token it
receives is an ordinary Supabase JWT. So the same RLS policies that scope the
web UI scope the MCP tools, and the Cloud Run service still holds no secrets.

**One-time Supabase setup** (Authentication → OAuth Server in the dashboard):

1. Enable the OAuth 2.1 server.
2. Set the authorization URL path to `/oauth/consent`.
3. Enable **dynamic client registration**.

Step 3 is what makes connecting a one-field operation. With it on, the client
registers itself during discovery and the user pastes a URL and nothing else —
no client id, no secret, no dashboard visit. With it off, every user has to be
handed a client id out of band, which is not a thing you can ask of people.

The cost is that anyone can register a client and name it whatever they like,
so `client_name` on the consent screen proves nothing. That is handled where it
has to be: the consent screen treats the name as an unverified claim and vouches
for the redirect URI instead, warning plainly when the app is one it does not
recognise (`src/lib/mcp/clients.ts`). Nothing is granted until a signed-in user
approves it there.

**In Claude**: Settings → Connectors → Add custom connector, and paste:

```
https://<your-service>/api/mcp
```

That is the whole setup. Claude reads `/.well-known/oauth-protected-resource`,
finds Supabase, registers itself, and sends you to `/oauth/consent` to approve.
Revoke any time at `/settings/connections`.

<details>
<summary>If you cannot enable dynamic client registration</summary>

Register a client by hand and give its id to each user:

```
node scripts/supabase/register-oauth-client.mjs Claude
```

Needs `SUPABASE_SECRET_KEY` from `.env`. Its redirect URI list has to name every
client surface up front, because Supabase matches redirect URIs exactly and does
not accept wildcards — which is the other reason this does not scale.

</details>

Then: *"Add this job to my tracker: &lt;url&gt;"*.

> Supabase builds the consent redirect from the project's Site URL, so point
> that at your deployed origin (not `localhost:3000`) before connecting Claude
> to the deployed app.

## Layout

| Path | What |
|---|---|
| `src/db/schema.ts` | Single source of truth for the data model |
| `src/db/scope.ts` | Ownership predicate for Drizzle queries, which bypass RLS |
| `supabase/bootstrap.sql` | One-time DDL + RLS, mirrors `schema.ts` |
| `src/db/index.ts` | Drizzle client |
| `drizzle/` | Generated migrations once Node is available — commit, never edit |
| `src/lib/applications/` | Validation and write logic, shared by the form and the MCP tools |
| `src/lib/geo/` | Places lookup, map URLs, and the pin grouping the map and its list share |
| `src/app/api/places/search/` | Address suggestions, proxied so the key stays server-side |
| `src/app/api/map/applications/` | The dashboard map, fetched as an image for the same reason |
| `scripts/geo/backfill.ts` | One-off: pins applications recorded before geocoding existed |
| `src/lib/mcp/` | MCP tool definitions and bearer-token verification |
| `src/app/api/mcp/route.ts` | The MCP endpoint |
| `src/app/oauth/consent/` | Consent screen for Supabase's OAuth 2.1 server |
| `src/lib/mcp/clients.ts` | Recognises OAuth clients at the consent screen |
| `scripts/supabase/` | Manual OAuth client registration, if DCR is off |
| `Dockerfile` | Three-stage build to a standalone Next server |
| `cloudbuild.yaml` | Build, push, deploy; pulls config from Secret Manager |
| `scripts/gcp/` | One-time project setup and secret upload |

## Prior art

The 2019-era version (Express + Mongo + Angular). Its data model is the reason this one tracks meetings, recruiters, and
recruiter-vs-direct sourcing; see the table at the top of [PLAN.md](PLAN.md).
