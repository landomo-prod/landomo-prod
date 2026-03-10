# Scaling Guide

Horizontal and vertical scaling strategies.

## Horizontal Scaling

### Worker Scaling

```bash
# PM2
pm2 start dist/start-worker.js --name worker-2 -i 2

# Docker Compose
docker compose up -d --scale worker=5
```

### API Scaling

```bash
# PM2 cluster mode
pm2 start dist/server.js -i 4

# Nginx load balancing
upstream backend {
    least_conn;
    server 127.0.0.1:3000;
    server 127.0.0.1:3001;
}
```

## Database Scaling

### Read Replicas

```sql
-- Primary
ALTER SYSTEM SET wal_level = replica;
CREATE USER replicator REPLICATION LOGIN PASSWORD 'password';

-- Replica
pg_basebackup -h primary -D /var/lib/postgresql/16/main -U replicator
```

### Connection Pooling

Use PgBouncer for connection pooling:

```bash
# PgBouncer config
[databases]
landomo_czech = host=localhost port=5432 dbname=landomo_czech_republic

[pgbouncer]
listen_addr = 127.0.0.1
listen_port = 6432
auth_type = md5
pool_mode = transaction
max_client_conn = 1000
default_pool_size = 25
```

## Load Testing

```bash
# Apache Bench
ab -n 1000 -c 10 \
  -H "Authorization: Bearer $KEY" \
  -T "application/json" \
  -p payload.json \
  http://localhost:3000/bulk-ingest
```

---

**Last Updated**: 2026-02-16
