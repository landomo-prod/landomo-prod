# Models

## Category-Specific Models

Each property category has its own LightGBM model with tailored features and hyperparameters.

### Apartment Model

- **Key features**: sqm, bedrooms, floor, total_floors, has_elevator, has_balcony, construction_type, condition, city, latitude, longitude
- **Derived features**: property_age, price_per_sqm, floor_ratio, years_since_renovation
- **Categorical features**: construction_type, condition, heating_type, energy_class, furnished, city
- **Hyperparameters**: num_leaves=63, min_child_samples=20
- **Typical feature count**: ~24

### House Model

- **Key features**: sqm_living, sqm_plot, bedrooms, has_garden, has_garage, construction_type, condition, city, latitude, longitude
- **Derived features**: property_age, price_per_sqm, years_since_renovation
- **Categorical features**: construction_type, condition, heating_type, energy_class, furnished, city
- **Hyperparameters**: num_leaves=31, min_child_samples=30
- **Typical feature count**: ~22

### Land Model

- **Key features**: area_plot_sqm, city, latitude, longitude
- **Categorical features**: city
- **Hyperparameters**: num_leaves=15, min_child_samples=50
- **Typical feature count**: ~4

### Commercial Model

- **Key features**: sqm_total, has_elevator, has_parking, bathrooms, year_built, condition, city, latitude, longitude
- **Derived features**: property_age, price_per_sqm
- **Categorical features**: condition, city
- **Hyperparameters**: num_leaves=31, min_child_samples=30
- **Typical feature count**: ~12

## Per-Country Models

Models are trained independently per country, connecting to that country's database (e.g., `landomo_czech`, `landomo_slovakia`). Each country can have different data volumes and feature distributions.

Supported countries are configured via `SUPPORTED_COUNTRIES` env var with optional database name overrides via `COUNTRY_DB_OVERRIDES`.

## Model Storage

Models are stored on disk at `MODEL_STORAGE_PATH` (default `/app/models`):

```
/app/models/
  czech/
    apartment/
      v1.pkl      # LightGBM Booster
      v1.json     # Metadata
      v2.pkl
      v2.json
    house/
      v1.pkl
      v1.json
  slovakia/
    apartment/
      v1.pkl
      v1.json
```

## Caching Strategy

### Model Cache (Redis, 24h TTL)

- Key: `ml:model:{country}:{category}:active`
- Value: `ModelMetadata` JSON (id, version, file_path, metrics, etc.)
- Invalidated via Redis pub/sub on channel `ml:model:updated:{country}:{category}`

### Prediction Cache (Redis, 1h TTL)

- Key: `ml:pred:{country}:{category}:{md5(features)}`
- Value: Full `PredictionResponse` JSON
- MD5 hash of feature JSON ensures unique keys per feature combination

### Cache Flow

1. Prediction request arrives
2. Check prediction cache (Redis) -- if hit, return cached response
3. Check model cache (Redis) -- if hit, use cached metadata
4. If model not cached, query `ml_model_registry` for active model, cache it
5. Verify model `.pkl` file exists on disk
6. Spawn Python `predict.py` with model path and features
7. Parse `__RESULT_JSON__` output, build response
8. Cache prediction response (1h TTL)
9. Return response

## Confidence Intervals

Confidence intervals are approximated using the model's MAE from training:

```
lower = predicted_price - 1.96 * MAE
upper = predicted_price + 1.96 * MAE
confidence_level = 0.95
```

This provides a rough 95% confidence band based on the assumption that prediction errors are approximately normally distributed.

## Inference Performance

- **Python subprocess timeout**: 5 seconds
- **Typical uncached prediction**: < 500ms (includes Python startup + model load + inference)
- **Cached prediction**: < 50ms (Redis lookup only)
- **Model file verification**: `existsSync` check on `.pkl` path before every uncached prediction
