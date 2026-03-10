# API Reference

All endpoints are prefixed with `/api/v1` unless otherwise noted.

## Response Headers

Every response includes:

| Header | Description |
|--------|-------------|
| `X-Request-ID` | Unique request correlation ID |
| `API-Version` | Current API version |
| `X-RateLimit-Limit` | Max requests per window |
| `X-RateLimit-Remaining` | Remaining requests |
| `X-RateLimit-Reset` | Window reset epoch (seconds) |

## Rate Limits

| Endpoint | Limit |
|----------|-------|
| `POST /api/v1/search` | 60 req/min per IP |
| `POST /api/v1/search/geo` | 30 req/min per IP |
| All other endpoints | 120 req/min per IP |

Rate limiting uses a Redis sorted-set sliding window. Returns `429 Too Many Requests` with `Retry-After` header when exceeded. Fails open if Redis is unavailable.

---

## Search

### POST /api/v1/search

Main federated property search across all country databases.

**Request Body:**

```json
{
  "countries": ["czech", "uk"],
  "filters": {
    "property_category": "apartment",
    "transaction_type": "sale",
    "price_min": 100000,
    "price_max": 500000,
    "bedrooms_min": 2,
    "sqm_min": 50,
    "city": "Prague",
    "has_parking": true,
    "search_query": "balcony view"
  },
  "sort_by": "price_asc",
  "page": 1,
  "limit": 20
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `countries` | `string[]` | No | Country codes to search. `["*"]` or omit for all. |
| `filters` | `object` | **Yes** | Search filters (see below) |
| `sort` | `object` | No | `{ field, order }` - explicit sort |
| `sort_by` | `string` | No | Sort preset: `price_asc`, `price_desc`, `date_newest`, `date_oldest`. Overrides `sort`. |
| `page` | `number` | No | Page number (1-based, default: 1) |
| `limit` | `number` | No | Items per page (1-100, default: 20) |
| `pagination` | `object` | No | Legacy: `{ limit, offset }` |

**Filters:**

| Filter | Type | Description |
|--------|------|-------------|
| `property_category` | `string` | `apartment`, `house`, `land`, `commercial` (enables partition pruning) |
| `property_type` | `string` | Property type |
| `transaction_type` | `string` | `sale`, `rent` |
| `price_min` / `price_max` | `number` | Price range |
| `bedrooms` | `number` | Exact bedroom count |
| `bedrooms_min` / `bedrooms_max` | `number` | Bedroom range |
| `bathrooms_min` | `number` | Minimum bathrooms |
| `sqm_min` / `sqm_max` | `number` | Square meter range |
| `city` | `string` | City name |
| `region` | `string` | Region name |
| `country` | `string` | Country code |
| `has_parking` | `boolean` | Parking available |
| `has_garden` | `boolean` | Garden available |
| `has_pool` | `boolean` | Pool available |
| `has_balcony` | `boolean` | Balcony available |
| `has_terrace` | `boolean` | Terrace available |
| `has_elevator` | `boolean` | Elevator available |
| `has_garage` | `boolean` | Garage available |
| `portal` | `string` | Source portal (e.g., `sreality`, `rightmove`) |
| `portal_features` | `string[]` | Required features (e.g., `["3d_tour", "video"]`) |
| `search_query` | `string` | Full-text search in title + description (ILIKE) |
| `disposition` | `string` | Czech: room layout (e.g., `2+kk`) |
| `ownership` | `string` | Czech: ownership type |
| `building_type` | `string` | Czech: building type |
| `condition` | `string` | Czech: property condition |
| `tenure` | `string` | UK: tenure type |
| `council_tax_band` | `string` | UK: council tax band |
| `epc_rating` | `string\|string[]` | UK: EPC rating(s) |
| `mls_number` | `string` | USA: MLS number |

**Sort Fields:** `price`, `created_at`, `updated_at`, `sqm`, `bedrooms`, `bathrooms`, `city`, `uk_council_tax_band`, `uk_epc_rating`, `uk_leasehold_years_remaining`, `usa_hoa_fees_monthly`, `australia_land_size_sqm`

**Response (200):**

```json
{
  "total": 1542,
  "results": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "portal": "sreality",
      "portal_id": "123456",
      "title": "2+kk apartment in Prague 5",
      "price": 4500000,
      "currency": "CZK",
      "property_type": "apartment",
      "transaction_type": "sale",
      "property_category": "apartment",
      "city": "Prague",
      "region": "Prague",
      "country": "czech",
      "bedrooms": 1,
      "bathrooms": 1,
      "sqm": 55,
      "latitude": 50.0755,
      "longitude": 14.4378,
      "images": ["https://..."],
      "created_at": "2026-02-20T10:00:00Z",
      "has_parking": true,
      "has_balcony": false,
      "source_url": "https://sreality.cz/...",
      "czech_disposition": "2+kk",
      "disposition_description": "2 rooms with kitchenette",
      "price_formatted": "4 500 000 Kc",
      "country_name": "Czech Republic"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 1542,
    "totalPages": 78,
    "hasNext": true,
    "hasPrev": false
  },
  "aggregations": {
    "by_country": { "czech": 1200, "uk": 342 },
    "by_property_type": { "apartment": 900, "house": 642 },
    "by_transaction_type": { "sale": 1542 },
    "price_range": { "min": 100000, "max": 499000, "avg": 285000 },
    "total_results": 1542
  },
  "query_time_ms": 45,
  "countries_queried": ["czech", "uk"]
}
```

**Error (400):**

```json
{
  "error": "Invalid search request",
  "errors": ["price_min must be less than or equal to price_max"]
}
```

---

### POST /api/v1/search/geo

Geographic radius search using PostGIS KNN index.

**Request Body:**

```json
{
  "latitude": 50.0755,
  "longitude": 14.4378,
  "radius_km": 5,
  "countries": ["czech"],
  "filters": {
    "property_type": "apartment",
    "price_max": 5000000
  },
  "limit": 20,
  "page": 1,
  "sort_by": "price_asc"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `latitude` | `number` | **Yes** | Center latitude (-90 to 90) |
| `longitude` | `number` | **Yes** | Center longitude (-180 to 180) |
| `radius_km` | `number` | No | Search radius in km (default: 10, max: 100) |
| `countries` | `string[]` | No | Countries to search (default: all) |
| `filters` | `object` | No | Additional search filters |
| `limit` | `number` | No | Items per page (default: 20, max: 100) |
| `page` | `number` | No | Page number (1-based, default: 1) |
| `sort_by` | `string` | No | Sort preset. Default: sort by distance. |

**Response (200):**

```json
{
  "center": { "latitude": 50.0755, "longitude": 14.4378 },
  "radius_km": 5,
  "total": 87,
  "results": [
    {
      "id": "...",
      "title": "...",
      "price": 3200000,
      "distance_km": 0.45,
      "distance_formatted": "0.45 km",
      "latitude": 50.078,
      "longitude": 14.441
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 87,
    "totalPages": 5,
    "hasNext": true,
    "hasPrev": false
  },
  "query_time_ms": 32
}
```

---

## Property Detail

### GET /api/v1/properties/:id

Get a single property by UUID.

| Parameter | Location | Type | Required | Description |
|-----------|----------|------|----------|-------------|
| `id` | path | `string (uuid)` | **Yes** | Property UUID |
| `country` | query | `string` | **Yes** | Country code |

Supports `ETag` / `If-None-Match` for conditional requests (returns `304 Not Modified`).

**Response (200):**

Full property object with all fields (same shape as search results, plus full description, agent info, portal metadata).

**Response (404):**

```json
{ "error": "Property not found" }
```

---

## Aggregations

### GET /api/v1/aggregations

Faceted aggregation statistics with filter support. Returns property type distribution, price histogram, bedroom distribution, top cities, and portal distribution.

All filter query params mirror the search filters so facets reflect the active query context.

| Parameter | Type | Description |
|-----------|------|-------------|
| `countries` | `string` | Comma-separated country codes or `*` for all |
| `property_type` | `string` | Filter by property type |
| `transaction_type` | `string` | Filter by transaction type |
| `city` | `string` | Filter by city |
| `region` | `string` | Filter by region |
| `price_min` / `price_max` | `number` | Price range filter |
| `bedrooms` / `bedrooms_min` / `bedrooms_max` | `number` | Bedroom filters |
| `bathrooms_min` | `number` | Minimum bathrooms |
| `sqm_min` / `sqm_max` | `number` | Square meter range |
| `has_parking`, `has_garden`, etc. | `boolean` | Amenity filters |
| `portal` | `string` | Portal filter |
| `search_query` | `string` | Text search |

**Response (200):**

```json
{
  "property_types": { "apartment": 5200, "house": 3100 },
  "price_histogram": [
    { "label": "0-100k", "min": 0, "max": 100000, "count": 450 },
    { "label": "100k-200k", "min": 100000, "max": 200000, "count": 1200 },
    { "label": "200k-500k", "min": 200000, "max": 500000, "count": 3800 },
    { "label": "500k-1M", "min": 500000, "max": 1000000, "count": 2100 },
    { "label": "1M+", "min": 1000000, "max": null, "count": 750 }
  ],
  "bedrooms": { "1": 1200, "2": 3400, "3": 2800 },
  "top_cities": [
    { "city": "Prague", "count": 4500 },
    { "city": "Brno", "count": 1200 }
  ],
  "portals": { "sreality": 8000, "bezrealitky": 3200 },
  "total": 8300,
  "by_country": {
    "czech": {
      "property_types": { "apartment": 5200 },
      "total": 5200
    }
  }
}
```

Cache TTL: 5 minutes.

---

## Filters

### GET /api/v1/filters

Returns all available filter option values with counts, for building dynamic UI filter panels.

| Parameter | Type | Description |
|-----------|------|-------------|
| `country` | `string` | Country code (default: all countries) |
| `property_category` | `string` | `apartment`, `house`, `land`, `commercial` |
| `transaction_type` | `string` | `sale`, `rent` |

**Response (200):**

```json
{
  "total": 45000,
  "price": { "min": 500000, "max": 25000000, "median": 4500000 },
  "sqm": { "min": 15, "max": 500, "median": 65 },
  "bedrooms": [
    { "value": "1", "count": 5200 },
    { "value": "2", "count": 12000 },
    { "value": "3", "count": 8500 }
  ],
  "cities": [
    { "value": "Prague", "count": 18000 },
    { "value": "Brno", "count": 5200 }
  ],
  "portals": [
    { "value": "sreality", "count": 25000 }
  ],
  "categories": [
    { "value": "apartment", "count": 30000 }
  ],
  "transaction_types": [
    { "value": "sale", "count": 35000 },
    { "value": "rent", "count": 10000 }
  ],
  "czech_disposition": [
    { "value": "2+kk", "count": 8500 }
  ],
  "condition": [
    { "value": "Velmi dobrý", "count": 5000 }
  ],
  "amenities": {
    "has_parking": 12000,
    "has_balcony": 18000,
    "has_elevator": 15000
  }
}
```

Uses pre-computed filter tables when available (single-country requests); falls back to live aggregate query. Cache TTL: 10 minutes. Single-flight deduplication on cache miss.

---

## Map

### GET /api/v1/map/tiles/:z/:x/:y

Standard slippy-map tile endpoint. Tile coordinates (z/x/y) follow Web Mercator (Google Maps, Mapbox, Leaflet).

| Parameter | Location | Type | Required | Description |
|-----------|----------|------|----------|-------------|
| `z` | path | `number` | **Yes** | Zoom level (0-22) |
| `x` | path | `number` | **Yes** | Tile X coordinate |
| `y` | path | `number` | **Yes** | Tile Y coordinate |
| `country` | query | `string` | **Yes** | Country code |
| `property_category` | query | `string` | No | Filter |
| `transaction_type` | query | `string` | No | Filter |
| `price_min` / `price_max` | query | `number` | No | Filter |
| `bedrooms_min` / `bedrooms_max` | query | `number` | No | Filter |
| `has_parking` / `has_elevator` / `has_garden` | query | `boolean` | No | Filter |

**Clustering Strategy by Zoom:**

| Zoom | Strategy | Cell Size | Max Results |
|------|----------|-----------|-------------|
| 1-14 | Geohash (`ST_GeoHash`) | 1250km to 1.2km | 500 clusters |
| 15-16 | Grid (`ST_SnapToGrid`) | 110m to 55m | 500 clusters |
| 17+ | Individual pins | N/A | 1000 properties |

**Response (200) - Clustered (zoom <= 16):**

```json
{
  "strategy": "geohash",
  "zoom": 12,
  "bounds": { "north": 50.1, "south": 50.0, "east": 14.5, "west": 14.4 },
  "clusters": [
    {
      "clusterId": "u2fkb",
      "count": 45,
      "centerLat": 50.075,
      "centerLon": 14.437,
      "avgPrice": 4500000,
      "minPrice": 1200000,
      "maxPrice": 12000000,
      "categoryCounts": { "apartment": 30, "house": 15 },
      "bounds": { "north": 50.08, "south": 50.07, "east": 14.44, "west": 14.43 }
    }
  ],
  "total": 45,
  "query_time_ms": 12,
  "cached": false
}
```

**Response (200) - Individual (zoom >= 17):**

```json
{
  "strategy": "individual",
  "zoom": 18,
  "properties": [
    {
      "id": "...",
      "title": "2+kk apartment",
      "price": 3500000,
      "currency": "CZK",
      "propertyCategory": "apartment",
      "latitude": 50.0755,
      "longitude": 14.4378,
      "thumbnailUrl": "https://...",
      "bedrooms": 1,
      "sqm": 55
    }
  ],
  "total": 12,
  "query_time_ms": 8,
  "cached": true
}
```

Response includes `X-Cache: HIT|MISS` and `Cache-Control: public, max-age=300` headers. Cache TTL: 5 minutes.

### POST /api/v1/map/clusters

Viewport-based clustering for clients that send bounding boxes instead of tile coordinates. Bounds are snapped to the nearest tile grid for cache reuse.

**Request Body:**

```json
{
  "country": "czech",
  "zoom": 12,
  "bounds": { "north": 50.1, "south": 50.0, "east": 14.5, "west": 14.4 },
  "filters": { "property_category": "apartment" }
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `country` | `string` | **Yes** | Country code |
| `zoom` | `number` | **Yes** | Zoom level (0-22) |
| `bounds` | `object` | **Yes** | `{ north, south, east, west }` |
| `filters` | `object` | No | Property filters |

Response shape is identical to tile endpoint.

---

## Boundaries

### GET /api/v1/boundaries/search

Search OSM administrative boundaries by name. Proxied to the Polygon Service.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `name` | `string` | **Yes** | Boundary name to search |
| `adminLevel` | `number` | No | OSM admin level (2-12) |
| `limit` | `number` | No | Max results (1-50, default: 10) |

### POST /api/v1/boundaries/point-in-polygon

Find administrative boundaries containing a geographic point. Proxied to the Polygon Service.

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
| `lat` | `number` | **Yes** | Latitude (-90 to 90) |
| `lon` | `number` | **Yes** | Longitude (-180 to 180) |
| `adminLevel` | `number` | No | OSM admin level filter (2-12) |

### GET /api/v1/boundaries/:id/properties

Get properties within a specific boundary.

| Parameter | Location | Type | Required | Description |
|-----------|----------|------|----------|-------------|
| `id` | path | `string` | **Yes** | Boundary ID |
| `country` | query | `string` | **Yes** | Country code |
| `limit` | query | `number` | No | Items per page (1-100, default: 20) |
| `page` | query | `number` | No | Page number (1-based, default: 1) |

**Response (200):**

```json
{
  "boundaryId": "abc123",
  "country": "czech",
  "total": 150,
  "results": [ ... ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8,
    "hasNext": true,
    "hasPrev": false
  }
}
```

---

## Price Trends

### GET /api/v1/properties/:id/price-history

Price history for a single property.

| Parameter | Location | Type | Required | Description |
|-----------|----------|------|----------|-------------|
| `id` | path | `string (uuid)` | **Yes** | Property UUID |
| `country` | query | `string` | **Yes** | Country code |

**Response (200):**

```json
{
  "property_id": "550e8400-...",
  "history": [
    { "price": 4200000, "currency": "CZK", "recorded_at": "2026-01-15T00:00:00Z" },
    { "price": 4500000, "currency": "CZK", "recorded_at": "2026-02-10T00:00:00Z" }
  ],
  "summary": {
    "current_price": 4500000,
    "initial_price": 4200000,
    "price_change_pct": 7.14,
    "trend": "up"
  }
}
```

Cache TTL: 10 minutes. Falls back to current property price as a single data point if no price history exists.

### GET /api/v1/market/trends

Monthly average price per sqm for the last 12 months.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `country` | `string` | **Yes** | Country code |
| `city` | `string` | No | City filter |
| `property_type` | `string` | No | Property type filter |

**Response (200):**

```json
{
  "country": "czech",
  "city": "Prague",
  "property_type": null,
  "months": [
    { "month": "2025-03-01T00:00:00Z", "avg_price_per_sqm": 85000.50, "listing_count": 12500 },
    { "month": "2025-04-01T00:00:00Z", "avg_price_per_sqm": 86200.75, "listing_count": 13000 }
  ]
}
```

Cache TTL: 1 hour.

---

## Cache Management

### POST /api/v1/cache/invalidate

Invalidate cached data for a specific country.

**Request Body:**

```json
{ "country": "czech" }
```

**Response (200):**

```json
{ "status": "invalidated", "country": "czech" }
```

### GET /api/v1/cache/stats

Redis cache statistics.

**Response (200):**

```json
{
  "hitRate": 0.85,
  "keyspace": { "total": 1200, "expires": 1150 },
  "memory": { "used": "45.2M", "peak": "52.1M" },
  "stats": { "hits": 85000, "misses": 15000, "evictedKeys": 0 },
  "uptime": 86400
}
```

---

## Health

### GET /api/v1/health

Simple health check.

```json
{
  "status": "healthy",
  "timestamp": "2026-02-23T12:00:00Z",
  "uptime": 86400,
  "service": "search-service",
  "version": "1.0.0"
}
```

### GET /api/v1/health/detailed

Detailed health check with database and cache status.

```json
{
  "status": "healthy",
  "timestamp": "2026-02-23T12:00:00Z",
  "uptime": 86400,
  "service": "search-service",
  "version": "1.0.0",
  "components": {
    "database": {
      "status": "healthy",
      "connections": { "czech": true, "uk": true },
      "pool_stats": { "czech": { "total": 10, "idle": 8, "waiting": 0 } }
    },
    "cache": {
      "status": "healthy",
      "stats": { "hitRate": 0.85 }
    }
  }
}
```

---

## Metrics

### GET /metrics

Prometheus-compatible metrics endpoint. Returns all custom and default Node.js metrics.

Custom metrics:

| Metric | Type | Labels | Description |
|--------|------|--------|-------------|
| `landomo_search_requests_total` | Counter | route, method, status | Total HTTP requests |
| `landomo_search_request_duration_seconds` | Histogram | route | Request latency |
| `landomo_search_results_total` | Histogram | country | Results per search query |
| `landomo_search_errors_total` | Counter | type, country | Search errors |
| `landomo_search_cache_hits_total` | Counter | - | Cache hits |
| `landomo_search_cache_misses_total` | Counter | - | Cache misses |
| `landomo_search_db_pool_active` | Gauge | country | Active DB connections |
| `landomo_search_db_pool_idle` | Gauge | country | Idle DB connections |
| `landomo_search_geo_queries_total` | Counter | - | Geo search queries |
