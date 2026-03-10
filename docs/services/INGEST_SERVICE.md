# Ingest Service

Property data ingestion service (per-country deployment).

## Overview

**Port**: 3000 (per-country)  
**Technology**: Fastify + TypeScript + BullMQ + PostgreSQL  
**Deployment**: One instance per country

The Ingest Service receives property data from scrapers, validates it, queues it for processing, and stores it in country-specific PostgreSQL databases using category-partitioned tables.

## Architecture

```
Scraper → POST /bulk-ingest → Redis Queue → Worker → PostgreSQL (category-partitioned)
```

## Quick Start

```bash
cd ingest-service
npm install
npm run build

# Terminal 1: API Server
npm run dev

# Terminal 2: Worker
npm run dev:worker
```

## Key Features

- **Bulk Ingestion**: Process 100-1000 properties per request
- **Category Partitioning**: Automatic routing to apartment/house/land/commercial partitions
- **Async Processing**: Non-blocking with BullMQ job queue
- **Terminal Status Protection**: Sold/rented properties never overwritten
- **Change Tracking**: Full audit trail in property_changes
- **Staleness Detection**: Automatic status updates for missing listings

## API Endpoints

See `/docs/API_REFERENCE.md#ingest-service-api`

- `POST /bulk-ingest` - Ingest multiple properties
- `POST /scrape-runs/start` - Start run tracking
- `POST /scrape-runs/complete` - Complete run
- `GET /health` - Health check

## Configuration

```bash
# .env
PORT=3000
DB_HOST=localhost
DB_PORT=5432
DB_USER=landomo
DB_PASSWORD=your_password
REDIS_HOST=localhost
REDIS_PORT=6379
API_KEYS=key1,key2
BATCH_SIZE=100
BATCH_WORKERS=5
STALENESS_THRESHOLD_HOURS=72
```

## Category-Specific UPSERT

```typescript
// Apartment example
INSERT INTO properties_new (
  property_category, portal, portal_id, title, price,
  apt_bedrooms, apt_sqm, apt_has_elevator, ...
) VALUES ('apartment', 'sreality', '12345', ...)
ON CONFLICT (portal, portal_id, property_category)
DO UPDATE SET
  status = CASE
    WHEN properties_new.status IN ('sold', 'rented')
    THEN properties_new.status
    ELSE 'active'
  END,
  last_seen_at = NOW(),
  ...
```

## Monitoring

```bash
# Service status
pm2 status ingest-czech
pm2 logs ingest-czech

# Queue status
redis-cli LLEN bull:ingest-property-czech_republic:wait

# Database check
psql -U landomo -d landomo_czech_republic -c "
  SELECT portal, COUNT(*), MAX(last_seen_at)
  FROM properties_new
  GROUP BY portal;
"
```

## Related Documentation

- **API Reference**: `/docs/API_REFERENCE.md`
- **Data Model**: `/docs/DATA_MODEL.md`
- **Deployment**: `/docs/DEPLOYMENT.md`

---

**Last Updated**: 2026-02-16
