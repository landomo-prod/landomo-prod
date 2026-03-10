# Reality.cz Scraper

| Field | Value |
|-------|-------|
| Portal | [reality.cz](https://www.reality.cz) |
| Listing Count | ~70,000 |
| Typical Runtime | 10-30 minutes (discovery) + background detail fetch |
| Property Categories | Apartments, Houses, Land, Commercial |
| Docker Service | `cz-reality` |
| Default Port | 8102 (configurable) |
| Version | 4.0.0-three-phase |

## Overview

Reality.cz is a major Czech real estate portal. This scraper uses a **reverse-engineered mobile API** (`api.reality.cz`, based on APK v3.1.4) rather than HTML scraping. The API provides structured data including GPS coordinates, `information[]` key-value arrays, and photo URLs.

The scraper implements a **three-phase checksum-optimized** architecture:

1. **Phase 1 (Discovery):** Sequential pagination through search API to collect all listing IDs (~5-10 min)
2. **Phase 2 (Comparison):** Checksum comparison against ingest API (~10-30 sec)
3. **Phase 3 (Queue):** New/changed listings queued for BullMQ detail workers (seconds, workers run in background)

## Category Mapping

| Offer Type | Property Types | Transaction |
|------------|---------------|-------------|
| `prodej` | `byty`, `domy`, `pozemky`, `komercni` | `sale` |
| `pronajem` | `byty`, `domy`, `pozemky`, `komercni` | `rent` |

8 total combinations (2 offer types x 4 property types).

## Tech Stack

- **Runtime:** Node.js 20 (Slim)
- **Language:** TypeScript
- **HTTP Client:** Axios (with session-based auth)
- **Job Queue:** BullMQ (Redis)
- **Shared:** `@landomo/core` (ScrapeRunTracker, ChecksumClient, metrics)

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Health check with queue stats and feature flags |
| `POST` | `/scrape` | Trigger scrape (async, returns 202) |
| `GET` | `/metrics` | Prometheus metrics |

## File Structure

```
reality/
  src/
    index.ts                              # Express server, scrape orchestration
    scraper/
      threePhaseOrchestrator.ts           # Three-phase checksum orchestrator
    scrapers/
      realityApiScraper.ts                # API client with search pagination
    transformers/
      realityTransformer.ts               # Category router
      apartments/apartmentTransformer.ts  # Apartment -> ApartmentPropertyTierI
      houses/houseTransformer.ts          # House -> HousePropertyTierI
      land/landTransformer.ts             # Land -> LandPropertyTierI
      commercial/commercialTransformer.ts # Commercial -> CommercialPropertyTierI
    adapters/
      ingestAdapter.ts                    # POST to bulk-ingest endpoint
    queue/
      detailQueue.ts                      # BullMQ queue, worker, batch flush
    types/
      realityTypes.ts                     # API types, RealityListing, apiDetailToListing
    utils/
      checksumExtractor.ts                # Checksum creation from listings & search items
      realityAuth.ts                      # Session-based API authentication
  Dockerfile
  package.json
  tsconfig.json
```
