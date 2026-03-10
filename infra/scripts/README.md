# Landomo-World Backup & Operations Scripts

This directory contains production-ready scripts for database backup, restore, and operational maintenance.

## Table of Contents

- [Backup Scripts](#backup-scripts)
- [Restore Scripts](#restore-scripts)
- [Verification Scripts](#verification-scripts)
- [Docker Deployment](#docker-deployment)
- [Recovery Procedures](#recovery-procedures)
- [Monitoring & Alerts](#monitoring--alerts)

---

## Backup Scripts

### `backup-databases.sh`

**Full database backup using pg_dump with compression.**

```bash
# Backup all country databases
./backup-databases.sh --all

# Backup specific country
./backup-databases.sh --country czech

# Backup multiple countries
./backup-databases.sh --country czech,slovakia,germany

# List available databases
./backup-databases.sh --list

# Verify an existing backup
./backup-databases.sh --verify-only /backups/landomo_czech_20260208_020000.dump
```

**Environment Variables:**
- `PGHOST` - PostgreSQL host (default: postgres)
- `PGPORT` - PostgreSQL port (default: 5432)
- `PGUSER` - PostgreSQL user (default: landomo)
- `PGPASSWORD` - PostgreSQL password (required)
- `BACKUP_DIR` - Output directory (default: /backups)
- `BACKUP_FORMAT` - "custom" (default, smaller) or "plain" (SQL text)
- `PARALLEL_JOBS` - pg_dump parallel jobs (default: 4)

**Output:**
- Compressed backup files: `landomo_{country}_{timestamp}.dump` or `.sql.gz`
- Metadata sidecar: `.meta` files with backup details
- Summary JSON: `latest_backup_summary.json`
- Detailed log: `backup_{timestamp}.log`

**Retention:** Handled by `backup-cron-entrypoint.sh` (30 days daily, 12 months monthly)

---

### `backup-wal.sh`

**Configure and manage PostgreSQL Write-Ahead Log (WAL) archiving for Point-in-Time Recovery (PITR).**

```bash
# Configure WAL archiving (requires superuser)
./backup-wal.sh setup

# Verify WAL archiving is active
./backup-wal.sh verify

# Take a base backup (required for PITR)
./backup-wal.sh base

# Check status
./backup-wal.sh status
```

**Environment Variables:**
- `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD` - PostgreSQL connection
- `WAL_ARCHIVE_DIR` - WAL archive directory (default: /backups/wal_archive)
- `BASE_BACKUP_DIR` - Base backup directory (default: /backups/base)

**Output:**
- WAL files: Archived to `$WAL_ARCHIVE_DIR`
- Base backups: Stored in `$BASE_BACKUP_DIR/base_{timestamp}/`

**Note:** WAL archiving requires PostgreSQL restart to activate `wal_level=replica` and `archive_mode=on`.

---

### `backup-cron-entrypoint.sh`

**Docker entrypoint for scheduled backups via cron.**

**Schedule:**
- **Daily full backup:** 2:00 AM UTC
- **Monthly archive:** 1st of each month (preserved separately)
- **Retention cleanup:** After each backup run

**Environment Variables:**
- `BACKUP_CRON` - Cron schedule (default: `0 2 * * *` = 2 AM daily)
- `RETENTION_DAILY` - Days to keep daily backups (default: 30)
- `RETENTION_MONTHLY` - Months to keep monthly backups (default: 12)
- `BACKUP_ON_START` - Run initial backup on container start (default: false)

**Usage:**
```bash
# Start backup scheduler container
docker compose -f docker/docker-compose.backup.yml up -d backup-scheduler

# View logs
docker logs -f landomo-backup-scheduler

# Run manual backup
docker exec landomo-backup-scheduler /scripts/backup-databases.sh --all
```

---

### `backup-sync-s3.sh`

**Sync backups to S3-compatible storage (AWS S3, Cloudflare R2, etc.).**

```bash
# Sync backups to S3
./backup-sync-s3.sh

# Dry-run mode (show what would be synced)
AWS_DRY_RUN=true ./backup-sync-s3.sh
```

**Environment Variables:**
- `AWS_ACCESS_KEY_ID` - S3 access key
- `AWS_SECRET_ACCESS_KEY` - S3 secret key
- `AWS_DEFAULT_REGION` - S3 region (default: auto)
- `AWS_ENDPOINT_URL` - S3 endpoint (for R2: `https://accountid.r2.cloudflarestorage.com`)
- `S3_BUCKET` - S3 bucket name
- `BACKUP_DIR` - Local backup directory (default: /backups)

**Features:**
- Incremental sync (only new/changed files)
- Compression verification before upload
- Upload failure detection
- Retention policy matching local backups

---

### `backup-verify-offsite.sh`

**Verify offsite backups are accessible and valid.**

```bash
# Verify all offsite backups
./backup-verify-offsite.sh

# Verify specific country
./backup-verify-offsite.sh --country czech
```

**Checks:**
- S3 bucket connectivity
- Backup file existence and integrity
- Metadata validation
- Age warnings (>48h old backups)

---

## Restore Scripts

### `restore-database.sh`

**Restore a database backup to a target database.**

```bash
# Restore to a new database
./restore-database.sh landomo_czech_20260208_020000.dump landomo_czech_restore

# Test restore (creates temp DB, validates, then drops)
./restore-database.sh --test landomo_czech_20260208_020000.dump

# Test restore and keep temp DB for inspection
./restore-database.sh --test --keep landomo_czech_20260208_020000.dump

# Restore without validation
./restore-database.sh --skip-validation backup.dump target_db
```

**Environment Variables:**
- `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD` - PostgreSQL connection

**Features:**
- Supports `.dump` (custom format) and `.sql.gz` (gzipped SQL)
- Automatic PostGIS extension creation
- Post-restore validation:
  - Table count and existence
  - Index verification
  - Row count checks
  - Schema version validation
  - Data integrity checks

**Validation Checks:**
- Core tables: `properties`, `ingestion_log`, `property_changes`, `price_history`, `listing_status_history`, `scrape_runs`, `staleness_thresholds`
- Core indexes: `idx_properties_portal_id`, `idx_properties_source_url`, `idx_properties_status`, `idx_properties_last_seen_at`
- Column existence: `portal_id`, `status`, etc.

---

### `test-restore-weekly.sh`

**Automated weekly restore testing for all country databases.**

```bash
# Test all countries
./test-restore-weekly.sh

# Test specific country
./test-restore-weekly.sh --country czech
```

**Environment Variables:**
- `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD` - PostgreSQL connection
- `BACKUP_DIR` - Backup directory (default: /backups)

**Output:**
- JSON results: `/backups/restore-tests/restore_test_{timestamp}.json`
- Summary statistics: passed, failed, no backup
- Exit code: 0 (all passed), 1 (failures detected)

**Features:**
- Finds most recent backup for each country
- Warns if backup is >48 hours old
- Parallel testing (if multiple countries)
- Detailed failure reporting

**Recommended Schedule:** Weekly via cron (Sundays 3 AM UTC)

---

## Verification Scripts

All verification is built into the scripts above:
- `backup-databases.sh --verify-only FILE` - Verify backup file integrity
- `restore-database.sh --test FILE` - Full restore validation
- `backup-verify-offsite.sh` - Verify offsite backups

---

## Docker Deployment

### Quick Start

```bash
# 1. Create backup directory
mkdir -p ./backups

# 2. Set environment variables in .env.prod
cat > .env.prod <<EOF
PGHOST=postgres
PGPORT=5432
PGUSER=landomo
PGPASSWORD=your_secure_password
BACKUP_CRON=0 2 * * *
RETENTION_DAILY=30
RETENTION_MONTHLY=12
EOF

# 3. Start backup service
docker compose -f docker/docker-compose.backup.yml --env-file .env.prod up -d

# 4. Verify backup service is running
docker logs landomo-backup-scheduler

# 5. Check backup files
ls -lh ./backups/
```

### Enable Offsite Sync (S3/R2)

```bash
# Add S3 configuration to .env.prod
cat >> .env.prod <<EOF
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_ENDPOINT_URL=https://accountid.r2.cloudflarestorage.com
S3_BACKUP_BUCKET=landomo-backups
SYNC_CRON=0 4 * * *
EOF

# Start offsite sync service
docker compose -f docker/docker-compose.backup.yml --env-file .env.prod --profile offsite up -d
```

---

## Recovery Procedures

### Full Database Recovery

**Scenario:** Database corruption or accidental data loss.

```bash
# 1. Stop services using the database
docker compose stop ingest-czech worker-czech

# 2. Identify the backup to restore
ls -lh /backups/landomo_czech_*.dump | tail -5

# 3. Restore to a temporary database for verification
docker exec landomo-backup-scheduler /scripts/restore-database.sh \
  --test /backups/landomo_czech_20260208_020000.dump

# 4. If validation passes, restore to production
docker exec landomo-postgres psql -U landomo -d postgres -c "DROP DATABASE landomo_czech"
docker exec landomo-postgres psql -U landomo -d postgres -c "CREATE DATABASE landomo_czech"
docker exec landomo-backup-scheduler /scripts/restore-database.sh \
  /backups/landomo_czech_20260208_020000.dump landomo_czech

# 5. Restart services
docker compose start ingest-czech worker-czech
```

**Recovery Time Objective (RTO):**
- Small DB (<1GB): ~5-10 minutes
- Medium DB (1-10GB): ~15-30 minutes
- Large DB (>10GB): ~30-60 minutes

---

### Point-in-Time Recovery (PITR)

**Scenario:** Restore to a specific timestamp using WAL archiving.

```bash
# 1. Identify the base backup closest to desired time
ls -lh /backups/base/

# 2. Stop PostgreSQL
docker compose stop postgres

# 3. Remove current data directory
docker run --rm -v postgres_data:/data alpine rm -rf /data/*

# 4. Restore base backup
docker run --rm -v postgres_data:/data -v backup_data:/backups alpine \
  tar -xzf /backups/base/base_20260208_020000/base.tar.gz -C /data

# 5. Configure recovery target
cat > /path/to/recovery.conf <<EOF
restore_command = 'cp /backups/wal_archive/%f %p'
recovery_target_time = '2026-02-08 14:30:00 UTC'
recovery_target_action = 'promote'
EOF

# 6. Start PostgreSQL in recovery mode
docker compose start postgres

# 7. Monitor recovery
docker logs -f landomo-postgres
```

**RTO for PITR:** 20-90 minutes (depends on WAL file count)

---

### Partial Data Recovery

**Scenario:** Recover specific tables or rows.

```bash
# 1. Restore full backup to temporary database
docker exec landomo-backup-scheduler /scripts/restore-database.sh \
  --test --keep /backups/landomo_czech_20260208_020000.dump

# 2. Extract specific data
docker exec landomo-postgres psql -U landomo -d landomo_restore_test_20260208 \
  -c "COPY (SELECT * FROM properties WHERE id IN ('uuid1', 'uuid2')) TO STDOUT" \
  > recovered_data.csv

# 3. Import to production
docker exec -i landomo-postgres psql -U landomo -d landomo_czech \
  -c "\COPY properties FROM STDIN" < recovered_data.csv

# 4. Clean up temp database
docker exec landomo-postgres psql -U landomo -d postgres \
  -c "DROP DATABASE landomo_restore_test_20260208"
```

---

## Monitoring & Alerts

### Backup Status Monitoring

**Check latest backup summary:**
```bash
docker exec landomo-backup-scheduler cat /backups/latest_backup_summary.json
```

**Example output:**
```json
{
  "timestamp": "20260208_020000",
  "total_databases": 11,
  "successful": 11,
  "failed": 0,
  "duration_seconds": 1847,
  "failed_databases": []
}
```

### Alerting Integration

**Prometheus metrics (via node-exporter on backup volume):**
```yaml
# /etc/prometheus/prometheus.yml
scrape_configs:
  - job_name: 'backup-status'
    static_configs:
      - targets: ['backup-scheduler:9100']
```

**Grafana dashboard queries:**
```promql
# Backup failures in last 24h
rate(backup_failures_total[24h]) > 0

# Backup age (hours since last successful backup)
(time() - backup_last_success_timestamp_seconds) / 3600 > 26

# Backup size trend
backup_size_bytes{country="czech"}
```

**Email alerts (via cron + sendmail):**
```bash
# Add to backup-cron-entrypoint.sh
if [ "$failed" -gt 0 ]; then
  echo "Backup failed for: ${failed_dbs[*]}" | \
    mail -s "ALERT: Landomo Backup Failed" ops@example.com
fi
```

---

## Backup Retention Policy

| Backup Type | Frequency | Retention | Location |
|-------------|-----------|-----------|----------|
| Daily Full | 2 AM UTC | 30 days | Local + S3 |
| Monthly Archive | 1st of month | 12 months | S3 only |
| WAL Files | Continuous | 7 days | Local |
| Base Backups | Weekly | 4 weeks | Local + S3 |

**Total storage estimate (11 country DBs):**
- Daily: ~50GB compressed (30 days = 1.5TB)
- Monthly: ~50GB compressed (12 months = 600GB)
- WAL: ~10GB per day (7 days = 70GB)

**Offsite (S3/R2) storage:** ~2TB total

---

## Troubleshooting

### Backup fails with "PGPASSWORD not set"

```bash
# Verify environment variable
docker exec landomo-backup-scheduler env | grep PGPASSWORD

# Fix: Update docker-compose.backup.yml or .env.prod
```

### Restore fails with "database already exists"

```bash
# Use --test mode for non-destructive testing
./restore-database.sh --test backup.dump

# Or drop the database first
docker exec landomo-postgres psql -U landomo -d postgres -c "DROP DATABASE target_db"
```

### WAL archiving not working

```bash
# Check WAL status
docker exec landomo-backup-scheduler /scripts/backup-wal.sh status

# Verify archive_command in PostgreSQL
docker exec landomo-postgres psql -U landomo -d postgres -c "SHOW archive_command"

# Check WAL directory permissions
docker exec landomo-backup-scheduler ls -lh /backups/wal_archive/
```

### Offsite sync fails with S3 errors

```bash
# Test S3 credentials
docker exec landomo-backup-offsite aws s3 ls s3://${S3_BUCKET}/

# Check endpoint URL (for R2)
docker exec landomo-backup-offsite env | grep AWS_ENDPOINT_URL

# Verify bucket permissions (IAM policy needs s3:PutObject, s3:GetObject, s3:ListBucket)
```

---

## Security Considerations

1. **Credentials:**
   - Never commit `.env.prod` to git
   - Use Docker secrets or environment files
   - Rotate `PGPASSWORD` regularly

2. **Backup Encryption:**
   - Enable S3 bucket encryption (AES-256)
   - Consider client-side encryption before upload

3. **Access Control:**
   - Restrict backup volume permissions (chmod 700)
   - Use separate IAM user for S3 sync (least privilege)
   - Enable MFA for S3 bucket deletions

4. **Network Security:**
   - Run backup services in isolated network
   - Use VPC endpoints for S3 access (if on AWS)
   - Enable audit logging for backup operations

---

## Performance Tuning

### Backup Speed

```bash
# Increase parallel jobs (requires more CPU/memory)
PARALLEL_JOBS=8 ./backup-databases.sh --all

# Use plain format for faster restore (at cost of larger files)
BACKUP_FORMAT=plain ./backup-databases.sh --all
```

### Restore Speed

```bash
# Custom format with parallel restore
pg_restore -j 8 -d target_db backup.dump

# Disable fsync during restore (faster, less safe)
psql -d target_db -c "ALTER SYSTEM SET fsync = off"
# (Re-enable after restore!)
psql -d target_db -c "ALTER SYSTEM SET fsync = on"
```

---

## Disaster Recovery Checklist

- [ ] Backups run daily at 2 AM UTC
- [ ] Weekly restore test passes
- [ ] Offsite sync active (S3/R2)
- [ ] WAL archiving enabled
- [ ] Base backup taken in last 7 days
- [ ] Alerts configured for backup failures
- [ ] Recovery procedures documented and tested
- [ ] RTO < 1 hour for critical databases
- [ ] RPO < 24 hours (ideally <1 hour with WAL)
- [ ] Credentials stored securely
- [ ] Backup encryption enabled

---

## Additional Resources

- [PostgreSQL Backup Documentation](https://www.postgresql.org/docs/current/backup.html)
- [Point-in-Time Recovery (PITR)](https://www.postgresql.org/docs/current/continuous-archiving.html)
- [AWS S3 Backup Best Practices](https://docs.aws.amazon.com/AmazonS3/latest/userguide/backup-best-practices.html)
- [Cloudflare R2 Documentation](https://developers.cloudflare.com/r2/)

---

**Last Updated:** 2026-02-08
**Maintained By:** DevOps Team
**Review Schedule:** Quarterly
