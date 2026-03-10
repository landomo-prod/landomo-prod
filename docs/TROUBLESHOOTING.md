# Troubleshooting Guide

Common issues and solutions for Landomo services.

## Quick Diagnostics

```bash
# Check all services
pm2 status

# Check Docker containers
docker ps

# Check database connectivity
psql -U landomo -d landomo_czech_republic -c "SELECT COUNT(*) FROM properties_new;"

# Check Redis connectivity
redis-cli ping

# Check disk space
df -h

# Check memory usage
free -h
```

## Scraper Issues

### Frame Detachment Errors

**Symptoms**: `Execution context was destroyed` or `Target closed`

**Solution** (30 min):
```bash
cd scrapers/Czech\ Republic/your-scraper
npm install puppeteer-extra puppeteer-extra-plugin-stealth

# Update scraper code
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
puppeteer.use(StealthPlugin());
```

### Architecture Changes

**Symptoms**: Scraper returns empty results or wrong data

**Solution** (1-3 hours):
1. Inspect website in browser DevTools
2. Update selectors in scraper
3. Test with single listing
4. Deploy updated scraper

### Compressed Response Data

**Symptoms**: Binary data instead of JSON

**Solution** (1 hour):
```typescript
import lzstring from 'lz-string';
import pako from 'pako';

// For LZ-string compression
const decompressed = lzstring.decompressFromBase64(data);

// For gzip compression
const decompressed = pako.inflate(data, { to: 'string' });
```

### Cloudflare Protection

**Symptoms**: 403 Forbidden, "Checking your browser"

**Solution** (2 hours):
1. Use bypass service (FlareSolverr)
2. Rotate user agents
3. Add delays between requests
4. Use residential proxies

### Rate Limiting

**Symptoms**: 429 Too Many Requests

**Solution** (30 min):
```typescript
// Add delays
await new Page().waitForTimeout(2000);

// Implement exponential backoff
let delay = 1000;
for (let retry = 0; retry < 5; retry++) {
  try {
    await scrape();
    break;
  } catch (error) {
    if (error.status === 429) {
      await wait(delay);
      delay *= 2;
    }
  }
}
```

## Category Type Issues

### Missing property_category

**Error**: `null value in column "property_category" violates not-null constraint`

**Solution**:
```typescript
// ✅ Good: Include property_category
const apartment: ApartmentPropertyTierI = {
  property_category: 'apartment', // REQUIRED
  bedrooms: 2,
  // ...
};

// ❌ Bad: Missing property_category
const property = {
  bedrooms: 2,
  // property_category missing!
};
```

### Wrong TierI Type

**Error**: Type mismatch errors in transformers

**Solution**:
```typescript
// ✅ Good: Correct category type
import { ApartmentPropertyTierI } from '@landomo/core';
const apartment: ApartmentPropertyTierI = { /* ... */ };

// ❌ Bad: Wrong category type
import { HousePropertyTierI } from '@landomo/core';
const apartment: HousePropertyTierI = { /* ... */ }; // Type error!
```

### Missing Required Fields

**Error**: `null value in column "apt_bedrooms" violates not-null constraint`

**Solution**:
```typescript
// Check category requirements:
// - Apartment: bedrooms, sqm, has_elevator/balcony/parking/basement
// - House: bedrooms, sqm_living, sqm_plot, has_garden/garage/parking/basement
// - Land: area_plot_sqm
// - Commercial: sqm_total, has_elevator/parking/bathrooms

const apartment: ApartmentPropertyTierI = {
  property_category: 'apartment',
  bedrooms: 2,           // REQUIRED
  sqm: 65,               // REQUIRED
  has_elevator: true,    // REQUIRED
  has_balcony: true,     // REQUIRED
  has_parking: false,    // REQUIRED
  has_basement: true,    // REQUIRED
  // ...
};
```

## Database Issues

### apt_bedrooms Column Missing

**Error**: `column "apt_bedrooms" does not exist`

**Solution**:
```bash
# Apply migration 013
psql -U landomo -d landomo_czech_republic \
  -f ingest-service/migrations/013_category_partitioning.sql
```

### Invalid Category Value

**Error**: `new row for relation "properties_new" violates check constraint`

**Solution**:
```typescript
// Use singular form
property_category: 'apartment' // ✅ Correct
property_category: 'apartments' // ❌ Wrong
```

### Slow Queries

**Symptoms**: Queries taking >1 second

**Solution**:
```sql
-- ✅ FAST: Include property_category and status
SELECT * FROM properties_new
WHERE property_category = 'apartment'
  AND status = 'active'
  AND city = 'Prague';

-- ❌ SLOW: Missing partition key
SELECT * FROM properties_new
WHERE city = 'Prague';

-- Check query plan
EXPLAIN ANALYZE SELECT ...;
```

## Redis Issues

### Cannot Connect to Redis

**Symptoms**: `ECONNREFUSED 127.0.0.1:6379`

**Solution**:
```bash
# Check if Redis is running
sudo systemctl status redis-server

# Start Redis
sudo systemctl start redis-server

# Test connection
redis-cli ping
# Should return: PONG
```

### Queue Not Processing

**Symptoms**: Jobs stuck in queue, worker idle

**Solution**:
```bash
# Check queue length
redis-cli LLEN bull:ingest-property:wait

# Check if worker is running
ps aux | grep start-worker

# Restart worker
pm2 restart worker-czech

# Clear stuck jobs (careful!)
redis-cli DEL bull:ingest-property:wait
```

### Redis Out of Memory

**Symptoms**: `OOM command not allowed when used memory > 'maxmemory'`

**Solution**:
```bash
# Check memory usage
redis-cli INFO memory

# Increase maxmemory
sudo nano /etc/redis/redis.conf
# maxmemory 2gb

# Restart Redis
sudo systemctl restart redis-server

# Set eviction policy
redis-cli CONFIG SET maxmemory-policy allkeys-lru
```

## PostgreSQL Issues

### Database Does Not Exist

**Error**: `database "landomo_czech_republic" does not exist`

**Solution**:
```bash
# Create database
sudo -u postgres psql
CREATE DATABASE landomo_czech_republic OWNER landomo;
GRANT ALL PRIVILEGES ON DATABASE landomo_czech_republic TO landomo;
\q

# Apply schema
psql -U landomo -d landomo_czech_republic < docker/postgres/init-schema.sql
```

### Connection Pool Exhausted

**Symptoms**: `remaining connection slots are reserved`

**Solution**:
```bash
# Check active connections
psql -U landomo -d landomo_czech_republic -c "
  SELECT count(*) FROM pg_stat_activity
  WHERE datname = 'landomo_czech_republic';
"

# Increase max_connections
sudo nano /etc/postgresql/16/main/postgresql.conf
# max_connections = 200

# Restart PostgreSQL
sudo systemctl restart postgresql

# Adjust pool size in application
# .env: DB_MAX_CONNECTIONS=20
```

### Disk Full

**Symptoms**: `could not extend file ... No space left on device`

**Solution**:
```bash
# Check disk usage
df -h

# Find large tables
psql -U landomo -d landomo_czech_republic -c "
  SELECT
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
  FROM pg_tables
  WHERE schemaname = 'public'
  ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
  LIMIT 10;
"

# Vacuum old data
VACUUM FULL;

# Archive old data
-- Export old removed/sold/rented listings
-- Delete from production DB
```

## Worker Issues

### Worker Not Starting

**Symptoms**: Worker crashes immediately

**Solution**:
```bash
# Check logs
pm2 logs worker-czech

# Common causes:
# 1. Missing environment variables
cat .env

# 2. Database connection failure
psql -U landomo -d landomo_czech_republic -c "SELECT 1;"

# 3. Redis connection failure
redis-cli ping

# 4. TypeScript compilation errors
cd ingest-service
npm run build
```

### Worker Processing Slowly

**Symptoms**: Queue building up, worker slow

**Solution**:
```bash
# Scale workers
pm2 start dist/start-worker.js --name worker-czech-2 -i 2

# Or with Docker
docker compose up -d --scale worker=5

# Check database performance
EXPLAIN ANALYZE SELECT * FROM properties_new WHERE ...;

# Check CPU/memory
htop
```

## API Issues

### 401 Unauthorized

**Symptoms**: `Invalid API key`

**Solution**:
```bash
# Check API key in request
curl -H "Authorization: Bearer YOUR_KEY" ...

# Check API key in environment
cat .env | grep API_KEYS

# Restart service after key update
pm2 restart ingest-czech
```

### 500 Internal Server Error

**Symptoms**: Requests failing, no specific error

**Solution**:
```bash
# Check service logs
pm2 logs ingest-czech

# Check database logs
sudo tail -f /var/log/postgresql/postgresql-16-main.log

# Check system resources
free -h
df -h
```

## Migration Issues

### Migration Already Applied

**Error**: `relation "properties_new" already exists`

**Solution**:
```bash
# Skip migration
echo "Migration already applied, skipping..."

# Or use migration tracking table
CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  applied_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Migration Failed Midway

**Symptoms**: Partial schema changes

**Solution**:
```bash
# Rollback manually
psql -U landomo -d landomo_czech_republic

# Drop created tables
DROP TABLE IF EXISTS properties_apartment CASCADE;
DROP TABLE IF EXISTS properties_house CASCADE;
DROP TABLE IF EXISTS properties_new CASCADE;

# Re-apply migration
\i ingest-service/migrations/013_category_partitioning.sql
```

## Performance Issues

### High CPU Usage

**Symptoms**: CPU at 100%, service slow

**Solution**:
```bash
# Check processes
htop

# Identify slow queries
SELECT * FROM pg_stat_activity WHERE state = 'active';

# Add missing indexes
CREATE INDEX idx_name ON table(column) WHERE condition;

# Scale workers
pm2 scale worker-czech +2
```

### High Memory Usage

**Symptoms**: OOM killer, service crashes

**Solution**:
```bash
# Check memory
free -h

# Reduce worker concurrency
# worker config: concurrency: 3 (down from 5)

# Reduce database pool size
# .env: DB_MAX_CONNECTIONS=10 (down from 20)

# Add swap space
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
```

## Testing in Docker

### macOS Puppeteer Issues

**Symptoms**: Scraper works on Linux, fails on macOS

**Solution**:
```bash
# ALWAYS test scrapers in Docker on macOS
docker build -t scraper-test .
docker run --rm scraper-test npm test

# Never rely on macOS native Puppeteer
```

## Getting Help

1. **Check logs first**: `pm2 logs` or `docker compose logs`
2. **Search documentation**: `/docs/*.md`
3. **Check migrations**: `ingest-service/migrations/`
4. **Verify state**: Database, Redis, disk space
5. **Create issue**: GitHub with logs and reproduction steps

---

**Last Updated**: 2026-02-16
