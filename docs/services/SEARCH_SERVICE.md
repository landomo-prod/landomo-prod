# Search Service

Global property search API querying all country databases.

## Overview

**Port**: 4000  
**Technology**: Fastify + TypeScript + PostgreSQL (multi-DB)  
**Deployment**: Single central instance

## Features

- **Multi-Country Search**: Query all countries simultaneously
- **Category-Specific Filters**: apartment/house/land/commercial
- **Geographic Search**: Bounding box and radius queries
- **Aggregations**: Price stats, sqm stats, counts
- **Partition Pruning**: Fast queries via category filtering

## Quick Start

```bash
cd search-service
npm install
npm run build
npm run dev
```

## API Endpoints

See `/docs/API_REFERENCE.md#search-service-api`

- `POST /search` - Main search endpoint
- `POST /search/geo` - Geographic search
- `GET /properties/:id` - Get single property

## Search Example

```json
{
  "countries": ["czech_republic", "slovakia"],
  "filters": {
    "property_category": "apartment",
    "transaction_type": "sale",
    "city": "Prague",
    "price_min": 5000000,
    "price_max": 10000000,
    "apt_bedrooms_min": 2,
    "apt_sqm_min": 60,
    "apt_has_balcony": true
  },
  "sort_by": "price_asc",
  "page": 1,
  "limit": 20
}
```

## Performance

- **Partition Pruning**: Include `property_category` in all queries
- **Partial Indexes**: All indexes use `WHERE status = 'active'`
- **Connection Pooling**: 20 connections per country database
- **Query Time**: <50ms typical, <100ms with aggregations

## Configuration

```bash
PORT=4000
SEARCH_API_KEY=your_key

# Per-country database connections
DB_CZECH_HOST=localhost
DB_CZECH_DATABASE=landomo_czech_republic
DB_CZECH_USER=landomo_search
DB_CZECH_PASSWORD=your_password

# Repeat for each country...
```

## Related Documentation

- **API Reference**: `/docs/API_REFERENCE.md`
- **Performance**: `/docs/advanced/PERFORMANCE.md`

---

**Last Updated**: 2026-02-16
