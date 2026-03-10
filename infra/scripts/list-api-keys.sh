#!/usr/bin/env bash
#
# list-api-keys.sh - List all active API keys per country (masked)
#
# Usage:
#   ./scripts/list-api-keys.sh           # List all countries
#   ./scripts/list-api-keys.sh czech     # List keys for specific country
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SECRETS_DIR="$PROJECT_ROOT/docker/secrets"

mask_key() {
  local key="$1"
  local len="${#key}"
  if [[ "$len" -le 4 ]]; then
    echo "****"
  else
    echo "****${key: -4}"
  fi
}

format_age() {
  local file="$1"
  if [[ "$(uname)" == "Darwin" ]]; then
    local mod_epoch
    mod_epoch="$(stat -f '%m' "$file")"
    local now_epoch
    now_epoch="$(date +%s)"
    local diff=$(( now_epoch - mod_epoch ))
  else
    local mod_epoch
    mod_epoch="$(stat -c '%Y' "$file")"
    local now_epoch
    now_epoch="$(date +%s)"
    local diff=$(( now_epoch - mod_epoch ))
  fi

  if [[ "$diff" -lt 3600 ]]; then
    echo "$(( diff / 60 ))m ago"
  elif [[ "$diff" -lt 86400 ]]; then
    echo "$(( diff / 3600 ))h ago"
  else
    echo "$(( diff / 86400 ))d ago"
  fi
}

list_country() {
  local country="$1"
  local file="$SECRETS_DIR/api_keys_${country}"

  if [[ ! -f "$file" ]]; then
    echo "  (no keys configured)"
    return
  fi

  local content
  content="$(cat "$file")"
  if [[ -z "$content" ]]; then
    echo "  (empty key file)"
    return
  fi

  local age
  age="$(format_age "$file")"

  IFS=',' read -ra ENTRIES <<< "$content"
  for entry in "${ENTRIES[@]}"; do
    IFS=':' read -ra PARTS <<< "$entry"
    local key="${PARTS[0]}"
    local version="${PARTS[1]:-v1}"
    local expiry="${PARTS[2]:-none}"
    local masked
    masked="$(mask_key "$key")"

    local expiry_display="$expiry"
    if [[ "$expiry" != "none" ]]; then
      local exp_epoch
      if [[ "$(uname)" == "Darwin" ]]; then
        exp_epoch="$(date -j -f '%Y-%m-%d' "$expiry" '+%s' 2>/dev/null || echo 0)"
      else
        exp_epoch="$(date -d "$expiry" '+%s' 2>/dev/null || echo 0)"
      fi
      local now_epoch
      now_epoch="$(date +%s)"
      if [[ "$exp_epoch" -gt 0 ]]; then
        local remaining=$(( (exp_epoch - now_epoch) / 86400 ))
        if [[ "$remaining" -lt 0 ]]; then
          expiry_display="${expiry} (EXPIRED)"
        elif [[ "$remaining" -le 30 ]]; then
          expiry_display="${expiry} (${remaining}d remaining)"
        else
          expiry_display="${expiry}"
        fi
      fi
    fi

    printf "  %-8s  %-12s  expires: %-30s  file modified: %s\n" "$version" "$masked" "$expiry_display" "$age"
  done
}

echo "=== Landomo API Keys ==="
echo ""

if [[ $# -ge 1 ]]; then
  # Single country
  echo "Country: $1"
  list_country "$1"
else
  # All countries - scan secrets directory
  if [[ ! -d "$SECRETS_DIR" ]]; then
    echo "Secrets directory not found: $SECRETS_DIR"
    echo "Run scripts/init-secrets.sh first."
    exit 1
  fi

  found=false
  for file in "$SECRETS_DIR"/api_keys_*; do
    if [[ ! -f "$file" ]]; then
      continue
    fi
    found=true
    country="$(basename "$file" | sed 's/^api_keys_//')"
    echo "Country: ${country}"
    list_country "$country"
    echo ""
  done

  if [[ "$found" == false ]]; then
    echo "No API key files found in $SECRETS_DIR"
    echo "Expected files named: api_keys_<country>"
  fi
fi

echo "=== End ==="
