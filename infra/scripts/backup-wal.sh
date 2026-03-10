#!/usr/bin/env bash
# =============================================================================
# Landomo-World WAL Archiving Setup for Point-in-Time Recovery (PITR)
# =============================================================================
# Configures PostgreSQL WAL archiving and verifies it is working.
#
# Usage:
#   ./backup-wal.sh setup      # Configure WAL archiving
#   ./backup-wal.sh verify     # Verify WAL archiving is active
#   ./backup-wal.sh base       # Take a base backup (required for PITR restore)
#   ./backup-wal.sh status     # Show current WAL archiving status
#
# Environment variables:
#   PGHOST          PostgreSQL host (default: postgres)
#   PGPORT          PostgreSQL port (default: 5432)
#   PGUSER          PostgreSQL user (default: landomo)
#   PGPASSWORD      PostgreSQL password (required)
#   WAL_ARCHIVE_DIR WAL archive directory (default: /backups/wal_archive)
#   BASE_BACKUP_DIR Base backup directory (default: /backups/base)
# =============================================================================
set -euo pipefail

PGHOST="${PGHOST:-postgres}"
PGPORT="${PGPORT:-5432}"
PGUSER="${PGUSER:-landomo}"
WAL_ARCHIVE_DIR="${WAL_ARCHIVE_DIR:-/backups/wal_archive}"
BASE_BACKUP_DIR="${BASE_BACKUP_DIR:-/backups/base}"

log() {
  echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] $*"
}

log_error() {
  log "ERROR: $*" >&2
}

check_prerequisites() {
  if [ -z "${PGPASSWORD:-}" ]; then
    log_error "PGPASSWORD is not set."
    exit 1
  fi
  if ! command -v psql &>/dev/null; then
    log_error "psql not found."
    exit 1
  fi
}

# Configure WAL archiving parameters in PostgreSQL
setup_wal_archiving() {
  log "Setting up WAL archiving..."

  mkdir -p "$WAL_ARCHIVE_DIR"
  mkdir -p "$BASE_BACKUP_DIR"

  # Check if we have superuser or sufficient privileges
  local is_super
  is_super=$(psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d postgres -tAc \
    "SELECT rolsuper FROM pg_roles WHERE rolname = '${PGUSER}'" 2>/dev/null)

  if [ "$is_super" != "t" ]; then
    log_error "User ${PGUSER} is not a superuser. WAL archiving requires superuser privileges."
    log "You can run these commands manually as the postgres superuser:"
    echo ""
    echo "  ALTER SYSTEM SET wal_level = 'replica';"
    echo "  ALTER SYSTEM SET archive_mode = 'on';"
    echo "  ALTER SYSTEM SET archive_command = 'cp %p ${WAL_ARCHIVE_DIR}/%f';"
    echo "  ALTER SYSTEM SET archive_timeout = '300';"
    echo "  SELECT pg_reload_conf();"
    echo ""
    exit 1
  fi

  # Set WAL archiving parameters
  psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d postgres <<-EOSQL
    ALTER SYSTEM SET wal_level = 'replica';
    ALTER SYSTEM SET archive_mode = 'on';
    ALTER SYSTEM SET archive_command = 'cp %p ${WAL_ARCHIVE_DIR}/%f';
    ALTER SYSTEM SET archive_timeout = '300';
    SELECT pg_reload_conf();
EOSQL

  log "WAL archiving parameters set."
  log "NOTE: wal_level and archive_mode changes require a PostgreSQL restart."
  log "Archive directory: ${WAL_ARCHIVE_DIR}"

  # Check if wal_level is already 'replica' (no restart needed)
  local current_wal_level
  current_wal_level=$(psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d postgres -tAc \
    "SHOW wal_level" 2>/dev/null | tr -d ' ')

  if [ "$current_wal_level" = "replica" ] || [ "$current_wal_level" = "logical" ]; then
    log "wal_level is already '${current_wal_level}' (no restart needed for this setting)."
  else
    log "Current wal_level: '${current_wal_level}'. Restart PostgreSQL to apply 'replica'."
  fi

  local current_archive_mode
  current_archive_mode=$(psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d postgres -tAc \
    "SHOW archive_mode" 2>/dev/null | tr -d ' ')

  if [ "$current_archive_mode" = "on" ]; then
    log "archive_mode is already 'on'."
  else
    log "Current archive_mode: '${current_archive_mode}'. Restart PostgreSQL to enable."
  fi
}

# Verify WAL archiving is active
verify_wal_archiving() {
  log "Verifying WAL archiving configuration..."

  local wal_level
  wal_level=$(psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d postgres -tAc \
    "SHOW wal_level" 2>/dev/null | tr -d ' ')

  local archive_mode
  archive_mode=$(psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d postgres -tAc \
    "SHOW archive_mode" 2>/dev/null | tr -d ' ')

  local archive_command
  archive_command=$(psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d postgres -tAc \
    "SHOW archive_command" 2>/dev/null)

  local ok=true

  log "  wal_level:       ${wal_level}"
  if [ "$wal_level" != "replica" ] && [ "$wal_level" != "logical" ]; then
    log_error "  wal_level must be 'replica' or 'logical'"
    ok=false
  fi

  log "  archive_mode:    ${archive_mode}"
  if [ "$archive_mode" != "on" ]; then
    log_error "  archive_mode must be 'on'"
    ok=false
  fi

  log "  archive_command: ${archive_command}"
  if [ -z "$archive_command" ] || [ "$archive_command" = "(disabled)" ]; then
    log_error "  archive_command is not set"
    ok=false
  fi

  # Check archive directory exists and is writable
  if [ -d "$WAL_ARCHIVE_DIR" ]; then
    log "  archive_dir:     ${WAL_ARCHIVE_DIR} (exists)"
    local wal_count
    wal_count=$(find "$WAL_ARCHIVE_DIR" -name "0000*" -type f 2>/dev/null | wc -l | tr -d ' ')
    log "  archived WALs:   ${wal_count}"
  else
    log_error "  archive_dir ${WAL_ARCHIVE_DIR} does not exist"
    ok=false
  fi

  # Check pg_stat_archiver for recent activity
  local last_archived_wal
  last_archived_wal=$(psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d postgres -tAc \
    "SELECT last_archived_wal FROM pg_stat_archiver" 2>/dev/null | tr -d ' ')

  local last_failed_wal
  last_failed_wal=$(psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d postgres -tAc \
    "SELECT last_failed_wal FROM pg_stat_archiver" 2>/dev/null | tr -d ' ')

  local archived_count
  archived_count=$(psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d postgres -tAc \
    "SELECT archived_count FROM pg_stat_archiver" 2>/dev/null | tr -d ' ')

  local failed_count
  failed_count=$(psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d postgres -tAc \
    "SELECT failed_count FROM pg_stat_archiver" 2>/dev/null | tr -d ' ')

  log "  archived_count:  ${archived_count:-0}"
  log "  failed_count:    ${failed_count:-0}"
  log "  last_archived:   ${last_archived_wal:-none}"
  log "  last_failed:     ${last_failed_wal:-none}"

  if [ "$ok" = true ]; then
    log "WAL archiving is properly configured."
    return 0
  else
    log_error "WAL archiving has configuration issues."
    return 1
  fi
}

# Take a base backup (needed for PITR restoration)
take_base_backup() {
  log "Taking base backup for PITR..."

  local timestamp
  timestamp=$(date -u +%Y%m%d_%H%M%S)
  local backup_dir="${BASE_BACKUP_DIR}/base_${timestamp}"

  mkdir -p "$backup_dir"

  if command -v pg_basebackup &>/dev/null; then
    pg_basebackup -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" \
      -D "$backup_dir" \
      -Ft -z \
      -P \
      --checkpoint=fast \
      --wal-method=stream

    local exit_code=$?
    if [ $exit_code -eq 0 ]; then
      local size
      size=$(du -sh "$backup_dir" | cut -f1)
      log "Base backup completed: ${backup_dir} (${size})"

      # Write metadata
      cat > "${backup_dir}/backup.meta" <<EOF
timestamp=${timestamp}
type=base_backup
host=${PGHOST}
pg_version=$(pg_basebackup --version | head -1)
wal_archive_dir=${WAL_ARCHIVE_DIR}
EOF
      return 0
    else
      log_error "pg_basebackup failed (exit code: ${exit_code})"
      rm -rf "$backup_dir"
      return 1
    fi
  else
    log_error "pg_basebackup not found."
    return 1
  fi
}

# Show current status
show_status() {
  log "WAL Archiving Status"
  log "===================="
  verify_wal_archiving || true

  log ""
  log "Base Backups:"
  if [ -d "$BASE_BACKUP_DIR" ]; then
    ls -lhd "${BASE_BACKUP_DIR}"/base_* 2>/dev/null || log "  No base backups found."
  else
    log "  Base backup directory does not exist."
  fi

  log ""
  log "WAL Archive:"
  if [ -d "$WAL_ARCHIVE_DIR" ]; then
    local wal_count
    wal_count=$(find "$WAL_ARCHIVE_DIR" -type f 2>/dev/null | wc -l | tr -d ' ')
    local wal_size
    wal_size=$(du -sh "$WAL_ARCHIVE_DIR" 2>/dev/null | cut -f1)
    log "  Files: ${wal_count}"
    log "  Size:  ${wal_size}"
  else
    log "  WAL archive directory does not exist."
  fi
}

# --- Main --------------------------------------------------------------------
main() {
  if [ $# -lt 1 ]; then
    echo "Usage: $(basename "$0") {setup|verify|base|status}"
    exit 1
  fi

  check_prerequisites

  case "$1" in
    setup)
      setup_wal_archiving
      ;;
    verify)
      verify_wal_archiving
      ;;
    base)
      take_base_backup
      ;;
    status)
      show_status
      ;;
    *)
      echo "Unknown command: $1"
      echo "Usage: $(basename "$0") {setup|verify|base|status}"
      exit 1
      ;;
  esac
}

main "$@"
