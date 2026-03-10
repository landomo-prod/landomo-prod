#!/usr/bin/env bash
#
# Refresh Facebook page tokens using the stored user token.
#
# The long-lived user token lasts ~60 days. Page tokens obtained via
# /me/accounts don't expire as long as the user token is valid.
# Run this before the user token expires to get fresh page tokens.
#
# Usage:
#   ./fb-refresh-token.sh                     # reads from .env
#   ./fb-refresh-token.sh --save              # update .env with new tokens

set -euo pipefail

GRAPH_API="https://graph.facebook.com/v22.0"
SAVE_MODE=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --save) SAVE_MODE=true; shift ;;
    *)      shift ;;
  esac
done

ENV_FILE="$(dirname "$0")/../.env"

# Load from .env
load_env() {
  local key="$1"
  grep -E "^${key}=" "$ENV_FILE" 2>/dev/null | cut -d= -f2- || true
}

APP_ID="${FB_APP_ID:-$(load_env FB_APP_ID)}"
APP_SECRET="${FB_APP_SECRET:-$(load_env FB_APP_SECRET)}"
USER_TOKEN="${FB_USER_ACCESS_TOKEN:-$(load_env FB_USER_ACCESS_TOKEN)}"
PAGE_ID="${FB_PAGE_ID:-$(load_env FB_PAGE_ID)}"

if [[ -z "$APP_ID" || -z "$APP_SECRET" ]]; then
  echo "Error: FB_APP_ID and FB_APP_SECRET required. Run ./fb-setup.sh first." >&2
  exit 1
fi

if [[ -z "$USER_TOKEN" ]]; then
  echo "Error: FB_USER_ACCESS_TOKEN not found. Run ./fb-setup.sh first." >&2
  exit 1
fi

echo ""
echo "Refreshing long-lived user token..."

# Exchange current long-lived token for a new one
NEW_TOKEN_RESPONSE=$(curl -s "${GRAPH_API}/oauth/access_token?grant_type=fb_exchange_token&client_id=${APP_ID}&client_secret=${APP_SECRET}&fb_exchange_token=${USER_TOKEN}")

NEW_USER_TOKEN=$(echo "$NEW_TOKEN_RESPONSE" | jq -r '.access_token // empty')
EXPIRES_IN=$(echo "$NEW_TOKEN_RESPONSE" | jq -r '.expires_in // 0')

if [[ -z "$NEW_USER_TOKEN" ]]; then
  ERROR=$(echo "$NEW_TOKEN_RESPONSE" | jq -r '.error.message // "Unknown error"')
  echo "Error refreshing user token: $ERROR" >&2
  echo ""
  echo "Your user token may have expired. Run ./fb-setup.sh to re-authorize."
  exit 1
fi

DAYS=$((EXPIRES_IN / 86400))
echo "New user token obtained (expires in ${DAYS} days)."

# Get fresh page tokens
echo "Fetching page tokens..."

PAGES_RESPONSE=$(curl -s "${GRAPH_API}/me/accounts?access_token=${NEW_USER_TOKEN}&fields=id,name,access_token&limit=100")

PAGE_COUNT=$(echo "$PAGES_RESPONSE" | jq '.data | length')

if [[ "$PAGE_COUNT" -eq 0 ]]; then
  echo "No pages found."
  exit 1
fi

echo "Found ${PAGE_COUNT} page(s)."
echo ""

# Find the configured page
if [[ -n "$PAGE_ID" ]]; then
  NEW_PAGE_TOKEN=$(echo "$PAGES_RESPONSE" | jq -r ".data[] | select(.id == \"${PAGE_ID}\") | .access_token // empty")
  PAGE_NAME=$(echo "$PAGES_RESPONSE" | jq -r ".data[] | select(.id == \"${PAGE_ID}\") | .name // empty")

  if [[ -n "$NEW_PAGE_TOKEN" ]]; then
    echo "Refreshed token for: ${PAGE_NAME} (${PAGE_ID})"
  else
    echo "Warning: Page ${PAGE_ID} not found in your managed pages."
    echo "Available pages:"
    echo "$PAGES_RESPONSE" | jq -r '.data[] | "  \(.id) — \(.name)"'
    exit 1
  fi
else
  echo "No FB_PAGE_ID configured. Here are your pages:"
  echo "$PAGES_RESPONSE" | jq -r '.data[] | "  \(.id) — \(.name)"'
  echo ""
  echo "Set FB_PAGE_ID in .env, then run this script again."
  exit 0
fi

echo ""

if [[ "$SAVE_MODE" == "true" && -f "$ENV_FILE" ]]; then
  # Update tokens in .env
  if grep -q '^FB_USER_ACCESS_TOKEN=' "$ENV_FILE"; then
    sed -i.bak "s|^FB_USER_ACCESS_TOKEN=.*|FB_USER_ACCESS_TOKEN=${NEW_USER_TOKEN}|" "$ENV_FILE"
  else
    echo "FB_USER_ACCESS_TOKEN=${NEW_USER_TOKEN}" >> "$ENV_FILE"
  fi

  if grep -q '^FB_PAGE_ACCESS_TOKEN=' "$ENV_FILE"; then
    sed -i.bak "s|^FB_PAGE_ACCESS_TOKEN=.*|FB_PAGE_ACCESS_TOKEN=${NEW_PAGE_TOKEN}|" "$ENV_FILE"
  else
    echo "FB_PAGE_ACCESS_TOKEN=${NEW_PAGE_TOKEN}" >> "$ENV_FILE"
  fi

  rm -f "${ENV_FILE}.bak"
  echo "Updated .env with new tokens."
else
  echo "New tokens (add to .env):"
  echo ""
  echo "FB_USER_ACCESS_TOKEN=${NEW_USER_TOKEN}"
  echo "FB_PAGE_ACCESS_TOKEN=${NEW_PAGE_TOKEN}"
  echo ""
  echo "Run with --save to update .env automatically."
fi

echo ""
echo "Done. Next refresh needed before: $(date -v+${DAYS}d '+%Y-%m-%d' 2>/dev/null || date -d "+${DAYS} days" '+%Y-%m-%d' 2>/dev/null || echo "~${DAYS} days from now")"
