#!/usr/bin/env bash
#
# List all Facebook pages you manage with their tokens and details.
#
# Usage:
#   ./fb-list-pages.sh                              # reads FB_USER_ACCESS_TOKEN from .env
#   ./fb-list-pages.sh --token YOUR_USER_TOKEN       # pass token directly
#   ./fb-list-pages.sh --json                        # output raw JSON

set -euo pipefail

GRAPH_API="https://graph.facebook.com/v22.0"
JSON_MODE=false
USER_TOKEN="${FB_USER_ACCESS_TOKEN:-}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --token) USER_TOKEN="$2"; shift 2 ;;
    --json)  JSON_MODE=true; shift ;;
    *)       shift ;;
  esac
done

# Try loading from .env if not set
if [[ -z "$USER_TOKEN" ]]; then
  ENV_FILE="$(dirname "$0")/../.env"
  if [[ -f "$ENV_FILE" ]]; then
    USER_TOKEN=$(grep -E '^FB_USER_ACCESS_TOKEN=' "$ENV_FILE" 2>/dev/null | cut -d= -f2- || true)
  fi
fi

if [[ -z "$USER_TOKEN" ]]; then
  echo "Error: No user token. Set FB_USER_ACCESS_TOKEN or use --token." >&2
  exit 1
fi

RESPONSE=$(curl -s "${GRAPH_API}/me/accounts?access_token=${USER_TOKEN}&fields=id,name,access_token,category,tasks,link,fan_count&limit=100")

ERROR=$(echo "$RESPONSE" | jq -r '.error.message // empty')
if [[ -n "$ERROR" ]]; then
  echo "Error: $ERROR" >&2
  exit 1
fi

if [[ "$JSON_MODE" == "true" ]]; then
  echo "$RESPONSE" | jq '.data'
  exit 0
fi

PAGE_COUNT=$(echo "$RESPONSE" | jq '.data | length')

echo ""
echo "Found ${PAGE_COUNT} page(s):"
echo ""
printf "%-20s %-18s %-25s %-10s %s\n" "PAGE ID" "FANS" "CATEGORY" "TASKS" "NAME"
echo "─────────────────────────────────────────────────────────────────────────────────────"

echo "$RESPONSE" | jq -r '.data[] | "\(.id)\t\(.fan_count // 0)\t\(.category // "N/A")\t\(.tasks | length)\t\(.name)"' | \
while IFS=$'\t' read -r id fans category task_count name; do
  printf "%-20s %-18s %-25s %-10s %s\n" "$id" "${fans} fans" "$category" "${task_count} tasks" "$name"
done

echo ""
echo "Use ./fb-list-pages.sh --json for full details with access tokens."
