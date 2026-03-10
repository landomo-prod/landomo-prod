# ML Pricing Service Configuration

All configuration is via environment variables, with Docker secrets support for sensitive values. See `.env.example` for a template.

## Environment Variables

### Server

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3500` | HTTP server port |
| `HOST` | `0.0.0.0` | Bind address |
| `NODE_ENV` | - | Environment (development/production) |

### Database (Read-Only)

| Variable | Default | Description |
|----------|---------|-------------|
| `DB_HOST` | `localhost` | PostgreSQL host |
| `DB_PORT` | `5432` | PostgreSQL port |
| `DB_READ_USER` | `ml_pricing_readonly` | Read-only database user |
| `DB_READ_PASSWORD` | (empty) | Read-only user password |
| `DB_MAX_CONNECTIONS` | `10` | Pool size per country |
| `DB_READ_REPLICA_HOST` | (none) | Read replica host (falls back to DB_HOST) |

### Country Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `SUPPORTED_COUNTRIES` | `czech` | Comma-separated country codes |
| `COUNTRY_DB_OVERRIDES` | (none) | Database name overrides (e.g., `czech=landomo_cz,uk=landomo_uk`) |

Database names default to `landomo_{country}` unless overridden.

### Redis

| Variable | Default | Description |
|----------|---------|-------------|
| `REDIS_HOST` | `localhost` | Redis host |
| `REDIS_PORT` | `6379` | Redis port |
| `REDIS_PASSWORD` | (none) | Redis password |

### Cache TTLs (hardcoded in config)

| Setting | Value | Description |
|---------|-------|-------------|
| Model cache | 86400s (24h) | Active model metadata |
| Prediction cache | 3600s (1h) | Prediction results |

### ML Models

| Variable | Default | Description |
|----------|---------|-------------|
| `MODEL_STORAGE_PATH` | `/app/models` | Base directory for model files |
| `PYTHON_PATH` | `python3` | Python interpreter path |

### Authentication

| Variable | Default | Description |
|----------|---------|-------------|
| `API_KEYS` | (empty) | Comma-separated API keys. Format: `key` or `key:version` or `key:version:expiry` |

### Logging

| Variable | Default | Description |
|----------|---------|-------------|
| `LOG_LEVEL` | `info` | Log level (debug, info, warn, error) |

Sensitive fields are redacted in logs: `password`, `db_password`, `api_key`, `apiKey`, `authorization`, `token`, `redis.password`, `req.headers.authorization`.

### Training (Python script env vars)

| Variable | Default | Description |
|----------|---------|-------------|
| `DB_HOST` | `localhost` | Database host for training data |
| `DB_PORT` | `5432` | Database port |
| `DB_READ_USER` / `DB_USER` | `landomo` | Database user |
| `DB_PASSWORD` | `landomo` | Database password |
| `DB_NAME` | `landomo_{country}` | Database name |

## Docker Secrets

| Secret Name | Fallback Env Var |
|-------------|-----------------|
| `api_keys` | `API_KEYS` |
| `db_read_password` | `DB_READ_PASSWORD` |
| `redis_password` | `REDIS_PASSWORD` |

Docker secrets at `/run/secrets/` take priority over environment variables.

## Python Dependencies

Listed in `ml/requirements.txt`:

| Package | Version | Purpose |
|---------|---------|---------|
| lightgbm | 4.5.0 | Gradient boosting model |
| scikit-learn | 1.5.2 | Metrics, preprocessing |
| numpy | 2.0.2 | Numerical operations |
| pandas | 2.2.3 | Data manipulation |
| psycopg2-binary | 2.9.10 | PostgreSQL adapter |
| joblib | 1.4.2 | Model serialization |
| python-dotenv | 1.0.1 | Environment loading |
