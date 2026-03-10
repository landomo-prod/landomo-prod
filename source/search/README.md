# Landomo Search Service

Federated search service that provides unified search across all country databases.

## Features

- **Multi-Country Search**: Query properties across multiple countries in parallel
- **Country-Specific Filters**: Each country has custom fields (Czech disposition, UK tenure, etc.)
- **Geographic Search**: PostGIS-powered radius search
- **Caching**: Redis-based caching for fast responses
- **Modular Architecture**: Easy to add new countries

## Architecture

```
Search Service
├── Federated queries across 7 country databases
├── Country-specific modules (Czech, UK, USA, etc.)
├── Redis caching layer
└── PostGIS geo-search support
```

## API Endpoints

### Search
```bash
POST /api/v1/search
```

**Example**:
```json
{
  "countries": ["czech", "uk"],
  "filters": {
    "city": "Praha",
    "price_max": 10000000,
    "bedrooms": 2,
    "disposition": "2+kk"
  },
  "sort": {
    "field": "price",
    "order": "asc"
  },
  "pagination": {
    "limit": 20,
    "offset": 0
  }
}
```

### Geographic Search
```bash
POST /api/v1/search/geo
```

**Example**:
```json
{
  "latitude": 50.0755,
  "longitude": 14.4378,
  "radius_km": 5,
  "filters": {
    "property_type": "apartment",
    "price_max": 5000000
  }
}
```

### Property Detail
```bash
GET /api/v1/properties/:id?country=<code>
```

### Aggregations
```bash
GET /api/v1/aggregations?countries=*&type=overview
```

## Quick Start

### Development

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Start development server
npm run dev
```

### Docker

```bash
# Build and run
docker compose -f docker-compose.yml -f docker-compose.search.yml up search-service

# View logs
docker logs -f landomo-search-service
```

## Configuration

Environment variables (see `.env.example`):

- `PORT`: Server port (default: 4000)
- `DB_READ_USER`: Read-only database user
- `DB_READ_PASSWORD`: Database password
- `REDIS_HOST`: Redis host
- `CACHE_TTL_SEARCH`: Search cache TTL in seconds (default: 300)

## Database Setup

Before running the search service:

1. **Create read-only user**:
```bash
psql -U postgres -f docker/postgres/create-readonly-user.sql
```

2. **Enable PostGIS**:
```bash
psql -U postgres -f docker/postgres/enable-postgis.sql
```

## Country Modules

Each country has a dedicated module with:
- Custom field definitions
- Country-specific filters
- Result transformations
- Filter metadata

**Adding a new country**:

1. Create module: `src/countries/newcountry/index.ts`
2. Extend `CountryModule` base class
3. Register in `src/countries/index.ts`

Example:
```typescript
export class NewCountryModule extends CountryModule {
  config = {
    code: 'newcountry',
    name: 'New Country',
    database: 'landomo_newcountry',
    currency: 'EUR'
  };

  fields = [
    // Define country-specific fields
  ];

  enhanceQuery(baseQuery, filters) {
    // Add country-specific query logic
    return baseQuery;
  }

  transformResult(dbRow) {
    // Transform result for API
    return { ...dbRow, country: 'newcountry' };
  }
}
```

## Performance

- **Single-country search**: 10-30ms
- **Multi-country search (3 countries)**: 30-50ms
- **Geo-radius search (5km)**: 20-50ms
- **Cache hit**: <5ms

## Testing

```bash
# Type check
npm run type-check

# Lint
npm run lint

# Format
npm run format
```

### Test Requests

```bash
# Health check
curl http://localhost:4000/api/v1/health

# Search
curl -X POST http://localhost:4000/api/v1/search \
  -H "Content-Type: application/json" \
  -d '{
    "countries": ["czech"],
    "filters": {"city": "Praha"},
    "pagination": {"limit": 5}
  }'

# Geo-search
curl -X POST http://localhost:4000/api/v1/search/geo \
  -H "Content-Type: application/json" \
  -d '{
    "latitude": 50.0755,
    "longitude": 14.4378,
    "radius_km": 5
  }'
```

## Monitoring

### Health Checks

```bash
# Basic health
GET /api/v1/health

# Detailed health (includes DB and Redis status)
GET /api/v1/health/detailed
```

### Logs

```bash
# Docker logs
docker logs -f landomo-search-service

# Check cache stats
docker exec -it landomo-redis redis-cli INFO stats
```

## Architecture Details

### Query Flow

1. **Request received** → Validate filters
2. **Build base query** → Apply global filters
3. **Enhance per country** → Apply country-specific filters
4. **Execute in parallel** → Query all countries simultaneously
5. **Aggregate results** → Merge and sort globally
6. **Cache response** → Store in Redis
7. **Return to client**

### Caching Strategy

- **Search results**: 5 min TTL (frequent changes)
- **Property details**: 30 min TTL (less frequent changes)
- **Aggregations**: 1 hour TTL (slow-changing stats)
- **Filter metadata**: 24 hours TTL (rarely changes)

## License

MIT
