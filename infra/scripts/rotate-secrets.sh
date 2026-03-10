#!/usr/bin/env bash
#
# rotate-secrets.sh - Rotate Docker secrets for Landomo platform
#
# Usage:
#   ./scripts/rotate-secrets.sh db          # Rotate database password
#   ./scripts/rotate-secrets.sh redis       # Rotate Redis password
#   ./scripts/rotate-secrets.sh api-keys    # Rotate all API keys
#   ./scripts/rotate-secrets.sh all         # Rotate everything
#
# After rotation, affected services are restarted to pick up new secrets.
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SECRETS_DIR="$PROJECT_ROOT/docker/secrets"
COMPOSE_FILE="$PROJECT_ROOT/docker/docker-compose.yml"
LOG_FILE="$PROJECT_ROOT/docker/secrets/rotation.log"

COUNTRIES=(australia uk usa czech france spain italy slovakia hungary germany austria)

gen_password() {
  local length="${1:-32}"
  LC_ALL=C tr -dc 'A-Za-z0-9' </dev/urandom | head -c "$length"
}

gen_api_key() {
  local prefix="$1"
  echo "${prefix}_$(gen_password 24)"
}

log_rotation() {
  local target="$1"
  local timestamp
  timestamp="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
  echo "${timestamp} ROTATED ${target}" >> "$LOG_FILE"
  echo "  Logged rotation event: ${target} at ${timestamp}"
}

rotate_db() {
  echo "--- Rotating database password ---"
  local new_pass
  new_pass="$(gen_password 32)"

  # Update PostgreSQL password via psql if postgres container is running
  if docker ps --format '{{.Names}}' | grep -q 'landomo-postgres'; then
    echo "  Updating PostgreSQL password in running database..."
    local db_user
    db_user="$(docker exec landomo-postgres printenv POSTGRES_USER 2>/dev/null || echo 'landomo')"
    docker exec landomo-postgres psql -U "$db_user" -d postgres \
      -c "ALTER USER ${db_user} WITH PASSWORD '${new_pass}';" 2>/dev/null \
      && echo "  PostgreSQL password updated successfully." \
      || echo "  WARNING: Could not update PostgreSQL password. Update manually after restart."
  else
    echo "  WARNING: PostgreSQL container not running. New password will take effect on next init."
  fi

  # Write new secret file
  printf '%s' "$new_pass" > "$SECRETS_DIR/db_password"
  chmod 600 "$SECRETS_DIR/db_password"
  echo "  Secret file updated: db_password"

  log_rotation "db_password"

  # Restart affected services
  echo "  Restarting ingest and worker services..."
  docker compose --project-directory "$PROJECT_ROOT" -f "$COMPOSE_FILE" \
    restart postgres $(printf 'ingest-%s ' "${COUNTRIES[@]}") $(printf 'worker-%s ' "${COUNTRIES[@]}") 2>/dev/null \
    || echo "  WARNING: Some services could not be restarted. Restart manually."

  echo "  Database password rotation complete."
}

rotate_redis() {
  echo "--- Rotating Redis password ---"
  local new_pass
  new_pass="$(gen_password 32)"

  # Update Redis password in running instance if available
  if docker ps --format '{{.Names}}' | grep -q 'landomo-redis'; then
    local old_pass
    old_pass="$(cat "$SECRETS_DIR/redis_password" 2>/dev/null || echo '')"
    echo "  Updating Redis password in running instance..."
    if [[ -n "$old_pass" ]]; then
      docker exec landomo-redis redis-cli -a "$old_pass" CONFIG SET requirepass "$new_pass" 2>/dev/null \
        && echo "  Redis password updated successfully." \
        || echo "  WARNING: Could not update Redis password. Update manually."
    else
      docker exec landomo-redis redis-cli CONFIG SET requirepass "$new_pass" 2>/dev/null \
        && echo "  Redis password updated successfully." \
        || echo "  WARNING: Could not update Redis password. Update manually."
    fi
  else
    echo "  WARNING: Redis container not running. New password will take effect on next start."
  fi

  printf '%s' "$new_pass" > "$SECRETS_DIR/redis_password"
  chmod 600 "$SECRETS_DIR/redis_password"
  echo "  Secret file updated: redis_password"

  log_rotation "redis_password"

  echo "  Restarting services that use Redis..."
  docker compose --project-directory "$PROJECT_ROOT" -f "$COMPOSE_FILE" \
    restart redis $(printf 'ingest-%s ' "${COUNTRIES[@]}") $(printf 'worker-%s ' "${COUNTRIES[@]}") 2>/dev/null \
    || echo "  WARNING: Some services could not be restarted. Restart manually."

  echo "  Redis password rotation complete."
}

rotate_api_keys() {
  echo "--- Rotating API keys ---"
  for country in "${COUNTRIES[@]}"; do
    local key1 key2
    key1="$(gen_api_key "${country}")"
    key2="$(gen_api_key "${country}")"
    printf '%s' "${key1},${key2}" > "$SECRETS_DIR/api_keys_${country}"
    chmod 600 "$SECRETS_DIR/api_keys_${country}"
    echo "  Rotated: api_keys_${country}"
    log_rotation "api_keys_${country}"
  done

  echo "  Restarting ingest services..."
  docker compose --project-directory "$PROJECT_ROOT" -f "$COMPOSE_FILE" \
    restart $(printf 'ingest-%s ' "${COUNTRIES[@]}") 2>/dev/null \
    || echo "  WARNING: Some services could not be restarted. Restart manually."

  echo ""
  echo "  IMPORTANT: Update scraper configurations with new API keys."
  echo "  New keys are in: $SECRETS_DIR/api_keys_*"

  echo "  API key rotation complete."
}

usage() {
  echo "Usage: $0 {db|redis|api-keys|all}"
  echo ""
  echo "  db        Rotate database password and restart DB-connected services"
  echo "  redis     Rotate Redis password and restart Redis-connected services"
  echo "  api-keys  Rotate all per-country API keys and restart ingest services"
  echo "  all       Rotate all secrets"
  exit 1
}

if [[ $# -lt 1 ]]; then
  usage
fi

echo "=== Landomo Secret Rotation ==="
echo ""

case "$1" in
  db)
    rotate_db
    ;;
  redis)
    rotate_redis
    ;;
  api-keys)
    rotate_api_keys
    ;;
  all)
    rotate_db
    echo ""
    rotate_redis
    echo ""
    rotate_api_keys
    ;;
  *)
    usage
    ;;
esac

echo ""
echo "=== Rotation complete ==="
