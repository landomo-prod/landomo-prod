# Polygon Service - Quick Start Guide

## Prerequisites

- Docker and Docker Compose installed
- landomo-world repository cloned
- PostgreSQL and Redis services running

## 1. Start Infrastructure

```bash
# From project root
cd /Users/samuelseidel/Development/landomo-world

# Start PostgreSQL and Redis (if not already running)
docker compose --project-directory . -f docker/docker-compose.yml --env-file .env.dev up -d postgres redis

# Wait for services to be healthy (30-60 seconds)
docker compose --project-directory . -f docker/docker-compose.yml ps
```

## 2. Start Polygon Service

```bash
# Start polygon-service
docker compose --project-directory . -f docker/docker-compose.yml --env-file .env.dev up -d polygon-service

# Check logs
docker logs landomo-polygon-service -f
```

## 3. Test Health Endpoint

```bash
# Test health check
curl http://localhost:4300/api/v1/health

# Expected response:
# {"status":"ok","service":"polygon-service","timestamp":"2024-02-08T..."}
```

## 4. Verify Database Connection

```bash
# Check if service can connect to PostgreSQL
docker logs landomo-polygon-service | grep -i "database\|postgres"

# Should see: "Polygon service configured" with database info
```

## 5. Test API (once routes are implemented)

```bash
# Example: Search for polygons by country
curl -H "X-API-Key: dev_key_polygon_1" \
  "http://localhost:4300/api/v1/polygons/search?country=CZ&type=municipality"

# Example: Reverse geocode point
curl -H "X-API-Key: dev_key_polygon_1" \
  -X POST http://localhost:4300/api/v1/polygons/lookup \
  -H "Content-Type: application/json" \
  -d '{"latitude": 50.0755, "longitude": 14.4378}'
```

## Common Commands

### View Logs
```bash
docker logs landomo-polygon-service -f --tail=100
```

### Restart Service
```bash
docker compose --project-directory . -f docker/docker-compose.yml restart polygon-service
```

### Stop Service
```bash
docker compose --project-directory . -f docker/docker-compose.yml stop polygon-service
```

### Rebuild Service
```bash
docker compose --project-directory . -f docker/docker-compose.yml build polygon-service
docker compose --project-directory . -f docker/docker-compose.yml up -d polygon-service
```

### Shell Access
```bash
docker exec -it landomo-polygon-service sh
```

### Check Resource Usage
```bash
docker stats landomo-polygon-service
```

## Troubleshooting

### Service fails to start
```bash
# Check dependencies are healthy
docker compose --project-directory . -f docker/docker-compose.yml ps

# View full logs
docker logs landomo-polygon-service
```

### Can't connect to database
```bash
# Check postgres is running
docker inspect landomo-postgres | grep -A 5 '"Status"'

# Check network
docker network inspect landomo-net
```

### Port already in use
```bash
# Change port in .env.dev
POLYGON_SERVICE_PORT=4301

# Or stop conflicting service
lsof -ti:4300 | xargs kill -9
```

## Next Steps

1. Implement polygon routes (`src/routes/polygons.ts`)
2. Add database migrations for polygon schema
3. Implement Overpass sync script
4. Add integration tests
5. Configure monitoring/metrics

## Configuration Files

- **Dockerfile**: `/polygon-service/Dockerfile`
- **docker-compose.yml**: `/docker/docker-compose.yml`
- **.env.example**: `/.env.example` (copy to `.env.dev`)
- **Service config**: `/polygon-service/src/config/index.ts`

## Service URLs

| Service | URL | Purpose |
|---------|-----|---------|
| Polygon API | http://localhost:4300 | Polygon service HTTP API |
| PostgreSQL | localhost:5432 | Database |
| Redis | localhost:6379 | Cache |
| Health Check | http://localhost:4300/api/v1/health | Service health |

## Environment Variables

Key variables to set in `.env.dev`:

```bash
# Polygon Service
POLYGON_SERVICE_PORT=4300
API_KEYS_POLYGON=dev_key_polygon_1
POLYGON_LOG_LEVEL=debug  # For development

# Database
DB_USER=landomo
DB_PASSWORD=landomo_dev_pass
DB_PORT=5432

# Redis
REDIS_PORT=6379
REDIS_PASSWORD=
```
