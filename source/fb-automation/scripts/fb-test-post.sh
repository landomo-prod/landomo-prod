#!/usr/bin/env bash
#
# Test posting to your Facebook page.
# Creates a test post and optionally adds a comment (the same flow fb-automation uses).
#
# Usage:
#   ./fb-test-post.sh                    # dry run (shows what would be posted)
#   ./fb-test-post.sh --publish          # actually posts to your page
#   ./fb-test-post.sh --publish --delete  # posts, verifies, then deletes

set -euo pipefail

GRAPH_API="https://graph.facebook.com/v22.0"
PUBLISH=false
DELETE_AFTER=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --publish) PUBLISH=true; shift ;;
    --delete)  DELETE_AFTER=true; shift ;;
    *)         shift ;;
  esac
done

ENV_FILE="$(dirname "$0")/../.env"

load_env() {
  grep -E "^${1}=" "$ENV_FILE" 2>/dev/null | cut -d= -f2- || true
}

PAGE_ID="${FB_PAGE_ID:-$(load_env FB_PAGE_ID)}"
PAGE_TOKEN="${FB_PAGE_ACCESS_TOKEN:-$(load_env FB_PAGE_ACCESS_TOKEN)}"

if [[ -z "$PAGE_ID" || -z "$PAGE_TOKEN" ]]; then
  echo "Error: FB_PAGE_ID and FB_PAGE_ACCESS_TOKEN required. Run ./fb-setup.sh first." >&2
  exit 1
fi

# Test post content
POST_TEXT="🏢 Testovací příspěvek — Landomo fb-automation

📍 Praha 5, Smíchov
💰 4 500 000 CZK
📐 75 m²
🚪 3+kk

Právě se na trhu objevila zajímavá nabídka bytu v žádané lokalitě Smíchova!

#nemovitosti #byty #prodej #praha

📌 Nenech si to ujít! ➡️ Odkaz v komentáři 👇"

COMMENT_TEXT="🔗 Více informací o této nemovitosti:
https://landomo.cz/p/test-123"

echo ""
echo "=== Facebook Test Post ==="
echo ""
echo "Page: ${PAGE_ID}"
echo ""
echo "--- Post Content ---"
echo "$POST_TEXT"
echo ""
echo "--- Comment Content ---"
echo "$COMMENT_TEXT"
echo ""

if [[ "$PUBLISH" != "true" ]]; then
  echo "(Dry run — use --publish to actually post)"
  exit 0
fi

echo "Publishing test post..."

# Create post
POST_RESPONSE=$(curl -s -X POST "${GRAPH_API}/${PAGE_ID}/feed" \
  -H "Content-Type: application/json" \
  -d "$(jq -n --arg msg "$POST_TEXT" --arg token "$PAGE_TOKEN" '{message: $msg, access_token: $token}')")

POST_ID=$(echo "$POST_RESPONSE" | jq -r '.id // empty')
POST_ERROR=$(echo "$POST_RESPONSE" | jq -r '.error.message // empty')

if [[ -z "$POST_ID" ]]; then
  echo "FAILED to create post: ${POST_ERROR}"
  exit 1
fi

echo "Post created: ${POST_ID}"

# Add comment
echo "Adding comment with link..."

COMMENT_RESPONSE=$(curl -s -X POST "${GRAPH_API}/${POST_ID}/comments" \
  -H "Content-Type: application/json" \
  -d "$(jq -n --arg msg "$COMMENT_TEXT" --arg token "$PAGE_TOKEN" '{message: $msg, access_token: $token}')")

COMMENT_ID=$(echo "$COMMENT_RESPONSE" | jq -r '.id // empty')
COMMENT_ERROR=$(echo "$COMMENT_RESPONSE" | jq -r '.error.message // empty')

if [[ -n "$COMMENT_ID" ]]; then
  echo "Comment added: ${COMMENT_ID}"
  echo ""
  echo "SUCCESS — Post + comment flow works correctly."
else
  echo "FAILED to add comment: ${COMMENT_ERROR}"
  echo ""
  echo "Testing fallback: editing post to include link..."

  FALLBACK_TEXT="${POST_TEXT}

https://landomo.cz/p/test-123"

  EDIT_RESPONSE=$(curl -s -X POST "${GRAPH_API}/${POST_ID}" \
    -H "Content-Type: application/json" \
    -d "$(jq -n --arg msg "$FALLBACK_TEXT" --arg token "$PAGE_TOKEN" '{message: $msg, access_token: $token}')")

  EDIT_ERROR=$(echo "$EDIT_RESPONSE" | jq -r '.error.message // empty')
  if [[ -z "$EDIT_ERROR" ]]; then
    echo "Fallback edit succeeded."
  else
    echo "Fallback edit also failed: ${EDIT_ERROR}"
  fi
fi

# Optionally delete the test post
if [[ "$DELETE_AFTER" == "true" ]]; then
  echo ""
  echo "Deleting test post..."
  DELETE_RESPONSE=$(curl -s -X DELETE "${GRAPH_API}/${POST_ID}?access_token=${PAGE_TOKEN}")
  DELETE_SUCCESS=$(echo "$DELETE_RESPONSE" | jq -r '.success // false')
  if [[ "$DELETE_SUCCESS" == "true" ]]; then
    echo "Test post deleted."
  else
    echo "Failed to delete test post. Delete manually: ${POST_ID}"
  fi
fi

echo ""
echo "View post: https://www.facebook.com/${POST_ID}"
