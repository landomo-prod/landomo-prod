#!/usr/bin/env bash
#
# init-secrets.sh - Generate Docker secret files for Landomo platform
#
# Usage:
#   ./scripts/init-secrets.sh          # Generate all secrets (skip existing)
#   ./scripts/init-secrets.sh --force  # Overwrite existing secrets
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SECRETS_DIR="$PROJECT_ROOT/docker/secrets"
FORCE=false

if [[ "${1:-}" == "--force" ]]; then
  FORCE=true
fi

# Generate a random alphanumeric string of given length
gen_password() {
  local length="${1:-32}"
  LC_ALL=C tr -dc 'A-Za-z0-9' </dev/urandom | head -c "$length"
}

# Generate a random API key with prefix
gen_api_key() {
  local prefix="$1"
  echo "${prefix}_$(gen_password 24)"
}

# Write a secret file (skip if exists unless --force)
write_secret() {
  local name="$1"
  local value="$2"
  local file="$SECRETS_DIR/$name"

  if [[ -f "$file" ]] && [[ "$FORCE" != "true" ]]; then
    echo "  SKIP  $name (already exists, use --force to overwrite)"
    return
  fi

  printf '%s' "$value" > "$file"
  chmod 600 "$file"
  echo "  CREATED  $name"
}

echo "=== Landomo Docker Secrets Initialization ==="
echo ""
echo "Secrets directory: $SECRETS_DIR"
echo ""

mkdir -p "$SECRETS_DIR"

# --- Infrastructure secrets ---
echo "Infrastructure passwords:"
write_secret "db_password" "$(gen_password 32)"
write_secret "db_read_password" "$(gen_password 32)"
write_secret "redis_password" "$(gen_password 32)"
write_secret "grafana_password" "$(gen_password 24)"

echo ""

# --- Per-country API keys (two keys each, comma-separated) ---
COUNTRIES=(australia uk usa czech france spain italy slovakia hungary germany austria)

echo "Per-country API keys:"
for country in "${COUNTRIES[@]}"; do
  key1="$(gen_api_key "${country}")"
  key2="$(gen_api_key "${country}")"
  write_secret "api_keys_${country}" "${key1},${key2}"
done

echo ""
echo "=== Secrets initialization complete ==="
echo ""
echo "Files are in: $SECRETS_DIR"
echo "File permissions set to 600 (owner read/write only)."
echo ""
echo "To use custom values, edit the files directly:"
echo "  echo 'my_custom_password' > $SECRETS_DIR/db_password"
echo ""
echo "Then start the platform:"
echo "  docker compose --project-directory . -f docker/docker-compose.yml up -d"
