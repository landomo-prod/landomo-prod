#!/usr/bin/env bash
# =============================================================================
# Landomo-World Offsite Backup Sync Script
# =============================================================================
# Syncs local database backups to S3-compatible object storage.
# Supports AWS S3, MinIO, Backblaze B2, and DigitalOcean Spaces.
#
# Usage:
#   ./backup-sync-s3.sh                    # Sync all backups
#   ./backup-sync-s3.sh --encrypt          # Encrypt before uploading
#   ./backup-sync-s3.sh --dry-run          # Preview what would be synced
#
# Environment variables (or set in .env.backup):
#   S3_BUCKET            Target bucket name (required)
#   S3_ENDPOINT          S3-compatible endpoint URL (for non-AWS)
#   S3_ACCESS_KEY        Access key ID
#   S3_SECRET_KEY        Secret access key
#   S3_REGION            AWS region (default: us-east-1)
#   S3_PREFIX            Object prefix/folder in bucket (default: landomo-backups)
#   BACKUP_DIR           Local backup directory (default: /backups)
#   ENCRYPT_BACKUPS      Encrypt before upload: "gpg" or "age" (default: none)
#   GPG_RECIPIENT        GPG key ID for encryption (if ENCRYPT_BACKUPS=gpg)
#   AGE_RECIPIENTS_FILE  age recipients file (if ENCRYPT_BACKUPS=age)
#   SYNC_TOOL            "awscli" or "rclone" (default: auto-detect)
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
ENCRYPT_BACKUPS="${ENCRYPT_BACKUPS:-none}"
GPG_RECIPIENT="${GPG_RECIPIENT:-}"
AGE_RECIPIENTS_FILE="${AGE_RECIPIENTS_FILE:-}"
SYNC_TOOL="${SYNC_TOOL:-auto}"
DRY_RUN=false
DO_ENCRYPT=false
TIMESTAMP="$(date -u +%Y%m%d_%H%M%S)"

# --- Functions ---------------------------------------------------------------

log() {
  echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] $*"
}

log_error() {
  log "ERROR: $*" >&2
}

usage() {
  cat <<EOF
Usage: $(basename "$0") [OPTIONS]

Sync local database backups to S3-compatible object storage.

Options:
  --encrypt         Encrypt backup files before uploading
  --dry-run         Show what would be synced without uploading
  -h, --help        Show this help message

Environment:
  S3_BUCKET           Target bucket (required)
  S3_ENDPOINT         Endpoint URL for non-AWS (e.g., http://minio:9000)
  S3_ACCESS_KEY       Access key ID
  S3_SECRET_KEY       Secret access key
  S3_REGION           AWS region (default: us-east-1)
  S3_PREFIX           Object key prefix (default: landomo-backups)
  BACKUP_DIR          Local backup dir (default: /backups)
  ENCRYPT_BACKUPS     "gpg", "age", or "none" (default: none)
  GPG_RECIPIENT       GPG key ID for --encrypt with gpg
  AGE_RECIPIENTS_FILE age recipients file for --encrypt with age
  SYNC_TOOL           "awscli" or "rclone" (default: auto-detect)
EOF
  exit 0
}

detect_sync_tool() {
  if [ "$SYNC_TOOL" != "auto" ]; then
    if ! command -v "$SYNC_TOOL" &>/dev/null; then
      if [ "$SYNC_TOOL" = "awscli" ] && command -v aws &>/dev/null; then
        SYNC_TOOL="awscli"
        return
      fi
      log_error "Requested sync tool '${SYNC_TOOL}' not found"
      exit 1
    fi
    return
  fi

  if command -v aws &>/dev/null; then
    SYNC_TOOL="awscli"
  elif command -v rclone &>/dev/null; then
    SYNC_TOOL="rclone"
  else
    log_error "Neither 'aws' CLI nor 'rclone' found. Install one of them."
    exit 1
  fi
  log "Auto-detected sync tool: ${SYNC_TOOL}"
}

validate_config() {
  if [ -z "$S3_BUCKET" ]; then
    log_error "S3_BUCKET is required"
    exit 1
  fi
  if [ ! -d "$BACKUP_DIR" ]; then
    log_error "BACKUP_DIR does not exist: ${BACKUP_DIR}"
    exit 1
  fi
}

# Encrypt a single file, returning the path to the encrypted file
encrypt_file() {
  local src="$1"
  local encrypted=""

  case "$ENCRYPT_BACKUPS" in
    gpg)
      if [ -z "$GPG_RECIPIENT" ]; then
        log_error "GPG_RECIPIENT required when ENCRYPT_BACKUPS=gpg"
        exit 1
      fi
      encrypted="${src}.gpg"
      gpg --batch --yes --recipient "$GPG_RECIPIENT" --output "$encrypted" --encrypt "$src"
      echo "$encrypted"
      ;;
    age)
      if ! command -v age &>/dev/null; then
        log_error "'age' command not found. Install age encryption tool."
        exit 1
      fi
      encrypted="${src}.age"
      if [ -n "$AGE_RECIPIENTS_FILE" ]; then
        age --encrypt --recipients-file "$AGE_RECIPIENTS_FILE" --output "$encrypted" "$src"
      else
        log_error "AGE_RECIPIENTS_FILE required when ENCRYPT_BACKUPS=age"
        exit 1
      fi
      echo "$encrypted"
      ;;
    none|"")
      echo "$src"
      ;;
    *)
      log_error "Unknown ENCRYPT_BACKUPS value: ${ENCRYPT_BACKUPS}"
      exit 1
      ;;
  esac
}

# Generate SHA256 checksum for a file
generate_checksum() {
  local file="$1"
  local checksum_file="${file}.sha256"
  sha256sum "$file" | awk '{print $1}' > "$checksum_file"
  echo "$checksum_file"
}

# Sync using AWS CLI
sync_awscli() {
  local src_dir="$1"
  local s3_dest="$2"

  local endpoint_args=()
  if [ -n "$S3_ENDPOINT" ]; then
    endpoint_args=(--endpoint-url "$S3_ENDPOINT")
  fi

  export AWS_ACCESS_KEY_ID="$S3_ACCESS_KEY"
  export AWS_SECRET_ACCESS_KEY="$S3_SECRET_KEY"
  export AWS_DEFAULT_REGION="$S3_REGION"

  local dry_run_args=()
  if [ "$DRY_RUN" = true ]; then
    dry_run_args=(--dryrun)
  fi

  aws s3 sync "$src_dir" "$s3_dest" \
    "${endpoint_args[@]}" \
    "${dry_run_args[@]}" \
    --exclude "*.log" \
    --exclude "latest_backup_summary.json" \
    --storage-class STANDARD_IA \
    --no-progress
}

# Sync using rclone
sync_rclone() {
  local src_dir="$1"
  local remote_dest="$2"

  # Configure rclone on-the-fly via environment
  export RCLONE_CONFIG_LANDOMO_TYPE=s3
  export RCLONE_CONFIG_LANDOMO_ACCESS_KEY_ID="$S3_ACCESS_KEY"
  export RCLONE_CONFIG_LANDOMO_SECRET_ACCESS_KEY="$S3_SECRET_KEY"
  export RCLONE_CONFIG_LANDOMO_REGION="$S3_REGION"
  if [ -n "$S3_ENDPOINT" ]; then
    export RCLONE_CONFIG_LANDOMO_ENDPOINT="$S3_ENDPOINT"
    export RCLONE_CONFIG_LANDOMO_PROVIDER=Other
  else
    export RCLONE_CONFIG_LANDOMO_PROVIDER=AWS
  fi

  local dry_run_args=()
  if [ "$DRY_RUN" = true ]; then
    dry_run_args=(--dry-run)
  fi

  rclone sync "$src_dir" "landomo:${S3_BUCKET}/${S3_PREFIX}" \
    "${dry_run_args[@]}" \
    --exclude "*.log" \
    --exclude "latest_backup_summary.json" \
    --checksum \
    --stats-one-line \
    -v
}

# --- Main --------------------------------------------------------------------

main() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --encrypt)
        DO_ENCRYPT=true
        shift
        ;;
      --dry-run)
        DRY_RUN=true
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

  validate_config
  detect_sync_tool

  log "=== Offsite Backup Sync ==="
  log "Source:      ${BACKUP_DIR}"
  log "Bucket:      ${S3_BUCKET}"
  log "Prefix:      ${S3_PREFIX}"
  log "Tool:        ${SYNC_TOOL}"
  log "Encrypt:     ${DO_ENCRYPT} (${ENCRYPT_BACKUPS})"
  log "Dry run:     ${DRY_RUN}"

  # If encryption requested, encrypt files first into a staging directory
  local sync_dir="$BACKUP_DIR"
  local staging_dir=""
  if [ "$DO_ENCRYPT" = true ] && [ "$ENCRYPT_BACKUPS" != "none" ]; then
    staging_dir="${BACKUP_DIR}/.sync-staging-${TIMESTAMP}"
    mkdir -p "$staging_dir"
    sync_dir="$staging_dir"

    log "Encrypting backup files..."
    local count=0
    for f in "${BACKUP_DIR}"/*.dump "${BACKUP_DIR}"/*.sql.gz; do
      [ -f "$f" ] || continue
      local basename_f
      basename_f=$(basename "$f")
      log "  Encrypting: ${basename_f}"
      local encrypted
      encrypted=$(encrypt_file "$f")
      if [ "$encrypted" != "$f" ]; then
        mv "$encrypted" "${staging_dir}/"
      else
        cp "$f" "${staging_dir}/"
      fi

      # Copy metadata sidecar if present
      if [ -f "${f}.meta" ]; then
        cp "${f}.meta" "${staging_dir}/"
      fi

      # Generate checksum
      local staged_file="${staging_dir}/$(basename "$encrypted")"
      generate_checksum "$staged_file" > /dev/null
      count=$(( count + 1 ))
    done
    log "Encrypted ${count} file(s)"
  else
    # Generate checksums for unencrypted files
    log "Generating checksums..."
    for f in "${BACKUP_DIR}"/*.dump "${BACKUP_DIR}"/*.sql.gz; do
      [ -f "$f" ] || continue
      if [ ! -f "${f}.sha256" ] || [ "$f" -nt "${f}.sha256" ]; then
        generate_checksum "$f" > /dev/null
      fi
    done
  fi

  # Perform sync
  log "Starting sync..."
  local start_time
  start_time=$(date +%s)

  case "$SYNC_TOOL" in
    awscli)
      sync_awscli "$sync_dir" "s3://${S3_BUCKET}/${S3_PREFIX}"
      ;;
    rclone)
      sync_rclone "$sync_dir" "landomo:${S3_BUCKET}/${S3_PREFIX}"
      ;;
  esac

  local end_time
  end_time=$(date +%s)
  local duration=$(( end_time - start_time ))

  log "Sync completed in ${duration}s"

  # Cleanup staging directory
  if [ -n "$staging_dir" ] && [ -d "$staging_dir" ]; then
    rm -rf "$staging_dir"
    log "Cleaned up staging directory"
  fi

  # Write sync result metadata
  cat > "${BACKUP_DIR}/latest_sync_result.json" <<EOF
{
  "timestamp": "${TIMESTAMP}",
  "bucket": "${S3_BUCKET}",
  "prefix": "${S3_PREFIX}",
  "tool": "${SYNC_TOOL}",
  "encrypted": ${DO_ENCRYPT},
  "encryption_method": "${ENCRYPT_BACKUPS}",
  "duration_seconds": ${duration},
  "dry_run": ${DRY_RUN}
}
EOF

  log "=== Sync Complete ==="
}

main "$@"
