# Polygon Service

Administrative boundary polygon service with OpenStreetMap Overpass sync, PostgreSQL/PostGIS storage, Redis caching, and Fastify API.

## Features

- **Overpass Sync**: Downloads OSM administrative boundaries (countries, states, regions, municipalities)
- **PostgreSQL/PostGIS**: Stores polygons with spatial indexes for fast geometric queries
- **Redis Cache**: Caches area lookups and point-in-polygon results
- **Fastify API**: Fast, schema-based REST API
- **Hierarchy Support**: Parent-child relationships based on admin_level

## Architecture

```
Overpass API → OverpassSyncService → PostgreSQL/PostGIS
                                    ↓
                                  Redis Cache
                                    ↓
                              Fastify API
```

## Installation

```bash
npm install
```

## Configuration

Copy `.env.example` to `.env` and configure:

```env
# Server
PORT=3100
HOST=0.0.0.0

# Database
DB_HOST=localhost
DB_PORT=5432
DB_USER=landomo
DB_PASSWORD=your_password
DB_NAME=landomo_geocoding

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
CACHE_TTL_SECONDS=3600

# API Keys
API_KEYS=dev_key_polygon_1,prod_key_xyz

# Overpass API
OVERPASS_API_URL=https://overpass-api.de/api/interpreter
OVERPASS_TIMEOUT=6000
```

## Database Setup

1. Create PostgreSQL database with PostGIS:

```bash
createdb landomo_geocoding
psql landomo_geocoding -c "CREATE EXTENSION postgis;"
psql landomo_geocoding -c "CREATE EXTENSION pg_trgm;"
```

2. Initialize schema:

```bash
psql landomo_geocoding < src/database/schema.sql
```

## Usage

### Development

```bash
npm run dev
```

### Production

```bash
npm run build
npm start
```

### Sync Overpass Data

Sync Czech Republic boundaries (default):

```bash
npm run sync:overpass
```

Sync specific country:

```bash
SYNC_COUNTRY=SK npm run sync:overpass
```

Sync specific admin levels:

```bash
SYNC_ADMIN_LEVELS=2,3,4,6,8 npm run sync:overpass
```

Force re-sync (skip recently updated check):

```bash
SYNC_SKIP_RECENT=false npm run sync:overpass
```

## API Endpoints

All endpoints require `X-API-Key` header (except health checks).

### Health

```bash
# Basic health
GET /health

# Detailed health with DB status
GET /api/v1/health
```

### Boundaries

```bash
# Get boundary by OSM relation ID
GET /api/v1/boundaries/:relationId

# Search boundaries by name
GET /api/v1/boundaries/search?name=Prague&adminLevel=8&limit=10

# Point-in-polygon query
POST /api/v1/boundaries/point-in-polygon
{
  "lat": 50.0755,
  "lon": 14.4378,
  "adminLevel": 8
}

# Get stats
GET /api/v1/boundaries/stats

# Clear cache (admin)
DELETE /api/v1/boundaries/cache
```

### Example Requests

```bash
# Get Prague boundary
curl -H "X-API-Key: dev_key_polygon_1" \
  http://localhost:3100/api/v1/boundaries/435514

# Search for Prague
curl -H "X-API-Key: dev_key_polygon_1" \
  "http://localhost:3100/api/v1/boundaries/search?name=Prague&adminLevel=8"

# Find which areas contain a point
curl -H "X-API-Key: dev_key_polygon_1" \
  -H "Content-Type: application/json" \
  -d '{"lat": 50.0755, "lon": 14.4378}' \
  http://localhost:3100/api/v1/boundaries/point-in-polygon
```

## Admin Levels

OSM admin_level values:

- `2` - Country
- `3` - State/Province (e.g., Bohemia)
- `4` - Region (e.g., Prague Region)
- `5` - Subregion
- `6` - District
- `7` - Subdistrict
- `8` - Municipality (e.g., Prague)
- `9` - City district
- `10` - Neighborhood
- `11` - Block
- `12` - Subblock

## Docker

```bash
# Build
docker build -t polygon-service .

# Run
docker run -d \
  -p 3100:3100 \
  -e DB_HOST=postgres \
  -e REDIS_HOST=redis \
  -e API_KEYS=your_key \
  --name polygon-service \
  polygon-service
```

## Performance

- **Database**: PostGIS spatial indexes (GIST) for fast geometric queries
- **Cache**: Redis with configurable TTL (default 1 hour)
- **Query optimization**: Fuzzy name search with trigram indexes
- **Batch sync**: Skips recently updated areas (last 30 days) to reduce API load

## Caching Strategy

- **Area by ID**: Cached indefinitely (1 hour TTL)
- **Area by name**: Cached for exact matches
- **Point-in-polygon**: Cached with 6 decimal precision (~11cm)
- **Cache invalidation**: Manual via API or automatic on sync

## Migration from MongoDB

This service replaces the old MongoDB-based `SyncAreasService`. Key changes:

- **Storage**: MongoDB → PostgreSQL/PostGIS
- **Geometry**: GeoJSON in JSONB → PostGIS GEOMETRY (MULTIPOLYGON, 4326)
- **Queries**: MongoDB `$geoWithin` → PostGIS `ST_Contains`
- **Indexes**: MongoDB 2dsphere → PostGIS GIST spatial index
- **Cache**: None → Redis with configurable TTL
- **API**: None → Fastify REST API with authentication

## License

UNLICENSED
