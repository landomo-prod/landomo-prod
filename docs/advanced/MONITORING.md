# Monitoring Guide

Monitoring and observability for Landomo services.

## Health Checks

```bash
curl http://localhost:3000/health  # Ingest
curl http://localhost:4000/health  # Search
curl http://localhost:4300/health  # Polygon
curl http://localhost:3500/health  # ML Pricing
```

## Service Monitoring

```bash
# PM2
pm2 status
pm2 monit
pm2 logs ingest-czech

# Docker
docker ps
docker stats
docker compose logs -f
```

## Database Monitoring

```sql
-- Active connections
SELECT datname, count(*) FROM pg_stat_activity
WHERE datname LIKE 'landomo_%' GROUP BY datname;

-- Slow queries
SELECT query, mean_time FROM pg_stat_statements
WHERE mean_time > 100 ORDER BY mean_time DESC LIMIT 20;

-- Table sizes
SELECT tablename, pg_size_pretty(pg_total_relation_size(tablename))
FROM pg_tables WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(tablename) DESC;
```

## Redis Monitoring

```bash
redis-cli INFO memory
redis-cli LLEN bull:ingest-property:wait
```

---

**Last Updated**: 2026-02-16
