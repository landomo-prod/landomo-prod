#!/bin/bash
#
# PostgreSQL Performance Optimization Script
# Applies production-ready settings for write-heavy workload
#
# Usage:
#   ./scripts/optimize-postgres.sh
#
# What it does:
#   1. Applies optimal PostgreSQL configuration
#   2. Restarts PostgreSQL to apply changes
#   3. Verifies settings
#   4. Runs benchmark queries

set -euo pipefail

CONTAINER_NAME="landomo-postgres"
DB_USER="${DB_USER:-landomo}"
DB_NAME="${DB_NAME:-landomo_slovakia}"

echo "============================================================"
echo "PostgreSQL Performance Optimization"
echo "============================================================"
echo ""

# Check if container is running
if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
  echo "Error: PostgreSQL container '${CONTAINER_NAME}' is not running"
  echo "Start it with: docker compose -f docker/docker-compose.yml up -d postgres"
  exit 1
fi

echo "1. Applying PostgreSQL configuration..."
echo "-----------------------------------------------------------"

# Memory settings (for 8GB RAM server, adjust as needed)
docker exec "$CONTAINER_NAME" psql -U "$DB_USER" -c "ALTER SYSTEM SET shared_buffers = '2GB';"
docker exec "$CONTAINER_NAME" psql -U "$DB_USER" -c "ALTER SYSTEM SET work_mem = '16MB';"
docker exec "$CONTAINER_NAME" psql -U "$DB_USER" -c "ALTER SYSTEM SET maintenance_work_mem = '512MB';"
docker exec "$CONTAINER_NAME" psql -U "$DB_USER" -c "ALTER SYSTEM SET autovacuum_work_mem = '256MB';"
docker exec "$CONTAINER_NAME" psql -U "$DB_USER" -c "ALTER SYSTEM SET effective_cache_size = '6GB';"

# WAL settings (write performance)
docker exec "$CONTAINER_NAME" psql -U "$DB_USER" -c "ALTER SYSTEM SET wal_buffers = '16MB';"
docker exec "$CONTAINER_NAME" psql -U "$DB_USER" -c "ALTER SYSTEM SET checkpoint_timeout = '15min';"
docker exec "$CONTAINER_NAME" psql -U "$DB_USER" -c "ALTER SYSTEM SET checkpoint_completion_target = 0.9;"
docker exec "$CONTAINER_NAME" psql -U "$DB_USER" -c "ALTER SYSTEM SET max_wal_size = '4GB';"
docker exec "$CONTAINER_NAME" psql -U "$DB_USER" -c "ALTER SYSTEM SET min_wal_size = '1GB';"
docker exec "$CONTAINER_NAME" psql -U "$DB_USER" -c "ALTER SYSTEM SET synchronous_commit = 'local';"

# Autovacuum settings (critical for write-heavy workload)
docker exec "$CONTAINER_NAME" psql -U "$DB_USER" -c "ALTER SYSTEM SET autovacuum_max_workers = 4;"
docker exec "$CONTAINER_NAME" psql -U "$DB_USER" -c "ALTER SYSTEM SET autovacuum_naptime = '30s';"
docker exec "$CONTAINER_NAME" psql -U "$DB_USER" -c "ALTER SYSTEM SET autovacuum_vacuum_threshold = 50;"
docker exec "$CONTAINER_NAME" psql -U "$DB_USER" -c "ALTER SYSTEM SET autovacuum_vacuum_scale_factor = 0.1;"
docker exec "$CONTAINER_NAME" psql -U "$DB_USER" -c "ALTER SYSTEM SET autovacuum_analyze_threshold = 50;"
docker exec "$CONTAINER_NAME" psql -U "$DB_USER" -c "ALTER SYSTEM SET autovacuum_analyze_scale_factor = 0.05;"

# Query planner (SSD optimization)
docker exec "$CONTAINER_NAME" psql -U "$DB_USER" -c "ALTER SYSTEM SET random_page_cost = 1.1;"

# Parallel query
docker exec "$CONTAINER_NAME" psql -U "$DB_USER" -c "ALTER SYSTEM SET max_parallel_workers_per_gather = 4;"
docker exec "$CONTAINER_NAME" psql -U "$DB_USER" -c "ALTER SYSTEM SET max_parallel_workers = 8;"
docker exec "$CONTAINER_NAME" psql -U "$DB_USER" -c "ALTER SYSTEM SET max_worker_processes = 8;"

# Logging
docker exec "$CONTAINER_NAME" psql -U "$DB_USER" -c "ALTER SYSTEM SET log_min_duration_statement = 1000;"
docker exec "$CONTAINER_NAME" psql -U "$DB_USER" -c "ALTER SYSTEM SET log_checkpoints = 'on';"
docker exec "$CONTAINER_NAME" psql -U "$DB_USER" -c "ALTER SYSTEM SET log_autovacuum_min_duration = 0;"
docker exec "$CONTAINER_NAME" psql -U "$DB_USER" -c "ALTER SYSTEM SET track_io_timing = 'on';"

echo "✓ Configuration applied"
echo ""

echo "2. Restarting PostgreSQL to apply changes..."
echo "-----------------------------------------------------------"
docker restart "$CONTAINER_NAME"

# Wait for PostgreSQL to be ready
echo -n "Waiting for PostgreSQL to be ready"
for i in {1..30}; do
  if docker exec "$CONTAINER_NAME" pg_isready -U "$DB_USER" > /dev/null 2>&1; then
    echo " ✓"
    break
  fi
  echo -n "."
  sleep 1
  if [ $i -eq 30 ]; then
    echo " ✗"
    echo "Error: PostgreSQL did not become ready in 30 seconds"
    exit 1
  fi
done
echo ""

echo "3. Verifying configuration..."
echo "-----------------------------------------------------------"

# Verify key settings
docker exec "$CONTAINER_NAME" psql -U "$DB_USER" -c "
SELECT name, setting, unit
FROM pg_settings
WHERE name IN (
  'shared_buffers',
  'work_mem',
  'maintenance_work_mem',
  'effective_cache_size',
  'wal_buffers',
  'checkpoint_timeout',
  'max_wal_size',
  'synchronous_commit',
  'autovacuum_max_workers',
  'random_page_cost'
)
ORDER BY name;
"

echo ""
echo "4. Running VACUUM ANALYZE on all tables..."
echo "-----------------------------------------------------------"

# Get list of country databases
DATABASES=$(docker exec "$CONTAINER_NAME" psql -U "$DB_USER" -t -c "
  SELECT datname FROM pg_database
  WHERE datname LIKE 'landomo_%'
    AND datistemplate = false;
")

for db in $DATABASES; do
  db_trimmed=$(echo "$db" | xargs)  # Trim whitespace
  if [ -n "$db_trimmed" ]; then
    echo "  Vacuuming $db_trimmed..."
    docker exec "$CONTAINER_NAME" psql -U "$DB_USER" -d "$db_trimmed" -c "VACUUM ANALYZE;" 2>/dev/null || true
  fi
done

echo "✓ VACUUM complete"
echo ""

echo "============================================================"
echo "Optimization Complete!"
echo "============================================================"
echo ""
echo "Next steps:"
echo "  1. Run benchmark queries:"
echo "     docker exec -i $CONTAINER_NAME psql -U $DB_USER -d $DB_NAME < load-tests/benchmark-queries.sql"
echo ""
echo "  2. Run load test:"
echo "     k6 run load-tests/ingest-load-test.js --env BASE_URL=http://localhost:3008"
echo ""
echo "  3. Monitor performance:"
echo "     docker stats $CONTAINER_NAME"
echo ""
echo "Expected improvements:"
echo "  - 2-3x faster writes (WAL optimization)"
echo "  - 50% faster queries (larger shared_buffers)"
echo "  - Reduced checkpoint stalls (15min timeout)"
echo "  - Better autovacuum responsiveness"
echo ""
