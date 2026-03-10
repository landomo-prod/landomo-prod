#!/usr/bin/env bash
# =============================================================================
# Landomo-World Offsite Backup Verification Script
# =============================================================================
# Verifies that offsite backups match local backups and checks retention
# compliance.
#
# Usage:
#   ./backup-verify-offsite.sh                  # Full verification
#   ./backup-verify-offsite.sh --list           # List remote backups only
#   ./backup-verify-offsite.sh --checksums      # Verify checksums only
#   ./backup-verify-offsite.sh --retention      # Check retention compliance only
#
# Environment variables (or set in .env.backup):
#   S3_BUCKET, S3_ENDPOINT, S3_ACCESS_KEY, S3_SECRET_KEY, S3_REGION
#   S3_PREFIX, BACKUP_DIR
#   RETENTION_DAILY      Expected daily backups (default: 30)
#   RETENTION_MONTHLY    Expected monthly backups (default: 12)
# =============================================================================
set -euo pipefail

# --- Load env if available ---------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -f "${SCRIPT_DIR}/../.env.backup" ]; then
  set -a
  # shellcheck source=/dev/null
  source "${SCRIPT_DIR}/../.env.backup"
  set +a
fi

# --- Configuration -----------------------------------------------------------
S3_BUCKET="${S3_BUCKET:-}"
S3_ENDPOINT="${S3_ENDPOINT:-}"
S3_ACCESS_KEY="${S3_ACCESS_KEY:-}"
S3_SECRET_KEY="${S3_SECRET_KEY:-}"
S3_REGION="${S3_REGION:-us-east-1}"
S3_PREFIX="${S3_PREFIX:-landomo-backups}"
BACKUP_DIR="${BACKUP_DIR:-/backups}"
RETENTION_DAILY="${RETENTION_DAILY:-30}"
RETENTION_MONTHLY="${RETENTION_MONTHLY:-12}"

MODE="full"
EXIT_CODE=0

# --- Functions ---------------------------------------------------------------

log() {
  echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] $*"
}

log_error() {
  log "ERROR: $*" >&2
}

log_warn() {
  log "WARN: $*" >&2
}

usage() {
  cat <<EOF
Usage: $(basename "$0") [OPTIONS]

Verify offsite backups match local and check retention compliance.

Options:
  --list           List remote backups only
  --checksums      Verify local vs remote checksums
  --retention      Check retention policy compliance only
  -h, --help       Show this help message

Environment:
  S3_BUCKET, S3_ENDPOINT, S3_ACCESS_KEY, S3_SECRET_KEY, S3_REGION
  S3_PREFIX         Object prefix (default: landomo-backups)
  BACKUP_DIR        Local backup dir (default: /backups)
  RETENTION_DAILY   Expected daily backups (default: 30)
  RETENTION_MONTHLY Expected monthly backups (default: 12)
EOF
  exit 0
}

setup_aws() {
  export AWS_ACCESS_KEY_ID="$S3_ACCESS_KEY"
  export AWS_SECRET_ACCESS_KEY="$S3_SECRET_KEY"
  export AWS_DEFAULT_REGION="$S3_REGION"
}

aws_cmd() {
  local endpoint_args=()
  if [ -n "$S3_ENDPOINT" ]; then
    endpoint_args=(--endpoint-url "$S3_ENDPOINT")
  fi
  aws "${endpoint_args[@]}" "$@"
}

# List all backup files on remote
list_remote_backups() {
  log "Remote backups in s3://${S3_BUCKET}/${S3_PREFIX}/:"
  log ""

  aws_cmd s3 ls "s3://${S3_BUCKET}/${S3_PREFIX}/" --recursive 2>/dev/null | \
    grep -E '\.(dump|sql\.gz|dump\.gpg|dump\.age|sql\.gz\.gpg|sql\.gz\.age)$' | \
    while read -r line; do
      echo "  $line"
    done

  local count
  count=$(aws_cmd s3 ls "s3://${S3_BUCKET}/${S3_PREFIX}/" --recursive 2>/dev/null | \
    grep -cE '\.(dump|sql\.gz|dump\.gpg|dump\.age|sql\.gz\.gpg|sql\.gz\.age)$' || true)
  log ""
  log "Total remote backup files: ${count}"
}

# Compare checksums between local and remote
verify_checksums() {
  log "=== Checksum Verification ==="
  local verified=0
  local mismatched=0
  local missing=0

  for checksum_file in "${BACKUP_DIR}"/*.sha256; do
    [ -f "$checksum_file" ] || continue

    local backup_file="${checksum_file%.sha256}"
    local basename_f
    basename_f=$(basename "$backup_file")

    if [ ! -f "$backup_file" ]; then
      continue
    fi

    local local_checksum
    local_checksum=$(cat "$checksum_file")

    # Download remote checksum
    local remote_checksum_path="s3://${S3_BUCKET}/${S3_PREFIX}/$(basename "$checksum_file")"
    local tmp_checksum
    tmp_checksum=$(mktemp)

    if aws_cmd s3 cp "$remote_checksum_path" "$tmp_checksum" --quiet 2>/dev/null; then
      local remote_checksum
      remote_checksum=$(cat "$tmp_checksum")

      if [ "$local_checksum" = "$remote_checksum" ]; then
        log "  OK: ${basename_f}"
        verified=$(( verified + 1 ))
      else
        log_error "  MISMATCH: ${basename_f} (local=${local_checksum:0:16}... remote=${remote_checksum:0:16}...)"
        mismatched=$(( mismatched + 1 ))
      fi
    else
      log_warn "  MISSING remote checksum: ${basename_f}"
      missing=$(( missing + 1 ))
    fi

    rm -f "$tmp_checksum"
  done

  log ""
  log "Checksum results: ${verified} verified, ${mismatched} mismatched, ${missing} missing"

  if [ "$mismatched" -gt 0 ]; then
    EXIT_CODE=1
  fi
}

# Check retention compliance
check_retention() {
  log "=== Retention Compliance Check ==="

  # Count unique backup dates from remote listing
  local remote_listing
  remote_listing=$(aws_cmd s3 ls "s3://${S3_BUCKET}/${S3_PREFIX}/" --recursive 2>/dev/null || true)

  # Extract unique dates from filenames (format: landomo_*_YYYYMMDD_HHMMSS.dump)
  local unique_dates
  unique_dates=$(echo "$remote_listing" | \
    grep -oE '[0-9]{8}_[0-9]{6}\.(dump|sql)' | \
    grep -oE '[0-9]{8}' | \
    sort -u)

  local total_dates
  total_dates=$(echo "$unique_dates" | grep -c . || true)

  log "Unique backup dates found: ${total_dates}"

  # Check daily retention (should have at least RETENTION_DAILY days of backups)
  local today_epoch
  today_epoch=$(date +%s)
  local daily_threshold_epoch
  daily_threshold_epoch=$(( today_epoch - RETENTION_DAILY * 86400 ))

  local recent_count=0
  while IFS= read -r date_str; do
    [ -z "$date_str" ] && continue
    local year="${date_str:0:4}"
    local month="${date_str:4:2}"
    local day="${date_str:6:2}"
    local date_epoch
    date_epoch=$(date -d "${year}-${month}-${day}" +%s 2>/dev/null || date -j -f "%Y-%m-%d" "${year}-${month}-${day}" +%s 2>/dev/null || echo 0)
    if [ "$date_epoch" -ge "$daily_threshold_epoch" ]; then
      recent_count=$(( recent_count + 1 ))
    fi
  done <<< "$unique_dates"

  log "Daily backups (last ${RETENTION_DAILY} days): ${recent_count} found"
  if [ "$recent_count" -lt "$RETENTION_DAILY" ]; then
    log_warn "Daily retention not met: expected ${RETENTION_DAILY}, found ${recent_count}"
    log_warn "  (This is normal if the system has been running for less than ${RETENTION_DAILY} days)"
  else
    log "  Daily retention: OK"
  fi

  # Check monthly retention (unique months)
  local unique_months
  unique_months=$(echo "$unique_dates" | grep -oE '[0-9]{6}' | sort -u | wc -l | tr -d ' ')

  log "Monthly backups (unique months): ${unique_months} found"
  if [ "$unique_months" -lt "$RETENTION_MONTHLY" ]; then
    log_warn "Monthly retention not met: expected ${RETENTION_MONTHLY}, found ${unique_months}"
    log_warn "  (This is normal if the system has been running for less than ${RETENTION_MONTHLY} months)"
  else
    log "  Monthly retention: OK"
  fi

  # Check for gaps (missing days in the last 7 days)
  log ""
  log "Recent backup check (last 7 days):"
  local days_missing=0
  for i in $(seq 0 6); do
    local check_date
    check_date=$(date -d "-${i} days" +%Y%m%d 2>/dev/null || date -v-${i}d +%Y%m%d 2>/dev/null)
    if echo "$unique_dates" | grep -q "^${check_date}$"; then
      log "  ${check_date}: present"
    else
      log_warn "  ${check_date}: MISSING"
      days_missing=$(( days_missing + 1 ))
    fi
  done

  if [ "$days_missing" -gt 1 ]; then
    log_warn "Multiple missing backup days in the last week (${days_missing} days)"
    EXIT_CODE=1
  fi
}

# Report missing remote backups that exist locally
check_missing_remote() {
  log "=== Missing Remote Backups ==="

  local remote_files
  remote_files=$(aws_cmd s3 ls "s3://${S3_BUCKET}/${S3_PREFIX}/" --recursive 2>/dev/null | \
    awk '{print $NF}' | xargs -I{} basename {} || true)

  local missing=0
  for f in "${BACKUP_DIR}"/*.dump "${BACKUP_DIR}"/*.sql.gz; do
    [ -f "$f" ] || continue
    local basename_f
    basename_f=$(basename "$f")
    if ! echo "$remote_files" | grep -qF "$basename_f"; then
      log_warn "  Not on remote: ${basename_f}"
      missing=$(( missing + 1 ))
    fi
  done

  if [ "$missing" -eq 0 ]; then
    log "  All local backups are present on remote"
  else
    log_warn "  ${missing} local backup(s) not found on remote"
  fi
}

# --- Main --------------------------------------------------------------------

main() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --list)
        MODE="list"
        shift
        ;;
      --checksums)
        MODE="checksums"
        shift
        ;;
      --retention)
        MODE="retention"
        shift
        ;;
      -h|--help)
        usage
        ;;
      *)
        log_error "Unknown option: $1"
        usage
        ;;
    esac
  done

  if [ -z "$S3_BUCKET" ]; then
    log_error "S3_BUCKET is required"
    exit 1
  fi

  if ! command -v aws &>/dev/null; then
    log_error "'aws' CLI not found. Install AWS CLI."
    exit 1
  fi

  setup_aws

  log "========================================"
  log "Offsite Backup Verification"
  log "========================================"
  log "Bucket:  ${S3_BUCKET}"
  log "Prefix:  ${S3_PREFIX}"
  log "Local:   ${BACKUP_DIR}"
  log ""

  case "$MODE" in
    list)
      list_remote_backups
      ;;
    checksums)
      verify_checksums
      ;;
    retention)
      check_retention
      ;;
    full)
      list_remote_backups
      log ""
      verify_checksums
      log ""
      check_retention
      log ""
      check_missing_remote
      ;;
  esac

  log ""
  if [ "$EXIT_CODE" -eq 0 ]; then
    log "=== Verification PASSED ==="
  else
    log "=== Verification FAILED (see warnings above) ==="
  fi

  exit $EXIT_CODE
}

main "$@"
