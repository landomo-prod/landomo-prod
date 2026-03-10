#!/usr/bin/env bash
#
# rotate-api-keys.sh - Rotate API keys for a specific country with versioning
#
# Usage:
#   ./scripts/rotate-api-keys.sh <country> [--remove-old] [--expiry YYYY-MM-DD]
#
# Examples:
#   ./scripts/rotate-api-keys.sh czech                       # Add v-next key, keep old
#   ./scripts/rotate-api-keys.sh czech --expiry 2026-12-31   # New key with expiry date
#   ./scripts/rotate-api-keys.sh czech --remove-old           # Remove oldest key
#
# Key format in secret files:  key:version[:expiry]
#   e.g. "abc123:v1,def456:v2:2026-12-31"
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SECRETS_DIR="$PROJECT_ROOT/docker/secrets"
LOG_FILE="$SECRETS_DIR/rotation.log"

gen_key() {
  LC_ALL=C tr -dc 'A-Za-z0-9' </dev/urandom | head -c 32
}

next_version() {
  local current_max="$1"
  # Extract numeric part from "vN", default to 0
  local num
  num="${current_max#v}"
  if [[ "$num" =~ ^[0-9]+$ ]]; then
    echo "v$(( num + 1 ))"
  else
    echo "v1"
  fi
}

log_event() {
  local msg="$1"
  local timestamp
  timestamp="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
  mkdir -p "$(dirname "$LOG_FILE")"
  echo "${timestamp} ${msg}" >> "$LOG_FILE"
}

usage() {
  echo "Usage: $0 <country> [--remove-old] [--expiry YYYY-MM-DD]"
  echo ""
  echo "  <country>       Country name (e.g. czech, slovakia, germany)"
  echo "  --remove-old    Remove the oldest key (use after grace period)"
  echo "  --expiry DATE   Set expiry date on new key (YYYY-MM-DD)"
  echo ""
  echo "Key format: key:version[:expiry]"
  echo "Multiple keys separated by commas."
  exit 1
}

if [[ $# -lt 1 ]]; then
  usage
fi

COUNTRY="$1"
shift

REMOVE_OLD=false
EXPIRY=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --remove-old)
      REMOVE_OLD=true
      shift
      ;;
    --expiry)
      EXPIRY="$2"
      shift 2
      ;;
    *)
      echo "Unknown option: $1"
      usage
      ;;
  esac
done

SECRET_FILE="$SECRETS_DIR/api_keys_${COUNTRY}"

echo "=== API Key Rotation: ${COUNTRY} ==="
echo ""

# Read existing keys
EXISTING=""
if [[ -f "$SECRET_FILE" ]]; then
  EXISTING="$(cat "$SECRET_FILE")"
fi

# Parse existing entries to find max version
MAX_VERSION="v0"
ENTRY_COUNT=0
if [[ -n "$EXISTING" ]]; then
  IFS=',' read -ra ENTRIES <<< "$EXISTING"
  ENTRY_COUNT="${#ENTRIES[@]}"
  for entry in "${ENTRIES[@]}"; do
    IFS=':' read -ra PARTS <<< "$entry"
    if [[ ${#PARTS[@]} -ge 2 ]]; then
      ver="${PARTS[1]}"
      ver_num="${ver#v}"
      max_num="${MAX_VERSION#v}"
      if [[ "$ver_num" =~ ^[0-9]+$ ]] && [[ "$ver_num" -gt "$max_num" ]]; then
        MAX_VERSION="$ver"
      fi
    fi
  done
fi

if [[ "$REMOVE_OLD" == true ]]; then
  if [[ "$ENTRY_COUNT" -le 1 ]]; then
    echo "ERROR: Cannot remove old key - only ${ENTRY_COUNT} key(s) configured."
    echo "  At least one key must remain active."
    exit 1
  fi

  # Remove the first (oldest) entry
  IFS=',' read -ra ENTRIES <<< "$EXISTING"
  REMOVED="${ENTRIES[0]}"
  # Mask the key for display
  IFS=':' read -ra RM_PARTS <<< "$REMOVED"
  MASKED_KEY="****${RM_PARTS[0]: -4}"
  RM_VER="${RM_PARTS[1]:-v1}"

  NEW_ENTRIES=("${ENTRIES[@]:1}")
  NEW_VALUE="$(IFS=','; echo "${NEW_ENTRIES[*]}")"

  mkdir -p "$SECRETS_DIR"
  printf '%s' "$NEW_VALUE" > "$SECRET_FILE"
  chmod 600 "$SECRET_FILE"

  echo "Removed oldest key: ${MASKED_KEY} (${RM_VER})"
  log_event "REMOVED api_keys_${COUNTRY} version=${RM_VER}"
else
  # Generate new key
  NEW_KEY="$(gen_key)"
  NEW_VERSION="$(next_version "$MAX_VERSION")"

  NEW_ENTRY="${NEW_KEY}:${NEW_VERSION}"
  if [[ -n "$EXPIRY" ]]; then
    NEW_ENTRY="${NEW_ENTRY}:${EXPIRY}"
  fi

  if [[ -n "$EXISTING" ]]; then
    NEW_VALUE="${EXISTING},${NEW_ENTRY}"
  else
    NEW_VALUE="$NEW_ENTRY"
  fi

  mkdir -p "$SECRETS_DIR"
  printf '%s' "$NEW_VALUE" > "$SECRET_FILE"
  chmod 600 "$SECRET_FILE"

  echo "Generated new key:"
  echo "  Version:  ${NEW_VERSION}"
  echo "  Key:      ${NEW_KEY}"
  if [[ -n "$EXPIRY" ]]; then
    echo "  Expires:  ${EXPIRY}"
  fi
  echo ""
  echo "Active keys for ${COUNTRY}: $(( ENTRY_COUNT + 1 ))"

  log_event "ADDED api_keys_${COUNTRY} version=${NEW_VERSION} expiry=${EXPIRY:-none}"
fi

echo ""
echo "Secret file: ${SECRET_FILE}"
echo ""
echo "Next steps:"
echo "  1. Restart the ingest service to pick up new keys:"
echo "     docker compose restart ingest-${COUNTRY}"
echo "  2. Update scraper config with the new key"
if [[ "$REMOVE_OLD" != true ]]; then
  echo "  3. After all scrapers migrate, remove the old key:"
  echo "     $0 ${COUNTRY} --remove-old"
fi
echo ""
echo "=== Done ==="
