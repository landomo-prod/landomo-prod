# API Reference

Complete API documentation for all Landomo services.

## Overview

Land

omo provides four core microservices:

| Service | Port | Purpose | Auth Required |
|---------|------|---------|---------------|
| **Ingest Service** | 3000 (per-country) | Property data ingestion | Yes (API Key) |
| **Search Service** | 4000 | Property search & retrieval | Yes (API Key) |
| **Polygon Service** | 4300 | OSM boundary queries | Yes (API Key) |
| **ML Pricing Service** | 3500 | Price predictions & deal scoring | Yes (API Key) |

## Authentication

All services use Bearer token authentication:

```bash
Authorization: Bearer YOUR_API_KEY
```

### Environment Configuration

```bash
# Ingest Service
INGEST_API_KEY=your_ingest_key_here

# Search Service
SEARCH_API_KEY=your_search_key_here

# Polygon Service
POLYGON_API_KEY=your_polygon_key_here

# ML Pricing Service
ML_PRICING_API_KEY=your_ml_key_here
```

---

## Ingest Service API

Base URL: `http://localhost:3000` (per-country deployment)

### POST /bulk-ingest

Ingest multiple properties in a single request (recommended for scrapers).

**Request**:
```json
{
  "portal": "sreality",
  "country": "czech_republic",
  "properties": [
    {
      "portal_id": "12345",
      "data": {
        "property_category": "apartment",
        "title": "Modern 2+kk apartment",
        "price": 8500000,
        "currency": "CZK",
        "transaction_type": "sale",
        "location": {
          "city": "Prague",
          "region": "Prague",
          "postal_code": "130 00",
          "country": "Czech Republic",
          "coordinates": {
            "lat": 50.0755,
            "lon": 14.4378
          }
        },
        "bedrooms": 1,
        "sqm": 65,
        "has_elevator": true,
        "has_balcony": true,
        "has_parking": false,
        "has_basement": true
      },
      "raw_data": { /* original portal response */ }
    }
  ]
}
```

**Response** (202 Accepted):
```json
{
  "status": "accepted",
  "message": "1 properties queued for batch ingestion",
  "job_id": "batch-sreality-1708088400000-req123"
}
```

**Error Responses**:
- `400 Bad Request`: Missing/invalid fields
- `401 Unauthorized`: Invalid API key
- `500 Internal Server Error`: Server error

**Field Requirements by Category**:

| Category | Required TierI Fields |
|----------|----------------------|
| `apartment` | `bedrooms`, `sqm`, `has_elevator`, `has_balcony`, `has_parking`, `has_basement` |
| `house` | `bedrooms`, `sqm_living`, `sqm_plot`, `has_garden`, `has_garage`, `has_parking`, `has_basement` |
| `land` | `area_plot_sqm` |
| `commercial` | `sqm_total`, `has_elevator`, `has_parking`, `has_bathrooms` |

### POST /scrape-runs/start

Register the start of a scraper run (tracking).

**Request**:
```json
{
  "portal": "sreality",
  "property_category": "apartment"
}
```

**Response** (201 Created):
```json
{
  "run_id": "550e8400-e29b-41d4-a716-446655440000",
  "portal": "sreality",
  "started_at": "2026-02-16T10:30:00Z"
}
```

### POST /scrape-runs/complete

Mark a scraper run as completed.

**Request**:
```json
{
  "run_id": "550e8400-e29b-41d4-a716-446655440000",
  "listings_found": 1250,
  "listings_new": 45,
  "listings_updated": 203
}
```

**Response** (200 OK):
```json
{
  "status": "completed",
  "duration_seconds": 3420
}
```

### POST /scrape-runs/fail

Mark a scraper run as failed.

**Request**:
```json
{
  "run_id": "550e8400-e29b-41d4-a716-446655440000",
  "error_message": "Connection timeout after 30s"
}
```

**Response** (200 OK):
```json
{
  "status": "failed"
}
```

### GET /health

Health check endpoint (no auth required).

**Response** (200 OK):
```json
{
  "status": "healthy",
  "timestamp": "2026-02-16T10:30:00Z",
  "uptime": 86400,
  "version": "1.0.0",
  "database": "connected",
  "redis": "connected"
}
```

---

## Search Service API

Base URL: `http://localhost:4000`

### POST /search

Main property search endpoint with advanced filtering.

**Request**:
```json
{
  "countries": ["czech_republic"],
  "filters": {
    "property_category": "apartment",
    "transaction_type": "sale",
    "city": "Prague",
    "price_min": 5000000,
    "price_max": 10000000,
    "bedrooms_min": 2,
    "sqm_min": 60,
    "apt_has_balcony": true,
    "apt_has_elevator": true
  },
  "sort_by": "price_asc",
  "page": 1,
  "limit": 20
}
```

**Response** (200 OK):
```json
{
  "total": 147,
  "results": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "portal": "sreality",
      "portal_id": "12345",
      "property_category": "apartment",
      "title": "Modern 2+kk apartment",
      "price": 8500000,
      "currency": "CZK",
      "transaction_type": "sale",
      "location": {
        "city": "Prague",
        "postal_code": "130 00",
        "coordinates": { "lat": 50.0755, "lon": 14.4378 }
      },
      "apt_bedrooms": 1,
      "apt_sqm": 65,
      "apt_floor": 5,
      "apt_has_elevator": true,
      "apt_has_balcony": true,
      "source_url": "https://...",
      "created_at": "2026-02-15T10:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 147,
    "totalPages": 8,
    "hasNext": true,
    "hasPrev": false
  },
  "aggregations": {
    "price_stats": {
      "min": 5200000,
      "max": 9950000,
      "avg": 7450000
    },
    "sqm_stats": {
      "min": 60,
      "max": 95,
      "avg": 72
    }
  },
  "query_time_ms": 42,
  "countries_queried": ["czech_republic"]
}
```

**Available Filters**:

| Filter | Type | Description | Example |
|--------|------|-------------|---------|
| `property_category` | string | Category filter | `"apartment"` |
| `transaction_type` | string | Sale or rent | `"sale"` |
| `city` | string | City name | `"Prague"` |
| `region` | string | Region/state | `"Prague"` |
| `price_min` | number | Minimum price | `5000000` |
| `price_max` | number | Maximum price | `10000000` |
| `bedrooms_min` | number | Min bedrooms | `2` |
| `bedrooms_max` | number | Max bedrooms | `4` |
| `sqm_min` | number | Min area | `60` |
| `sqm_max` | number | Max area | `120` |
| `apt_has_balcony` | boolean | Has balcony (apartments) | `true` |
| `apt_has_elevator` | boolean | Has elevator (apartments) | `true` |
| `house_has_garden` | boolean | Has garden (houses) | `true` |
| `house_has_pool` | boolean | Has pool (houses) | `true` |
| `land_zoning` | string | Land zoning | `"residential"` |

**Sort Options**:

- `price_asc`: Price low to high
- `price_desc`: Price high to low
- `date_newest`: Newest first
- `date_oldest`: Oldest first
- `sqm_asc`: Area low to high
- `sqm_desc`: Area high to low

### POST /search/geo

Geographic search within bounding box or radius.

**Bounding Box Request**:
```json
{
  "countries": ["czech_republic"],
  "filters": {
    "property_category": "apartment",
    "transaction_type": "sale"
  },
  "bbox": {
    "min_lat": 50.0,
    "max_lat": 50.1,
    "min_lon": 14.3,
    "max_lon": 14.5
  },
  "limit": 100
}
```

**Radius Request**:
```json
{
  "countries": ["czech_republic"],
  "filters": {
    "property_category": "house"
  },
  "center": {
    "lat": 50.0755,
    "lon": 14.4378
  },
  "radius_km": 5,
  "limit": 50
}
```

**Response** (200 OK):
```json
{
  "total": 42,
  "results": [ /* properties with coordinates */ ],
  "query_time_ms": 28
}
```

### GET /properties/:id

Get single property by ID.

**Response** (200 OK):
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "portal": "sreality",
  "portal_id": "12345",
  "property_category": "apartment",
  "title": "Modern 2+kk apartment",
  "price": 8500000,
  "currency": "CZK",
  "description": "Beautiful modern apartment...",
  "location": { /* full location */ },
  "media": {
    "images": [
      { "url": "https://...", "caption": "Living room", "order": 1 }
    ],
    "videos": [],
    "floor_plan": "https://..."
  },
  "agent": {
    "name": "John Doe",
    "phone": "+420 123 456 789",
    "email": "john@realestate.cz"
  },
  "apt_bedrooms": 1,
  "apt_sqm": 65,
  /* ... all category-specific fields */
  "country_specific": { /* Czech-specific data */ },
  "portal_metadata": { /* Portal-specific data */ },
  "status": "active",
  "created_at": "2026-02-15T10:00:00Z",
  "last_seen_at": "2026-02-16T10:00:00Z"
}
```

**Error Responses**:
- `404 Not Found`: Property doesn't exist

### GET /health

Health check endpoint (no auth required).

---

## Polygon Service API

Base URL: `http://localhost:4300`

### GET /boundaries/search

Search for administrative boundaries by name.

**Query Parameters**:
- `q` (required): Search query
- `country` (optional): Country filter
- `level` (optional): Admin level (2/4/6/8/9/10)
- `limit` (optional): Max results (default: 10)

**Example**:
```bash
GET /boundaries/search?q=Prague&country=Czech%20Republic&level=8
```

**Response** (200 OK):
```json
{
  "results": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "osm_id": "435514",
      "osm_type": "relation",
      "name": "Prague",
      "name_en": "Prague",
      "admin_level": 8,
      "country": "Czech Republic",
      "bbox": {
        "min_lat": 49.9413,
        "max_lat": 50.1773,
        "min_lon": 14.2244,
        "max_lon": 14.7067
      },
      "geometry_type": "MultiPolygon"
    }
  ],
  "total": 1,
  "query_time_ms": 15
}
```

### POST /boundaries/point-in-polygon

Find which boundaries contain a specific point.

**Request**:
```json
{
  "lat": 50.0755,
  "lon": 14.4378,
  "country": "Czech Republic"
}
```

**Response** (200 OK):
```json
{
  "point": {
    "lat": 50.0755,
    "lon": 14.4378
  },
  "boundaries": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "Prague",
      "admin_level": 8,
      "osm_id": "435514"
    },
    {
      "id": "660e8400-e29b-41d4-a716-446655440001",
      "name": "Vinohrady",
      "admin_level": 10,
      "osm_id": "435515"
    }
  ],
  "query_time_ms": 8
}
```

### POST /sync/overpass

Trigger manual OSM data sync (admin only).

**Request**:
```json
{
  "country": "Czech Republic",
  "admin_levels": [8, 10]
}
```

**Response** (202 Accepted):
```json
{
  "status": "sync_started",
  "job_id": "sync-cz-1708088400000"
}
```

### GET /health

Health check endpoint (no auth required).

---

## ML Pricing Service API

Base URL: `http://localhost:3500`

### POST /predictions

Get price predictions and deal quality scores.

**Request**:
```json
{
  "country": "czech_republic",
  "property_category": "apartment",
  "features": {
    "city": "Prague",
    "apt_bedrooms": 2,
    "apt_sqm": 75,
    "apt_floor": 5,
    "apt_has_elevator": true,
    "apt_has_balcony": true,
    "apt_has_parking": true,
    "latitude": 50.0755,
    "longitude": 14.4378
  }
}
```

**Response** (200 OK):
```json
{
  "prediction": {
    "predicted_price": 9250000,
    "confidence": 0.87,
    "price_range": {
      "min": 8500000,
      "max": 10000000
    }
  },
  "deal_quality": {
    "score": 0.78,
    "rating": "good",
    "savings_estimate": 750000,
    "percentile": 72
  },
  "model": {
    "country": "czech_republic",
    "category": "apartment",
    "version": "v1.2.3",
    "trained_at": "2026-02-10T02:00:00Z",
    "r2_score": 0.84,
    "mape": 12.5
  },
  "inference_time_ms": 45,
  "cached": false
}
```

**Deal Quality Ratings**:
- `excellent`: score >= 0.85 (top 15% of deals)
- `good`: score >= 0.70 (top 30% of deals)
- `fair`: score >= 0.50 (average deals)
- `poor`: score < 0.50 (below average deals)

### GET /models/:country/:category/info

Get model information and performance metrics.

**Example**:
```bash
GET /models/czech_republic/apartment/info
```

**Response** (200 OK):
```json
{
  "country": "czech_republic",
  "category": "apartment",
  "version": "v1.2.3",
  "trained_at": "2026-02-10T02:00:00Z",
  "training_samples": 125000,
  "features_count": 42,
  "metrics": {
    "r2_score": 0.84,
    "mape": 12.5,
    "rmse": 450000,
    "mae": 320000
  },
  "feature_importance": {
    "city": 0.25,
    "apt_sqm": 0.22,
    "apt_bedrooms": 0.15,
    "latitude": 0.12,
    "longitude": 0.11
  }
}
```

### GET /health

Health check endpoint (no auth required).

---

## Rate Limits

Default rate limits per service:

| Service | Requests/Minute | Requests/Hour |
|---------|-----------------|---------------|
| Ingest | 100 | 5000 |
| Search | 300 | 15000 |
| Polygon | 200 | 10000 |
| ML Pricing | 100 | 5000 |

**Rate Limit Headers**:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1708088460
```

**Rate Limit Exceeded** (429 Too Many Requests):
```json
{
  "error": "RateLimitExceeded",
  "message": "Rate limit exceeded. Try again in 45 seconds.",
  "retry_after": 45
}
```

---

## Error Responses

All services follow consistent error response format:

```json
{
  "error": "ErrorType",
  "message": "Human-readable error description",
  "details": {
    "field": "Additional context"
  }
}
```

**Common Error Types**:

| Status | Error Type | Description |
|--------|------------|-------------|
| 400 | `ValidationError` | Invalid request data |
| 401 | `Unauthorized` | Missing/invalid API key |
| 404 | `NotFound` | Resource doesn't exist |
| 409 | `Conflict` | Duplicate resource |
| 429 | `RateLimitExceeded` | Too many requests |
| 500 | `InternalServerError` | Server error |
| 503 | `ServiceUnavailable` | Service temporarily down |

---

## Client Examples

### cURL

```bash
# Search for apartments in Prague
curl -X POST http://localhost:4000/search \
  -H "Authorization: Bearer $SEARCH_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "countries": ["czech_republic"],
    "filters": {
      "property_category": "apartment",
      "city": "Prague",
      "price_max": 10000000,
      "bedrooms_min": 2
    },
    "sort_by": "price_asc",
    "limit": 20
  }'
```

### JavaScript/TypeScript

```typescript
import axios from 'axios';

const searchClient = axios.create({
  baseURL: 'http://localhost:4000',
  headers: {
    'Authorization': `Bearer ${process.env.SEARCH_API_KEY}`,
    'Content-Type': 'application/json'
  }
});

async function searchProperties() {
  const response = await searchClient.post('/search', {
    countries: ['czech_republic'],
    filters: {
      property_category: 'apartment',
      city: 'Prague',
      price_max: 10000000,
      bedrooms_min: 2
    },
    sort_by: 'price_asc',
    limit: 20
  });

  return response.data;
}
```

### Python

```python
import requests

SEARCH_API_URL = "http://localhost:4000"
API_KEY = "your_api_key_here"

def search_properties():
    response = requests.post(
        f"{SEARCH_API_URL}/search",
        headers={
            "Authorization": f"Bearer {API_KEY}",
            "Content-Type": "application/json"
        },
        json={
            "countries": ["czech_republic"],
            "filters": {
                "property_category": "apartment",
                "city": "Prague",
                "price_max": 10000000,
                "bedrooms_min": 2
            },
            "sort_by": "price_asc",
            "limit": 20
        }
    )
    return response.json()
```

---

## Related Documentation

- **Data Model**: `/docs/DATA_MODEL.md`
- **Ingest Service**: `/docs/services/INGEST_SERVICE.md`
- **Search Service**: `/docs/services/SEARCH_SERVICE.md`
- **Polygon Service**: `/docs/services/POLYGON_SERVICE.md`
- **ML Pricing Service**: `/docs/services/ML_PRICING_SERVICE.md`

---

**Last Updated**: 2026-02-16
