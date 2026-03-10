# SReality.cz Scraper

> Production-grade web scraper for SReality.cz with checksum-based optimization

[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20.x-green.svg)](https://nodejs.org/)
[![Redis](https://img.shields.io/badge/Redis-6.x-red.svg)](https://redis.io/)

## Overview

The SReality scraper extracts property listings from [SReality.cz](https://www.sreality.cz) (Czech Republic's largest real estate portal) and transforms them into the Landomo category-partitioned schema. It features intelligent **checksum-based optimization** that reduces API calls by **90-95%** through change detection.

### Key Features

- 🚀 **Three-Phase Architecture**: Discovery → Checksum Comparison → Selective Fetching
- 📊 **Category Partitioning**: Apartment, House, Land, Commercial, Other
- 💾 **Checksum Optimization**: 90-95% reduction in API calls
- ⚡ **High Performance**: 200 concurrent workers, ~100k listings in 10-15 minutes
- 🔄 **Queue-Based**: BullMQ on Redis for scalable processing
- 🎯 **Type-Safe**: Full TypeScript with Tier I type compliance
- 📈 **Observable**: Prometheus metrics, health checks, logging

## Quick Start

```bash
# Prerequisites: Redis must be running
docker run -d --name redis -p 6379:6379 redis:7

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your settings

# Development mode
npm run dev

# Production build
npm run build
npm start

# Trigger scrape
curl -X POST http://localhost:8102/scrape
```

## Performance

| Metric | Value |
|--------|-------|
| Total Listings | ~100,000 |
| Scrape Time | 10-15 minutes |
| API Call Savings | 90-95% |
| Worker Concurrency | 200 (configurable) |
| Memory Usage | ~4GB |

### Before vs After Checksum Optimization

| Phase | Without Checksums | With Checksums |
|-------|-------------------|----------------|
| Discovery | 2-3 min | 2-3 min |
| Detail Fetching | 60+ min (100k fetches) | 5-10 min (5-10k fetches) |
| **Total** | **60-65 min** | **10-15 min** |
| **API Calls** | **100,000** | **10,000 (90% reduction)** |

## Architecture

```
┌─────────────┐
│  Scheduler  │ POST /scrape
└──────┬──────┘
       │
       v
┌────────────────────────────────────────────────┐
│     Three-Phase Checksum Orchestrator          │
├────────────────────────────────────────────────┤
│ Phase 1: Discovery (2-3 min)                   │
│   • Parallel page fetching (20 pages/batch)    │
│   • Extract 100k listings (minimal data)       │
│                                                 │
│ Phase 2: Checksum Comparison (10-30 sec)       │
│   • Generate content hashes                    │
│   • Compare with stored checksums              │
│   • Identify: New (5%), Changed (5%),          │
│              Unchanged (90%)                   │
│                                                 │
│ Phase 3: Selective Fetching (5-10 min)         │
│   • Queue only new/changed (~10k)              │
│   • 200 workers fetch details in parallel      │
│   • Transform to category-specific types       │
│   • Batch ingest (100 properties/request)      │
└────────────────────────────────────────────────┘
       │
       v
┌──────────────┐     ┌──────────────┐
│ Redis Queue  │◄────┤ 200 Workers  │
│  (BullMQ)    │     │              │
└──────┬───────┘     └──────────────┘
       │
       v
┌────────────────────────────────────────────────┐
│      Category-Specific Transformers            │
├────────────────────────────────────────────────┤
│ Apartment │ House │ Land │ Commercial │ Other │
└────────────────────────────────────────────────┘
       │
       v
┌──────────────┐
│ Ingest API   │ → PostgreSQL (per-country partitions)
└──────────────┘
```

## Documentation

Comprehensive documentation is available in the [`docs/`](./docs/) folder:

- **[Overview](./docs/README.md)** - Quick start and feature overview
- **[Architecture](./docs/ARCHITECTURE.md)** - Technical design and data flow
- **[API Reference](./docs/API_REFERENCE.md)** - Types, interfaces, and API schemas
- **[Configuration](./docs/CONFIGURATION.md)** - Environment variables and settings
- **[Development](./docs/DEVELOPMENT.md)** - Local setup, testing, and contribution guide
- **[Troubleshooting](./docs/TROUBLESHOOTING.md)** - Common issues and solutions
- **[Changelog](./docs/CHANGELOG.md)** - Version history and migration guides

## Category Support

All five SReality categories are fully supported with dedicated transformers:

| Category | SReality ID | Listings | Transformer | Output Type |
|----------|-------------|----------|-------------|-------------|
| Apartments | 1 | ~60,000 | `transformApartment` | `ApartmentPropertyTierI` |
| Houses | 2 | ~25,000 | `transformHouse` | `HousePropertyTierI` |
| Land | 3 | ~8,000 | `transformLand` | `LandPropertyTierI` |
| Commercial | 4 | ~6,000 | `transformCommercial` | `CommercialPropertyTierI` |
| Other | 5 | ~1,200 | `transformOther` | `OtherPropertyTierI` |

Each transformer outputs a **type-safe Tier I type** compliant with the category-partitioned three-tier data model.

## API Endpoints

### `POST /scrape`

Trigger a scrape run with optional category filtering.

```bash
# All categories
curl -X POST http://localhost:8102/scrape

# Specific categories
curl -X POST "http://localhost:8102/scrape?categories=1,2"

# Critical only (apartments + houses)
curl -X POST "http://localhost:8102/scrape?categories=critical"

# Standard only (land + commercial + other)
curl -X POST "http://localhost:8102/scrape?categories=standard"
```

### `GET /health`

Health check with queue statistics.

```bash
curl http://localhost:8102/health | jq
```

```json
{
  "status": "healthy",
  "scraper": "sreality",
  "version": "2.0.0-queue",
  "workers": 200,
  "queue": {
    "waiting": 1250,
    "active": 200,
    "completed": 3450,
    "failed": 5
  },
  "timestamp": "2026-02-16T10:30:00Z"
}
```

### `GET /metrics`

Prometheus metrics endpoint for monitoring.

```bash
curl http://localhost:8102/metrics
```

## Configuration

### Environment Variables

```bash
# Required
INGEST_API_URL=http://localhost:3004      # Ingest service URL
INGEST_API_KEY=dev_key_cz_1               # API key
REDIS_HOST=localhost                       # Redis hostname
REDIS_PORT=6379                            # Redis port

# Optional
REDIS_PASSWORD=                            # Redis password (if auth enabled)
WORKER_CONCURRENCY=200                     # Number of parallel workers
PORT=8102                                  # HTTP server port
CONCURRENT_PAGES=20                        # Parallel page fetches in discovery
```

See [Configuration Guide](./docs/CONFIGURATION.md) for complete reference.

## Docker

### docker-compose.yml

```yaml
scraper-sreality:
  build:
    context: .
    dockerfile: scrapers/Czech Republic/sreality/Dockerfile
  environment:
    - WORKER_CONCURRENCY=200
    - INGEST_API_URL=http://landomo-ingest-czech:3000
    - INGEST_API_KEY=${INGEST_API_KEY_SREALITY}
    - REDIS_HOST=redis
    - REDIS_PASSWORD=${REDIS_PASSWORD}
  ports:
    - "8102:8102"
  depends_on:
    - redis
    - ingest-czech
```

### Run with Docker

```bash
# From project root
docker compose -f docker/docker-compose.yml up scraper-sreality
```

## Development

### Prerequisites

- Node.js 20.x or higher
- Redis 6.x or higher
- 4GB RAM (for 200 workers)

### Local Setup

```bash
# Install dependencies
npm install

# Build shared-components
cd ../../../shared-components
npm install && npm run build

# Return to scraper
cd -

# Start Redis
docker run -d --name redis -p 6379:6379 redis:7

# Configure environment
cp .env.example .env

# Run in development mode
npm run dev
```

See [Development Guide](./docs/DEVELOPMENT.md) for detailed setup instructions.

## Monitoring

### Prometheus Metrics

The scraper exposes metrics at `/metrics`:

- `scraper_scrape_runs_total{portal,status}` - Total scrape runs
- `scraper_scrape_duration_seconds{portal,category}` - Scrape duration
- `scraper_properties_scraped_total{portal,category,result}` - Properties processed
- `scraper_scrape_run_active{portal}` - Active scrape indicator

### Logging

Structured JSON logs with Winston:

```json
{
  "level": "info",
  "message": "Scrape completed",
  "durationMin": "12.35",
  "totalFound": 98543,
  "processed": 9821,
  "savingsPercent": 90,
  "timestamp": "2026-02-16T10:30:00Z"
}
```

## Troubleshooting

### Common Issues

**Redis Connection Failed**:
```bash
# Check Redis is running
redis-cli ping
# Expected: PONG
```

**Out of Memory**:
```bash
# Reduce worker count
WORKER_CONCURRENCY=100

# Or increase heap size
node --max-old-space-size=6144 dist/index.js
```

**Slow Scraping**:
```bash
# Check queue stats
curl http://localhost:8102/health | jq '.queue'

# Increase workers if CPU allows
WORKER_CONCURRENCY=200
```

See [Troubleshooting Guide](./docs/TROUBLESHOOTING.md) for complete solutions.

## Technology Stack

- **Runtime**: Node.js 20.x, TypeScript 5.0
- **Queue**: BullMQ 5.x on Redis 6.x
- **HTTP**: Express 4.x, Axios 1.x
- **Types**: @landomo/core (shared-components)
- **Metrics**: Prometheus (prom-client)
- **Logging**: Winston

## Project Structure

```
src/
├── index.ts                           # Express server + entry point
├── scraper/
│   └── threePhaseOrchestrator.ts     # Main scrape orchestration
├── transformers/
│   ├── srealityTransformer.ts        # Category router
│   ├── apartments/apartmentTransformer.ts
│   ├── houses/houseTransformer.ts
│   ├── land/landTransformer.ts
│   ├── commercial/commercialTransformer.ts
│   └── other/otherTransformer.ts
├── queue/
│   └── detailQueue.ts                # BullMQ queue + workers
├── adapters/
│   └── ingestAdapter.ts              # Ingest API client
├── utils/
│   ├── fetchData.ts                  # HTTP fetch utilities
│   ├── checksumExtractor.ts          # Checksum generation
│   ├── itemsParser.ts                # Type-safe field parser
│   ├── categoryDetection.ts          # Category detection
│   └── srealityHelpers.ts            # Helper functions
└── types/
    ├── srealityTypes.ts              # SReality listing types
    └── srealityApiTypes.ts           # API response types

docs/
├── README.md                          # Documentation overview
├── ARCHITECTURE.md                    # Technical design
├── API_REFERENCE.md                   # Types and interfaces
├── CONFIGURATION.md                   # Environment variables
├── DEVELOPMENT.md                     # Setup and contribution
├── TROUBLESHOOTING.md                 # Common issues
└── CHANGELOG.md                       # Version history
```

## Contributing

We welcome contributions! Please see [Development Guide](./docs/DEVELOPMENT.md) for:

- Code style guidelines
- Testing requirements
- Pull request process
- Commit message conventions

## Version

**Current**: 2.0.0

See [Changelog](./docs/CHANGELOG.md) for version history and migration guides.

## License

Part of the Landomo World platform.

## Support

- **Documentation**: [docs/](./docs/)
- **Issues**: See [Troubleshooting](./docs/TROUBLESHOOTING.md)
- **Architecture**: See [Architecture](./docs/ARCHITECTURE.md)

---

**Made with ❤️ for the Landomo World platform**
