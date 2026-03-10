# CLAUDE.MD - Core Service Development Guide

**Component**: Landomo Core Service (REST API)
**Purpose**: Centralized property data ingestion service
**Technology**: Fastify + TypeScript + BullMQ + PostgreSQL
**Status**: Production-ready, fully tested

---

## 🎯 Purpose

The Core Service is the **central hub** that receives property data from all regional scrapers, validates it, queues it for processing, and stores it in country-specific databases.

### Key Responsibilities

1. **HTTP API**: Accept property data via REST endpoints
2. **Authentication**: Verify API keys from scrapers
3. **Validation**: Ensure data meets schema requirements
4. **Queuing**: Push to internal Redis queue for async processing
5. **Batch Processing**: Process properties in batches (100 at a time)
6. **Database Management**: Store data in per-country PostgreSQL databases

---

## 📐 Architecture

```
┌──────────────────────────────────────────────────────┐
│              Core Service Architecture                │
└──────────────────────────────────────────────────────┘

HTTP Layer
┌──────────────────┐
│  POST /ingest    │ ← Scrapers send data here
│  GET /health     │
└────────┬─────────┘
         │
         ▼
Middleware
┌──────────────────┐
│  Authentication  │ (API key validation)
│  Error Handler   │
└────────┬─────────┘
         │
         ▼
Queue Layer
┌──────────────────┐
│  Redis Queue     │ (Internal, non-blocking)
│  (BullMQ)        │
└────────┬─────────┘
         │
         ▼
Worker Layer
┌──────────────────┐
│  Batch Worker    │ (Background processing)
│  (BullMQ Worker) │
└────────┬─────────┘
         │
         ▼
Database Layer
┌──────────────────────────┐
│  PostgreSQL              │
│  ├── landomo_australia   │
│  ├── landomo_uk          │
│  ├── landomo_italy       │
│  └── ... (~200 DBs)      │
└──────────────────────────┘
```

---

## 📁 File Structure

```
landomo-core-service/
├── src/
│   ├── server.ts                    # Main API server (Fastify)
│   ├── start-worker.ts              # Worker entry point
│   │
│   ├── routes/
│   │   ├── ingest.ts                # POST /api/v1/properties/ingest
│   │   ├── bulk-ingest.ts           # POST /api/v1/properties/bulk-ingest
│   │   └── health.ts                # GET /api/v1/health
│   │
│   ├── middleware/
│   │   ├── auth.ts                  # API key authentication
│   │   └── error-handler.ts         # Global error handler
│   │
│   ├── database/
│   │   ├── manager.ts               # Multi-DB connection manager
│   │   └── bulk-operations.ts       # Bulk INSERT/UPDATE
│   │
│   ├── queue/
│   │   └── internal-queue.ts        # Redis queue setup
│   │
│   ├── workers/
│   │   └── batch-ingestion.ts       # Background worker
│   │
│   └── config/
│       └── index.ts                 # Configuration loader
│
├── .env                              # Configuration
├── .eslintrc.json                    # Linting rules
├── .prettierrc.json                  # Code formatting
├── tsconfig.json                     # TypeScript config
├── package.json                      # Dependencies & scripts
├── TEST_RESULTS.md                   # Test documentation
└── CLAUDE.MD                         # This file
```

---

## 🚀 Quick Start

### Start Services

```bash
# Install dependencies
npm install

# Start API server (Terminal 1)
npm run dev

# Start batch worker (Terminal 2)
npm run dev:worker

# Or in production
npm run build
npm run start         # API
npm run start:worker  # Worker
```

### Test Endpoints

```bash
# Health check
curl http://localhost:3000/api/v1/health

# Ingest property (with API key)
curl -X POST http://localhost:3000/api/v1/properties/ingest \
  -H "Authorization: Bearer dev_key_1" \
  -H "Content-Type: application/json" \
  -d '{
    "portal": "domain",
    "portal_id": "test-123",
    "country": "australia",
    "data": {
      "title": "Test Property",
      "price": 500000,
      "property_type": "apartment",
      "bedrooms": 2,
      "bathrooms": 1,
      "location": { "city": "Sydney", "country": "Australia" }
    },
    "raw_data": {}
  }'
```

### Run Tests

```bash
# Linting
npm run lint          # Check issues
npm run lint:fix      # Auto-fix

# Type checking
npm run type-check

# Format code
npm run format

# Manual tests
./test-health.sh
./test-ingest.sh
```

---

## 🔑 API Endpoints

### POST /api/v1/properties/ingest

**Purpose**: Ingest a single property

**Authentication**: Required (Bearer token)

**Request**:
```json
{
  "portal": "domain",
  "portal_id": "2019285123",
  "country": "australia",
  "data": {
    "title": "Modern 3-Bedroom Apartment",
    "price": 950000,
    "currency": "AUD",
    "property_type": "apartment",
    "transaction_type": "sale",
    "location": {
      "address": "123 George Street",
      "city": "Sydney",
      "region": "New South Wales",
      "country": "Australia",
      "postal_code": "2000",
      "coordinates": { "lat": -33.8688, "lon": 151.2093 }
    },
    "details": {
      "bedrooms": 3,
      "bathrooms": 2,
      "sqm": 120,
      "floor": 5
    },
    "amenities": {
      "has_parking": true,
      "has_balcony": true,
      "has_pool": true
    },
    "images": ["https://...jpg"],
    "description": "...",
    "agent": {
      "name": "John Smith",
      "phone": "+61 2 1234 5678"
    }
  },
  "raw_data": { /* original portal response */ }
}
```

**Response** (202 Accepted):
```json
{
  "status": "accepted",
  "message": "Property queued for ingestion"
}
```

**Error Responses**:
- `400`: Missing required fields
- `401`: Unauthorized (invalid API key)
- `500`: Internal server error

### GET /api/v1/health

**Purpose**: Health check

**Authentication**: Not required

**Response** (200 OK):
```json
{
  "status": "healthy",
  "timestamp": "2026-01-31T...",
  "uptime": 123.45,
  "version": "1.0.0"
}
```

---

## 🗄️ Database Architecture

### Multi-Database Manager

**Pattern**: One database per country

```typescript
// database/manager.ts
const connections = new Map<string, Pool>();

export function getCoreDatabase(country: string): Pool {
  const dbName = `landomo_${country.toLowerCase()}`;

  if (!connections.has(dbName)) {
    connections.set(dbName, new Pool({
      host: config.database.host,
      port: config.database.port,
      user: config.database.user,
      password: config.database.password,
      database: dbName,
      max: config.database.maxConnections,
    }));
  }

  return connections.get(dbName)!;
}
```

### Schema

**Category-Partitioned Architecture** (Migration 013):

```sql
-- properties_new (partitioned base table)
CREATE TABLE properties_new (
  -- Core identification
  id UUID DEFAULT gen_random_uuid(),
  portal VARCHAR(100) NOT NULL,
  portal_id VARCHAR(255) NOT NULL,
  title TEXT NOT NULL,
  price NUMERIC NOT NULL,
  currency VARCHAR(10) NOT NULL DEFAULT 'CZK',

  -- Category drives partitioning
  property_category VARCHAR(20) NOT NULL CHECK (property_category IN ('apartment', 'house', 'land', 'commercial')),
  transaction_type VARCHAR(10) NOT NULL CHECK (transaction_type IN ('sale', 'rent')),

  -- Location (JSONB + denormalized fields)
  location JSONB NOT NULL,
  city VARCHAR(255),
  country VARCHAR(100) NOT NULL,
  latitude NUMERIC,
  longitude NUMERIC,

  -- Status & lifecycle
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Tier I: Apartment columns (apt_*)
  apt_bedrooms INTEGER,
  apt_sqm NUMERIC,
  apt_floor INTEGER,
  apt_has_elevator BOOLEAN,
  apt_has_balcony BOOLEAN,
  apt_has_parking BOOLEAN,
  apt_has_basement BOOLEAN,
  -- ... 42 apartment-specific fields

  -- Tier I: House columns (house_*)
  house_bedrooms INTEGER,
  house_sqm_living NUMERIC,
  house_sqm_plot NUMERIC,
  house_has_garden BOOLEAN,
  house_has_garage BOOLEAN,
  house_has_parking BOOLEAN,
  house_has_basement BOOLEAN,
  -- ... 41 house-specific fields

  -- Tier I: Land columns (land_*)
  land_area_plot_sqm NUMERIC,
  land_zoning VARCHAR(50),
  land_water_supply VARCHAR(50),
  land_sewage VARCHAR(50),
  land_electricity VARCHAR(50),
  -- ... 26 land-specific fields

  -- Tier I: Commercial columns (comm_*) ✨ NEW
  comm_sqm_total NUMERIC,
  comm_has_elevator BOOLEAN,
  comm_has_parking BOOLEAN,
  comm_has_bathrooms BOOLEAN,
  comm_property_subtype VARCHAR(50),
  comm_monthly_rent NUMERIC,
  comm_lease_type VARCHAR(50),
  -- ... 60+ commercial-specific fields

  -- Tier II: Country-specific (JSONB)
  country_specific JSONB DEFAULT '{}'::jsonb,

  -- Tier III: Portal metadata (JSONB)
  portal_metadata JSONB DEFAULT '{}'::jsonb,
  media JSONB,
  agent JSONB,

  -- Portal & lifecycle
  source_url TEXT NOT NULL,
  source_platform TEXT NOT NULL,
  raw_data JSONB NOT NULL,

  -- Constraints
  CONSTRAINT unique_portal_property_new UNIQUE (portal, portal_id, property_category),
  PRIMARY KEY (id, property_category)

) PARTITION BY LIST (property_category);

-- Partitions (automatic routing via property_category)
CREATE TABLE properties_apartment PARTITION OF properties_new FOR VALUES IN ('apartment');
CREATE TABLE properties_house PARTITION OF properties_new FOR VALUES IN ('house');
CREATE TABLE properties_land PARTITION OF properties_new FOR VALUES IN ('land');
CREATE TABLE properties_commercial PARTITION OF properties_new FOR VALUES IN ('commercial');

-- Indexes (42 per partition = 168 total)
-- Apartment partition indexes
CREATE INDEX idx_apt_bedrooms ON properties_apartment(apt_bedrooms) WHERE status = 'active';
CREATE INDEX idx_apt_price ON properties_apartment(price) WHERE status = 'active';
CREATE INDEX idx_apt_city ON properties_apartment(city) WHERE status = 'active';
-- ... 39 more apartment indexes

-- House partition indexes
CREATE INDEX idx_house_bedrooms ON properties_house(house_bedrooms) WHERE status = 'active';
CREATE INDEX idx_house_sqm_plot ON properties_house(house_sqm_plot) WHERE status = 'active';
-- ... 40 more house indexes

-- Land partition indexes
CREATE INDEX idx_land_area ON properties_land(land_area_plot_sqm) WHERE status = 'active';
CREATE INDEX idx_land_zoning ON properties_land(land_zoning) WHERE status = 'active';
-- ... 24 more land indexes

-- Commercial partition indexes ✨ NEW
CREATE INDEX idx_comm_subtype ON properties_commercial(comm_property_subtype) WHERE status = 'active';
CREATE INDEX idx_comm_sqm ON properties_commercial(comm_sqm_total) WHERE status = 'active';
-- ... 40 more commercial indexes

-- property_changes (audit trail)
CREATE TABLE property_changes (
  id UUID PRIMARY KEY,
  property_id UUID REFERENCES properties_new(id),
  change_type VARCHAR(20),
  changed_fields JSONB,
  old_values JSONB,
  new_values JSONB,
  changed_at TIMESTAMP DEFAULT NOW()
);

-- price_history (denormalized)
CREATE TABLE price_history (
  id UUID PRIMARY KEY,
  property_id UUID REFERENCES properties_new(id),
  price NUMERIC NOT NULL,
  recorded_at TIMESTAMP DEFAULT NOW()
);

-- ingestion_log (tracking)
CREATE TABLE ingestion_log (
  id UUID PRIMARY KEY,
  portal VARCHAR(100),
  portal_listing_id VARCHAR(255),
  property_category VARCHAR(20),
  ingested_at TIMESTAMP DEFAULT NOW(),
  status VARCHAR(20),
  error_message TEXT,
  raw_payload JSONB
);
```

**Migration Status**:
- ✅ Migration 013 applied to `landomo_cz` (2026-02-10)
- ✅ 4 partitions created (apartment, house, land, commercial)
- ✅ 168 category-specific indexes created
- ✅ Partition pruning working correctly

---

## ⚙️ Configuration

### Environment Variables (.env)

```bash
# Server
PORT=3000
HOST=0.0.0.0

# API Keys (comma-separated)
API_KEYS=dev_key_1,dev_key_2,prod_key_xyz

# PostgreSQL
DB_HOST=localhost
DB_PORT=5432
DB_USER=landomo
DB_PASSWORD=landomo_dev_pass
DB_MAX_CONNECTIONS=20

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Batch Processing
BATCH_SIZE=100
BATCH_TIMEOUT=10000
BATCH_WORKERS=5
```

### Configuration Loader

```typescript
// config/index.ts
export const config = {
  server: {
    port: parseInt(process.env.PORT || '3000'),
    host: process.env.HOST || '0.0.0.0',
  },
  auth: {
    apiKeys: process.env.API_KEYS?.split(',') || [],
  },
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    user: process.env.DB_USER || 'landomo',
    password: process.env.DB_PASSWORD || '',
    maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '20'),
  },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD || undefined,
  },
  batch: {
    size: parseInt(process.env.BATCH_SIZE || '100'),
    timeout: parseInt(process.env.BATCH_TIMEOUT || '10000'),
    workers: parseInt(process.env.BATCH_WORKERS || '5'),
  },
};
```

---

## 🔐 Authentication

### API Key Middleware

```typescript
// middleware/auth.ts
export async function authMiddleware(request, reply) {
  // Skip auth for health endpoint
  if (request.url === '/api/v1/health') {
    return;
  }

  const authHeader = request.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return reply.status(401).send({
      error: 'Unauthorized',
      message: 'Missing or invalid Authorization header',
    });
  }

  const token = authHeader.substring(7);

  if (!config.auth.apiKeys.includes(token)) {
    return reply.status(401).send({
      error: 'Unauthorized',
      message: 'Invalid API key',
    });
  }
}
```

### Usage in Scraper

```typescript
// Scraper side
const response = await axios.post(
  'http://localhost:3000/api/v1/properties/ingest',
  payload,
  {
    headers: {
      'Authorization': `Bearer ${process.env.CORE_SERVICE_API_KEY}`,
      'Content-Type': 'application/json',
    },
  }
);
```

---

## 🔄 Async Processing

### Flow

```
1. Scraper sends POST request
   ↓
2. API validates and adds to queue → Returns 202 Accepted
   ↓
3. Worker picks up job from queue
   ↓
4. Worker performs bulk INSERT
   ↓
5. Job marked complete (or retried on failure)
```

### Benefits

- **Fast response**: Scraper doesn't wait for DB
- **Resilience**: Automatic retries on failure
- **Batching**: Can process multiple jobs at once
- **Scalability**: Add more workers easily

### Worker Implementation

```typescript
// workers/batch-ingestion.ts
export function startBatchIngestionWorker() {
  const worker = new Worker<IngestionPayload>(
    'ingest-property',
    async (job: Job<IngestionPayload>) => {
      const payload = job.data;

      try {
        const db = getCoreDatabase(payload.country);
        const result = await bulkInsertOrUpdateProperties(db, [payload]);

        return {
          success: true,
          country: payload.country,
          portal: payload.portal,
          ...result,
        };
      } catch (error) {
        console.error(`Failed to ingest property:`, error);
        throw error; // Will trigger retry
      }
    },
    {
      connection: {
        host: config.redis.host,
        port: config.redis.port,
        password: config.redis.password,
      },
      concurrency: config.batch.workers, // 5 workers in parallel
      limiter: {
        max: 10,       // Max 10 jobs per...
        duration: 1000, // ...second
      },
    }
  );

  worker.on('completed', (job) => {
    console.log(`Job ${job.id} completed`);
  });

  worker.on('failed', (job, err) => {
    console.error(`Job ${job?.id} failed:`, err);
  });

  return worker;
}
```

---

## 📊 Monitoring & Debugging

### Check Queue

```bash
# Redis CLI
redis-cli

# Check queue length
> LLEN bull:ingest-property:wait

# View keys
> KEYS "bull:*"

# Monitor commands
> MONITOR
```

### Check Database

```sql
-- Count properties
SELECT COUNT(*) FROM properties;

-- Recent ingestions
SELECT portal, COUNT(*) as count, MAX(created_at) as last_ingestion
FROM properties
GROUP BY portal
ORDER BY last_ingestion DESC;

-- Failed ingestions
SELECT portal, error_message, COUNT(*)
FROM ingestion_log
WHERE status = 'error'
GROUP BY portal, error_message;
```

### Check Logs

```bash
# API logs (stdout)
# Worker logs (stdout)

# PostgreSQL logs
sudo tail -f /var/log/postgresql/postgresql-16-main.log

# Redis logs
sudo tail -f /var/log/redis/redis-server.log
```

---

## 🧪 Testing

### Unit Tests

```bash
# Run type check
npm run type-check

# Run linter
npm run lint
```

### Integration Tests

```bash
# Health endpoint
./test-health.sh

# Ingestion endpoint
./test-ingest.sh
```

### Manual Testing

```bash
# Send test property
curl -X POST http://localhost:3000/api/v1/properties/ingest \
  -H "Authorization: Bearer dev_key_1" \
  -H "Content-Type: application/json" \
  -d @test-property.json

# Check if it reached database
psql -U landomo -d landomo_australia \
  -c "SELECT * FROM properties ORDER BY created_at DESC LIMIT 1;"
```

---

## 🐛 Common Issues

### Issue: "Cannot connect to Redis"

**Solution**:
```bash
sudo systemctl start redis-server
redis-cli ping  # Should return PONG
```

### Issue: "Cannot connect to PostgreSQL"

**Solution**:
```bash
sudo systemctl start postgresql
psql -U landomo -d landomo_australia  # Test connection
```

### Issue: "Database does not exist"

**Solution**:
```bash
# Create database
sudo -u postgres psql
CREATE DATABASE landomo_australia;
GRANT ALL PRIVILEGES ON DATABASE landomo_australia TO landomo;

# Apply schema
psql -U landomo -d landomo_australia < path/to/schema.sql
```

### Issue: Worker not processing jobs

**Check**:
1. Is worker running? (`ps aux | grep worker`)
2. Is Redis accessible? (`redis-cli ping`)
3. Are there jobs in queue? (`redis-cli LLEN bull:ingest-property:wait`)
4. Check worker logs for errors

---

## 📈 Performance Optimization

### Batch Processing

Currently: Individual inserts (1 property at a time)

**Future optimization**:
```typescript
// Process 100 properties at once with single INSERT
await bulkInsertOrUpdateProperties(db, properties);

// Expected: 10-50x faster
```

### Connection Pooling

```typescript
// Already implemented
const pool = new Pool({
  max: 20,  // Max 20 connections per DB
});
```

### Caching

**Future**: Cache static data
- District lists
- Currency conversion rates
- Portal configurations

---

## ✅ Best Practices

### Code Style

1. **Use TypeScript strict mode**
2. **Async/await** (not callbacks)
3. **Proper error handling** (try/catch)
4. **Parameterized SQL queries** (prevent injection)
5. **Meaningful variable names**
6. **JSDoc comments** for functions

### Security

1. **Never log API keys**
2. **Use parameterized queries** (never string interpolation)
3. **Validate all input**
4. **Rate limit** API endpoints
5. **Use HTTPS** in production

### Database

1. **Use connection pooling**
2. **Batch operations** when possible
3. **Index frequently queried fields**
4. **Monitor query performance**
5. **Regular backups**

---

## 🚀 Deployment

### Docker

```dockerfile
FROM node:20-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY dist/ ./dist/
CMD ["node", "dist/server.js"]
```

### Kubernetes

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: core-service
spec:
  replicas: 3
  selector:
    matchLabels:
      app: core-service
  template:
    metadata:
      labels:
        app: core-service
    spec:
      containers:
        - name: core-service
          image: landomo/core-service:latest
          ports:
            - containerPort: 3000
          env:
            - name: API_KEYS
              valueFrom:
                secretKeyRef:
                  name: core-service-secrets
                  key: api-keys
```

---

## 📚 Related Documentation

- **Root CLAUDE.MD**: `/home/samuelseidel/landomo/CLAUDE.MD`
- **Test Results**: `TEST_RESULTS.md`
- **Architecture**: `/home/samuelseidel/landomo/ARCHITECTURE_VALIDATION_COMPLETE.md`
- **Quick Start**: `/home/samuelseidel/landomo/QUICK_START.md`

---

**Status**: Production-ready
**Last Tested**: 2026-01-31
**Test Pass Rate**: 100% (13/13 tests)

---

*This guide is actively maintained. Last updated: 2026-01-31*
