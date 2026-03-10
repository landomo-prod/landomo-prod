# Getting Started with Landomo Core Service

## Quick Start (Docker Compose - Recommended)

The fastest way to get started is with Docker Compose, which sets up PostgreSQL, Redis, and the Core Service automatically.

### 1. Start All Services

```bash
docker-compose up -d
```

This starts:
- PostgreSQL (port 5432)
- Redis (port 6379)
- Core Service API (port 3000)
- Batch Worker (2 instances)

### 2. Verify Services are Running

```bash
docker-compose ps
```

You should see all services running.

### 3. Test Health Endpoint

```bash
./test-health.sh
```

Expected output:
```json
{
  "status": "healthy",
  "timestamp": "2026-01-31T...",
  "uptime": 10.5,
  "version": "1.0.0"
}
```

### 4. Test Ingestion Endpoint

```bash
./test-ingest.sh
```

Expected output:
```json
{
  "status": "accepted",
  "message": "Property queued for ingestion"
}
```

### 5. View Logs

```bash
# All services
docker-compose logs -f

# Core Service only
docker-compose logs -f core-service

# Batch worker only
docker-compose logs -f batch-worker
```

### 6. Stop Services

```bash
docker-compose down
```

## Manual Setup (Without Docker)

If you prefer to run services manually:

### Prerequisites

- Node.js 20+
- PostgreSQL 16+
- Redis 7+

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env`:
```env
PORT=3000
HOST=0.0.0.0
API_KEYS=dev_key_1,dev_key_2,prod_key_xyz
DB_HOST=localhost
DB_PORT=5432
DB_USER=landomo
DB_PASSWORD=your_password
REDIS_HOST=localhost
REDIS_PORT=6379
```

### 3. Start PostgreSQL

```bash
# On Ubuntu/Debian
sudo systemctl start postgresql

# On macOS (Homebrew)
brew services start postgresql@16
```

### 4. Start Redis

```bash
# On Ubuntu/Debian
sudo systemctl start redis

# On macOS (Homebrew)
brew services start redis
```

### 5. Create Databases

```bash
psql -U postgres
```

```sql
-- Create databases
CREATE DATABASE landomo_australia;
CREATE DATABASE landomo_italy;
CREATE DATABASE landomo_usa;
-- Add more as needed

-- Exit psql
\q
```

### 6. Apply Database Schema

```bash
psql -U postgres -d landomo_australia -f ../landomo-core/src/database/schema-template-core.sql
```

Repeat for each country database.

### 7. Build TypeScript

```bash
npm run build
```

### 8. Start Core Service

```bash
# Development (with hot reload)
npm run dev

# Production
npm start
```

### 9. Start Batch Worker

In another terminal:

```bash
# Development
npm run dev:worker

# Production
npm run start:worker
```

## Testing the Setup

### 1. Check Configuration

```bash
npm run test:setup
```

### 2. Test Health Endpoint

```bash
./test-health.sh
```

### 3. Test Ingestion

```bash
./test-ingest.sh
```

### 4. Manual cURL Tests

**Health Check:**
```bash
curl http://localhost:3000/api/v1/health
```

**Ingest Property:**
```bash
curl -X POST http://localhost:3000/api/v1/properties/ingest \
  -H "Authorization: Bearer dev_key_1" \
  -H "Content-Type: application/json" \
  -d '{
    "portal": "domain",
    "portal_id": "test-123",
    "country": "australia",
    "data": {
      "title": "Test Property",
      "price": 950000,
      "currency": "AUD",
      "property_type": "apartment",
      "transaction_type": "sale",
      "location": {
        "city": "Sydney",
        "country": "Australia"
      },
      "details": {
        "bedrooms": 3,
        "bathrooms": 2
      }
    },
    "raw_data": {}
  }'
```

## Querying the Database

### Connect to Database

```bash
psql -U landomo -d landomo_australia
```

### Example Queries

**View recent properties:**
```sql
SELECT id, title, price, city, portal, created_at
FROM properties
ORDER BY created_at DESC
LIMIT 10;
```

**View ingestion log:**
```sql
SELECT portal, status, COUNT(*) as count
FROM ingestion_log
GROUP BY portal, status;
```

**View property changes:**
```sql
SELECT p.title, pc.change_type, pc.changed_at
FROM property_changes pc
JOIN properties p ON p.id = pc.property_id
ORDER BY pc.changed_at DESC
LIMIT 10;
```

**Price history:**
```sql
SELECT p.title, ph.price, ph.recorded_at
FROM price_history ph
JOIN properties p ON p.id = ph.property_id
WHERE p.title LIKE '%Sydney%'
ORDER BY ph.recorded_at DESC;
```

## Monitoring

### Check Queue Status

Connect to Redis:
```bash
redis-cli
```

Check queue length:
```
LLEN bull:ingest-property:wait
```

View recent jobs:
```
LRANGE bull:ingest-property:wait 0 10
```

Monitor in real-time:
```
MONITOR
```

### View Logs

**Docker Compose:**
```bash
docker-compose logs -f core-service
docker-compose logs -f batch-worker
```

**Manual:**
Check console output where services are running.

## Troubleshooting

### Port Already in Use

If port 3000 is already in use:
1. Edit `.env` and change `PORT=3000` to another port
2. Or stop the service using port 3000

### Cannot Connect to PostgreSQL

Check PostgreSQL is running:
```bash
sudo systemctl status postgresql
# or
brew services list
```

Check connection:
```bash
psql -U landomo -h localhost -d postgres
```

### Cannot Connect to Redis

Check Redis is running:
```bash
redis-cli ping
```

Should return `PONG`.

### API Key Not Working

Make sure API_KEYS is set in `.env`:
```env
API_KEYS=dev_key_1,dev_key_2
```

And use matching key in requests:
```bash
-H "Authorization: Bearer dev_key_1"
```

### Worker Not Processing Jobs

1. Check worker is running
2. Check Redis connection
3. View worker logs for errors
4. Check queue has jobs: `redis-cli LLEN bull:ingest-property:wait`

## Production Deployment

### Environment Variables

Set these in production:
```env
PORT=3000
HOST=0.0.0.0
API_KEYS=secure_key_1,secure_key_2  # Use secure keys!
DB_HOST=your-postgres-host
DB_USER=landomo
DB_PASSWORD=secure_password
REDIS_HOST=your-redis-host
REDIS_PASSWORD=redis_password  # If Redis has auth
```

### Security

1. **Use strong API keys** (not dev_key_1!)
2. **Enable PostgreSQL SSL** for remote connections
3. **Enable Redis AUTH** if exposed
4. **Use firewall** to restrict access
5. **Run behind reverse proxy** (nginx/Caddy)

### Scaling

**Scale Batch Workers:**
```bash
# Docker Compose
docker-compose up -d --scale batch-worker=5

# Manual
# Start 5 instances of: npm run start:worker
```

**Scale API Servers:**
- Run multiple instances behind load balancer
- Use PM2 or Docker for process management

### Monitoring in Production

1. **Set up Prometheus** for metrics
2. **Configure alerts** for:
   - Queue depth > threshold
   - Error rate > threshold
   - Worker failures
   - API response time
3. **Log aggregation** (ELK stack, Grafana Loki)

## Next Steps

1. **Create more country databases** as needed
2. **Deploy scrapers** to send data to Core Service
3. **Set up monitoring** and alerts
4. **Configure backup** for databases
5. **Implement search API** on top of Core DBs (future)

## Support

- **Documentation**: See [README.md](README.md)
- **Architecture**: See [ARCHITECTURE.md](../ARCHITECTURE.md)
- **Issues**: GitHub Issues

---

**Status**: ✅ Production Ready
**Version**: 1.0.0
