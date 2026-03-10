# WAL-G Backup — Operations Runbook

## Overview

PostgreSQL on `landomo-db` ships WAL segments to Hetzner Object Storage continuously
and performs daily base backups via a WAL-G sidecar container.

| Item | Value |
|------|-------|
| Tool | WAL-G v3.0.3 (pg target) |
| Storage | Hetzner Object Storage (S3-compatible) |
| Bucket | `s3://landomo-backups/pg/` |
| Compression | Brotli |
| WAL archiving | Continuous — every 60 s or on segment switch (~16 MB) |
| Base backups | Daily 02:00 UTC |
| Retention | 7 full base backups (cleaned Sunday 03:00 UTC) |
| RPO | ~60 seconds |
| RTO | ~15–30 min |

## Architecture

```
landomo-db
  landomo-postgres (PostGIS 17 + WAL-G)
    archive_command = wal-g wal-push %p
         │  WAL segment every ~60s or 16 MB
         ▼
  landomo-backup (sidecar)
    cron 02:00 → wal-g backup-push   (base backup)
    cron 03:00 Sun → wal-g delete retain FULL 7
         │
         ▼
  Hetzner Object Storage
    s3://landomo-backups/pg/
      wal_005/           ← continuous WAL stream
      basebackups_005/   ← daily base snapshots
```

## Relevant Files

| File | Purpose |
|------|---------|
| `infra/docker/db/Dockerfile` | Custom PostGIS image with WAL-G binary |
| `infra/docker/db/docker-compose.db.yml` | postgres + backup sidecar service definitions |
| `infra/docker/db/.env.example` | Env var template (Hetzner credentials) |
| `infra/docker/countries/czech/backup/Dockerfile` | WAL-G backup sidecar image |
| `infra/docker/countries/czech/backup/entrypoint.sh` | Sidecar startup + env validation |
| `infra/docker/countries/czech/backup/backup-cron` | Cron schedule |

## Initial Deployment

### 1. Create Hetzner Object Storage bucket

1. Go to Hetzner Cloud Console → Object Storage
2. Create bucket: `landomo-backups` in your preferred region (e.g. `fsn1`)
3. Go to Access Keys → Create access key
4. Note down Access Key ID and Secret Access Key

### 2. Configure credentials on landomo-db

```bash
# Create infra directory
ssh landomo-db 'mkdir -p /opt/landomo/infra/docker/db'

# Sync files from local
rsync -az ~/Development/landomo-prod/infra/docker/db/ \
  landomo-db:/opt/landomo/infra/docker/db/
rsync -az ~/Development/landomo-prod/infra/docker/countries/czech/backup/ \
  landomo-db:/opt/landomo/infra/docker/backup/

# Create .env from template
ssh landomo-db 'cp /opt/landomo/infra/docker/db/.env.example /opt/landomo/infra/docker/db/.env'

# Fill in real credentials
ssh landomo-db 'nano /opt/landomo/infra/docker/db/.env'
```

### 3. Build images

```bash
ssh landomo-db 'cd /opt/landomo/infra/docker/db && \
  docker compose -f docker-compose.db.yml --env-file .env build'
```

> **Note:** WAL-G builds from source — this takes ~5 minutes on first run.

### 4. Stop old postgres container, start new stack

```bash
# Stop the old standalone container
ssh landomo-db 'docker stop landomo-postgres && docker rm landomo-postgres'

# Start postgres + backup sidecar via compose
ssh landomo-db 'cd /opt/landomo/infra/docker/db && \
  docker compose -f docker-compose.db.yml --env-file .env up -d'
```

### 5. Verify WAL archiving

```bash
# Check archive_command is active
ssh landomo-db 'docker exec landomo-postgres psql -U landomo postgres \
  -c "SELECT archived_count, failed_count, last_archived_wal, last_failed_msg \
      FROM pg_stat_archiver;"'

# Watch WAL archive log
ssh landomo-db 'docker exec landomo-postgres tail -f /tmp/walg-archive.log'
```

### 6. Trigger first base backup

```bash
ssh landomo-db 'docker exec landomo-backup \
  sh -c "source /etc/walg.env && wal-g backup-push /var/lib/postgresql/data"'
```

### 7. Verify backup in Hetzner

```bash
ssh landomo-db 'docker exec landomo-backup \
  sh -c "source /etc/walg.env && wal-g backup-list --detail --pretty"'
```

---

## Redeployment (after image/config changes)

```bash
# Sync updated files
rsync -az ~/Development/landomo-prod/infra/docker/db/ \
  landomo-db:/opt/landomo/infra/docker/db/

# Rebuild and restart
ssh landomo-db 'cd /opt/landomo/infra/docker/db && \
  docker compose -f docker-compose.db.yml --env-file .env \
  up -d --build --force-recreate'
```

---

## Day-to-day Operations

### List available backups

```bash
ssh landomo-db 'docker exec landomo-backup \
  sh -c "source /etc/walg.env && wal-g backup-list --detail --pretty"'
```

### Check WAL archiving health

```bash
ssh landomo-db 'docker exec landomo-postgres psql -U landomo postgres \
  -c "SELECT * FROM pg_stat_archiver;"'
```

### View backup/archiving logs

```bash
ssh landomo-db 'docker exec landomo-postgres tail -50 /tmp/walg-archive.log'
ssh landomo-db 'docker exec landomo-backup tail -50 /var/log/walg/backup.log'
```

### Force an immediate base backup

```bash
ssh landomo-db 'docker exec landomo-backup \
  sh -c "source /etc/walg.env && wal-g backup-push /var/lib/postgresql/data"'
```

### Manual retention cleanup

```bash
# Keep last 7 full backups
ssh landomo-db 'docker exec landomo-backup \
  sh -c "source /etc/walg.env && wal-g delete retain FULL 7 --confirm"'
```

---

## Restore Procedures

### Full restore (latest backup)

> Perform on a recovery host or after stopping landomo-postgres in a maintenance window.

```bash
# 1. Stop postgres
ssh landomo-db 'docker compose -f /opt/landomo/infra/docker/db/docker-compose.db.yml stop landomo-postgres'

# 2. Clear data dir (IRREVERSIBLE — confirm this is intentional)
ssh landomo-db 'rm -rf /opt/postgres-data/*'

# 3. Restore latest base backup
ssh landomo-db 'docker run --rm \
  --env-file /opt/landomo/infra/docker/db/.env \
  -v /opt/postgres-data:/var/lib/postgresql/data \
  landomo-backup:latest \
  sh -c "source /etc/walg.env && wal-g backup-fetch /var/lib/postgresql/data LATEST"'

# 4. Create recovery signal (postgres replays WAL automatically on startup)
ssh landomo-db 'touch /opt/postgres-data/recovery.signal'

# 5. Start postgres
ssh landomo-db 'docker compose -f /opt/landomo/infra/docker/db/docker-compose.db.yml start landomo-postgres'

# 6. Monitor recovery progress
ssh landomo-db 'docker logs -f landomo-postgres'
```

### Point-in-time restore (PITR)

Replace step 4 above with:

```bash
# Write recovery target (adjust timestamp as needed)
ssh landomo-db 'cat >> /opt/postgres-data/postgresql.auto.conf <<EOF
restore_command = '"'"'docker exec landomo-backup sh -c "source /etc/walg.env && wal-g wal-fetch %f %p"'"'"'
recovery_target_time = '"'"'2026-02-24 14:30:00 UTC'"'"'
recovery_target_action = '"'"'promote'"'"'
EOF'

ssh landomo-db 'touch /opt/postgres-data/recovery.signal'

# Then start postgres as in step 5
```

---

## Troubleshooting

### WAL archiving is failing

```bash
# Check failed_count and last error
docker exec landomo-postgres psql -U landomo postgres \
  -c "SELECT failed_count, last_failed_wal, last_failed_time, last_failed_msg FROM pg_stat_archiver;"

# Check WAL-G output
docker exec landomo-postgres cat /tmp/walg-archive.log | tail -50

# Test connectivity to Hetzner S3
docker exec landomo-backup \
  sh -c "source /etc/walg.env && wal-g backup-list"
```

### backup-push is failing

```bash
docker logs landomo-backup

# Run with verbose output
docker exec landomo-backup \
  sh -c "source /etc/walg.env && WALG_LOG_LEVEL=DEVEL wal-g backup-push /var/lib/postgresql/data"
```

### Credentials not working with Hetzner

Make sure:
- `AWS_S3_FORCE_PATH_STYLE=true` is set
- `AWS_ENDPOINT` is `https://fsn1.your-objectstorage.com` (not bucket-prefixed)
- `AWS_REGION` matches the region the bucket was created in
- The access key has read+write permissions on the bucket
