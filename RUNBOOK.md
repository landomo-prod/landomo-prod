# Landomo-World Production Runbook

Czech MVP deployment on Hostinger VPS. Deployment root: `/opt/landomo-world`.

---

## Service Inventory

| Service | Container | Port | Health Endpoint |
|---------|-----------|------|-----------------|
| PostgreSQL | landomo-postgres | 5432 | `pg_isready -U landomo` |
| Redis | landomo-redis | 6379 | `redis-cli ping` |
| PgBouncer | landomo-pgbouncer | 6432 | `pg_isready -h localhost -p 6432` |
| Ingest (CZ) | landomo-ingest-czech | 3006 | `GET /api/v1/health` |
| Worker (CZ) | landomo-worker-czech | -- | BullMQ heartbeat |
| Sreality scraper | landomo-scraper-sreality | 8102 | `GET /health` |
| Bezrealitky scraper | landomo-scraper-bezrealitky | 8103 | `GET /health` |
| Reality scraper | landomo-scraper-reality | 8104 | `GET /health` |
| IDNES Reality scraper | landomo-scraper-idnes-reality | 8105 | `GET /health` |
| Realingo scraper | landomo-scraper-realingo | 8106 | `GET /health` |
| Ulovdomov scraper | landomo-scraper-ulovdomov | 8107 | `GET /health` |
| Bazos scraper | landomo-scraper-bazos | 8108 | `GET /health` |
| CeskeReality scraper | landomo-scraper-ceskereality | 8109 | `GET /health` |
| Search service | landomo-search-service | 4000 | `GET /api/v1/health` |
| Polygon service | landomo-polygon-service | 3100 | `GET /api/v1/health` |

---

## Quick Reference Commands

```bash
# SSH to VPS
ssh landomo-vps

# All commands below run on VPS in /opt/landomo-world
cd /opt/landomo-world

# Compose alias (use throughout this doc)
DC="docker compose --project-directory . -f docker/docker-compose.yml --env-file .env.production"

# Status overview
$DC ps
docker stats --no-stream

# View logs (last 200 lines, follow)
$DC logs -f --tail=200 ingest-czech
$DC logs -f --tail=200 worker-czech
$DC logs -f --tail=200 scraper-sreality
```

---

## 1. Service Restart Procedures

### Restart a single scraper (zero downtime to ingestion)

```bash
$DC restart scraper-sreality
# Verify
$DC logs --tail=20 scraper-sreality
curl -s http://localhost:8102/health | jq .
```

### Restart ingest + worker (brief ingestion pause)

```bash
# Workers drain current jobs before stopping
$DC restart worker-czech
$DC restart ingest-czech

# Verify ingest is accepting requests
curl -s http://localhost:3006/api/v1/health | jq .
```

### Restart infrastructure (PostgreSQL / Redis)

**WARNING: This affects ALL services. Schedule during low-traffic window.**

```bash
# Redis restart (BullMQ jobs will retry)
$DC restart redis
sleep 5
$DC restart worker-czech ingest-czech  # reconnect to Redis

# PostgreSQL restart (causes brief query failures)
$DC restart postgres
sleep 10
$DC restart pgbouncer ingest-czech worker-czech
```

### Full platform restart

```bash
$DC down
$DC up -d postgres redis
sleep 15  # wait for DB + Redis healthy
$DC up -d pgbouncer ingest-czech worker-czech
sleep 10
$DC up -d scraper-sreality scraper-bezrealitky scraper-reality scraper-idnes-reality scraper-realingo scraper-ulovdomov scraper-bazos scraper-ceskereality
```

---

## 2. Troubleshooting Guide

### Scraper returning 0 listings

1. Check scraper logs for HTTP errors:
   ```bash
   $DC logs --tail=100 scraper-sreality | grep -i "error\|fail\|block\|403\|429"
   ```
2. Test the source portal manually (may be down or blocking).
3. Check if portal changed HTML structure (selector mismatch).
4. Restart the scraper: `$DC restart scraper-sreality`

### Ingestion failures (400/500 from ingest API)

1. Check ingest logs:
   ```bash
   $DC logs --tail=100 ingest-czech | grep -i "error\|reject\|invalid"
   ```
2. Common causes:
   - Missing `property_category` in payload (transformer bug)
   - Duplicate `source_url` + `source_platform` within same batch
   - Database connection exhaustion (check PgBouncer stats)
3. Check PgBouncer:
   ```bash
   docker exec landomo-pgbouncer psql -p 6432 -U pgbouncer_admin pgbouncer -c "SHOW POOLS;"
   ```

### Worker stuck / jobs not processing

1. Check worker logs:
   ```bash
   $DC logs --tail=100 worker-czech | grep -i "error\|stall\|timeout"
   ```
2. Check Redis queue depth:
   ```bash
   docker exec landomo-redis redis-cli -a "$(cat docker/secrets/redis_password)" LLEN bull:ingest-property-czech:wait
   ```
3. If queue is growing but worker is idle, restart worker:
   ```bash
   $DC restart worker-czech
   ```

### Database connection errors

1. Check active connections:
   ```bash
   docker exec landomo-postgres psql -U landomo -d landomo_czech -c \
     "SELECT count(*) FROM pg_stat_activity WHERE datname='landomo_czech';"
   ```
2. Check PgBouncer pool saturation:
   ```bash
   docker exec landomo-pgbouncer psql -p 6432 -U pgbouncer_admin pgbouncer -c "SHOW POOLS;"
   ```
3. If connections are maxed, restart PgBouncer: `$DC restart pgbouncer`

### Staleness checker not running

1. Verify the scheduled job exists in Redis:
   ```bash
   docker exec landomo-redis redis-cli -a "$(cat docker/secrets/redis_password)" \
     KEYS "bull:staleness-check-czech:*"
   ```
2. Check worker logs for staleness job execution:
   ```bash
   $DC logs --tail=200 worker-czech | grep -i "staleness"
   ```
3. The staleness cron runs every 6 hours (`0 */6 * * *`). Manual trigger:
   ```bash
   curl -X POST http://localhost:3006/api/v1/staleness/trigger
   ```

### Circuit breaker tripped (>30% stale)

This means a portal's scraper is failing silently. The staleness checker skips the portal to avoid mass-marking listings as removed.

1. Check which portal tripped:
   ```bash
   $DC logs --tail=200 worker-czech | grep "circuit.breaker\|skip.*portal"
   ```
2. Investigate that scraper's logs.
3. Once scraper is fixed and running, the next staleness check will resume normally.

### Out of disk space

```bash
# Check disk usage
df -h
du -sh /var/lib/docker/volumes/*

# Prune unused Docker resources
docker system prune -f
docker volume prune -f  # WARNING: removes unused volumes

# Check PostgreSQL WAL size
docker exec landomo-postgres du -sh /var/lib/postgresql/data/pg_wal/
```

---

## 3. Log Locations and Analysis

### Docker logs (primary)

```bash
# All services
$DC logs -f --tail=100

# Specific service
$DC logs -f --tail=200 ingest-czech

# Time-bounded
$DC logs --since="2h" worker-czech

# Search for errors across all services
$DC logs --since="1h" 2>&1 | grep -i "error\|fatal\|panic"
```

### PostgreSQL logs

```bash
docker exec landomo-postgres cat /var/lib/postgresql/data/log/postgresql*.log
# Or tail the current log
docker exec landomo-postgres tail -f /var/lib/postgresql/data/log/postgresql-$(date +%a).log
```

### Key log patterns to watch

| Pattern | Meaning | Action |
|---------|---------|--------|
| `UPSERT.*inserted.*true` | New listing ingested | Normal |
| `UPSERT.*inserted.*false` | Existing listing updated | Normal |
| `staleness.*marking.*removed` | Listing gone stale (72h) | Normal |
| `circuit breaker` | Portal >30% stale | Investigate scraper |
| `ECONNREFUSED` | Service connection lost | Restart dependent service |
| `pool exhausted` | DB connections maxed | Check PgBouncer, restart |
| `scrape_run.*overlap` | Concurrent scrape blocked (409) | Normal safety mechanism |

---

## 4. Backup and Restore

### Database backup (manual)

```bash
# Dump Czech database
docker exec landomo-postgres pg_dump -U landomo -Fc landomo_czech > /opt/backups/landomo_czech_$(date +%Y%m%d_%H%M%S).dump

# Compressed SQL backup
docker exec landomo-postgres pg_dump -U landomo landomo_czech | gzip > /opt/backups/landomo_czech_$(date +%Y%m%d).sql.gz
```

### Database backup (automated daily)

Add to root crontab (`crontab -e`):

```cron
0 3 * * * docker exec landomo-postgres pg_dump -U landomo -Fc landomo_czech > /opt/backups/landomo_czech_$(date +\%Y\%m\%d).dump && find /opt/backups -name "*.dump" -mtime +7 -delete
```

### Restore from backup

```bash
# Stop services writing to the database
$DC stop worker-czech ingest-czech

# Restore (drops and recreates)
docker exec -i landomo-postgres pg_restore -U landomo -d landomo_czech --clean --if-exists < /opt/backups/landomo_czech_20260215.dump

# Restart services
$DC start ingest-czech worker-czech
```

### Redis backup

Redis is configured with AOF persistence (`appendonly yes`) and periodic RDB snapshots. Data is in the `redis_data` Docker volume.

```bash
# Manual snapshot
docker exec landomo-redis redis-cli -a "$(cat docker/secrets/redis_password)" BGSAVE

# Copy RDB file
docker cp landomo-redis:/data/dump.rdb /opt/backups/redis_$(date +%Y%m%d).rdb
```

---

## 5. Emergency Rollback

### Rollback a scraper deployment

```bash
# Stop the broken scraper
$DC stop scraper-sreality

# If using rsync-based deploy, restore previous dist/ from backup:
# On local machine:
git stash  # or git checkout <previous-commit>
rsync -av "scrapers/Czech Republic/sreality/dist/" landomo-vps:/opt/landomo-world/scrapers/Czech\ Republic/sreality/dist/

# Restart
ssh landomo-vps "cd /opt/landomo-world && $DC restart scraper-sreality"
```

### Rollback a database migration

Migrations are forward-only. To undo:

1. Write a reverse migration SQL file.
2. Apply it:
   ```bash
   docker exec -i landomo-postgres psql -U landomo -d landomo_czech < reverse_migration.sql
   ```
3. Or restore from the pre-migration backup (preferred).

### Rollback ingest service

```bash
# Stop ingest + worker
$DC stop ingest-czech worker-czech

# On local machine, checkout previous working version:
git checkout <commit>
cd ingest-service && npm run build

# Rsync and restart
rsync -av ingest-service/dist/ landomo-vps:/opt/landomo-world/ingest-service/dist/
ssh landomo-vps "cd /opt/landomo-world && $DC start ingest-czech worker-czech"
```

### Nuclear option: full rollback

```bash
# Stop everything
$DC down

# Restore database from backup
docker exec -i landomo-postgres pg_restore -U landomo -d landomo_czech --clean --if-exists < /opt/backups/landomo_czech_YYYYMMDD.dump

# Restore Redis
$DC up -d redis
docker cp /opt/backups/redis_YYYYMMDD.rdb landomo-redis:/data/dump.rdb
$DC restart redis

# Bring everything back up
$DC up -d
```

---

## 6. Scaling Guidelines

### Vertical (current VPS)

| Resource | Current | Warning | Action |
|----------|---------|---------|--------|
| CPU | 4 cores | >80% sustained | Reduce scraper concurrency |
| RAM | 8 GB | >85% | Reduce `DB_MAX_CONNECTIONS`, `BATCH_WORKERS` |
| Disk | 100 GB | >80% | Prune Docker, archive old backups |
| DB connections | 20/service | PgBouncer > 80% | Increase `DEFAULT_POOL_SIZE` |

### Scraper concurrency tuning

```bash
# In docker-compose or .env.production:
WORKER_CONCURRENCY=30   # Sreality (high volume)
WORKER_CONCURRENCY=10   # Smaller portals
BATCH_WORKERS=2          # Ingest workers per batch
BATCH_SIZE=100           # Properties per batch
```

### Horizontal (future)

- Scrapers are stateless -- can run on separate VPS with `INGEST_API_URL` pointed at main.
- Workers can scale by adding more `worker-czech` containers (BullMQ distributes jobs).
- Database: add read replica, configure `DB_READ_HOST` in ingest service config.

---

## 7. Routine Maintenance

### Daily checks

```bash
# Service health
$DC ps

# Disk space
df -h

# Database size
docker exec landomo-postgres psql -U landomo -d landomo_czech -c \
  "SELECT pg_size_pretty(pg_database_size('landomo_czech'));"

# Listings count by category
docker exec landomo-postgres psql -U landomo -d landomo_czech -c \
  "SELECT property_category, status, count(*) FROM properties_new GROUP BY property_category, status ORDER BY 1, 2;"

# Redis queue depth (should be near 0 when idle)
docker exec landomo-redis redis-cli -a "$(cat docker/secrets/redis_password)" \
  LLEN bull:ingest-property-czech:wait
```

### Weekly

- Review scraper success rates in `scrape_runs` table.
- Check for stale listings approaching circuit breaker threshold.
- Verify backups exist and are recent.
- `docker system prune -f` to reclaim disk.

### Monthly

- Review and rotate API keys if needed.
- Update Docker images: `$DC pull && $DC up -d`
- Check for PostgreSQL bloat: `VACUUM ANALYZE` on large tables.
- Review `ingestion_log` size and consider archival.

---

## 8. Applying Database Migrations

```bash
# Copy migration to VPS
scp ingest-service/migrations/NNN_description.sql landomo-vps:/opt/landomo-world/ingest-service/migrations/

# ALWAYS backup before migrating
docker exec landomo-postgres pg_dump -U landomo -Fc landomo_czech > /opt/backups/pre_migration_$(date +%Y%m%d_%H%M%S).dump

# Apply migration
docker exec -i landomo-postgres psql -U landomo -d landomo_czech < /opt/landomo-world/ingest-service/migrations/NNN_description.sql

# Verify
docker exec landomo-postgres psql -U landomo -d landomo_czech -c "\dt+"
```

---

## 9. Triggering Scrapers

```bash
# Trigger a single scraper
curl -X POST http://localhost:8102/scrape   # Sreality
curl -X POST http://localhost:8103/scrape   # Bezrealitky
curl -X POST http://localhost:8104/scrape   # Reality
curl -X POST http://localhost:8105/scrape   # IDNES Reality
curl -X POST http://localhost:8106/scrape   # Realingo
curl -X POST http://localhost:8107/scrape   # Ulovdomov
curl -X POST http://localhost:8108/scrape   # Bazos
curl -X POST http://localhost:8109/scrape   # CeskeReality

# Check active scrape runs
docker exec landomo-postgres psql -U landomo -d landomo_czech -c \
  "SELECT source_platform, status, started_at FROM scrape_runs WHERE status='running' ORDER BY started_at DESC;"
```

---

## 10. Contacts and Escalation

| Issue | First Response | Escalation |
|-------|---------------|------------|
| Scraper down | Check logs, restart container | Review portal for changes |
| Database full | Prune, archive old data | Expand disk / add replica |
| All services down | `$DC up -d`, check VPS | Contact Hostinger support |
| Data quality issues | Check `data-quality-checker` logs | Review transformer logic |
| VPS unreachable | Check Hostinger panel | Hostinger support ticket |
