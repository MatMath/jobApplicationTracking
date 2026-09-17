#!/usr/bin/env bash
# Adds a new version of each deploy secret, taking values from .env.
# Optional: creating them in the console works just as well.
#
#   ./scripts/gcp/secrets.sh            # reads ./.env
#   ENV_FILE=.env.production PROJECT_ID=my-proj ./scripts/gcp/secrets.sh
#
# Rotate the keys first if they have ever been shared; this uploads whatever
# the file currently holds.
set -euo pipefail

ENV_FILE="${ENV_FILE:-.env}"
PROJECT_ID="${PROJECT_ID:-$(gcloud config get-value project 2>/dev/null)}"
[ -n "$PROJECT_ID" ] || { echo "No project. Set PROJECT_ID or run: gcloud config set project <PROJECT_ID>" >&2; exit 1; }
export CLOUDSDK_CORE_PROJECT="$PROJECT_ID"
SECRETS=(NEXT_PUBLIC_SUPABASE_URL NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY NEXT_PUBLIC_LOGO_DEV_TOKEN GOOGLE_MAPS_API_KEY)
[ -f "$ENV_FILE" ] || { echo "No $ENV_FILE" >&2; exit 1; }

for name in "${SECRETS[@]}"; do
  # Exact-key match; last definition wins, as dotenv does. Strip quotes and CR.
  value="$(grep -E "^${name}=" "$ENV_FILE" | tail -1 | cut -d= -f2- | tr -d '\r' | sed -e 's/^["'\'']//' -e 's/["'\'']$//')"
  if [ -z "$value" ]; then
    echo "  $name: empty in $ENV_FILE - skipped"
    continue
  fi
  gcloud secrets describe "$name" >/dev/null 2>&1 \
    || gcloud secrets create "$name" --replication-policy=automatic >/dev/null
  # printf, not echo: no trailing newline sneaks into the value. Piped via
  # stdin so the value never appears in argv, `ps`, or shell history.
  printf '%s' "$value" | gcloud secrets versions add "$name" --data-file=- >/dev/null
  echo "  $name: new version added (${#value} chars)"
done
