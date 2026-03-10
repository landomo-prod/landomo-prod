#!/usr/bin/env bash
#
# Check if a Facebook token is valid and show its details.
#
# Usage:
#   ./fb-token-check.sh                          # checks FB_PAGE_ACCESS_TOKEN from .env
#   ./fb-token-check.sh --token YOUR_TOKEN        # check specific token
#   ./fb-token-check.sh --page                    # check page token (default)
#   ./fb-token-check.sh --user                    # check user token

set -euo pipefail

GRAPH_API="https://graph.facebook.com/v22.0"
TOKEN=""
TOKEN_TYPE="page"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --token) TOKEN="$2"; shift 2 ;;
    --page)  TOKEN_TYPE="page"; shift ;;
    --user)  TOKEN_TYPE="user"; shift ;;
    *)       shift ;;
  esac
done

# Try loading from .env
if [[ -z "$TOKEN" ]]; then
  ENV_FILE="$(dirname "$0")/../.env"
  if [[ -f "$ENV_FILE" ]]; then
    if [[ "$TOKEN_TYPE" == "page" ]]; then
      TOKEN=$(grep -E '^FB_PAGE_ACCESS_TOKEN=' "$ENV_FILE" 2>/dev/null | cut -d= -f2- || true)
    else
      TOKEN=$(grep -E '^FB_USER_ACCESS_TOKEN=' "$ENV_FILE" 2>/dev/null | cut -d= -f2- || true)
    fi
  fi
fi

# Also check env vars
if [[ -z "$TOKEN" ]]; then
  if [[ "$TOKEN_TYPE" == "page" ]]; then
    TOKEN="${FB_PAGE_ACCESS_TOKEN:-}"
  else
    TOKEN="${FB_USER_ACCESS_TOKEN:-}"
  fi
fi

if [[ -z "$TOKEN" ]]; then
  echo "Error: No token found. Set FB_PAGE_ACCESS_TOKEN / FB_USER_ACCESS_TOKEN or use --token." >&2
  exit 1
fi

echo ""
echo "Checking ${TOKEN_TYPE} token..."
echo "Token: ${TOKEN:0:20}...${TOKEN: -10}"
echo ""

# Debug token info
APP_ID="${FB_APP_ID:-}"
APP_TOKEN=""

if [[ -n "$APP_ID" ]]; then
  APP_SECRET="${FB_APP_SECRET:-}"
  if [[ -z "$APP_SECRET" ]]; then
    ENV_FILE="$(dirname "$0")/../.env"
    APP_SECRET=$(grep -E '^FB_APP_SECRET=' "$ENV_FILE" 2>/dev/null | cut -d= -f2- || true)
    APP_ID=$(grep -E '^FB_APP_ID=' "$ENV_FILE" 2>/dev/null | cut -d= -f2- || true)
  fi
  if [[ -n "$APP_ID" && -n "$APP_SECRET" ]]; then
    APP_TOKEN="${APP_ID}|${APP_SECRET}"
  fi
fi

# Method 1: Simple /me check
ME_RESPONSE=$(curl -s "${GRAPH_API}/me?access_token=${TOKEN}&fields=id,name")
ME_ERROR=$(echo "$ME_RESPONSE" | jq -r '.error.message // empty')

if [[ -n "$ME_ERROR" ]]; then
  echo "INVALID TOKEN"
  echo ""
  echo "Error: $ME_ERROR"
  echo "Code: $(echo "$ME_RESPONSE" | jq -r '.error.code // "N/A"')"
  echo ""

  if echo "$ME_ERROR" | grep -qi "expired"; then
    echo "The token has expired. Run ./fb-setup.sh to get a new one."
  elif echo "$ME_ERROR" | grep -qi "invalid"; then
    echo "The token is invalid. Run ./fb-setup.sh to get a new one."
  fi
  exit 1
fi

ME_ID=$(echo "$ME_RESPONSE" | jq -r '.id')
ME_NAME=$(echo "$ME_RESPONSE" | jq -r '.name')

echo "VALID TOKEN"
echo ""
echo "  Identity: ${ME_NAME} (${ME_ID})"

# Method 2: Debug token (if we have app credentials)
if [[ -n "$APP_TOKEN" ]]; then
  DEBUG_RESPONSE=$(curl -s "${GRAPH_API}/debug_token?input_token=${TOKEN}&access_token=${APP_TOKEN}")
  DEBUG_DATA=$(echo "$DEBUG_RESPONSE" | jq '.data // empty')

  if [[ -n "$DEBUG_DATA" && "$DEBUG_DATA" != "null" ]]; then
    TYPE=$(echo "$DEBUG_DATA" | jq -r '.type // "unknown"')
    APP_NAME=$(echo "$DEBUG_DATA" | jq -r '.application // "unknown"')
    IS_VALID=$(echo "$DEBUG_DATA" | jq -r '.is_valid // false')
    EXPIRES=$(echo "$DEBUG_DATA" | jq -r '.expires_at // 0')
    SCOPES=$(echo "$DEBUG_DATA" | jq -r '.scopes // [] | join(", ")')

    echo "  Type: ${TYPE}"
    echo "  App: ${APP_NAME}"
    echo "  Valid: ${IS_VALID}"
    echo "  Scopes: ${SCOPES}"

    if [[ "$EXPIRES" != "0" && "$EXPIRES" != "null" ]]; then
      EXPIRES_DATE=$(date -r "$EXPIRES" '+%Y-%m-%d %H:%M' 2>/dev/null || date -d "@$EXPIRES" '+%Y-%m-%d %H:%M' 2>/dev/null || echo "unknown")
      NOW=$(date +%s)
      REMAINING=$(( (EXPIRES - NOW) / 86400 ))
      echo "  Expires: ${EXPIRES_DATE} (${REMAINING} days remaining)"

      if [[ $REMAINING -lt 7 ]]; then
        echo ""
        echo "  WARNING: Token expires in less than 7 days! Run ./fb-setup.sh to refresh."
      fi
    else
      echo "  Expires: Never (page tokens don't expire)"
    fi
  fi
else
  echo ""
  echo "  (Set FB_APP_ID and FB_APP_SECRET for detailed token debug info)"
fi

# If it's a page token, check posting permissions
if [[ "$TOKEN_TYPE" == "page" ]]; then
  echo ""
  echo "Testing post permission..."
  # Just check if we can read the page feed (doesn't create anything)
  FEED_CHECK=$(curl -s "${GRAPH_API}/${ME_ID}/feed?access_token=${TOKEN}&limit=1&fields=id")
  FEED_ERROR=$(echo "$FEED_CHECK" | jq -r '.error.message // empty')

  if [[ -z "$FEED_ERROR" ]]; then
    echo "  Feed access: OK"
  else
    echo "  Feed access: DENIED ($FEED_ERROR)"
    echo "  Make sure pages_manage_posts permission is approved."
  fi
fi

echo ""
