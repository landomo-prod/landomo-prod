#!/usr/bin/env bash
# =============================================================================
# WAL-G backup sidecar entrypoint
# =============================================================================
set -euo pipefail

log() { echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] $*"; }

# ── Validate required environment ────────────────────────────────────────────
required_vars=(
  WALG_S3_PREFIX
  AWS_ENDPOINT
  AWS_ACCESS_KEY_ID
  AWS_SECRET_ACCESS_KEY
  AWS_REGION
  PGHOST
  PGUSER
  PGPASSWORD
)

missing=()
for var in "${required_vars[@]}"; do
  if [ -z "${!var:-}" ]; then
    missing+=("$var")
  fi
done

if [ ${#missing[@]} -gt 0 ]; then
  log "ERROR: Missing required environment variables: ${missing[*]}"
  exit 1
fi

# ── Export WAL-G / AWS env so cron jobs inherit them ─────────────────────────
# dcron does not inherit the parent environment, so we write an env file
# that the cron scripts source explicitly.
env_file="/etc/walg.env"
{
  echo "WALG_S3_PREFIX=${WALG_S3_PREFIX}"
  echo "AWS_ENDPOINT=${AWS_ENDPOINT}"
  echo "AWS_ACCESS_KEY_ID=${AWS_ACCESS_KEY_ID}"
  echo "AWS_SECRET_ACCESS_KEY=${AWS_SECRET_ACCESS_KEY}"
  echo "AWS_REGION=${AWS_REGION}"
  echo "AWS_S3_FORCE_PATH_STYLE=${AWS_S3_FORCE_PATH_STYLE:-true}"
  echo "WALG_COMPRESSION_METHOD=${WALG_COMPRESSION_METHOD:-brotli}"
  echo "WALG_DELTA_MAX_STEPS=${WALG_DELTA_MAX_STEPS:-6}"
  echo "PGHOST=${PGHOST}"
  echo "PGPORT=${PGPORT:-5432}"
  echo "PGUSER=${PGUSER}"
  echo "PGPASSWORD=${PGPASSWORD}"
  echo "PGDATABASE=${PGDATABASE:-postgres}"
} > "$env_file"
chmod 600 "$env_file"

log "WAL-G backup sidecar starting"
log "  S3 prefix : ${WALG_S3_PREFIX}"
log "  S3 endpoint: ${AWS_ENDPOINT}"
log "  Postgres  : ${PGHOST}:${PGPORT:-5432}"

# ── Wait for postgres to be ready ────────────────────────────────────────────
log "Waiting for postgres..."
until pg_isready -h "${PGHOST}" -p "${PGPORT:-5432}" -U "${PGUSER}" -q 2>/dev/null; do
  sleep 5
done
log "Postgres is ready."

# ── Start cron daemon ────────────────────────────────────────────────────────
log "Starting cron daemon..."
# Use busybox crond (-f foreground, -l 8 log level, -L /dev/stdout)
exec busybox crond -f -l 8 -L /proc/1/fd/1
