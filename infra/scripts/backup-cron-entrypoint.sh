#!/usr/bin/env bash
# =============================================================================
# Landomo-World Backup Cron Entrypoint
# =============================================================================
# Docker entrypoint that runs scheduled backups via cron.
#
# Schedule:
#   - Daily full backup at 2:00 AM UTC
#   - Monthly backup preserved on 1st of each month
#   - Retention cleanup after each backup
#
# Environment variables:
#   PGHOST              PostgreSQL host (default: postgres)
#   PGPORT              PostgreSQL port (default: 5432)
#   PGUSER              PostgreSQL user (default: landomo)
#   PGPASSWORD          PostgreSQL password (required)
#   BACKUP_DIR          Backup output directory (default: /backups)
#   BACKUP_CRON         Cron schedule (default: 0 2 * * * = 2 AM UTC daily)
#   RETENTION_DAILY     Days to keep daily backups (default: 30)
#   RETENTION_MONTHLY   Months to keep monthly backups (default: 12)
# =============================================================================
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/backups}"
BACKUP_CRON="${BACKUP_CRON:-0 2 * * *}"
RETENTION_DAILY="${RETENTION_DAILY:-30}"
RETENTION_MONTHLY="${RETENTION_MONTHLY:-12}"
MONTHLY_DIR="${BACKUP_DIR}/monthly"

log() {
  echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] $*"
}

# Create directory structure
mkdir -p "$BACKUP_DIR"
mkdir -p "$MONTHLY_DIR"
mkdir -p "${BACKUP_DIR}/wal_archive"
mkdir -p "${BACKUP_DIR}/base"

log "Landomo Backup Service starting..."
log "  Backup dir:        ${BACKUP_DIR}"
log "  Schedule:          ${BACKUP_CRON}"
log "  Daily retention:   ${RETENTION_DAILY} days"
log "  Monthly retention: ${RETENTION_MONTHLY} months"

# Write the backup runner script that cron will execute
cat > /scripts/run-backup.sh <<'RUNNER'
#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/backups}"
MONTHLY_DIR="${BACKUP_DIR}/monthly"
RETENTION_DAILY="${RETENTION_DAILY:-30}"
RETENTION_MONTHLY="${RETENTION_MONTHLY:-12}"
LOG_FILE="${BACKUP_DIR}/cron_backup.log"

log() {
  local msg="[$(date -u +%Y-%m-%dT%H:%M:%SZ)] $*"
  echo "$msg" >> "$LOG_FILE"
  echo "$msg"
}

log "=== Scheduled backup starting ==="

# Run the full backup
/scripts/backup-databases.sh --all >> "$LOG_FILE" 2>&1
BACKUP_EXIT=$?

if [ $BACKUP_EXIT -ne 0 ]; then
  log "ERROR: Backup failed with exit code ${BACKUP_EXIT}"
else
  log "Backup completed successfully."

  # If today is the 1st of the month, copy to monthly archive
  DAY_OF_MONTH=$(date -u +%d)
  if [ "$DAY_OF_MONTH" = "01" ]; then
    MONTH_TAG=$(date -u +%Y%m)
    MONTH_DIR="${MONTHLY_DIR}/${MONTH_TAG}"
    mkdir -p "$MONTH_DIR"

    TIMESTAMP=$(date -u +%Y%m%d)
    for f in "${BACKUP_DIR}"/landomo_*_${TIMESTAMP}_*.dump "${BACKUP_DIR}"/landomo_*_${TIMESTAMP}_*.sql.gz; do
      if [ -f "$f" ]; then
        cp "$f" "$MONTH_DIR/"
        # Copy metadata sidecar if present
        [ -f "${f}.meta" ] && cp "${f}.meta" "$MONTH_DIR/"
      fi
    done
    log "Monthly backup archived to ${MONTH_DIR}"
  fi
fi

# --- Retention cleanup ---

# Remove daily backups older than RETENTION_DAILY days
log "Cleaning up daily backups older than ${RETENTION_DAILY} days..."
DELETED_COUNT=0
find "$BACKUP_DIR" -maxdepth 1 -name "landomo_*.dump" -mtime +"$RETENTION_DAILY" -type f -print -delete 2>/dev/null | while read -r f; do
  rm -f "${f}.meta" 2>/dev/null
  DELETED_COUNT=$((DELETED_COUNT + 1))
done
find "$BACKUP_DIR" -maxdepth 1 -name "landomo_*.sql.gz" -mtime +"$RETENTION_DAILY" -type f -print -delete 2>/dev/null | while read -r f; do
  rm -f "${f}.meta" 2>/dev/null
done
# Clean up orphaned log files older than retention
find "$BACKUP_DIR" -maxdepth 1 -name "backup_*.log" -mtime +"$RETENTION_DAILY" -type f -delete 2>/dev/null

# Remove monthly backups older than RETENTION_MONTHLY months
if [ -d "$MONTHLY_DIR" ]; then
  log "Cleaning up monthly backups older than ${RETENTION_MONTHLY} months..."
  CUTOFF_MONTH=$(date -u -d "${RETENTION_MONTHLY} months ago" +%Y%m 2>/dev/null || \
    date -u -v-${RETENTION_MONTHLY}m +%Y%m 2>/dev/null || echo "")

  if [ -n "$CUTOFF_MONTH" ]; then
    for month_dir in "${MONTHLY_DIR}"/*/; do
      if [ -d "$month_dir" ]; then
        dir_month=$(basename "$month_dir")
        if [ "$dir_month" \< "$CUTOFF_MONTH" ]; then
          log "Removing old monthly backup: ${dir_month}"
          rm -rf "$month_dir"
        fi
      fi
    done
  else
    log "WARNING: Could not compute monthly cutoff date. Skipping monthly cleanup."
  fi
fi

# Clean up old WAL files (keep last 7 days worth)
WAL_ARCHIVE_DIR="${BACKUP_DIR}/wal_archive"
if [ -d "$WAL_ARCHIVE_DIR" ]; then
  WAL_BEFORE=$(find "$WAL_ARCHIVE_DIR" -type f 2>/dev/null | wc -l | tr -d ' ')
  find "$WAL_ARCHIVE_DIR" -type f -mtime +7 -delete 2>/dev/null
  WAL_AFTER=$(find "$WAL_ARCHIVE_DIR" -type f 2>/dev/null | wc -l | tr -d ' ')
  WAL_REMOVED=$((WAL_BEFORE - WAL_AFTER))
  if [ "$WAL_REMOVED" -gt 0 ]; then
    log "Removed ${WAL_REMOVED} old WAL files."
  fi
fi

log "=== Scheduled backup finished ==="
RUNNER

chmod +x /scripts/run-backup.sh

# Build the cron environment file so cron jobs inherit our env vars
env | grep -E '^(PG|BACKUP_|RETENTION_|MONTHLY_|PATH)' > /etc/backup-env 2>/dev/null || true

# Write the crontab
CRON_ENTRY="${BACKUP_CRON} . /etc/backup-env; /scripts/run-backup.sh >> ${BACKUP_DIR}/cron_backup.log 2>&1"
TEST_RESTORE_CRON="${TEST_RESTORE_CRON:-0 3 * * 0}"
MONITOR_CRON="0 */6 * * *"
{
  echo "${CRON_ENTRY}"
  echo "${TEST_RESTORE_CRON} . /etc/backup-env; /scripts/test-restore-weekly.sh >> ${BACKUP_DIR}/restore_test.log 2>&1"
  echo "${MONITOR_CRON} . /etc/backup-env; /scripts/backup-monitor.sh >> ${BACKUP_DIR}/monitor.log 2>&1"
} > /etc/cron.d/landomo-backup
chmod 0644 /etc/cron.d/landomo-backup

# Also run an initial backup on startup (optional, controlled by env)
if [ "${BACKUP_ON_START:-false}" = "true" ]; then
  log "Running initial backup on startup..."
  /scripts/run-backup.sh || log "WARNING: Initial backup failed."
fi

log "Cron entry installed: ${CRON_ENTRY}"
log "Backup service ready. Waiting for scheduled runs..."

# Start cron in the foreground
exec cron -f
