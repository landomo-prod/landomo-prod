#!/usr/bin/env bash
# =============================================================================
# Landomo-World Weekly Backup Restore Test
# =============================================================================
# Restores the most recent backup to a temporary database, validates it,
# and reports results. Designed to run weekly via cron.
#
# Usage:
#   ./test-restore-weekly.sh              # Test latest backup
#   ./test-restore-weekly.sh --country czech  # Test specific country
#
# Environment variables:
#   PGHOST, PGPORT, PGUSER, PGPASSWORD
#   BACKUP_DIR          Backup directory (default: /backups)
#   SLACK_WEBHOOK_URL   Optional Slack notification
# =============================================================================
set -euo pipefail

PGHOST="${PGHOST:-postgres}"
PGPORT="${PGPORT:-5432}"
PGUSER="${PGUSER:-landomo}"
BACKUP_DIR="${BACKUP_DIR:-/backups}"
SLACK_WEBHOOK_URL="${SLACK_WEBHOOK_URL:-}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TIMESTAMP="$(date -u +%Y%m%d_%H%M%S)"
REPORT_FILE="${BACKUP_DIR}/restore_test_${TIMESTAMP}.json"

log() {
  echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] $*"
}

log_error() {
  log "ERROR: $*" >&2
}

send_slack() {
  local message="$1"
  local color="${2:-good}"
  if [ -n "$SLACK_WEBHOOK_URL" ]; then
    curl -s -X POST "$SLACK_WEBHOOK_URL" \
      -H 'Content-Type: application/json' \
      -d "{\"attachments\":[{\"color\":\"${color}\",\"text\":\"${message}\"}]}" \
      > /dev/null 2>&1 || true
  fi
}

# Find the most recent backup for a given country
find_latest_backup() {
  local country="$1"
  ls -t "${BACKUP_DIR}"/landomo_${country}_*.dump 2>/dev/null | head -1
}

# Test restore of a single backup file
test_restore() {
  local backup_file="$1"
  local db_basename
  db_basename=$(basename "$backup_file" | sed 's/_[0-9]\{8\}_[0-9]\{6\}\.dump$//')
  local test_db="${db_basename}_restore_test"
  local start_time
  start_time=$(date +%s)

  log "Testing restore: $(basename "$backup_file") -> ${test_db}"

  # Use the restore script with --test flag
  if "${SCRIPT_DIR}/restore-database.sh" --test "$backup_file" 2>&1; then
    local end_time
    end_time=$(date +%s)
    local duration=$(( end_time - start_time ))
    log "Restore test PASSED for $(basename "$backup_file") (${duration}s)"
    echo "{\"file\":\"$(basename "$backup_file")\",\"status\":\"passed\",\"duration_seconds\":${duration}}"
    return 0
  else
    local end_time
    end_time=$(date +%s)
    local duration=$(( end_time - start_time ))
    log_error "Restore test FAILED for $(basename "$backup_file") (${duration}s)"
    echo "{\"file\":\"$(basename "$backup_file")\",\"status\":\"failed\",\"duration_seconds\":${duration}}"
    return 1
  fi
}

# --- Main --------------------------------------------------------------------
main() {
  local country_filter=""

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --country)
        country_filter="$2"
        shift 2
        ;;
      -h|--help)
        echo "Usage: $(basename "$0") [--country NAME]"
        exit 0
        ;;
      *)
        log_error "Unknown option: $1"
        exit 1
        ;;
    esac
  done

  if [ -z "${PGPASSWORD:-}" ]; then
    log_error "PGPASSWORD is not set."
    exit 1
  fi

  log "=== Weekly Backup Restore Test ==="
  log "Backup dir: ${BACKUP_DIR}"

  local countries=()
  if [ -n "$country_filter" ]; then
    IFS=',' read -ra countries <<< "$country_filter"
  else
    # Discover countries from backup files
    for f in "${BACKUP_DIR}"/landomo_*.dump; do
      [ -f "$f" ] || continue
      local country
      country=$(basename "$f" | sed 's/^landomo_//' | sed 's/_[0-9]\{8\}_[0-9]\{6\}\.dump$//')
      if [[ ! " ${countries[*]} " =~ " ${country} " ]]; then
        countries+=("$country")
      fi
    done
  fi

  if [ ${#countries[@]} -eq 0 ]; then
    log_error "No backup files found in ${BACKUP_DIR}"
    send_slack "Backup restore test: No backup files found" "danger"
    exit 1
  fi

  log "Testing countries: ${countries[*]}"

  local total=0
  local passed=0
  local failed=0
  local results=()

  for country in "${countries[@]}"; do
    local backup_file
    backup_file=$(find_latest_backup "$country")
    if [ -z "$backup_file" ]; then
      log "No backup found for ${country}, skipping."
      continue
    fi

    total=$(( total + 1 ))
    local result
    if result=$(test_restore "$backup_file"); then
      passed=$(( passed + 1 ))
    else
      failed=$(( failed + 1 ))
    fi
    results+=("$result")
  done

  # Write report
  cat > "$REPORT_FILE" <<EOF
{
  "timestamp": "${TIMESTAMP}",
  "total_tested": ${total},
  "passed": ${passed},
  "failed": ${failed},
  "results": [$(IFS=,; echo "${results[*]}")]
}
EOF

  log ""
  log "============================================"
  log "Restore Test Summary"
  log "============================================"
  log "Total tested: ${total}"
  log "Passed:       ${passed}"
  log "Failed:       ${failed}"
  log "Report:       ${REPORT_FILE}"

  # Send notification
  if [ "$failed" -gt 0 ]; then
    send_slack "Backup restore test FAILED: ${failed}/${total} databases failed restore verification" "danger"
    exit 1
  else
    send_slack "Backup restore test passed: ${passed}/${total} databases verified successfully" "good"
    exit 0
  fi
}

main "$@"
