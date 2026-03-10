# Landomo-World Documentation

Global real estate aggregation platform that scrapes 600+ portals, normalizes property data, and serves it via federated search APIs.

## Quick Links

- **Getting Started**: [GETTING_STARTED.md](GETTING_STARTED.md)
- **Architecture**: [ARCHITECTURE.md](ARCHITECTURE.md)
- **Data Model**: [DATA_MODEL.md](DATA_MODEL.md)
- **API Reference**: [API_REFERENCE.md](API_REFERENCE.md)
- **Development Guide**: [DEVELOPMENT.md](DEVELOPMENT.md)
- **Deployment Guide**: [DEPLOYMENT.md](DEPLOYMENT.md)
- **Troubleshooting**: [TROUBLESHOOTING.md](TROUBLESHOOTING.md)

## Documentation Structure

```
docs/
├── README.md                    # This file
├── GETTING_STARTED.md          # Quick start guide
├── ARCHITECTURE.md             # System architecture
├── DATA_MODEL.md               # Database schema & data model
├── API_REFERENCE.md            # API endpoints documentation
├── DEVELOPMENT.md              # Development workflows
├── DEPLOYMENT.md               # Deployment procedures
├── TROUBLESHOOTING.md          # Common issues & solutions
│
├── services/
│   ├── INGEST_SERVICE.md       # Property ingestion service
│   ├── SEARCH_SERVICE.md       # Search & query service
│   ├── POLYGON_SERVICE.md      # Boundary/polygon service
│   └── ML_PRICING_SERVICE.md   # ML pricing & predictions
│
├── scrapers/
│   ├── SCRAPER_GUIDE.md        # Scraper development guide
│   ├── SCRAPER_PATTERNS.md     # Common patterns & solutions
│   └── SCRAPER_TESTING.md      # Testing & debugging scrapers
│
└── advanced/
    ├── PERFORMANCE.md          # Performance optimization
    ├── MONITORING.md           # Metrics & monitoring
    ├── SECURITY.md             # Security best practices
    └── SCALING.md              # Scaling strategies
```

## Project Overview

Landomo-World is a multi-tenant real estate aggregation platform that:

1. **Scrapes** property listings from 600+ portals across multiple countries
2. **Normalizes** data into category-specific schemas (apartment/house/land/commercial)
3. **Tracks** listing lifecycle, changes, and staleness
4. **Serves** data via REST APIs with geographic/polygon search
5. **Predicts** property prices using ML models

## Key Technologies

- **Backend**: TypeScript, Node.js, Fastify, Express
- **Database**: PostgreSQL (per-country), PostGIS
- **Queue**: BullMQ on Redis
- **Scraping**: Puppeteer, Playwright, Axios
- **ML**: Python, LightGBM, scikit-learn
- **Infrastructure**: Docker, Docker Compose

## Core Concepts

### Category-Partitioned Schema

Properties are partitioned by category for performance:
- `properties_apartment` - Apartments/flats
- `properties_house` - Houses/villas
- `properties_land` - Land plots
- `properties_commercial` - Commercial spaces

### Three-Tier Data Model

1. **Tier I**: Category-specific required fields → Indexed columns
2. **Tier II**: Country-specific data → `country_specific` JSONB
3. **Tier III**: Portal metadata → `portal_metadata` JSONB

### Listing Lifecycle

```
active → removed (72h) → sold/rented (terminal)
       ↖_____________↙ (reactivated if seen again)
```

## Services

### Ingest Service (Port 3004+)
Receives property data from scrapers, validates, transforms, and writes to per-country PostgreSQL databases.

### Search Service (Port 4000)
Provides property search with filters, pagination, and geographic queries.

### Polygon Service (Port 4300)
Manages administrative boundaries from OSM, provides point-in-polygon and boundary search.

### ML Pricing Service (Port 3500)
Trains and serves ML models for property price prediction and deal quality analysis.

## Quick Start

```bash
# Start infrastructure
docker compose -f docker/docker-compose.yml up -d postgres redis

# Start a country's services
docker compose -f docker/docker-compose.yml up -d ingest-czech worker-czech

# Trigger a scraper
curl -X POST http://localhost:8084/scrape
```

See [GETTING_STARTED.md](GETTING_STARTED.md) for detailed setup instructions.

## Contributing

1. Read [DEVELOPMENT.md](DEVELOPMENT.md) for development workflows
2. Follow the patterns in [SCRAPER_GUIDE.md](scrapers/SCRAPER_GUIDE.md) for new scrapers
3. Test locally before committing
4. Update documentation when adding features

## Support

- **Issues**: Check [TROUBLESHOOTING.md](TROUBLESHOOTING.md)
- **Patterns**: See [SCRAPER_PATTERNS.md](scrapers/SCRAPER_PATTERNS.md)
- **Architecture**: Read [ARCHITECTURE.md](ARCHITECTURE.md)

## License

Proprietary - Landomo Platform
