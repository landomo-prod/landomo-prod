# ML Pricing Service

Machine learning-powered property price prediction and deal quality analysis for the Landomo platform.

## Overview

The ML Pricing Service provides:
- **Price Predictions**: Real-time property valuation using LightGBM models trained on historical data
- **Deal Quality Analysis**: Identify underpriced properties by comparing listed vs predicted prices
- **Confidence Intervals**: 95% confidence ranges for predictions
- **Multi-Country Support**: Category-specific models per country (Czech Republic, Slovakia, etc.)

**Tech Stack:** Fastify + TypeScript (API) | Python 3.11 + LightGBM (ML) | PostgreSQL (read-only) | Redis (cache) | BullMQ (training jobs)

---

## Quick Start

### Prerequisites
- Docker & Docker Compose
- PostgreSQL with Landomo databases (e.g., `landomo_czech`)
- Redis
- Applied migrations 023-025 (ML training views, model registry, read-only user)

### 1. Apply Database Migrations

```bash
# Apply ML-specific migrations to each country database
psql -U landomo -d landomo_czech -f ingest-service/migrations/023_ml_training_views.sql
psql -U landomo -d landomo_czech -f ingest-service/migrations/024_ml_model_registry.sql
psql -U landomo -d landomo_czech -f ingest-service/migrations/025_ml_pricing_readonly_user.sql

# Verify materialized views
psql -U landomo -d landomo_czech -c "SELECT COUNT(*) FROM ml_training_features_apartment;"

# Test read-only user
psql -U ml_pricing_readonly -d landomo_czech -c "SELECT COUNT(*) FROM ml_training_features_apartment;"
```

### 2. Train Initial Model

```bash
# Install Python dependencies
cd ml-pricing-service/ml
pip install -r requirements.txt

# Train apartment model for Czech Republic
python train_model.py --country czech_republic --category apartment

# Expected output:
# Training LightGBM model...
# Train samples: 12543, Test samples: 3136
# Training completed in 124.5s
# Metrics: MAE=285,432 CZK, RMSE=421,234 CZK, R²=0.872, MAPE=12.4%
# Model saved to: /app/models/czech_republic/apartment/v1.pkl
# __RESULT_JSON__:{"success":true,"version":1,"metrics":{...}}

# Verify model file created
ls -lh /app/models/czech_republic/apartment/
```

### 3. Start Service with Docker

```bash
# Build and start ml-pricing-service
cd /Users/samuelseidel/Development/landomo-world
docker compose up -d ml-pricing-service

# Check logs
docker compose logs -f ml-pricing-service

# Expected output:
# [INFO] Connected to database: landomo_czech
# [INFO] Connected to Redis
# [INFO] Model loaded: czech_republic/apartment/v1 (R²=0.872)
# [INFO] Server listening on http://0.0.0.0:3500
```

### 4. Test API

```bash
# Health check
curl http://localhost:3500/api/v1/health

# Expected: {"status":"healthy","checks":{"database":true,"redis":true,"model":true}}

# Get model info
curl http://localhost:3500/api/v1/models/czech_republic/apartment/info | jq

# Expected:
# {
#   "country": "czech_republic",
#   "property_category": "apartment",
#   "model_version": "v1",
#   "status": "active",
#   "metrics": {"mae": 285432, "rmse": 421234, "r2": 0.872, "mape": 12.4},
#   "training_info": {...}
# }

# Price prediction
curl -X POST http://localhost:3500/api/v1/predictions \
  -H "Authorization: Bearer dev_ml_key_1" \
  -H "Content-Type: application/json" \
  -d '{
    "country": "czech_republic",
    "property_category": "apartment",
    "features": {
      "bedrooms": 2,
      "sqm": 65,
      "floor": 3,
      "has_elevator": true,
      "has_balcony": true,
      "has_parking": false,
      "has_basement": false,
      "city": "Prague",
      "latitude": 50.0755,
      "longitude": 14.4378,
      "year_built": 2015
    },
    "options": {
      "include_confidence": true
    }
  }' | jq

# Expected:
# {
#   "predicted_price": 5200000,
#   "currency": "CZK",
#   "confidence_interval": {
#     "lower": 4800000,
#     "upper": 5600000,
#     "confidence_level": 0.95
#   },
#   "prediction_metadata": {
#     "model_version": "czech_republic_apartment_v1",
#     "trained_at": "2026-02-13T02:00:00Z",
#     "feature_count": 18,
#     "prediction_time_ms": 45,
#     "cache_hit": false
#   }
# }
```

---

## API Documentation

### Base URL
`http://localhost:3500/api/v1`

### Authentication
All endpoints (except `/health`) require Bearer token authentication:
```
Authorization: Bearer dev_ml_key_1
```

### Endpoints

#### `POST /predictions`
Get price prediction for a property.

**Request:**
```json
{
  "country": "czech_republic",
  "property_category": "apartment",
  "features": {
    "bedrooms": 2,
    "sqm": 65,
    "floor": 3,
    "has_elevator": true,
    "has_balcony": true,
    "has_parking": false,
    "has_basement": false,
    "city": "Prague",
    "latitude": 50.0755,
    "longitude": 14.4378,
    "year_built": 2015
  },
  "options": {
    "include_confidence": true
  }
}
```

**Response (200 OK):**
```json
{
  "predicted_price": 5200000,
  "currency": "CZK",
  "confidence_interval": {
    "lower": 4800000,
    "upper": 5600000,
    "confidence_level": 0.95
  },
  "prediction_metadata": {
    "model_version": "czech_republic_apartment_v1",
    "trained_at": "2026-02-13T02:00:00Z",
    "feature_count": 18,
    "prediction_time_ms": 45,
    "cache_hit": false
  }
}
```

**Error Responses:**
- `400 Bad Request`: Missing/invalid features
- `401 Unauthorized`: Invalid API key
- `404 Not Found`: Model not found for country/category
- `422 Unprocessable Entity`: Insufficient training data (<100 samples)
- `503 Service Unavailable`: Model server unavailable

---

#### `GET /models/:country/:category/info`
Get metadata about the active model.

**Example:**
```bash
curl http://localhost:3500/api/v1/models/czech_republic/apartment/info
```

**Response (200 OK):**
```json
{
  "country": "czech_republic",
  "property_category": "apartment",
  "model_version": "v1",
  "status": "active",
  "metrics": {
    "mae": 285432,
    "rmse": 421234,
    "r2": 0.872,
    "mape": 12.4
  },
  "training_info": {
    "trained_at": "2026-02-13T02:00:00Z",
    "training_duration_seconds": 124,
    "training_samples": 12543,
    "feature_count": 18,
    "model_type": "LightGBM",
    "hyperparameters": {
      "objective": "regression",
      "metric": "mae",
      "num_leaves": 63,
      "learning_rate": 0.05
    }
  },
  "data_coverage": {
    "last_data_sync": "2026-02-13T01:00:00Z",
    "active_listings_count": 45231,
    "avg_price": 6850000,
    "median_price": 5900000
  }
}
```

---

#### `GET /health`
Health check endpoint (no authentication required).

**Response (200 OK):**
```json
{
  "status": "healthy",
  "uptime": 3600,
  "timestamp": "2026-02-13T12:00:00Z",
  "checks": {
    "database": true,
    "redis": true,
    "model": true
  }
}
```

**Response (503 Service Unavailable):**
```json
{
  "status": "degraded",
  "checks": {
    "database": true,
    "redis": false,
    "model": true
  }
}
```

---

## Model Training

### Manual Training

Train a new model manually:

```bash
python ml/train_model.py --country czech_republic --category apartment
```

**Options:**
- `--country`: Country code (czech_republic, slovakia, hungary, etc.)
- `--category`: Property category (apartment, house, land, commercial)
- `--test-split`: Test set percentage (default: 0.2)
- `--output-dir`: Model output directory (default: /app/models)

### Automated Weekly Retraining

The service automatically retrains models weekly via BullMQ scheduled jobs:
- **Schedule**: Every Sunday at 2 AM (configurable via `TRAINING_CRON`)
- **Process**:
  1. Refresh materialized views (`ml_training_features_*`)
  2. Extract training data
  3. Train LightGBM model
  4. Evaluate on test set
  5. Save model to filesystem
  6. Register in `ml_model_registry` table
  7. Publish Redis event to reload cached models

**View training logs:**
```bash
docker compose logs -f ml-pricing-service | grep "Training"
```

---

## Performance Benchmarks

### Latency Targets
- **Prediction (cached)**: <50ms (p99)
- **Prediction (uncached)**: <500ms (p99)
- **Model loading**: <2s (on first request)

### Load Testing

```bash
# Install Apache Bench
# macOS: brew install httpd
# Ubuntu: apt-get install apache2-utils

# Create test request
cat > apartment_request.json << EOF
{
  "country": "czech_republic",
  "property_category": "apartment",
  "features": {
    "bedrooms": 2,
    "sqm": 65,
    "floor": 3,
    "has_elevator": true,
    "has_balcony": true,
    "has_parking": false,
    "has_basement": false,
    "city": "Prague",
    "latitude": 50.0755,
    "longitude": 14.4378,
    "year_built": 2015
  }
}
EOF

# Run load test: 100 requests, 10 concurrent
ab -n 100 -c 10 \
   -H "Authorization: Bearer dev_ml_key_1" \
   -p apartment_request.json \
   -T application/json \
   http://localhost:3500/api/v1/predictions

# Expected results:
# - Requests per second: >50
# - Mean response time: <200ms (with cache warming)
# - 99th percentile: <500ms
```

### Cache Performance

The service uses Redis for two-tier caching:

1. **Model Cache** (24h TTL)
   - Key: `ml:model:{country}:{category}:active`
   - Stores model metadata and file path
   - Hit rate: >95% (models rarely change)

2. **Prediction Cache** (1h TTL)
   - Key: `ml:pred:{hash(features)}`
   - Stores prediction result
   - Hit rate: ~20-30% (varies by traffic patterns)

**Monitor cache hit rates:**
```bash
# Check Prometheus metrics
curl http://localhost:3500/metrics | grep ml_cache

# Expected:
# ml_cache_hits_total{country="czech_republic",category="apartment"} 1523
# ml_cache_misses_total{country="czech_republic",category="apartment"} 421
```

---

## Configuration

### Environment Variables

See `.env.example` for full configuration options.

**Key settings:**

```bash
# Server
PORT=3500
NODE_ENV=production

# Database (read-only multi-country access)
DB_HOST=postgres
DB_READ_USER=ml_pricing_readonly
DB_READ_PASSWORD=ml_pricing_readonly_pass

# Redis Cache
REDIS_HOST=redis
MODEL_CACHE_TTL=86400          # 24 hours
PREDICTION_CACHE_TTL=3600      # 1 hour

# API Authentication
API_KEYS=dev_ml_key_1,prod_ml_key_xyz:v2:2027-12-31

# ML Configuration
MODELS_DIR=/app/models
TRAINING_CRON=0 2 * * 0        # Every Sunday 2 AM
MIN_TRAINING_SAMPLES=100
```

---

## Monitoring

### Prometheus Metrics

The service exposes Prometheus metrics at `/metrics`:

```bash
curl http://localhost:3500/metrics
```

**Key metrics:**
- `ml_prediction_requests_total` - Total prediction requests
- `ml_prediction_duration_seconds` - Prediction latency histogram
- `ml_cache_hit_rate` - Cache hit percentage
- `ml_model_r2_score` - Model accuracy (R² score)
- `ml_model_age_hours` - Hours since last training
- `ml_training_duration_seconds` - Training time histogram

**Grafana Dashboards:**
- Dashboard: "ML Pricing Service Overview"
- Panels: Request rate, latency percentiles, cache hit rate, model accuracy

---

## Troubleshooting

### Model Not Found (404)

**Error:**
```json
{"error": "ModelNotFoundError", "message": "Model not found for czech_republic/apartment"}
```

**Solution:**
```bash
# 1. Check if model exists on filesystem
ls -lh /app/models/czech_republic/apartment/

# 2. Check ml_model_registry table
psql -U landomo -d landomo_czech -c \
  "SELECT * FROM ml_model_registry WHERE country='czech_republic' AND property_category='apartment' AND status='active';"

# 3. Train new model
python ml/train_model.py --country czech_republic --category apartment
```

---

### Insufficient Training Data (422)

**Error:**
```json
{"error": "InsufficientDataError", "message": "Insufficient training data: 45 samples (min: 100)"}
```

**Solution:**
```bash
# 1. Check materialized view data
psql -U landomo -d landomo_czech -c \
  "SELECT COUNT(*) FROM ml_training_features_apartment WHERE status IN ('active', 'sold', 'rented');"

# 2. Refresh materialized views
psql -U landomo -d landomo_czech -c \
  "REFRESH MATERIALIZED VIEW CONCURRENTLY ml_training_features_apartment;"

# 3. If still insufficient, wait for more data ingestion or adjust MIN_TRAINING_SAMPLES
```

---

### Slow Predictions (>500ms)

**Possible causes:**
1. **Model not cached in Redis**
   - First prediction per model is slower (~200-500ms)
   - Subsequent predictions: <50ms with cache

2. **Large feature extraction overhead**
   - Check Python bridge timeout (default: 5s)
   - Monitor `ml_prediction_duration_seconds{cache_hit="false"}`

3. **Database connection pool exhausted**
   - Increase `DB_MAX_CONNECTIONS` (default: 10)
   - Check `pg_stat_activity` for long-running queries

**Debug:**
```bash
# Check prediction latency breakdown
docker compose logs ml-pricing-service | grep "Prediction completed"

# Example log:
# [INFO] Prediction completed {country: "czech_republic", category: "apartment", duration_ms: 234, cache_hit: false}
```

---

### Python Bridge Timeout (503)

**Error:**
```json
{"error": "PredictionTimeoutError", "message": "Python script timeout (>5s)"}
```

**Solution:**
```bash
# 1. Test Python script directly
python ml/predict.py \
  --model /app/models/czech_republic/apartment/v1.pkl \
  --features '{"bedrooms":2,"sqm":65,"city":"Prague"}'

# 2. Check for missing Python dependencies
pip list | grep -E "(lightgbm|scikit-learn|pandas)"

# 3. Increase timeout in src/services/python-bridge.ts (default: 5000ms)
```

---

## Development

### Local Setup (without Docker)

```bash
# 1. Install dependencies
cd ml-pricing-service
npm install

# 2. Build TypeScript
npm run build

# 3. Start PostgreSQL and Redis locally
# (Ensure landomo_czech database exists with migrations applied)

# 4. Set environment variables
cp .env.example .env
# Edit .env with local DB credentials

# 5. Start service
npm start

# 6. Test
curl http://localhost:3500/api/v1/health
```

### Type Checking

```bash
# Check TypeScript types
cd ml-pricing-service
npm run type-check

# Rebuild shared-components if types changed
cd ../shared-components
npm run build
```

---

## Production Deployment

### Pre-flight Checklist

- [ ] Database migrations applied to all country databases
- [ ] Read-only user `ml_pricing_readonly` created with correct permissions
- [ ] Materialized views populated (run `REFRESH MATERIALIZED VIEW`)
- [ ] At least one model trained per country/category
- [ ] API keys configured in Docker secrets (`/run/secrets/api_keys_ml_pricing`)
- [ ] Redis password set
- [ ] Prometheus monitoring configured
- [ ] Grafana dashboards imported

### Deployment Steps

```bash
# 1. Build image
docker compose build ml-pricing-service

# 2. Start service
docker compose up -d ml-pricing-service

# 3. Verify health
curl http://localhost:3500/api/v1/health

# 4. Check logs
docker compose logs -f ml-pricing-service

# 5. Monitor metrics
curl http://localhost:3500/metrics | grep ml_
```

---

## Architecture

### Service Components

```
┌─────────────────────────────────────────────────────────────┐
│                   ML Pricing Service (3500)                 │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐ │
│  │  REST API    │    │ Model Server │    │ Training Job │ │
│  │  (Fastify)   │◄───┤  (Redis      │◄───┤  (BullMQ)    │ │
│  │              │    │   cached)    │    │              │ │
│  └──────────────┘    └──────────────┘    └──────────────┘ │
│         │                    │                    │         │
└─────────│────────────────────│────────────────────│─────────┘
          │                    │                    │
    ┌─────▼────────────────────▼────────────────────▼─────┐
    │           Redis (Model Cache + Job Queue)           │
    └──────────────────────────────────────────────────────┘
          │                                          │
    ┌─────▼─────────┐                        ┌──────▼──────┐
    │  Multi-Country│                        │  Training   │
    │  PostgreSQL   │                        │  Features   │
    │  (Read-Only)  │                        │  Materialized│
    │               │                        │  Views       │
    └───────────────┘                        └─────────────┘
```

### Data Flow

**Training:**
1. BullMQ schedules weekly training job (Sunday 2 AM)
2. Worker refreshes materialized view
3. Python script extracts features from PostgreSQL
4. LightGBM trains on 80/20 train/test split
5. Model saved to `/app/models/{country}/{category}/v{version}.pkl`
6. Metadata inserted into `ml_model_registry` table
7. Redis pub/sub notifies API to reload model

**Prediction:**
1. API receives POST /predictions request
2. Check Redis cache for prediction
3. If cache miss:
   - Load model from Redis (or filesystem if not cached)
   - Call Python predict.py via child_process
   - Parse JSON output
   - Cache result (1h TTL)
4. Return predicted_price + confidence interval

---

## License

Proprietary - Landomo Platform
