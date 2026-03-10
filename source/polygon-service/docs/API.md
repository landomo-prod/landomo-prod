# Polygon Service API Reference

Base URL: `http://localhost:3100`

All endpoints except health checks require `X-API-Key` header.

## Health

### GET /health

Basic health check (no auth required).

**Response:**
```json
{
  "status": "ok",
  "service": "polygon-service",
  "timestamp": "2026-02-23T10:00:00.000Z"
}
```

### GET /api/v1/health

Detailed health check with database status (no auth required).

**Response (200 or 503):**
```json
{
  "status": "ok",
  "service": "polygon-service",
  "version": "1.0.0",
  "timestamp": "2026-02-23T10:00:00.000Z",
  "checks": {
    "database": "ok",
    "redis": "ok"
  },
  "config": {
    "database": "landomo_geocoding",
    "port": 3100
  }
}
```

## Boundaries

### GET /api/v1/boundaries/:relationId

Get a boundary by OSM relation ID. Results are cached in Redis.

**Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `relationId` | path, integer | OSM relation ID |

**Response (200):**
```json
{
  "data": {
    "id": "uuid-here",
    "relationId": 51684,
    "name": "Prague",
    "adminLevel": 6,
    "parentRelationId": null,
    "geometry": {
      "type": "Polygon",
      "coordinates": [[[14.22, 50.0], [14.71, 50.0], ...]]
    },
    "tags": { "admin_level": "6", "boundary": "administrative", "name": "Praha" },
    "names": { "name": "Praha", "name:en": "Prague", "name:de": "Prag" }
  },
  "cached": false
}
```

**Errors:**
- `400` - Invalid relation ID
- `404` - Boundary not found

### GET /api/v1/boundaries/search

Search boundaries by name using trigram fuzzy matching (similarity threshold > 0.3).

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `name` | string | yes | Search query |
| `adminLevel` | integer | no | Filter by admin level |
| `limit` | integer | no | Max results (default: 10) |

**Example:**
```
GET /api/v1/boundaries/search?name=Prague&adminLevel=6&limit=5
```

**Response (200):**
```json
{
  "data": [
    {
      "id": "uuid-here",
      "relationId": 51684,
      "name": "Praha",
      "adminLevel": 6,
      "parentRelationId": null,
      "geometry": { "type": "Polygon", "coordinates": [...] },
      "tags": { ... },
      "names": { "name": "Praha", "name:en": "Prague" }
    }
  ],
  "cached": false
}
```

### POST /api/v1/boundaries/point-in-polygon

Find all administrative boundaries containing a given point. Uses PostGIS `ST_Contains` for spatial queries.

**Request Body:**
```json
{
  "lat": 50.0755,
  "lon": 14.4378,
  "adminLevel": 8
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `lat` | number | yes | Latitude (-90 to 90) |
| `lon` | number | yes | Longitude (-180 to 180) |
| `adminLevel` | number | no | Filter to specific admin level |

**Response (200):**
```json
{
  "data": [
    {
      "id": "uuid-here",
      "relationId": 435514,
      "name": "Praha 1",
      "adminLevel": 10,
      "parentRelationId": null,
      "geometry": { "type": "Polygon", "coordinates": [...] },
      "tags": { ... },
      "names": { ... }
    },
    {
      "id": "uuid-here",
      "relationId": 51684,
      "name": "Praha",
      "adminLevel": 6,
      "parentRelationId": null,
      "geometry": { ... },
      "tags": { ... },
      "names": { ... }
    }
  ],
  "cached": false
}
```

Results are ordered by `admin_level DESC` (most specific first). Cached in Redis with coordinate precision rounded to 6 decimal places (~11cm).

### GET /api/v1/boundaries/stats

Get database and cache statistics.

**Response (200):**
```json
{
  "database": {
    "total_areas": 6300,
    "admin_levels": 6,
    "min_admin_level": 2,
    "max_admin_level": 10,
    "total_countries": 1
  },
  "cache": {
    "keys": 142,
    "memory": "1.5M"
  }
}
```

### DELETE /api/v1/boundaries/cache

Clear all polygon cache entries from Redis.

**Response (200):**
```json
{
  "message": "Cache cleared successfully"
}
```

## Sync

### POST /api/v1/sync/overpass

Trigger Overpass API boundary sync for a country. See [OSM_SYNC.md](./OSM_SYNC.md) for details.

**Request Body:**
```json
{
  "countryCode": "CZ",
  "adminLevels": [2, 4, 6, 8, 9, 10],
  "skipRecent": true,
  "force": false
}
```

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `countryCode` | string | yes | - | ISO 3166-1 alpha-2 code |
| `adminLevels` | number[] | no | `[2,4,6,8,9,10]` | Admin levels to sync |
| `skipRecent` | boolean | no | `true` | Skip areas updated within last month |
| `force` | boolean | no | `false` | Override skipRecent |

**Response (200):**
```json
{
  "success": true,
  "countryCode": "CZ",
  "areasProcessed": 6350,
  "areasCreated": 6300,
  "areasUpdated": 0,
  "areasSkipped": 50,
  "errors": [],
  "durationMs": 180000
}
```

### GET /api/v1/sync/status

Get current sync status.

**Response (200):**
```json
{
  "active": false,
  "message": "No active sync jobs"
}
```
