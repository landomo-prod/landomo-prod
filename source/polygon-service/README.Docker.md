# Polygon Service - Docker Deployment

Administrative boundary polygon service with Overpass sync for the Landomo-World platform.

## Quick Start

### Development Mode

```bash
# From project root
docker compose --project-directory . -f docker/docker-compose.yml --env-file .env.dev up -d postgres redis polygon-service

# Check service health
curl http://localhost:4300/api/v1/health
```

### Production Mode

```bash
# From project root
docker compose --project-directory . -f docker/docker-compose.yml --env-file .env.prod up -d polygon-service
```

## Configuration

### Environment Variables

All configuration is via environment variables (see `.env.example` in project root):

| Variable | Default | Description |
|----------|---------|-------------|
| `POLYGON_SERVICE_PORT` | `4300` | External port mapping |
| `PORT` | `3100` | Internal service port |
| `DB_HOST` | `postgres` | PostgreSQL host |
| `DB_PORT` | `5432` | PostgreSQL port |
| `DB_NAME` | `landomo_geocoding` | Database name |
| `DB_USER` | `landomo` | Database user |
| `DB_PASSWORD` | - | Database password (from secret) |
| `REDIS_HOST` | `redis` | Redis host |
| `REDIS_PORT` | `6379` | Redis port |
| `CACHE_TTL_SECONDS` | `3600` | Cache TTL in seconds |
| `API_KEYS` | - | Comma-separated API keys |
| `OVERPASS_API_URL` | `https://overpass-api.de/api/interpreter` | Overpass API endpoint |
| `OVERPASS_TIMEOUT` | `6000` | Overpass request timeout (ms) |

### Docker Secrets

Production deployments use Docker secrets:

```bash
# Create secret files
echo "my_secure_password" > docker/secrets/db_password
echo "dev_key_polygon_1" > docker/secrets/api_keys_polygon
echo "redis_password" > docker/secrets/redis_password
```

## Health Check

The service includes automatic health checks:

```bash
# Via Docker
docker inspect landomo-polygon-service | grep -A 10 Health

# Direct HTTP
curl http://localhost:4300/api/v1/health
```

Expected response:
```json
{
  "status": "ok",
  "service": "polygon-service",
  "timestamp": "2024-02-08T12:00:00.000Z"
}
```

## Networking

The service connects to:
- **postgres** - PostGIS database for polygon storage
- **redis** - Cache layer for polygon lookups
- **landomo-net** - Docker bridge network

All services are on the same network for inter-service communication.

## Logs

```bash
# View logs
docker compose --project-directory . -f docker/docker-compose.yml logs -f polygon-service

# View logs with timestamps
docker logs landomo-polygon-service --timestamps

# Follow logs in JSON format
docker logs landomo-polygon-service -f --tail=100
```

## Building

### Multi-stage Build Process

1. **Builder stage** - Installs all dependencies, compiles TypeScript
2. **Production stage** - Copies built artifacts, installs production deps only

```bash
# Build locally (from project root)
docker build -t landomo/polygon-service:latest -f polygon-service/Dockerfile polygon-service/

# Build via compose
docker compose --project-directory . -f docker/docker-compose.yml build polygon-service
```

### Build Arguments

None currently - all configuration via environment variables.

## Troubleshooting

### Service won't start

```bash
# Check dependencies
docker compose --project-directory . -f docker/docker-compose.yml ps

# Ensure postgres and redis are healthy
docker inspect landomo-postgres | grep -A 5 Health
docker inspect landomo-redis | grep -A 5 Health
```

### Database connection issues

```bash
# Check database credentials
docker exec landomo-polygon-service env | grep DB_

# Test database connectivity
docker exec landomo-polygon-service sh -c "apt-get update && apt-get install -y postgresql-client && psql -h postgres -U landomo -d landomo_geocoding -c 'SELECT 1'"
```

### Redis connection issues

```bash
# Check Redis connectivity
docker exec landomo-polygon-service sh -c "apt-get update && apt-get install -y redis-tools && redis-cli -h redis ping"
```

## Performance

### Resource Limits

Set limits in production:

```yaml
polygon-service:
  deploy:
    resources:
      limits:
        cpus: '1.0'
        memory: 512M
      reservations:
        cpus: '0.25'
        memory: 256M
```

### Scaling

Horizontal scaling is supported (stateless service):

```bash
docker compose --project-directory . -f docker/docker-compose.yml up -d --scale polygon-service=3
```

## Integration

### From scrapers

```typescript
const response = await fetch('http://polygon-service:3100/api/v1/polygons/lookup', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': process.env.API_KEY
  },
  body: JSON.stringify({
    latitude: 50.0755,
    longitude: 14.4378
  })
});
```

### From search-service

```typescript
import axios from 'axios';

const polygonData = await axios.get('http://polygon-service:3100/api/v1/polygons/search', {
  params: { country: 'CZ', type: 'municipality' },
  headers: { 'X-API-Key': process.env.API_KEY }
});
```

## Maintenance

### Update database schema

```bash
# Run migrations (handled automatically on startup)
docker exec landomo-postgres psql -U landomo -d landomo_geocoding -f /migrations/polygon_schema.sql
```

### Clear cache

```bash
# Redis CLI
docker exec landomo-redis redis-cli FLUSHDB
```

### Sync Overpass data

```bash
# Manual sync (when service is running)
docker exec landomo-polygon-service npm run sync:overpass
```
