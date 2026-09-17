#!/usr/bin/env bash
# One-time Google Cloud setup for the job tracker. Safe to re-run.
#
#   gcloud auth login
#   gcloud config set project <PROJECT_ID>
#   ./scripts/gcp/setup.sh                        # or: PROJECT_ID=my-proj REGION=us-east4 ./scripts/gcp/setup.sh
#
# Creates: APIs, an Artifact Registry repo, two service accounts with the
# narrowest roles the pipeline needs, and the three (empty) secrets. It does
# not write any secret values - see scripts/gcp/secrets.sh or the console.
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-$(gcloud config get-value project 2>/dev/null)}"
REGION="${REGION:-northamerica-northeast1}"   # keep in sync with _REGION in cloudbuild.yaml
REPO=job-tracker
DEPLOYER="job-tracker-deployer@${PROJECT_ID}.iam.gserviceaccount.com"
RUNTIME="job-tracker-run@${PROJECT_ID}.iam.gserviceaccount.com"
# Read by the build, inlined into the bundle: the deployer needs these.
BUILD_SECRETS=(NEXT_PUBLIC_SUPABASE_URL NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY NEXT_PUBLIC_LOGO_DEV_TOKEN NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY)
# Read by the running container, never by the browser: the runtime needs these.
RUNTIME_SECRETS=(GOOGLE_MAPS_API_KEY)
SECRETS=("${BUILD_SECRETS[@]}" "${RUNTIME_SECRETS[@]}")

[ -n "$PROJECT_ID" ] || { echo "No project. Run: gcloud config set project <PROJECT_ID>" >&2; exit 1; }
# Scope every gcloud call below to that project without touching the user's
# gcloud config: PROJECT_ID=... works even with no default project set.
export CLOUDSDK_CORE_PROJECT="$PROJECT_ID"
ME="$(gcloud config get-value account 2>/dev/null)"
echo "Project $PROJECT_ID, region $REGION, as $ME"

echo "- enabling APIs"
gcloud services enable run.googleapis.com cloudbuild.googleapis.com \
  artifactregistry.googleapis.com secretmanager.googleapis.com iam.googleapis.com

echo "- Artifact Registry repo '$REPO'"
gcloud artifacts repositories describe "$REPO" --location="$REGION" >/dev/null 2>&1 \
  || gcloud artifacts repositories create "$REPO" --repository-format=docker --location="$REGION"

make_sa() {
  gcloud iam service-accounts describe "$1@${PROJECT_ID}.iam.gserviceaccount.com" >/dev/null 2>&1 \
    || gcloud iam service-accounts create "$1" --display-name="$2"
}
echo "- service accounts"
make_sa job-tracker-deployer "Job tracker - Cloud Build deployer"
# No project roles: the app calls Google Maps with an API key, not with this
# identity. Its only grant is read access to the one runtime secret, below.
make_sa job-tracker-run "Job tracker - Cloud Run runtime"

echo "- deployer roles"
# run.admin: deploy, and set the public invoker policy (--allow-unauthenticated).
# artifactregistry.writer: push the image. logging.logWriter: build logs.
# storage.objectViewer: read the source that `gcloud builds submit` uploads.
for role in roles/run.admin roles/artifactregistry.writer roles/logging.logWriter roles/storage.objectViewer; do
  gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:$DEPLOYER" --role="$role" --condition=None >/dev/null
done
# The deployer may deploy AS the runtime identity - and no other service account.
gcloud iam service-accounts add-iam-policy-binding "$RUNTIME" \
  --member="serviceAccount:$DEPLOYER" --role=roles/iam.serviceAccountUser >/dev/null
# You may submit builds that run as the deployer.
gcloud iam service-accounts add-iam-policy-binding "$DEPLOYER" \
  --member="user:$ME" --role=roles/iam.serviceAccountUser >/dev/null

echo "- secrets (created empty; each identity can read only the ones it needs)"
for s in "${SECRETS[@]}"; do
  gcloud secrets describe "$s" >/dev/null 2>&1 \
    || gcloud secrets create "$s" --replication-policy=automatic
done
for s in "${BUILD_SECRETS[@]}"; do
  gcloud secrets add-iam-policy-binding "$s" \
    --member="serviceAccount:$DEPLOYER" --role=roles/secretmanager.secretAccessor >/dev/null
done
# The Maps key is fetched by the container at request time, not baked into the
# image, so it is the runtime identity that reads it - the deployer never sees it.
for s in "${RUNTIME_SECRETS[@]}"; do
  gcloud secrets add-iam-policy-binding "$s" \
    --member="serviceAccount:$RUNTIME" --role=roles/secretmanager.secretAccessor >/dev/null
done

echo "- Maps Platform APIs (address lookup and the dashboard map)"
gcloud services enable places.googleapis.com static-maps-backend.googleapis.com maps-backend.googleapis.com

echo
echo "Done. Next: give each secret a value (./scripts/gcp/secrets.sh, or the console),"
echo "then: npm run deploy"
