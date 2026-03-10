# ATHome.lu Scraper

| Field | Value |
|-------|-------|
| Portal | [athome.lu](https://www.athome.lu) |
| Listing Count | ~15,000-20,000 |
| Typical Runtime | 5-10 minutes (with checksum optimization) |
| Property Categories | Apartments, Houses, Land, Commercial |
| Docker Service | `lu-athome` |
| Default Port | 8230 |
| Version | 1.0.0 |
| API Type | **Public JSON REST API (no auth required)** |

## Overview

ATHome is the dominant Luxembourg real estate portal with ~83% market share. This scraper uses the **ATHome public JSON API** (`apigw.prd.athomegroup.lu/api-listings/listings`) to fetch listings across 4 property types and 2 transaction types, yielding 8 category-type combinations.

The API requires no authentication, returns structured JSON with coordinates, pricing, agency info, and media links. This makes ATHome the easiest and fastest portal to scrape in the Benelux region.

The scraper implements a **three-phase checksum-optimized** architecture:

1. **Phase 1 (Discovery):** Parallel API pagination of all listing summaries (~2-3 min)
2. **Phase 2 (Comparison):** Checksum comparison against ingest API to detect new/changed listings (~10-30 sec)
3. **Phase 3 (Selective Fetch):** Only new/changed listings are queued for detail fetch via BullMQ (~5-10 min)

This achieves **90-95% API call reduction** on repeat runs.

## Category Mapping

| ATHome `propertyType` | ATHome `type` | Property Category | Transaction Types |
|----------------------|---------------|-------------------|-------------------|
| `flat` | apartment | `apartment` | for-sale, for-rent |
| `house` | house | `house` | for-sale, for-rent |
| `land` | land | `land` | for-sale, for-rent |
| `office` | commercial | `commercial` | for-sale, for-rent |

## Tech Stack

- **Runtime:** Node.js 20 (Alpine)
- **Language:** TypeScript
- **HTTP Client:** Axios
- **Job Queue:** BullMQ (Redis)
- **Concurrency:** p-limit
- **Shared:** `@landomo/core` (ScrapeRunTracker, ChecksumClient, metrics)

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Health check with queue stats |
| `POST` | `/scrape` | Trigger scrape (async, returns 202) |
| `GET` | `/metrics` | Prometheus metrics |

## File Structure

```
athome-lu/
  src/
    index.ts                              # Express server, scrape orchestration
    scraper/
      threePhaseOrchestrator.ts           # Three-phase checksum orchestrator
    transformers/
      apartmentTransformer.ts             # flat -> ApartmentPropertyTierI
      houseTransformer.ts                 # house -> HousePropertyTierI
      landTransformer.ts                  # land -> LandPropertyTierI
      commercialTransformer.ts            # office -> CommercialPropertyTierI
    adapters/
      ingestAdapter.ts                    # POST to bulk-ingest endpoint
    queue/
      detailQueue.ts                      # BullMQ queue, worker, batch flush
    types/
      rawTypes.ts                         # AtHomeListingRaw, AtHomeDetailRaw, API types
    utils/
      fetchData.ts                        # API fetch, pagination, detail fetch
      checksumExtractor.ts                # MD5 checksum from listing data
      headers.ts                          # Realistic browser header rotation
  Dockerfile
  package.json
  tsconfig.json
  docs/
    README.md
    CONFIGURATION.md
    ARCHITECTURE.md
    TRANSFORMERS.md
    TROUBLESHOOTING.md
```
