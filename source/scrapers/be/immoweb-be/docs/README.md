# Immoweb.be Scraper

| Field | Value |
|-------|-------|
| Portal | [immoweb.be](https://www.immoweb.be) |
| Listing Count | ~150,000 |
| Typical Runtime | 10-30 minutes (with checksum optimization) |
| Property Categories | Apartments, Houses, Land, Commercial (Office) |
| Docker Service | `be-immoweb` |
| Default Port | 8210 |
| Version | 1.0.0 |

## Overview

Immoweb is the largest Belgian real estate portal. This scraper uses a dual-strategy approach for search pages: it first attempts the JSON search API at `search.immoweb.be`, then falls back to HTML scraping with embedded JSON extraction from `<iw-search>` components. Detail pages extract property data from `window.classified` JSON objects embedded in the HTML.

The scraper implements a **three-phase checksum-optimized** architecture:

1. **Phase 1 (Discovery):** Parallel page fetching across 4 categories x 2 transaction types (~5-10 min)
2. **Phase 2 (Comparison):** Checksum comparison against ingest API to detect new/changed listings (~10-30 sec)
3. **Phase 3 (Selective Fetch):** Only new/changed listings queued for detail fetch via BullMQ (~5-20 min)

This achieves **85-95% API call reduction** on repeat runs.

## Category Mapping

| Immoweb Category | Property Category | Transaction Types |
|-------------------|-------------------|-------------------|
| APARTMENT | `apartment` | FOR_SALE, FOR_RENT |
| HOUSE | `house` | FOR_SALE, FOR_RENT |
| LAND | `land` | FOR_SALE, FOR_RENT |
| OFFICE | `commercial` | FOR_SALE, FOR_RENT |

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
immoweb-be/
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
      rawTypes.ts                         # ImmowebListing, ImmowebDetailResult
    utils/
      fetchData.ts                        # Search API + HTML fetch, detail fetch
      headers.ts                          # Realistic browser header rotation
      checksumExtractor.ts                # Checksum creation from listings
  Dockerfile
  package.json
  tsconfig.json
```

## Anti-Bot Status

Immoweb uses **Cloudflare WAF** protection. Simple HTTP requests to search pages return 403. The current implementation attempts:

1. JSON search API (`search.immoweb.be`) -- often blocked
2. HTML search with embedded JSON extraction -- often blocked
3. Detail pages via `window.classified` JSON extraction

**Production note:** Full production deployment requires Puppeteer with stealth plugin for search page access. The current HTTP-based approach works when Cloudflare challenge is not triggered.
