#!/usr/bin/env bash
#
# Production smoke for the marketing form email path (PRD 008).
#
# Pulls the production environment from the linked Vercel project into a
# temporary file (removed on exit, success or not) to find APP_BASE_URL, then
# runs `test-form-intake.ts --smoke` against it.
#
# The two tokens are stored in Vercel as type "Secret", which `vercel env pull`
# cannot decrypt — it writes the literal "[SENSITIVE]" — so they come from your
# shell (a password manager entry, not a file in the repo):
#
#   CONTACT_INTAKE_TOKEN=… CRON_SECRET=… npm run smoke:prod -- you+probe@example.com
#   BASE_URL=https://other-host … npm run smoke:prod -- you+probe@example.com   # override the target
#
# CRON_SECRET is optional; without it the sweep check is skipped.
#
# Sends ONE real submission and two real emails. Run it only after the portal
# deploy that honours `deliver` is live; before that every check reports
# `skipped` and the probe row still has to be deleted by hand.
set -euo pipefail
cd "$(dirname "$0")/.."

EMAIL="${1:-}"
if [[ -z "$EMAIL" ]]; then
  echo "usage: npm run smoke:prod -- you+probe@example.com" >&2
  exit 2
fi

TMP="$(mktemp -t pts-smoke-env)"
trap 'rm -f "$TMP"' EXIT

echo "Pulling production env from Vercel…"
vercel env pull "$TMP" --environment production --yes >/dev/null

# Only the values the smoke needs leave the temp file; everything else in the
# production env (database URL, service keys) stays there and is deleted.
read_var() { sed -n "s/^$1=\"\{0,1\}\([^\"]*\)\"\{0,1\}\$/\1/p" "$TMP" | head -1; }

TARGET="${BASE_URL:-$(read_var APP_BASE_URL)}"
if [[ -z "$TARGET" ]]; then
  echo "APP_BASE_URL is not set in the production env; pass BASE_URL=https://… explicitly." >&2
  exit 2
fi

# Shell wins; the pulled file is only a fallback for a non-secret value, and a
# "[SENSITIVE]" placeholder is treated as absent.
pick() {
  local shell_value="${!1:-}"
  if [[ -n "$shell_value" ]]; then printf '%s' "$shell_value"; return; fi
  local pulled; pulled="$(read_var "$1")"
  [[ "$pulled" == "[SENSITIVE]" ]] && pulled=""
  printf '%s' "$pulled"
}

CONTACT_TOKEN="$(pick CONTACT_INTAKE_TOKEN)"
if [[ -z "$CONTACT_TOKEN" ]]; then
  cat >&2 <<'MSG'
CONTACT_INTAKE_TOKEN is a Vercel "Secret" and cannot be pulled. Pass it from your shell:

  CONTACT_INTAKE_TOKEN=… [CRON_SECRET=…] npm run smoke:prod -- you+probe@example.com

If nobody has the value stored, rotate it: generate a new one (openssl rand -hex 32), set it on
both Vercel projects (portal CONTACT_INTAKE_TOKEN, marketing site CONTACT_INTAKE_TOKEN), and keep
it in the password manager this time.
MSG
  exit 2
fi

BASE_URL="$TARGET" \
CONTACT_INTAKE_TOKEN="$CONTACT_TOKEN" \
CRON_SECRET="$(pick CRON_SECRET)" \
SMOKE_EMAIL="$EMAIL" \
  npx tsx scripts/test-form-intake.ts --smoke
