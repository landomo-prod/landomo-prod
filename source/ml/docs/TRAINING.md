# Training Pipeline

## Overview

The training pipeline fetches property data from PostgreSQL materialized views, engineers features, trains a LightGBM model, evaluates it, and registers it in the model registry.

## Data Source

Training data comes from materialized views named `ml_training_features_{category}`:

- `ml_training_features_apartment`
- `ml_training_features_house`
- `ml_training_features_land`
- `ml_training_features_commercial`

These views are defined in migration 023 and provide pre-joined, denormalized data from `properties_new` with appropriate filters (active listings, valid prices).

## Feature Sets

### Apartment Features
`bedrooms`, `bathrooms`, `sqm`, `floor`, `total_floors`, `rooms`, `has_elevator`, `has_balcony`, `has_parking`, `has_basement`, `has_loggia`, `has_terrace`, `has_garage`, `year_built`, `construction_type`, `condition`, `heating_type`, `energy_class`, `furnished`, `renovation_year`, `hoa_fees`, `city`, `latitude`, `longitude`

### House Features
`bedrooms`, `bathrooms`, `sqm_living`, `sqm_plot`, `total_floors`, `rooms`, `has_garden`, `has_garage`, `has_parking`, `has_basement`, `has_terrace`, `has_pool`, `year_built`, `construction_type`, `condition`, `heating_type`, `energy_class`, `furnished`, `renovation_year`, `city`, `latitude`, `longitude`

### Land Features
`area_plot_sqm`, `city`, `latitude`, `longitude`

### Commercial Features
`sqm_total`, `has_elevator`, `has_parking`, `bathrooms`, `year_built`, `condition`, `city`, `latitude`, `longitude`

## Feature Engineering

The `engineer_features()` function creates derived features:

| Feature | Formula | Categories |
|---------|---------|------------|
| `property_age` | `current_year - year_built` (clipped 0-200) | apartment, house, commercial |
| `price_per_sqm` | `price / sqm` | apartment, house, commercial |
| `floor_ratio` | `floor / total_floors` | apartment only |
| `years_since_renovation` | `current_year - renovation_year` (-1 if none) | apartment, house |

## Missing Data Handling

| Data Type | Strategy | Columns |
|-----------|----------|---------|
| Boolean | Fill with `False` | `has_elevator`, `has_balcony`, etc. |
| Numerical | Median imputation | `bedrooms`, `sqm`, `year_built`, etc. |
| Categorical | Mode imputation (most frequent) | `construction_type`, `condition`, `city`, etc. |

## Train/Test Split

Uses temporal splitting: the last 20% of rows (most recent listings) become the test set. This simulates real-world prediction where the model is trained on historical data and predicts future prices.

## LightGBM Hyperparameters

### Default Parameters
```python
{
    "objective": "regression",
    "metric": "mae",
    "num_leaves": 31,
    "learning_rate": 0.05,
    "feature_fraction": 0.8,
    "bagging_fraction": 0.8,
    "bagging_freq": 5,
    "min_child_samples": 20,
    "verbose": -1,
    "n_jobs": -1,
    "seed": 42,
}
```

### Category-Specific Overrides

| Category | `num_leaves` | `min_child_samples` |
|----------|-------------|---------------------|
| apartment | 63 | 20 |
| house | 31 | 30 |
| land | 15 | 50 |
| commercial | 31 | 30 |

### Training Settings
- **Max boosting rounds**: 1000 (configurable via `--num-boost-round`)
- **Early stopping**: 50 rounds (configurable via `--early-stopping`)
- **Categorical features**: Handled natively by LightGBM (not one-hot encoded)

## Evaluation Metrics

| Metric | Description |
|--------|-------------|
| MAE | Mean Absolute Error |
| RMSE | Root Mean Squared Error |
| R2 | R-squared (coefficient of determination) |
| MAPE | Mean Absolute Percentage Error |
| Within 10% | % of predictions within 10% of true price |
| Within 20% | % of predictions within 20% of true price |

Target performance: R2 > 0.80, MAPE < 15%.

## Running Training

### CLI

```bash
# Basic training
python ml/train_model.py --country czech_republic --category apartment

# With options
python ml/train_model.py \
  --country czech_republic \
  --category apartment \
  --transaction-type sale \
  --min-price 100000 \
  --num-boost-round 1000 \
  --early-stopping 50 \
  --model-dir /app/models

# Skip database registration
python ml/train_model.py --country czech_republic --category house --skip-db-register
```

### CLI Arguments

| Argument | Default | Description |
|----------|---------|-------------|
| `--country` | (required) | Country code |
| `--category` | (required) | apartment/house/land/commercial |
| `--version` | auto-increment | Model version number |
| `--transaction-type` | `sale` | `sale`, `rent`, or `both` |
| `--min-price` | `100000` | Minimum price filter |
| `--max-price` | (none) | Maximum price filter |
| `--limit` | (none) | Max training samples |
| `--model-dir` | `/app/models` | Base directory for saved models |
| `--num-boost-round` | `1000` | Max boosting rounds |
| `--early-stopping` | `50` | Early stopping patience |
| `--skip-db-register` | `false` | Skip model registry insert |

### Automated Retraining

Weekly automated retraining is configured via cron: `0 2 * * 0` (every Sunday at 2 AM). The training job is triggered via BullMQ.

## Model Output

Training produces two files per model:

```
/app/models/{country}/{category}/v{version}.pkl    # LightGBM Booster (joblib)
/app/models/{country}/{category}/v{version}.json   # Metadata + metrics
```

The model is also registered in the `ml_model_registry` table with status `active`. Previous versions for the same country+category are set to `archived`.
