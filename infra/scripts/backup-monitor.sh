#!/usr/bin/env bash
# =============================================================================
# Landomo-World Backup Monitoring & Alerting
# =============================================================================
# Checks backup health and sends alerts when issues are detected.
#
# Usage:
#   ./backup-monitor.sh                    # Full health check
#   ./backup-monitor.sh --prometheus       # Output Prometheus metrics
#
# Environment variables:
#   BACKUP_DIR              Backup directory (default: /backups)
#   MAX_BACKUP_AGE_HOURS    Alert if latest backup older than this (default: 26)
#   MIN_BACKUP_SIZE_KB      Alert if backup smaller than this (default: 100)
#   SLACK_WEBHOOK_URL       Slack webhook for alerts
#   PROMETHEUS_PUSHGATEWAY  Pushgateway URL for metrics
# =============================================================================
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/backups}"
MAX_BACKUP_AGE_HOURS="${MAX_BACKUP_AGE_HOURS:-26}"
MIN_BACKUP_SIZE_KB="${MIN_BACKUP_SIZE_KB:-100}"
SLACK_WEBHOOK_URL="${SLACK_WEBHOOK_URL:-}"
PROMETHEUS_PUSHGATEWAY="${PROMETHEUS_PUSHGATEWAY:-}"
PROMETHEUS_MODE=false
EXIT_CODE=0

log() {
  echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] $*"
}

log_error() {
  log "ERROR: $*" >&2
}

log_warn() {
  log "WARN: $*"
}

send_slack() {
  local message="$1"
  local color="${2:-warning}"
  if [ -n "$SLACK_WEBHOOK_URL" ]; then
    curl -s -X POST "$SLACK_WEBHOOK_URL" \
      -H 'Content-Type: application/json' \
      -d "{\"attachments\":[{\"color\":\"${color}\",\"text\":\"${message}\"}]}" \
      > /dev/null 2>&1 || true
  fi
}

# Check age of latest backup
check_backup_freshness() {
  log "=== Backup Freshness Check ==="
  local alerts=""

  for db_prefix in "${BACKUP_DIR}"/landomo_*.dump; do
    [ -f "$db_prefix" ] || continue

    # Find the newest backup for each database
    local db_name
    db_name=$(basename "$db_prefix" | sed 's/_[0-9]\{8\}_[0-9]\{6\}\.dump$//')

    local latest
    latest=$(ls -t "${BACKUP_DIR}/${db_name}_"*.dump 2>/dev/null | head -1)
    [ -z "$latest" ] && continue

    local file_age_seconds
    if [[ "$OSTYPE" == "darwin"* ]]; then
      file_age_seconds=$(( $(date +%s) - $(stat -f %m "$latest") ))
    else
      file_age_seconds=$(( $(date +%s) - $(stat -c %Y "$latest") ))
    fi
    local file_age_hours=$(( file_age_seconds / 3600 ))

    if [ "$file_age_hours" -gt "$MAX_BACKUP_AGE_HOURS" ]; then
      log_warn "${db_name}: latest backup is ${file_age_hours}h old (threshold: ${MAX_BACKUP_AGE_HOURS}h)"
      alerts="${alerts}${db_name} backup is ${file_age_hours}h old. "
      EXIT_CODE=1
    else
      log "  ${db_name}: ${file_age_hours}h old - OK"
    fi
  done

  # Check if any backups exist at all
  local backup_count
  backup_count=$(ls "${BACKUP_DIR}"/landomo_*.dump 2>/dev/null | wc -l | tr -d ' ')
  if [ "$backup_count" -eq 0 ]; then
    log_error "No backup files found in ${BACKUP_DIR}"
    alerts="${alerts}No backup files found! "
    EXIT_CODE=1
  fi

  if [ -n "$alerts" ]; then
    send_slack "Backup freshness alert: ${alerts}" "danger"
  fi
}

# Check backup file sizes for anomalies
check_backup_sizes() {
  log "=== Backup Size Check ==="
  local alerts=""
  local min_bytes=$(( MIN_BACKUP_SIZE_KB * 1024 ))

  for f in "${BACKUP_DIR}"/landomo_*.dump; do
    [ -f "$f" ] || continue
    local size_bytes
    size_bytes=$(wc -c < "$f" | tr -d ' ')
    local size_kb=$(( size_bytes / 1024 ))
    local basename_f
    basename_f=$(basename "$f")

    if [ "$size_bytes" -lt "$min_bytes" ]; then
      log_warn "${basename_f}: ${size_kb}KB (minimum: ${MIN_BACKUP_SIZE_KB}KB)"
      alerts="${alerts}${basename_f} is only ${size_kb}KB. "
      EXIT_CODE=1
    fi
  done

  # Check for size regression (current vs previous backup)
  local seen_dbs=()
  for f in $(ls -t "${BACKUP_DIR}"/landomo_*.dump 2>/dev/null); do
    local db_name
    db_name=$(basename "$f" | sed 's/_[0-9]\{8\}_[0-9]\{6\}\.dump$//')
    if [[ " ${seen_dbs[*]:-} " =~ " ${db_name} " ]]; then
      continue
    fi
    seen_dbs+=("$db_name")

    # Get two most recent backups for this db
    local backups
    backups=$(ls -t "${BACKUP_DIR}/${db_name}_"*.dump 2>/dev/null | head -2)
    local count
    count=$(echo "$backups" | wc -l | tr -d ' ')
    if [ "$count" -ge 2 ]; then
      local current_file
      current_file=$(echo "$backups" | head -1)
      local previous_file
      previous_file=$(echo "$backups" | tail -1)
      local current_size
      current_size=$(wc -c < "$current_file" | tr -d ' ')
      local previous_size
      previous_size=$(wc -c < "$previous_file" | tr -d ' ')

      if [ "$previous_size" -gt 0 ]; then
        local ratio=$(( current_size * 100 / previous_size ))
        if [ "$ratio" -lt 50 ]; then
          log_warn "${db_name}: backup shrank to ${ratio}% of previous size"
          alerts="${alerts}${db_name} backup shrank to ${ratio}% of previous. "
          EXIT_CODE=1
        fi
      fi
    fi
  done

  if [ -n "$alerts" ]; then
    send_slack "Backup size alert: ${alerts}" "warning"
  fi
}

# Check latest_backup_summary.json for failures
check_last_run() {
  log "=== Last Backup Run Check ==="
  local summary="${BACKUP_DIR}/latest_backup_summary.json"

  if [ ! -f "$summary" ]; then
    log_warn "No backup summary file found"
    return
  fi

  local failed
  failed=$(grep -o '"failed":[0-9]*' "$summary" | cut -d: -f2)
  if [ "${failed:-0}" -gt 0 ]; then
    local failed_dbs
    failed_dbs=$(grep -o '"failed_databases":\[.*\]' "$summary" || echo "unknown")
    log_error "Last backup run had ${failed} failure(s): ${failed_dbs}"
    send_slack "Last backup run had ${failed} failure(s): ${failed_dbs}" "danger"
    EXIT_CODE=1
  else
    log "  Last backup run: all successful"
  fi
}

# Check restore test results
check_restore_tests() {
  log "=== Restore Test Results ==="
  local latest_test
  latest_test=$(ls -t "${BACKUP_DIR}"/restore_test_*.json 2>/dev/null | head -1)

  if [ -z "$latest_test" ]; then
    log_warn "No restore test results found. Run test-restore-weekly.sh"
    return
  fi

  local test_age_seconds
  if [[ "$OSTYPE" == "darwin"* ]]; then
    test_age_seconds=$(( $(date +%s) - $(stat -f %m "$latest_test") ))
  else
    test_age_seconds=$(( $(date +%s) - $(stat -c %Y "$latest_test") ))
  fi
  local test_age_days=$(( test_age_seconds / 86400 ))

  if [ "$test_age_days" -gt 7 ]; then
    log_warn "Restore test is ${test_age_days} days old (should be weekly)"
  fi

  local failed
  failed=$(grep -o '"failed":[0-9]*' "$latest_test" | cut -d: -f2)
  if [ "${failed:-0}" -gt 0 ]; then
    log_error "Last restore test had ${failed} failure(s)"
    EXIT_CODE=1
  else
    log "  Last restore test: all passed (${test_age_days} days ago)"
  fi
}

# Output Prometheus metrics
output_prometheus_metrics() {
  local metrics=""

  # Backup count
  local backup_count
  backup_count=$(ls "${BACKUP_DIR}"/landomo_*.dump 2>/dev/null | wc -l | tr -d ' ')
  metrics="${metrics}landomo_backup_files_total ${backup_count}\n"

  # Latest backup age per database
  local seen_dbs=()
  for f in $(ls -t "${BACKUP_DIR}"/landomo_*.dump 2>/dev/null); do
    local db_name
    db_name=$(basename "$f" | sed 's/_[0-9]\{8\}_[0-9]\{6\}\.dump$//')
    if [[ " ${seen_dbs[*]:-} " =~ " ${db_name} " ]]; then continue; fi
    seen_dbs+=("$db_name")

    local file_age_seconds
    if [[ "$OSTYPE" == "darwin"* ]]; then
      file_age_seconds=$(( $(date +%s) - $(stat -f %m "$f") ))
    else
      file_age_seconds=$(( $(date +%s) - $(stat -c %Y "$f") ))
    fi
    local size_bytes
    size_bytes=$(wc -c < "$f" | tr -d ' ')

    metrics="${metrics}landomo_backup_age_seconds{database=\"${db_name}\"} ${file_age_seconds}\n"
    metrics="${metrics}landomo_backup_size_bytes{database=\"${db_name}\"} ${size_bytes}\n"
  done

  # Last run status
  local summary="${BACKUP_DIR}/latest_backup_summary.json"
  if [ -f "$summary" ]; then
    local failed
    failed=$(grep -o '"failed":[0-9]*' "$summary" | cut -d: -f2)
    metrics="${metrics}landomo_backup_last_run_failures ${failed:-0}\n"
  fi

  if [ -n "$PROMETHEUS_PUSHGATEWAY" ]; then
    echo -e "$metrics" | curl -s --data-binary @- \
      "${PROMETHEUS_PUSHGATEWAY}/metrics/job/landomo_backup" || true
    log "Pushed metrics to ${PROMETHEUS_PUSHGATEWAY}"
  else
    echo -e "$metrics"
  fi
}

# --- Main --------------------------------------------------------------------
main() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --prometheus)
        PROMETHEUS_MODE=true
        shift
        ;;
      -h|--help)
        echo "Usage: $(basename "$0") [--prometheus]"
        exit 0
        ;;
      *)
        log_error "Unknown option: $1"
        exit 1
        ;;
    esac
  done

  if [ "$PROMETHEUS_MODE" = true ]; then
    output_prometheus_metrics
    exit 0
  fi

  log "========================================"
  log "Backup Health Monitor"
  log "========================================"
  log "Backup dir: ${BACKUP_DIR}"
  log "Max age:    ${MAX_BACKUP_AGE_HOURS}h"
  log ""

  check_backup_freshness
  log ""
  check_backup_sizes
  log ""
  check_last_run
  log ""
  check_restore_tests

  log ""
  if [ "$EXIT_CODE" -eq 0 ]; then
    log "=== All backup checks PASSED ==="
  else
    log "=== Backup checks FAILED (see warnings above) ==="
  fi

  exit $EXIT_CODE
}

main "$@"
