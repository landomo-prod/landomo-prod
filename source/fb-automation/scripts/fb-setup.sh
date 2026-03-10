#!/usr/bin/env bash
#
# Facebook Page Setup Helper
#
# Interactive script that walks you through the full Facebook token flow:
#   1. Opens browser for OAuth authorization
#   2. Exchanges short-lived token for long-lived user token
#   3. Lists your managed pages with their tokens
#   4. Outputs env vars ready to paste into .env
#
# Prerequisites:
#   - A Facebook App (create at https://developers.facebook.com/apps/)
#   - App must have "pages_manage_posts" and "pages_show_list" permissions approved
#   - curl and jq installed
#
# Usage:
#   ./fb-setup.sh
#   ./fb-setup.sh --app-id YOUR_APP_ID --app-secret YOUR_APP_SECRET

set -euo pipefail

GRAPH_API="https://graph.facebook.com/v22.0"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

log()  { echo -e "${GREEN}[+]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
err()  { echo -e "${RED}[x]${NC} $1"; }
bold() { echo -e "${BOLD}$1${NC}"; }

# Check dependencies
for cmd in curl jq; do
  if ! command -v "$cmd" &>/dev/null; then
    err "$cmd is required. Install it first."
    exit 1
  fi
done

# Parse args
APP_ID="${FB_APP_ID:-}"
APP_SECRET="${FB_APP_SECRET:-}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --app-id)    APP_ID="$2"; shift 2 ;;
    --app-secret) APP_SECRET="$2"; shift 2 ;;
    *)           shift ;;
  esac
done

echo ""
bold "=== Facebook Page Setup for Landomo fb-automation ==="
echo ""

# Step 1: Get App credentials
if [[ -z "$APP_ID" ]]; then
  echo -n "Facebook App ID: "
  read -r APP_ID
fi

if [[ -z "$APP_SECRET" ]]; then
  echo -n "Facebook App Secret: "
  read -rs APP_SECRET
  echo ""
fi

if [[ -z "$APP_ID" || -z "$APP_SECRET" ]]; then
  err "App ID and App Secret are required."
  exit 1
fi

# Step 2: Generate OAuth URL
REDIRECT_URI="https://localhost:3300/callback"
SCOPES="public_profile,pages_show_list,pages_manage_posts,pages_read_engagement"
OAUTH_URL="https://www.facebook.com/v22.0/dialog/oauth?client_id=${APP_ID}&redirect_uri=${REDIRECT_URI}&scope=${SCOPES}&response_type=code"

echo ""
log "Opening browser for Facebook authorization..."
echo ""
bold "If the browser doesn't open, go to this URL manually:"
echo ""
echo "$OAUTH_URL"
echo ""

# Try to open browser
if command -v open &>/dev/null; then
  open "$OAUTH_URL" 2>/dev/null || true
elif command -v xdg-open &>/dev/null; then
  xdg-open "$OAUTH_URL" 2>/dev/null || true
fi

warn "After authorizing, Facebook will redirect to a URL like:"
echo "  https://localhost:3300/callback?code=XXXXXXX"
echo ""
echo -n "Paste the full redirect URL (or just the 'code' value): "
read -r CODE_INPUT

# Extract code from URL or use raw value
if [[ "$CODE_INPUT" == *"code="* ]]; then
  CODE=$(echo "$CODE_INPUT" | sed -n 's/.*code=\([^&]*\).*/\1/p')
else
  CODE="$CODE_INPUT"
fi

if [[ -z "$CODE" ]]; then
  err "No authorization code provided."
  exit 1
fi

# Step 3: Exchange code for short-lived user token
log "Exchanging authorization code for access token..."

TOKEN_RESPONSE=$(curl -s "${GRAPH_API}/oauth/access_token?client_id=${APP_ID}&redirect_uri=${REDIRECT_URI}&client_secret=${APP_SECRET}&code=${CODE}")

SHORT_TOKEN=$(echo "$TOKEN_RESPONSE" | jq -r '.access_token // empty')
if [[ -z "$SHORT_TOKEN" ]]; then
  err "Failed to get access token:"
  echo "$TOKEN_RESPONSE" | jq .
  exit 1
fi

log "Got short-lived user token."

# Step 4: Exchange for long-lived user token
log "Exchanging for long-lived user token (valid ~60 days)..."

LONG_TOKEN_RESPONSE=$(curl -s "${GRAPH_API}/oauth/access_token?grant_type=fb_exchange_token&client_id=${APP_ID}&client_secret=${APP_SECRET}&fb_exchange_token=${SHORT_TOKEN}")

LONG_TOKEN=$(echo "$LONG_TOKEN_RESPONSE" | jq -r '.access_token // empty')
EXPIRES_IN=$(echo "$LONG_TOKEN_RESPONSE" | jq -r '.expires_in // "unknown"')

if [[ -z "$LONG_TOKEN" ]]; then
  err "Failed to get long-lived token:"
  echo "$LONG_TOKEN_RESPONSE" | jq .
  exit 1
fi

log "Got long-lived user token (expires in ${EXPIRES_IN}s / ~$((EXPIRES_IN / 86400)) days)."

# Step 5: Get managed pages
log "Fetching your managed Facebook pages..."
echo ""

PAGES_RESPONSE=$(curl -s "${GRAPH_API}/me/accounts?access_token=${LONG_TOKEN}&fields=id,name,access_token,category,tasks&limit=100")

PAGE_COUNT=$(echo "$PAGES_RESPONSE" | jq '.data | length')

if [[ "$PAGE_COUNT" -eq 0 || "$PAGE_COUNT" == "null" ]]; then
  warn "No pages found. Make sure you have admin access to at least one Facebook page."
  echo ""
  echo "Response:"
  echo "$PAGES_RESPONSE" | jq .
  exit 1
fi

bold "Found ${PAGE_COUNT} page(s):"
echo ""

echo "$PAGES_RESPONSE" | jq -r '.data[] | "  \(.name) (ID: \(.id)) — \(.category // "N/A")"'

echo ""
echo "─────────────────────────────────────────────────────"
echo ""

# Step 6: Let user pick a page
if [[ "$PAGE_COUNT" -eq 1 ]]; then
  SELECTED_INDEX=0
  SELECTED_NAME=$(echo "$PAGES_RESPONSE" | jq -r '.data[0].name')
  log "Auto-selecting the only page: ${SELECTED_NAME}"
else
  echo "Select a page (enter the number):"
  echo ""
  echo "$PAGES_RESPONSE" | jq -r '.data | to_entries[] | "  \(.key + 1). \(.value.name) (ID: \(.value.id))"'
  echo ""
  echo -n "Page number: "
  read -r PAGE_NUM
  SELECTED_INDEX=$((PAGE_NUM - 1))
fi

SELECTED_ID=$(echo "$PAGES_RESPONSE" | jq -r ".data[${SELECTED_INDEX}].id")
SELECTED_NAME=$(echo "$PAGES_RESPONSE" | jq -r ".data[${SELECTED_INDEX}].name")
SELECTED_TOKEN=$(echo "$PAGES_RESPONSE" | jq -r ".data[${SELECTED_INDEX}].access_token")

echo ""
log "Selected: ${SELECTED_NAME} (${SELECTED_ID})"

# Step 7: Verify page token works
log "Verifying page token..."

VERIFY_RESPONSE=$(curl -s "${GRAPH_API}/me?access_token=${SELECTED_TOKEN}&fields=id,name")
VERIFY_NAME=$(echo "$VERIFY_RESPONSE" | jq -r '.name // empty')

if [[ -n "$VERIFY_NAME" ]]; then
  log "Token verified for: ${VERIFY_NAME}"
else
  warn "Token verification returned unexpected response:"
  echo "$VERIFY_RESPONSE" | jq .
fi

# Step 8: Output config
echo ""
echo "═══════════════════════════════════════════════════════"
bold "  Add these to your .env file:"
echo "═══════════════════════════════════════════════════════"
echo ""
echo "FB_PAGE_ID=${SELECTED_ID}"
echo "FB_PAGE_ACCESS_TOKEN=${SELECTED_TOKEN}"
echo ""
echo "# App credentials (needed for token refresh):"
echo "FB_APP_ID=${APP_ID}"
echo "FB_APP_SECRET=${APP_SECRET}"
echo ""
echo "# User token (for refreshing page tokens, expires in ~60 days):"
echo "FB_USER_ACCESS_TOKEN=${LONG_TOKEN}"
echo ""
echo "═══════════════════════════════════════════════════════"
echo ""

# Step 9: Optionally save to file
echo -n "Save to .env file? (y/N): "
read -r SAVE_CHOICE

if [[ "$SAVE_CHOICE" =~ ^[yY] ]]; then
  ENV_FILE="$(dirname "$0")/../.env"
  {
    echo ""
    echo "# Facebook Page Config — generated $(date '+%Y-%m-%d %H:%M')"
    echo "FB_PAGE_ID=${SELECTED_ID}"
    echo "FB_PAGE_ACCESS_TOKEN=${SELECTED_TOKEN}"
    echo "FB_APP_ID=${APP_ID}"
    echo "FB_APP_SECRET=${APP_SECRET}"
    echo "FB_USER_ACCESS_TOKEN=${LONG_TOKEN}"
  } >> "$ENV_FILE"
  log "Appended to ${ENV_FILE}"
fi

echo ""
log "Done! Your fb-automation service is ready to publish to \"${SELECTED_NAME}\"."
warn "Page tokens from /me/accounts don't expire, but refresh if you change app permissions."
