#!/usr/bin/env bash
# =============================================================================
# Landomo-World Database Restore Script
# =============================================================================
# Restores a database backup to a target database for verification or recovery.
#
# Usage:
#   ./restore-database.sh <backup_file> <target_database>
#   ./restore-database.sh landomo_czech_20260208_020000.dump landomo_czech_restore
#   ./restore-database.sh --test landomo_czech_20260208_020000.dump
#
# Options:
#   --test              Restore to a temporary database, validate, and drop
#   --keep              Keep the restored database after test (with --test)
#   --skip-validation   Skip post-restore validation queries
#
# Environment variables:
#   PGHOST          PostgreSQL host (default: postgres)
#   PGPORT          PostgreSQL port (default: 5432)
#   PGUSER          PostgreSQL user (default: landomo)
#   PGPASSWORD      PostgreSQL password (required)
# =============================================================================
set -euo pipefail

PGHOST="${PGHOST:-postgres}"
PGPORT="${PGPORT:-5432}"
PGUSER="${PGUSER:-landomo}"

# Validation thresholds
MIN_TABLE_COUNT=5
MIN_ROW_COUNT=0

# Expected core tables (from init-schema.sql and migrations)
EXPECTED_TABLES=(
  properties
  ingestion_log
  property_changes
  price_history
  listing_status_history
  scrape_runs
  staleness_thresholds
)

# Expected indexes
EXPECTED_INDEXES=(
  idx_properties_portal_id
  idx_properties_source_url
  idx_properties_status
  idx_properties_last_seen_at
)

log() {
  echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] $*"
}

log_error() {
  log "ERROR: $*" >&2
}

log_ok() {
  log "OK: $*"
}

log_fail() {
  log "FAIL: $*" >&2
}

usage() {
  cat <<EOF
Usage: $(basename "$0") [OPTIONS] <backup_file> [target_database]

Arguments:
  backup_file       Path to backup file (.dump or .sql.gz)
  target_database   Target database name (required unless --test is used)

Options:
  --test              Restore to temp database, validate, then drop
  --keep              With --test, keep the temp database after validation
  --skip-validation   Skip post-restore validation
  -h, --help          Show this help

Environment:
  PGHOST, PGPORT, PGUSER, PGPASSWORD  PostgreSQL connection
EOF
  exit 0
}

check_prerequisites() {
  for cmd in psql pg_restore gunzip; do
    if ! command -v "$cmd" &>/dev/null; then
      log_error "${cmd} not found."
      exit 1
    fi
  done
  if [ -z "${PGPASSWORD:-}" ]; then
    log_error "PGPASSWORD is not set."
    exit 1
  fi
}

# Create a database
create_database() {
  local db_name="$1"
  log "Creating database: ${db_name}"
  psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d postgres -c \
    "CREATE DATABASE ${db_name}" 2>/dev/null
}

# Drop a database
drop_database() {
  local db_name="$1"
  log "Dropping database: ${db_name}"
  # Terminate active connections first
  psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d postgres -c \
    "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='${db_name}' AND pid <> pg_backend_pid()" >/dev/null 2>&1 || true
  psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d postgres -c \
    "DROP DATABASE IF EXISTS ${db_name}" 2>/dev/null
}

# Check if database exists
database_exists() {
  local db_name="$1"
  psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d postgres -tAc \
    "SELECT 1 FROM pg_database WHERE datname='${db_name}'" 2>/dev/null | grep -q 1
}

# Restore from a backup file
restore_backup() {
  local backup_file="$1"
  local target_db="$2"
  local start_time
  start_time=$(date +%s)

  log "Restoring ${backup_file} -> ${target_db}"

  if [[ "$backup_file" == *.dump ]]; then
    # Custom format - use pg_restore
    pg_restore -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" \
      -d "$target_db" \
      --no-owner --no-acl \
      --exit-on-error \
      "$backup_file" 2>&1
  elif [[ "$backup_file" == *.sql.gz ]]; then
    # Gzipped SQL - decompress and pipe to psql
    gunzip -c "$backup_file" | psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" \
      -d "$target_db" \
      --set ON_ERROR_STOP=on 2>&1
  elif [[ "$backup_file" == *.sql ]]; then
    # Plain SQL
    psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" \
      -d "$target_db" \
      --set ON_ERROR_STOP=on \
      -f "$backup_file" 2>&1
  else
    log_error "Unsupported backup format: ${backup_file}"
    return 1
  fi

  local exit_code=$?
  local end_time
  end_time=$(date +%s)
  local duration=$(( end_time - start_time ))

  if [ $exit_code -ne 0 ]; then
    log_error "Restore failed (exit code: ${exit_code})"
    return 1
  fi

  log "Restore completed in ${duration}s"
  return 0
}

# Validate restored database
validate_restore() {
  local target_db="$1"
  local validation_errors=0

  log "Running post-restore validation on ${target_db}..."

  # 1. Check table count
  local table_count
  table_count=$(psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$target_db" -tAc \
    "SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'" 2>/dev/null)

  if [ "${table_count:-0}" -ge "$MIN_TABLE_COUNT" ]; then
    log_ok "Table count: ${table_count} (minimum: ${MIN_TABLE_COUNT})"
  else
    log_fail "Table count: ${table_count:-0} (expected >= ${MIN_TABLE_COUNT})"
    validation_errors=$(( validation_errors + 1 ))
  fi

  # 2. Check expected tables exist
  for table in "${EXPECTED_TABLES[@]}"; do
    local exists
    exists=$(psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$target_db" -tAc \
      "SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='${table}'" 2>/dev/null)
    if [ "$exists" = "1" ]; then
      log_ok "Table exists: ${table}"
    else
      log_fail "Table missing: ${table}"
      validation_errors=$(( validation_errors + 1 ))
    fi
  done

  # 3. Check row counts for key tables
  local properties_count
  properties_count=$(psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$target_db" -tAc \
    "SELECT count(*) FROM properties" 2>/dev/null || echo "0")
  log "  properties rows: ${properties_count}"

  local ingestion_log_count
  ingestion_log_count=$(psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$target_db" -tAc \
    "SELECT count(*) FROM ingestion_log" 2>/dev/null || echo "0")
  log "  ingestion_log rows: ${ingestion_log_count}"

  # 4. Check indexes exist
  for idx in "${EXPECTED_INDEXES[@]}"; do
    local idx_exists
    idx_exists=$(psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$target_db" -tAc \
      "SELECT 1 FROM pg_indexes WHERE indexname='${idx}'" 2>/dev/null)
    if [ "$idx_exists" = "1" ]; then
      log_ok "Index exists: ${idx}"
    else
      log_fail "Index missing: ${idx}"
      validation_errors=$(( validation_errors + 1 ))
    fi
  done

  # 5. Check schema version (if migrations table exists)
  local has_migrations
  has_migrations=$(psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$target_db" -tAc \
    "SELECT 1 FROM information_schema.tables WHERE table_name='schema_migrations'" 2>/dev/null)
  if [ "$has_migrations" = "1" ]; then
    local latest_migration
    latest_migration=$(psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$target_db" -tAc \
      "SELECT max(version) FROM schema_migrations" 2>/dev/null)
    log "  Schema migration version: ${latest_migration:-unknown}"
  fi

  # 6. Sample data integrity - check properties has required columns
  local has_portal_id
  has_portal_id=$(psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$target_db" -tAc \
    "SELECT 1 FROM information_schema.columns WHERE table_name='properties' AND column_name='portal_id'" 2>/dev/null)
  if [ "$has_portal_id" = "1" ]; then
    log_ok "Column exists: properties.portal_id"
  else
    log_fail "Column missing: properties.portal_id"
    validation_errors=$(( validation_errors + 1 ))
  fi

  local has_status
  has_status=$(psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$target_db" -tAc \
    "SELECT 1 FROM information_schema.columns WHERE table_name='properties' AND column_name='status'" 2>/dev/null)
  if [ "$has_status" = "1" ]; then
    log_ok "Column exists: properties.status"
  else
    log_fail "Column missing: properties.status"
    validation_errors=$(( validation_errors + 1 ))
  fi

  # 7. Check for data distribution sanity (no single portal >99%)
  if [ "${properties_count:-0}" -gt 0 ]; then
    local max_portal_pct
    max_portal_pct=$(psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$target_db" -tAc \
      "SELECT ROUND(100.0 * MAX(cnt) / SUM(cnt), 1) FROM (SELECT source_portal, COUNT(*) as cnt FROM properties GROUP BY source_portal) sub" 2>/dev/null || echo "0")
    log "  Max single portal share: ${max_portal_pct}%"
  fi

  # Summary
  log ""
  if [ $validation_errors -eq 0 ]; then
    log "Validation PASSED (0 errors)"
    return 0
  else
    log "Validation FAILED (${validation_errors} error(s))"
    return 1
  fi
}

# --- Main --------------------------------------------------------------------
main() {
  local test_mode=false
  local keep_temp=false
  local skip_validation=false
  local backup_file=""
  local target_db=""

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --test)
        test_mode=true
        shift
        ;;
      --keep)
        keep_temp=true
        shift
        ;;
      --skip-validation)
        skip_validation=true
        shift
        ;;
      -h|--help)
        usage
        ;;
      -*)
        log_error "Unknown option: $1"
        usage
        ;;
      *)
        if [ -z "$backup_file" ]; then
          backup_file="$1"
        elif [ -z "$target_db" ]; then
          target_db="$1"
        else
          log_error "Too many arguments"
          usage
        fi
        shift
        ;;
    esac
  done

  if [ -z "$backup_file" ]; then
    log_error "Backup file is required."
    usage
  fi

  if [ ! -f "$backup_file" ]; then
    log_error "Backup file not found: ${backup_file}"
    exit 1
  fi

  check_prerequisites

  # In test mode, create a temp database name
  if [ "$test_mode" = true ]; then
    local timestamp
    timestamp=$(date -u +%Y%m%d%H%M%S)
    target_db="landomo_restore_test_${timestamp}"
    log "Test mode: using temporary database ${target_db}"
  fi

  if [ -z "$target_db" ]; then
    log_error "Target database name is required (or use --test for automatic)."
    usage
  fi

  # Check if target already exists
  if database_exists "$target_db"; then
    if [ "$test_mode" = true ]; then
      log "Dropping pre-existing temp database: ${target_db}"
      drop_database "$target_db"
    else
      log_error "Target database '${target_db}' already exists. Drop it first or use a different name."
      exit 1
    fi
  fi

  # Create target database
  create_database "$target_db"

  # Enable PostGIS if available (needed for geometry columns)
  psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$target_db" -c \
    "CREATE EXTENSION IF NOT EXISTS postgis" 2>/dev/null || true

  # Restore
  local restore_start
  restore_start=$(date +%s)

  if ! restore_backup "$backup_file" "$target_db"; then
    log_error "Restore failed."
    if [ "$test_mode" = true ] && [ "$keep_temp" = false ]; then
      drop_database "$target_db"
    fi
    exit 1
  fi

  local restore_end
  restore_end=$(date +%s)
  local restore_duration=$(( restore_end - restore_start ))

  # Validate
  local validation_result=0
  if [ "$skip_validation" = false ]; then
    if ! validate_restore "$target_db"; then
      validation_result=1
    fi
  fi

  # Cleanup in test mode
  if [ "$test_mode" = true ] && [ "$keep_temp" = false ]; then
    log "Cleaning up temporary database: ${target_db}"
    drop_database "$target_db"
  elif [ "$test_mode" = true ] && [ "$keep_temp" = true ]; then
    log "Keeping temporary database: ${target_db} (use --test without --keep to auto-drop)"
  fi

  # Final report
  log ""
  log "============================================"
  log "Restore Report"
  log "============================================"
  log "Backup file:     ${backup_file}"
  log "Target database: ${target_db}"
  log "Restore time:    ${restore_duration}s"
  log "Validation:      $([ $validation_result -eq 0 ] && echo 'PASSED' || echo 'FAILED')"
  log "Test mode:       ${test_mode}"
  log "============================================"

  exit $validation_result
}

main "$@"
