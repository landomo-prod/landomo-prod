# SReality Scraper - Local Docker Deployment

Deploy the SReality scraper as a local Docker container that sends data to the VPS ingest service.

## Quick Start

```bash
# 1. Deploy (builds and starts container)
./deploy-local.sh

# 2. Trigger a scrape
curl -X POST http://localhost:8102/scrape

# 3. Check logs
docker-compose logs -f sreality-scraper
```

## Configuration

### VPS Endpoint
- **URL**: http://187.77.70.123:3006/api/v1/properties/bulk-ingest
- **API Key**: 74a1cb67ecbbf4a672a1d7c01955ba30
- **Backup Key**: f388a3d0b578df2bdcf629e6e0449f5d

### Ports
- **Scraper API**: 8102
- **Redis**: 6379 (optional)

## Services

### 1. SReality Scraper
- Container: `sreality-scraper`
- Image: `landomo/sreality-scraper:latest`
- Port: 8102
- Health: http://localhost:8102/health

### 2. Redis (Optional)
- Container: `sreality-redis`
- Port: 6379
- For BullMQ queuing (not required for basic operation)

## Manual Deployment

If you prefer manual steps:

```bash
# 1. Build from project root
cd /Users/samuelseidel/Development/landomo-world
docker build -f "scrapers/Czech Republic/sreality/Dockerfile" -t landomo/sreality-scraper:latest .

# 2. Start services
cd "scrapers/Czech Republic/sreality"
docker-compose up -d

# 3. Check status
docker-compose ps
docker-compose logs -f sreality-scraper
```

## Useful Commands

### Service Management
```bash
# Start services
docker-compose up -d

# Stop services
docker-compose down

# Restart scraper
docker-compose restart sreality-scraper

# View status
docker-compose ps

# View logs
docker-compose logs -f sreality-scraper
docker-compose logs --tail=100 sreality-scraper

# Execute command in container
docker exec -it sreality-scraper sh
```

### Testing

```bash
# Health check
curl http://localhost:8102/health

# Trigger scrape (all categories)
curl -X POST http://localhost:8102/scrape

# Trigger scrape (specific categories)
curl -X POST http://localhost:8102/scrape \
  -H "Content-Type: application/json" \
  -d '{"categories": ["apartments", "houses"]}'

# Check Redis (if using)
docker exec -it sreality-redis redis-cli ping
docker exec -it sreality-redis redis-cli info
```

### Monitoring

```bash
# Follow logs in real-time
docker-compose logs -f sreality-scraper

# Container stats
docker stats sreality-scraper

# Check container health
docker inspect --format='{{.State.Health.Status}}' sreality-scraper
```

## Environment Variables

Configured in `.env.docker`:

| Variable | Value | Description |
|----------|-------|-------------|
| INGEST_API_URL | http://187.77.70.123:3006/api/v1/properties | VPS ingest endpoint |
| INGEST_API_KEY | 74a1cb67ecbbf4a672a1d7c01955ba30 | API authentication |
| PORT | 8102 | Scraper service port |
| PARALLEL_PAGES | 20 | Concurrent page fetching |
| RATE_LIMIT_DELAY | 500 | Delay between requests (ms) |

## Architecture

```
┌─────────────────┐
│  Local Docker   │
│                 │
│  ┌───────────┐  │      HTTP POST
│  │ SReality  │──┼─────────────────→  VPS (187.77.70.123:3006)
│  │ Scraper   │  │                     /api/v1/properties/bulk-ingest
│  └───────────┘  │
│        ↓        │
│  ┌───────────┐  │
│  │  Redis    │  │  (Optional - for queuing)
│  │  (BullMQ) │  │
│  └───────────┘  │
└─────────────────┘
```

## Three-Phase Scraping Process

1. **Phase 1 - Discovery** (~2-3 min)
   - Fetches all listing pages
   - Extracts basic data (hash_id, price, location)

2. **Phase 2 - Checksum Comparison** (~10-30 sec)
   - Generates checksums for all listings
   - Compares with existing data
   - Identifies new/changed listings

3. **Phase 3 - Selective Fetching** (~5-10 min)
   - Fetches full details only for changed listings
   - Transforms to TierI format
   - Sends to VPS via bulk-ingest API

**Optimization**: Achieves 90-95% reduction in API calls vs full re-fetch

## Troubleshooting

### Container won't start
```bash
# Check logs
docker-compose logs sreality-scraper

# Check if port is in use
lsof -i :8102

# Remove and rebuild
docker-compose down
docker rmi landomo/sreality-scraper:latest
./deploy-local.sh
```

### Can't connect to VPS
```bash
# Test VPS endpoint
curl -X POST http://187.77.70.123:3006/api/v1/properties/bulk-ingest \
  -H "Authorization: Bearer 74a1cb67ecbbf4a672a1d7c01955ba30" \
  -H "Content-Type: application/json" \
  -d '{"test": "connection"}'

# Check firewall/network
ping 187.77.70.123
```

### Scraper errors during execution
```bash
# Check detailed logs
docker-compose logs --tail=500 sreality-scraper

# Exec into container
docker exec -it sreality-scraper sh

# Check environment
docker exec sreality-scraper env | grep INGEST
```

### High memory usage
```bash
# Check stats
docker stats sreality-scraper

# Restart to clear memory
docker-compose restart sreality-scraper
```

## Production Recommendations

1. **Resource Limits**: Add memory/CPU limits in docker-compose.yml
2. **Logging**: Configure log rotation to prevent disk fill
3. **Monitoring**: Set up health check alerts
4. **Backup Keys**: Keep backup API key for failover
5. **Scheduling**: Use cron or external scheduler for regular scrapes

## Performance Metrics

From large-scale testing (44,975 listings):
- **Throughput**: 1,479 listings/sec
- **Transform Speed**: 230,641 listings/sec
- **Memory Usage**: 43 MB → 113 MB peak
- **Success Rate**: 100%
- **Processing Time**: 0.68ms per listing

## Support

For issues:
1. Check logs: `docker-compose logs -f sreality-scraper`
2. Verify VPS connectivity
3. Review environment variables
4. Check documentation: `docs/` directory
