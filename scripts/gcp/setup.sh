#!/usr/bin/env bash
# One-time Google Cloud setup for the job tracker. Safe to re-run.
#
#   gcloud auth login
#   gcloud config set project <PROJECT_ID>
#   ./scripts/gcp/setup.sh                        # or: REGION=us-east4 ./scripts/gcp/setup.sh
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
SECRETS=(NEXT_PUBLIC_SUPABASE_URL NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY NEXT_PUBLIC_LOGO_DEV_TOKEN)

[ -n "$PROJECT_ID" ] || { echo "No project. Run: gcloud config set project <PROJECT_ID>" >&2; exit 1; }
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
# Deliberately granted nothing: the app calls no Google APIs.
make_sa job-tracker-run "Job tracker - Cloud Run runtime (no roles)"

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

echo "- secrets (created empty; the deployer can read these three and nothing else)"
for s in "${SECRETS[@]}"; do
  gcloud secrets describe "$s" >/dev/null 2>&1 \
    || gcloud secrets create "$s" --replication-policy=automatic
  gcloud secrets add-iam-policy-binding "$s" \
    --member="serviceAccount:$DEPLOYER" --role=roles/secretmanager.secretAccessor >/dev/null
done

echo
echo "Done. Next: give each secret a value (./scripts/gcp/secrets.sh, or the console),"
echo "then: npm run deploy"
