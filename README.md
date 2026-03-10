# landomo-prod

Global real estate aggregation platform — monorepo restructured for clarity and per-country flexibility.

## Directory Structure

```
landomo-prod/
├── source/                  # All application source code
│   ├── shared/              # @landomo/core — shared types, DB utils, clients
│   ├── scrapers/            # One folder per country → one per portal
│   │   └── {Country}/{portal}/
│   ├── db/                  # Database schema & migrations (shared)
│   │   ├── migrations/      # SQL migration files (apply in order)
│   │   └── schema/          # init-schema.sql, seed data
│   ├── ingest/              # Ingest API (Fastify + BullMQ workers)
│   ├── search/              # Search & federation service
│   ├── frontend/            # React Native / Next.js frontend
│   ├── ml/                  # ML pricing service (Python + TS API)
│   ├── polygon/             # Geospatial boundary service
│   └── scheduler/           # Job scheduler
│
├── infra/                   # Everything deployment-related
│   ├── docker/
│   │   ├── base/            # Shared base configs (postgres, redis, nginx, monitoring)
│   │   └── countries/       # Per-country docker-compose files
│   │       ├── czech/
│   │       ├── hungary/
│   │       ├── poland/
│   │       └── ...
│   ├── secrets/             # Git-ignored; API keys & DB passwords per country
│   └── scripts/             # Deploy, migrate, backup, health-check scripts
│
└── docs/                    # Project-level documentation
    ├── architecture/        # System design, data model, ADRs
    ├── services/            # Per-service docs
    ├── scrapers/            # Portal-specific scraper docs
    └── deployment/          # VPS setup, runbooks, secrets management
```

## Quick Start

```bash
# Start infrastructure for a country
docker compose -f infra/docker/countries/czech/docker-compose.yml --env-file infra/secrets/countries/czech/.env up -d

# Build shared types
cd source/shared && npm install && npm run build

# Type-check ingest service
cd source/ingest && npm run type-check
```

## Architecture

```
Scheduler → Scrapers → Ingest API → Redis/BullMQ → Workers → PostgreSQL (per-country)
                                                            ↘ Search/Polygon Services → Frontend
```

See `docs/architecture/` for full system design and `RUNBOOK.md` for operational procedures.
