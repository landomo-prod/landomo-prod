# Immotop.lu Scraper

| Field | Value |
|-------|-------|
| Portal | [immotop.lu](https://www.immotop.lu) |
| Listing Count | ~5,000-10,000 |
| Typical Runtime | 10-20 minutes (with checksum optimization) |
| Property Categories | Apartments, Houses, Land, Commercial |
| Docker Service | `lu-immotop` |
| Default Port | 8231 |
| Version | 1.0.0 |
| API Type | HTML scraping with `__NEXT_DATA__` extraction |

## Overview

Immotop is a Luxembourg real estate portal covering the Greater Region (Luxembourg, France/Lorraine, Belgium, Germany). It runs on Next.js, which means listing data can be extracted from embedded `__NEXT_DATA__` JSON in the HTML rather than parsing DOM elements.

The scraper implements a **three-phase checksum-optimized** architecture:

1. **Phase 1 (Discovery):** Parallel HTML page fetching with `__NEXT_DATA__` extraction (~3-5 min)
2. **Phase 2 (Comparison):** Checksum comparison against ingest API (~10-30 sec)
3. **Phase 3 (Selective Fetch):** Only new/changed listings queued for detail fetch via BullMQ (~5-15 min)

Lower worker concurrency (20 default) is used to respect the HTML-based portal.

## Category Mapping

| Immotop URL Segment | Property Category | Transaction Types |
|--------------------|-------------------|-------------------|
| `apartment` | `apartment` | buy, rent |
| `house` | `house` | buy, rent |
| `land` | `land` | buy |
| `office` | `commercial` | buy, rent |

7 search configurations total (land has no rent).

## Tech Stack

- **Runtime:** Node.js 20 (Alpine)
- **Language:** TypeScript
- **HTTP Client:** Axios
- **HTML Parser:** Cheerio
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
immotop-lu/
  src/
    index.ts                              # Express server, scrape orchestration
    scraper/
      threePhaseOrchestrator.ts           # Three-phase checksum orchestrator
    transformers/
      apartmentTransformer.ts             # apartment -> ApartmentPropertyTierI
      houseTransformer.ts                 # house -> HousePropertyTierI
      landTransformer.ts                  # land -> LandPropertyTierI
      commercialTransformer.ts            # office -> CommercialPropertyTierI
    adapters/
      ingestAdapter.ts                    # POST to bulk-ingest endpoint
    queue/
      detailQueue.ts                      # BullMQ queue, worker, batch flush
    types/
      rawTypes.ts                         # ImmotopListingRaw, ImmotopDetailRaw
    utils/
      fetchData.ts                        # HTML fetch, __NEXT_DATA__ parsing, cheerio fallback
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
