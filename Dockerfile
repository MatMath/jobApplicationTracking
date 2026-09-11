# syntax=docker/dockerfile:1
#
# Three stages: install deps, build, then a runtime image holding only Next's
# standalone output. Built and deployed by cloudbuild.yaml; see README "Deploy".

# ---------------------------------------------------------------------- deps
FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# --------------------------------------------------------------------- build
FROM node:24-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Next's standalone output copies any .env it finds into the runtime folder, so
# a local .env in the build context would ship the Supabase secret key and the
# database password inside the image. .dockerignore excludes it; this makes a
# regression fail the build instead of leaking quietly.
RUN if [ -f .env ] || [ -f .env.local ] || [ -f .env.production ]; then \
      echo "Refusing to build: a .env file is in the build context (check .dockerignore)" >&2; exit 1; \
    fi

# NEXT_PUBLIC_* are inlined into the JavaScript at build time - setting them on
# the running service does nothing. They must arrive here, as build args.
# Cloud Build fetches them from Secret Manager (see cloudbuild.yaml). They are
# public by design (shipped to every browser), so their presence in image
# metadata is not a leak; genuinely secret values never pass through here.
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
ARG NEXT_PUBLIC_LOGO_DEV_TOKEN
ARG NEXT_PUBLIC_SITE_URL=""
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=$NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY \
    NEXT_PUBLIC_LOGO_DEV_TOKEN=$NEXT_PUBLIC_LOGO_DEV_TOKEN \
    NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_TELEMETRY_DISABLED=1

# Fail the build loudly rather than ship a bundle that cannot reach Supabase.
RUN test -n "$NEXT_PUBLIC_SUPABASE_URL" && test -n "$NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY" \
    || (echo "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY are required build args" >&2; exit 1)

RUN npm run build

# ------------------------------------------------------------------- runtime
FROM node:24-alpine AS runner
WORKDIR /app

# Cloud Run sends traffic to $PORT (8080 by default); bind every interface.
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=8080 \
    HOSTNAME=0.0.0.0

# tzdata: the deploy sets TZ (see cloudbuild.yaml). Node's bundled ICU usually
# resolves it alone, but date defaults and dashboard weeks depend on it, so the
# system zone database is cheap insurance (~1.5 MB).
RUN apk add --no-cache tzdata && addgroup -S app && adduser -S app -G app

COPY --from=builder --chown=app:app /app/.next/standalone ./
COPY --from=builder --chown=app:app /app/.next/static ./.next/static

USER app
EXPOSE 8080
CMD ["node", "server.js"]
