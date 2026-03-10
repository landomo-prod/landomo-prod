# ML Pricing Service

Machine learning price prediction and deal quality analysis.

## Overview

**Port**: 3500  
**Technology**: Python 3.11 + LightGBM + scikit-learn, TypeScript/Fastify API  
**Models**: Per country, per category

## Features

- Price predictions with confidence intervals
- Deal quality scoring (excellent/good/fair/poor)
- Model performance metrics (R², MAPE)
- Redis caching (models 24h, predictions 1h)
- Automated weekly retraining (Sunday 2 AM)

## API Endpoints

See `/docs/API_REFERENCE.md#ml-pricing-service-api`

- `POST /predictions` - Get prediction & deal score
- `GET /models/:country/:category/info` - Model info

## Prediction Example

```json
{
  "country": "czech_republic",
  "property_category": "apartment",
  "features": {
    "city": "Prague",
    "apt_bedrooms": 2,
    "apt_sqm": 75,
    "apt_has_elevator": true,
    "latitude": 50.0755,
    "longitude": 14.4378
  }
}
```

## Model Training

Training data from materialized views:

```sql
CREATE MATERIALIZED VIEW ml_training_features_apartment AS
SELECT
  price,
  apt_bedrooms,
  apt_sqm,
  apt_floor,
  city,
  latitude,
  longitude
FROM properties_apartment
WHERE status IN ('sold', 'rented')
  AND price IS NOT NULL;
```

Weekly automated retraining via BullMQ.

## Performance Metrics

- **R² Score**: > 0.80
- **MAPE**: < 15%
- **Inference Time**: < 500ms (uncached), < 50ms (cached)

---

**Last Updated**: 2026-02-16
