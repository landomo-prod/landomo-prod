#!/usr/bin/env bash
# =============================================================================
# Landomo-World Database Backup Script
# =============================================================================
# Full backup of country databases using pg_dump with gzip compression.
#
# Usage:
#   ./backup-databases.sh --all                  # Backup all country databases
#   ./backup-databases.sh --country czech        # Backup single country
#   ./backup-databases.sh --country czech,slovakia  # Backup multiple countries
#
# Environment variables:
#   PGHOST          PostgreSQL host (default: postgres)
#   PGPORT          PostgreSQL port (default: 5432)
#   PGUSER          PostgreSQL user (default: landomo)
#   PGPASSWORD      PostgreSQL password (required)
#   BACKUP_DIR      Output directory (default: /backups)
#   BACKUP_FORMAT   "custom" for pg_dump -Fc or "plain" for SQL (default: custom)
#   PARALLEL_JOBS   Number of parallel pg_dump jobs (default: 4)
# =============================================================================
set -euo pipefail

# --- Configuration -----------------------------------------------------------
PGHOST="${PGHOST:-postgres}"
PGPORT="${PGPORT:-5432}"
PGUSER="${PGUSER:-landomo}"
BACKUP_DIR="${BACKUP_DIR:-/backups}"
BACKUP_FORMAT="${BACKUP_FORMAT:-custom}"
PARALLEL_JOBS="${PARALLEL_JOBS:-4}"
TIMESTAMP="$(date -u +%Y%m%d_%H%M%S)"
LOG_FILE="${BACKUP_DIR}/backup_${TIMESTAMP}.log"

# All known country databases (matches docker/postgres/init-databases.sh)
ALL_COUNTRIES=(
  australia
  uk
  usa
  czech
  france
  spain
  italy
  slovakia
  germany
  hungary
  austria
)

# --- Functions ---------------------------------------------------------------

log() {
  local msg="[$(date -u +%Y-%m-%dT%H:%M:%SZ)] $*"
  echo "$msg"
  echo "$msg" >> "$LOG_FILE" 2>/dev/null || true
}

log_error() {
  log "ERROR: $*" >&2
}

usage() {
  cat <<EOF
Usage: $(basename "$0") [OPTIONS]

Options:
  --all                    Backup all country databases
  --country NAME[,NAME]    Backup specific country/countries (comma-separated)
  --list                   List available country databases
  --verify-only FILE       Verify an existing backup file
  -h, --help               Show this help message

Environment:
  PGHOST, PGPORT, PGUSER, PGPASSWORD  PostgreSQL connection
  BACKUP_DIR        Output directory (default: /backups)
  BACKUP_FORMAT     "custom" (default, smaller) or "plain" (SQL text)
  PARALLEL_JOBS     pg_dump parallel jobs (default: 4)
EOF
  exit 0
}

# Ensure pg_dump is available
check_prerequisites() {
  if ! command -v pg_dump &>/dev/null; then
    log_error "pg_dump not found. Install PostgreSQL client tools."
    exit 1
  fi
  if ! command -v pg_restore &>/dev/null; then
    log_error "pg_restore not found. Install PostgreSQL client tools."
    exit 1
  fi
  if [ -z "${PGPASSWORD:-}" ]; then
    log_error "PGPASSWORD is not set."
    exit 1
  fi
}

# Test connection to postgres
test_connection() {
  if ! pg_isready -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -q 2>/dev/null; then
    log_error "Cannot connect to PostgreSQL at ${PGHOST}:${PGPORT}"
    exit 1
  fi
}

# Backup a single database
# Args: $1 = database name
backup_database() {
  local db_name="$1"
  local start_time
  start_time=$(date +%s)

  local extension="dump"
  local format_flag="-Fc"
  if [ "$BACKUP_FORMAT" = "plain" ]; then
    extension="sql.gz"
    format_flag="-Fp"
  fi

  local backup_file="${BACKUP_DIR}/${db_name}_${TIMESTAMP}.${extension}"

  log "Starting backup: ${db_name} -> $(basename "$backup_file")"

  # Verify the database exists
  if ! psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d postgres -tAc \
    "SELECT 1 FROM pg_database WHERE datname='${db_name}'" 2>/dev/null | grep -q 1; then
    log_error "Database ${db_name} does not exist, skipping."
    return 1
  fi

  # Run pg_dump
  if [ "$BACKUP_FORMAT" = "plain" ]; then
    pg_dump -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" \
      -d "$db_name" \
      --no-owner --no-acl \
      -j "$PARALLEL_JOBS" \
      "$format_flag" 2>>"$LOG_FILE" | gzip > "$backup_file"
  else
    pg_dump -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" \
      -d "$db_name" \
      --no-owner --no-acl \
      "$format_flag" \
      -f "$backup_file" 2>>"$LOG_FILE"
  fi

  local exit_code=$?
  local end_time
  end_time=$(date +%s)
  local duration=$(( end_time - start_time ))

  if [ $exit_code -ne 0 ]; then
    log_error "pg_dump failed for ${db_name} (exit code: ${exit_code})"
    rm -f "$backup_file"
    return 1
  fi

  # Get file size
  local file_size
  if [ -f "$backup_file" ]; then
    file_size=$(du -h "$backup_file" | cut -f1)
    local file_bytes
    file_bytes=$(wc -c < "$backup_file" | tr -d ' ')
  else
    log_error "Backup file not created for ${db_name}"
    return 1
  fi

  # Verify backup integrity
  if ! verify_backup "$backup_file"; then
    log_error "Backup verification failed for ${db_name}"
    return 1
  fi

  log "Completed: ${db_name} | Size: ${file_size} | Duration: ${duration}s"

  # Write metadata sidecar
  cat > "${backup_file}.meta" <<EOF
database=${db_name}
timestamp=${TIMESTAMP}
format=${BACKUP_FORMAT}
size_bytes=${file_bytes}
duration_seconds=${duration}
pg_version=$(pg_dump --version | head -1)
host=${PGHOST}
EOF

  return 0
}

# Verify a backup file
# Args: $1 = backup file path
verify_backup() {
  local backup_file="$1"

  if [ ! -f "$backup_file" ]; then
    log_error "File not found: ${backup_file}"
    return 1
  fi

  local file_bytes
  file_bytes=$(wc -c < "$backup_file" | tr -d ' ')
  if [ "$file_bytes" -lt 100 ]; then
    log_error "Backup file suspiciously small (${file_bytes} bytes): ${backup_file}"
    return 1
  fi

  # For custom format, use pg_restore --list to verify structure
  if [[ "$backup_file" == *.dump ]]; then
    if ! pg_restore --list "$backup_file" > /dev/null 2>&1; then
      log_error "pg_restore --list failed for ${backup_file}"
      return 1
    fi
    log "Verified (pg_restore --list): $(basename "$backup_file")"
  elif [[ "$backup_file" == *.sql.gz ]]; then
    # For gzip, verify the archive is not corrupt
    if ! gzip -t "$backup_file" 2>/dev/null; then
      log_error "gzip integrity check failed for ${backup_file}"
      return 1
    fi
    log "Verified (gzip -t): $(basename "$backup_file")"
  fi

  return 0
}

# Resolve country names to database names
resolve_databases() {
  local input="$1"
  local databases=()

  IFS=',' read -ra countries <<< "$input"
  for country in "${countries[@]}"; do
    country="$(echo "$country" | tr -d ' ' | tr '[:upper:]' '[:lower:]')"
    databases+=("landomo_${country}")
  done

  echo "${databases[@]}"
}

# --- Main --------------------------------------------------------------------

main() {
  local mode=""
  local country_input=""
  local verify_file=""

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --all)
        mode="all"
        shift
        ;;
      --country)
        mode="country"
        country_input="$2"
        shift 2
        ;;
      --list)
        echo "Available country databases:"
        for c in "${ALL_COUNTRIES[@]}"; do
          echo "  landomo_${c}"
        done
        exit 0
        ;;
      --verify-only)
        verify_file="$2"
        shift 2
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

  # Verify-only mode
  if [ -n "$verify_file" ]; then
    check_prerequisites
    if verify_backup "$verify_file"; then
      log "Backup file is valid: ${verify_file}"
      exit 0
    else
      exit 1
    fi
  fi

  if [ -z "$mode" ]; then
    log_error "Specify --all or --country NAME"
    usage
  fi

  check_prerequisites
  mkdir -p "$BACKUP_DIR"

  # Initialize log
  echo "=== Landomo Backup Log - ${TIMESTAMP} ===" > "$LOG_FILE"

  test_connection
  log "Connected to PostgreSQL at ${PGHOST}:${PGPORT}"

  # Build list of databases to back up
  local databases=()
  if [ "$mode" = "all" ]; then
    for c in "${ALL_COUNTRIES[@]}"; do
      databases+=("landomo_${c}")
    done
  else
    IFS=' ' read -ra databases <<< "$(resolve_databases "$country_input")"
  fi

  log "Backing up ${#databases[@]} database(s): ${databases[*]}"

  local total_start
  total_start=$(date +%s)
  local success=0
  local failed=0
  local failed_dbs=()

  for db in "${databases[@]}"; do
    if backup_database "$db"; then
      success=$(( success + 1 ))
    else
      failed=$(( failed + 1 ))
      failed_dbs+=("$db")
    fi
  done

  local total_end
  total_end=$(date +%s)
  local total_duration=$(( total_end - total_start ))

  # Summary
  log "============================================"
  log "Backup Summary"
  log "============================================"
  log "Total databases: ${#databases[@]}"
  log "Successful: ${success}"
  log "Failed: ${failed}"
  log "Total duration: ${total_duration}s"

  if [ ${#failed_dbs[@]} -gt 0 ]; then
    log "Failed databases: ${failed_dbs[*]}"
  fi

  # List backup sizes
  log ""
  log "Backup files:"
  ls -lh "${BACKUP_DIR}"/*_${TIMESTAMP}.* 2>/dev/null | while read -r line; do
    log "  $line"
  done

  # Write summary file for monitoring
  cat > "${BACKUP_DIR}/latest_backup_summary.json" <<EOF
{
  "timestamp": "${TIMESTAMP}",
  "total_databases": ${#databases[@]},
  "successful": ${success},
  "failed": ${failed},
  "duration_seconds": ${total_duration},
  "failed_databases": [$(printf '"%s",' "${failed_dbs[@]}" 2>/dev/null | sed 's/,$//')]
}
EOF

  if [ "$failed" -gt 0 ]; then
    exit 1
  fi

  exit 0
}

main "$@"
