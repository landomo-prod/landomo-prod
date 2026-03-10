# Zimmo.be Scraper

| Field | Value |
|-------|-------|
| Portal | [zimmo.be](https://www.zimmo.be) |
| Listing Count | ~40,000-60,000 |
| Typical Runtime | 10-20 minutes (with checksum optimization) |
| Property Categories | Apartments, Houses, Land, Commercial |
| Docker Service | `be-zimmo` |
| Default Port | 8211 |
| Version | 1.0.0 |

## Overview

Zimmo is the second-largest Belgian real estate portal. This scraper uses HTML parsing with multiple extraction strategies: `__NEXT_DATA__` JSON (Next.js), JSON-LD structured data, and HTML card `data-property-id` attribute fallback. Search pages use Dutch-language URL slugs.

The scraper implements a **three-phase checksum-optimized** architecture:

1. **Phase 1 (Discovery):** Parallel page fetching across 4 categories x 2 transaction types (~5-10 min)
2. **Phase 2 (Comparison):** Checksum comparison against ingest API (~10-30 sec)
3. **Phase 3 (Selective Fetch):** Only new/changed listings queued for detail fetch via BullMQ (~5-15 min)

## Category Mapping

| Zimmo Category | URL Slug (Dutch) | Property Category | Transaction Types |
|----------------|-------------------|-------------------|-------------------|
| apartment | `appartement` | `apartment` | te-koop, te-huur |
| house | `huis` | `house` | te-koop, te-huur |
| land | `grond` | `land` | te-koop, te-huur |
| commercial | `commercieel` | `commercial` | te-koop, te-huur |

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Runtime | Node.js 20 (Alpine) |
| Language | TypeScript |
| HTTP Client | Axios |
| Job Queue | BullMQ (Redis) |
| Concurrency | p-limit |
| Shared | `@landomo/core` (ScrapeRunTracker, ChecksumClient, metrics) |

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Health check with queue stats |
| `POST` | `/scrape` | Trigger scrape (async, returns 202) |
| `GET` | `/metrics` | Prometheus metrics |

## File Structure

```
zimmo-be/
  src/
    index.ts                              # Express server, scrape orchestration
    scraper/
      threePhaseOrchestrator.ts           # Three-phase checksum orchestrator
    transformers/
      apartmentTransformer.ts             # Apartment -> ApartmentPropertyTierI
      houseTransformer.ts                 # House -> HousePropertyTierI
      landTransformer.ts                  # Land -> LandPropertyTierI
      commercialTransformer.ts            # Commercial -> CommercialPropertyTierI
    adapters/
      ingestAdapter.ts                    # POST to bulk-ingest endpoint
    queue/
      detailQueue.ts                      # BullMQ queue, worker, batch flush
    types/
      rawTypes.ts                         # Raw type definitions
    utils/
      fetchData.ts                        # HTML search + detail fetch
      headers.ts                          # Realistic browser header rotation
      checksumExtractor.ts                # Checksum creation from listings
  Dockerfile
  package.json
  tsconfig.json
```

## Anti-Bot Status

Zimmo has **basic** anti-bot protection. HTML content is accessible without JavaScript rendering, meaning simple HTTP requests with proper headers generally work. No headless browser required. Rate limiting is moderate -- 500-1500ms delays between requests are sufficient.
