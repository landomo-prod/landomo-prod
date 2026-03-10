# ML Pricing Service API Reference

Base URL: `http://localhost:3500`

All endpoints except `/api/v1/health` require `Authorization: Bearer <api_key>` header.

## Health

### GET /api/v1/health

Detailed health check (no auth required).

**Response (200 or 503):**
```json
{
  "status": "healthy",
  "timestamp": "2026-02-23T10:00:00.000Z",
  "uptime": 3600.5,
  "version": "1.0.0",
  "checks": {
    "database": true,
    "redis": true
  },
  "pools": {
    "czech": { "total": 10, "idle": 8, "waiting": 0 },
    "slovakia": { "total": 10, "idle": 9, "waiting": 0 }
  }
}
```

## Predictions

### POST /api/v1/predictions

Predict property price given features.

**Request Body:**
```json
{
  "country": "czech",
  "property_category": "apartment",
  "features": {
    "sqm": 65,
    "bedrooms": 2,
    "city": "Praha",
    "floor": 3,
    "total_floors": 8,
    "has_elevator": true,
    "has_balcony": true,
    "condition": "good",
    "construction_type": "panel",
    "latitude": 50.08,
    "longitude": 14.42
  },
  "options": {
    "include_confidence": true
  }
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `country` | string | yes | Country code (e.g., `czech`, `slovakia`) |
| `property_category` | string | yes | `apartment`, `house`, `land`, or `commercial` |
| `features` | object | yes | Property features (see required features below) |
| `options.include_confidence` | boolean | no | Include confidence interval (default: true) |

**Required features per category:**

| Category | Required Features |
|----------|------------------|
| apartment | `sqm`, `city` |
| house | `sqm_living`, `city` |
| land | `area_plot_sqm`, `city` |
| commercial | `sqm_total`, `city` |

**Response (200):**
```json
{
  "predicted_price": 5250000,
  "currency": "CZK",
  "confidence_interval": {
    "lower": 4500000,
    "upper": 6000000,
    "confidence_level": 0.95
  },
  "prediction_metadata": {
    "model_version": "czech_apartment_v3",
    "trained_at": "2026-02-16T02:15:00.000Z",
    "feature_count": 24,
    "prediction_time_ms": 45,
    "cache_hit": false
  }
}
```

**Currency mapping:**

| Country | Currency |
|---------|----------|
| czech | CZK |
| slovakia | EUR |
| hungary | HUF |
| austria | EUR |
| germany | EUR |
| uk | GBP |
| usa | USD |
| australia | AUD |

**Errors:**
- `400 InvalidFeaturesError` - Missing required fields or invalid category
- `404 ModelNotFoundError` - No active model for country/category
- `503 PredictionTimeoutError` - Python prediction exceeded 5s timeout

## Models

### GET /api/v1/models/:country/:category/info

Get information about the active model for a country and category, including data coverage statistics.

**Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `country` | path, string | Country code |
| `category` | path, string | Property category |

**Example:**
```
GET /api/v1/models/czech/apartment/info
```

**Response (200):**
```json
{
  "country": "czech",
  "property_category": "apartment",
  "model_version": "v3",
  "model_type": "lightgbm",
  "trained_at": "2026-02-16T02:15:00.000Z",
  "status": "active",
  "metrics": {
    "mae": 385000,
    "rmse": 520000,
    "r2": 0.87,
    "mape": 12.3
  },
  "training_samples": 45000,
  "feature_count": 24,
  "data_coverage": {
    "active_listings": 52000,
    "avg_price": 5800000,
    "median_price": 4950000
  }
}
```

**Errors:**
- `404 ModelNotFoundError` - No active model found
