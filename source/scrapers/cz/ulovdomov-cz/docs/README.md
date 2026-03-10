# UlovDomov Scraper

**Portal:** [ulovdomov.cz](https://www.ulovdomov.cz)
**Listing Count:** ~50,000 listings
**Scrape Duration:** 15-20 minutes
**Docker Service:** `cz-ulovdomov`
**Port:** 8102 (configurable via `PORT` env var)
**Version:** 2.0.0-three-phase

## Overview

UlovDomov is a Czech real estate portal with a public REST API at `https://ud.api.ulovdomov.cz/v1`. The scraper uses a three-phase checksum-based approach: fetch all listings, compare checksums to find new/changed, then transform and ingest only what changed. The API returns full listing data in the discovery response (no separate detail fetch needed).

## Property Categories

| API `propertyType` | Category | Notes |
|---|---|---|
| `flat` | `apartment` | Most common |
| `house` | `house` | |
| `land` | `land` | |
| `commercial` | `commercial` | |
| `room` | `apartment` | Treated as apartment |

## Offer Types

- `sale`
- `rent`
- `coliving`

## Source Structure

```
src/
├── index.ts                              # Express server, scrape trigger
├── scraper/threePhaseOrchestrator.ts     # Three-phase checksum orchestrator
├── scrapers/listingsScraper.ts           # REST API client, pagination
├── adapters/ingestAdapter.ts             # Ingest API client
├── transformers/ulovdomovTransformer.ts  # Single transformer (all categories)
├── types/ulovdomovTypes.ts              # API response types, CZ bounds
└── utils/checksumExtractor.ts            # Checksum field extraction
```

## Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Health check (reports three-phase + checksum features) |
| `POST` | `/scrape` | Trigger scrape (returns 202, runs async) |
| `GET` | `/metrics` | Prometheus metrics |

## Quick Start

```bash
# Local development
cd "scrapers/Czech Republic/ulovdomov"
npm install
npm run dev

# Trigger scrape
curl -X POST http://localhost:8102/scrape

# Health check
curl http://localhost:8102/health
```

## Key Differences from BezRealitky

- REST API (not GraphQL)
- Sequential pagination with 300ms delays (not parallel)
- Single transformer file handles all categories (not separate files)
- `disposition` uses camelCase (`onePlusKk`) instead of Czech format (`1+kk`)
- `rentalPrice.value` used for both rent AND sale prices
- CZ bounding box required in all requests
- Three-phase checksum mode is always enabled (no legacy mode)
