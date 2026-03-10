# landomo-prod

Landomo is a global real estate platform that aggregates property listings from existing portals worldwide. The goal is to give users a single place to search, compare, and track real estate offers — regardless of which local portal they were originally listed on.

## What it does

- Scrapes listings from 600+ real estate portals across Europe and beyond
- Normalizes all data into a unified schema (apartments, houses, land, commercial)
- Serves listings through a search API consumed by the frontend
- Tracks price changes, new listings, and removed properties

## Repository layout

```
source/         All application code
  shared/       Shared TypeScript types and DB utilities (@landomo/core)
  scrapers/     One scraper per portal, grouped by country
  ingest/       API that receives scraped data and writes it to the database
  search/       Search and filtering API
  frontend/     User-facing app
  db/           SQL migrations and base schema
  ml/           Price prediction service
  polygon/      Geographic boundary service
  scheduler/    Periodic scrape job scheduling

infra/          Deployment and infrastructure
  docker/       Per-country docker-compose files + shared base configs
  scripts/      Deploy, migrate, backup scripts
  docs/         VPS setup, runbooks

docs/           Project-level documentation
```

## Servers

| Alias | Role |
|-------|------|
| `landomo-app` | Application server — scrapers, workers, APIs |
| `landomo-db` | Database server — PostgreSQL per-country |

```bash
ssh landomo-app
ssh landomo-db   # proxied through landomo-app
```

## Key concepts

- **Per-country stacks** — each country has its own ingest API, workers, and database (`landomo_cz`, `landomo_hu`, …)
- **Categories** — every listing is one of: `apartment`, `house`, `land`, `commercial`
- **Three-tier model** — universal fields + country-specific JSONB + portal metadata JSONB
- **Listing lifecycle** — `active` → `removed` (72h unseen) → `sold`/`rented` (terminal)
- **One container per portal** — each scraper runs independently in Docker
