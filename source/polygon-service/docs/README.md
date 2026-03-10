# Polygon Service

Administrative boundary polygon service for the Landomo platform. Downloads, stores, and serves OpenStreetMap (OSM) administrative boundaries using PostGIS.

## Overview

The polygon service provides:

- **Boundary storage**: PostGIS-backed storage of OSM administrative boundaries (countries, regions, districts, municipalities)
- **Point-in-polygon queries**: Given coordinates, find all containing administrative boundaries
- **Boundary search**: Fuzzy name search with trigram similarity (`pg_trgm`)
- **OSM sync**: Download boundaries from the Overpass API for any country
- **Redis caching**: Cache lookup results with configurable TTL (default 1 hour)

## Tech Stack

- **Runtime**: Node.js + TypeScript + Fastify
- **Database**: PostgreSQL with PostGIS extension + `pg_trgm`
- **Cache**: Redis (ioredis)
- **Geometry processing**: Turf.js (`@turf/helpers`, `@turf/boolean-within`)
- **Logging**: Pino with `pino-pretty`
- **Port**: 3100 (configurable via `PORT` env var)

## Architecture

```
Overpass API ──sync──► OverpassSyncService ──► PostGIS (boundaries table)
                                                     │
Client ──HTTP──► Fastify Routes ──query──► PostGIS ──┤
                      │                              │
                      └──cache──► Redis ◄────────────┘
```

## Database

Uses a single PostgreSQL database (default: `landomo_geocoding`) with PostGIS and `pg_trgm` extensions. The `boundaries` table stores:

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `osm_relation_id` | BIGINT | OSM relation ID (unique) |
| `osm_type` | VARCHAR | Always `'relation'` |
| `name` | VARCHAR | Primary name |
| `admin_level` | INTEGER | OSM admin level (2=country, 4=region, 6=district, 8=municipality, etc.) |
| `country_code` | VARCHAR | ISO 3166-1 alpha-2 code |
| `geometry_full` | GEOMETRY | PostGIS Polygon/MultiPolygon (SRID 4326) |
| `osm_tags` | JSONB | All OSM tags |
| `names` | JSONB | Name variations (i18n) |
| `boundary_type` | VARCHAR | Boundary type from OSM tags |
| `last_updated_osm` | TIMESTAMPTZ | Last sync timestamp |

### Indexes

- GiST spatial index on `geometry_full` for `ST_Contains` queries
- GIN index on `osm_tags` and `names` for JSONB queries
- GIN trigram index on `name` for fuzzy search
- B-tree indexes on `osm_relation_id`, `admin_level`, `country_code`

## Authentication

All routes except `/health` require an API key via `X-API-Key` header. Keys are configured via `API_KEYS` env var (comma-separated) or Docker secret `/run/secrets/api_keys`.

## Quick Start

```bash
# Start dependencies
docker compose -f docker/docker-compose.yml up -d postgres redis

# Configure
export DB_HOST=localhost DB_NAME=landomo_geocoding API_KEYS=dev_key_1

# Run
cd polygon-service && npm run dev

# Sync boundaries for Czech Republic
curl -X POST http://localhost:3100/api/v1/sync/overpass \
  -H "X-API-Key: dev_key_1" \
  -H "Content-Type: application/json" \
  -d '{"countryCode": "CZ"}'
```

## Related Documentation

- [API Reference](./API.md)
- [OSM Sync](./OSM_SYNC.md)
- [Configuration](./CONFIGURATION.md)
