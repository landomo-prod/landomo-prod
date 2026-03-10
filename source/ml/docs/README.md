# ML Pricing Service

Machine learning property price prediction service for the Landomo platform. Trains and serves LightGBM models per country and property category.

## Overview

- **Price prediction**: Given property features, predict market price with confidence intervals
- **Category-specific models**: Separate models for apartment, house, land, and commercial properties
- **Per-country models**: Each supported country has its own trained models
- **Model registry**: Version-tracked models stored on disk (joblib) with metadata in PostgreSQL
- **Caching**: Redis caching for models (24h) and predictions (1h)

## Tech Stack

- **API**: Node.js + TypeScript + Fastify (port 3500)
- **ML**: Python 3.11 + LightGBM + scikit-learn
- **Database**: PostgreSQL (read-only, per-country pools via `ml_pricing_readonly` user)
- **Cache**: Redis (node-redis)
- **Model format**: LightGBM Booster serialized with joblib (`.pkl` files)
- **Logging**: Pino with sensitive field redaction

## Architecture

```
                                    ┌─ ml_model_registry table
                                    │
Client ──HTTP──► Fastify API ──────►├─ Redis Cache (models 24h, predictions 1h)
                    │               │
                    └──spawn──► Python predict.py ──► LightGBM .pkl model
                                    │
Training (cron) ──► Python train_model.py ──► PostgreSQL materialized views
                                                (ml_training_features_*)
```

The TypeScript API handles HTTP, auth, caching, and model lookup. Actual ML inference and training runs in Python subprocesses via `python-bridge.ts`. Communication uses JSON over stdout with `__RESULT_JSON__:` prefix.

## Authentication

Uses Bearer token auth (`Authorization: Bearer <key>`). Health and metrics endpoints are exempt. Keys support versioning and expiration:

```
# Format: key:version:expiry
API_KEYS=prod_key_1:v2:2027-12-31,dev_key_2
```

Timing-safe comparison is used for key validation.

## Model Registry

Models are tracked in `ml_model_registry` table:

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `country` | VARCHAR | Country code |
| `property_category` | VARCHAR | apartment/house/land/commercial |
| `version` | INTEGER | Auto-incrementing version |
| `trained_at` | TIMESTAMPTZ | Training timestamp |
| `file_path` | VARCHAR | Path to `.pkl` file |
| `model_type` | VARCHAR | Always `'lightgbm'` |
| `metrics` | JSONB | MAE, RMSE, R2, MAPE |
| `status` | VARCHAR | `active` or `archived` |
| `training_samples` | INTEGER | Number of training samples |
| `feature_count` | INTEGER | Number of features |

Only one model per country+category is `active` at a time; previous versions are set to `archived`.

## Redis Pub/Sub

The service subscribes to `ml:model:updated:{country}:{category}` channels. When a new model is trained and registered, publishing to this channel triggers cache invalidation so the API immediately picks up the new model.

## Related Documentation

- [API Reference](./API.md)
- [Training Pipeline](./TRAINING.md)
- [Models](./MODELS.md)
- [Configuration](./CONFIGURATION.md)
