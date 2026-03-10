# Development Guide

Complete guide for developing and contributing to Landomo-World.

## Quick Start

```bash
# Clone repository
git clone https://github.com/yourusername/landomo-world.git
cd landomo-world

# Install dependencies
cd shared-components && npm install && npm run build
cd ../ingest-service && npm install
cd ../search-service && npm install

# Start infrastructure
docker compose -f docker/docker-compose.yml --env-file .env.dev up -d postgres redis

# Start services
cd ingest-service && npm run dev       # Terminal 1
cd ingest-service && npm run dev:worker # Terminal 2
cd search-service && npm run dev       # Terminal 3
```

## Development Workflow

### 1. Type-Driven Development

**Always build shared-components first**:

```bash
cd shared-components
npm run build
npm run type-check
```

**Why**: All services depend on `@landomo/core` types. Changes to types require rebuilding.

### 2. Feature Development Pattern

```
1. Define types in shared-components
2. Build shared-components
3. Implement in service
4. Type-check service
5. Test locally
6. Commit
```

### 3. Git Workflow

```bash
# Create feature branch
git checkout -b feature/apartment-filters

# Make changes
# ...

# Type check before commit
cd shared-components && npm run build
cd ../ingest-service && npm run type-check

# Commit
git add .
git commit -m "feat: add apartment floor filters"

# Push
git push origin feature/apartment-filters
```

## Project Structure

```
landomo-world/
├── shared-components/          # Shared TypeScript types
│   └── src/types/
│       ├── ApartmentPropertyTierI.ts
│       ├── HousePropertyTierI.ts
│       ├── LandPropertyTierI.ts
│       └── CommercialPropertyTierI.ts
│
├── ingest-service/            # Property ingestion API
│   ├── src/
│   │   ├── routes/           # API endpoints
│   │   ├── database/         # DB operations
│   │   ├── queue/            # BullMQ setup
│   │   └── workers/          # Background workers
│   └── migrations/           # Database migrations
│
├── search-service/            # Property search API
│   └── src/
│       ├── routes/           # Search endpoints
│       └── core/             # Search engine
│
├── polygon-service/           # OSM boundary service
├── ml-pricing-service/        # ML price predictions
│
├── scrapers/                  # Regional scrapers
│   ├── Czech Republic/
│   │   ├── sreality/
│   │   ├── bezrealitky/
│   │   └── ...
│   ├── Slovakia/
│   └── ...
│
└── docker/                    # Infrastructure
    ├── docker-compose.yml
    └── postgres/
```

## Code Style

### TypeScript

```typescript
// ✅ Good: Type-safe, explicit
export async function bulkInsert(
  pool: Pool,
  properties: ApartmentPropertyTierI[]
): Promise<BulkInsertResult> {
  // ...
}

// ❌ Bad: Untyped, implicit
export async function bulkInsert(pool, properties) {
  // ...
}
```

### Async/Await

```typescript
// ✅ Good: Async/await with error handling
try {
  const result = await database.insert(property);
  return result;
} catch (error) {
  logger.error('Insert failed', error);
  throw error;
}

// ❌ Bad: Callbacks
database.insert(property, (error, result) => {
  if (error) {
    console.log(error);
  }
});
```

### SQL Queries

```typescript
// ✅ Good: Parameterized queries
const result = await pool.query(
  'SELECT * FROM properties_new WHERE property_category = $1 AND city = $2',
  ['apartment', 'Prague']
);

// ❌ Bad: String concatenation (SQL injection risk)
const result = await pool.query(
  `SELECT * FROM properties_new WHERE city = '${city}'`
);
```

## Testing

### Type Checking

```bash
# Check all services
cd shared-components && npm run build
cd ../ingest-service && npm run type-check
cd ../search-service && npm run type-check
```

### Linting

```bash
cd ingest-service
npm run lint          # Check issues
npm run lint:fix      # Auto-fix
```

### Manual Testing

```bash
# Test ingest endpoint
curl -X POST http://localhost:3000/bulk-ingest \
  -H "Authorization: Bearer dev_key_1" \
  -H "Content-Type: application/json" \
  -d @test-payload.json

# Test search endpoint
curl -X POST http://localhost:4000/search \
  -H "Authorization: Bearer dev_key_1" \
  -H "Content-Type: application/json" \
  -d '{"countries":["czech_republic"],"filters":{"property_category":"apartment"}}'
```

## Database Development

### Migrations

```bash
# Create new migration
cd ingest-service/migrations
touch 030_add_new_feature.sql

# Apply migration
psql -U landomo -d landomo_czech_republic -f 030_add_new_feature.sql

# Verify
psql -U landomo -d landomo_czech_republic -c "\d properties_new"
```

### Query Testing

```sql
-- Test query performance
EXPLAIN ANALYZE
SELECT * FROM properties_new
WHERE property_category = 'apartment'
  AND city = 'Prague'
  AND status = 'active';

-- Check partition pruning
EXPLAIN
SELECT * FROM properties_new
WHERE property_category = 'apartment';
-- Should show: Scan on properties_apartment
```

## Scraper Development

### New Scraper Template

```bash
# Create scraper structure
mkdir -p scrapers/CountryName/portal-name/src/{scrapers,transformers,adapters}
cd scrapers/CountryName/portal-name

# Initialize npm
npm init -y
npm install express axios @landomo/core

# Create files
touch src/index.ts
touch src/scrapers/listingsScraper.ts
touch src/transformers/apartmentTransformer.ts
touch src/adapters/ingestAdapter.ts
```

### Transformer Pattern

```typescript
import { ApartmentPropertyTierI } from '@landomo/core';

export function transformApartment(raw: any): ApartmentPropertyTierI {
  return {
    property_category: 'apartment', // REQUIRED
    title: raw.title,
    price: parseFloat(raw.price),
    currency: 'CZK',
    transaction_type: raw.type === 'prodej' ? 'sale' : 'rent',
    
    location: {
      city: raw.location.city,
      country: 'Czech Republic',
      coordinates: {
        lat: raw.lat,
        lon: raw.lon
      }
    },
    
    bedrooms: raw.rooms - 1, // 2+kk = 1 bedroom
    sqm: raw.area,
    has_elevator: raw.elevator === 'ano',
    has_balcony: raw.features.includes('balkon'),
    has_parking: raw.features.includes('parkování'),
    has_basement: raw.features.includes('sklep'),
    
    source_url: raw.url,
    source_platform: 'portal-name',
    portal_id: raw.id.toString(),
    status: 'active'
  };
}
```

## Environment Configuration

### Development (.env.dev)

```bash
# Database
DB_HOST=localhost
DB_PORT=5432
DB_USER=landomo
DB_PASSWORD=landomo_dev_pass

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# API Keys
INGEST_API_KEY=dev_key_1
SEARCH_API_KEY=dev_key_2
```

### Production (.env.prod)

```bash
# Database
DB_HOST=production-db.example.com
DB_PORT=5432
DB_USER=landomo_prod
DB_PASSWORD=${SECRET_DB_PASSWORD}

# Redis
REDIS_HOST=production-redis.example.com
REDIS_PORT=6379
REDIS_PASSWORD=${SECRET_REDIS_PASSWORD}

# API Keys
INGEST_API_KEY=${SECRET_INGEST_KEY}
SEARCH_API_KEY=${SECRET_SEARCH_KEY}
```

## Common Tasks

### Add New Property Category

1. Create TypeScript type in `shared-components/src/types/`
2. Add partition to migration `013_category_partitioning.sql`
3. Update `bulk-operations.ts` UPSERT logic
4. Add category-specific indexes
5. Update scrapers to use new type

### Add Country-Specific Field

Add to Tier II (country_specific JSONB):

```typescript
const apartment: ApartmentPropertyTierI = {
  // ...
  country_specific: {
    czech_disposition: '2+kk',
    czech_ownership: 'osobní'
  }
};
```

### Add Universal Field

1. Add column to migration
2. Update TierI types
3. Update `bulk-operations.ts` column list
4. Add index if queryable
5. Rebuild shared-components

## Debugging

### Database Issues

```sql
-- Check active connections
SELECT * FROM pg_stat_activity
WHERE datname = 'landomo_czech_republic';

-- Check table sizes
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Check index usage
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan as index_scans
FROM pg_stat_user_indexes
ORDER BY idx_scan ASC;
```

### Redis Issues

```bash
# Check queue length
redis-cli LLEN bull:ingest-property:wait

# Monitor commands
redis-cli MONITOR

# Check memory usage
redis-cli INFO memory
```

### Worker Not Processing

```bash
# Check if worker is running
ps aux | grep "start-worker"

# Check Redis connection
redis-cli ping

# Check worker logs
pm2 logs worker-czech
```

## Performance Optimization

### Query Optimization

```sql
-- Always include property_category and status
SELECT * FROM properties_new
WHERE property_category = 'apartment'
  AND status = 'active'
  AND city = 'Prague';
```

### Batch Processing

```typescript
// Process in batches of 100
const BATCH_SIZE = 100;
for (let i = 0; i < properties.length; i += BATCH_SIZE) {
  const batch = properties.slice(i, i + BATCH_SIZE);
  await bulkInsertOrUpdateProperties(pool, batch);
}
```

## Related Documentation

- **Architecture**: `/docs/ARCHITECTURE.md`
- **API Reference**: `/docs/API_REFERENCE.md`
- **Data Model**: `/docs/DATA_MODEL.md`
- **Troubleshooting**: `/docs/TROUBLESHOOTING.md`

---

**Last Updated**: 2026-02-16
