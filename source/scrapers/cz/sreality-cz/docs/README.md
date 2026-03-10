# SReality.cz Scraper

| Field | Value |
|-------|-------|
| Portal | [sreality.cz](https://www.sreality.cz) |
| Listing Count | ~70,000 |
| Typical Runtime | 5-15 minutes (with checksum optimization) |
| Property Categories | Apartments, Houses, Land, Commercial, Other |
| Docker Service | `cz-sreality` |
| Default Port | 8102 |
| Version | 2.0.0-queue |

## Overview

SReality is the largest Czech real estate portal. This scraper uses the SReality public JSON API (`sreality.cz/api/cs/v2/estates`) to fetch listings across 5 categories and 2 transaction types (sale/rent), yielding 10 category-type combinations.

The scraper implements a **three-phase checksum-optimized** architecture:

1. **Phase 1 (Discovery):** Parallel page fetching of all listing summaries (~2-3 min)
2. **Phase 2 (Comparison):** Checksum comparison against ingest API to detect new/changed listings (~10-30 sec)
3. **Phase 3 (Selective Fetch):** Only new/changed listings are queued for detail fetch via BullMQ (~5-10 min)

This achieves **90-95% API call reduction** on repeat runs.

## Category Mapping

| SReality Category ID | Czech Name | Property Category | Transaction Types |
|----------------------|------------|-------------------|-------------------|
| 1 | Byty | `apartment` | Sale (1), Rent (2) |
| 2 | Domy | `house` | Sale (1), Rent (2) |
| 3 | Pozemky | `land` | Sale (1), Rent (2) |
| 4 | Komercni | `commercial` | Sale (1), Rent (2) |
| 5 | Ostatni | `other` | Sale (1), Rent (2) |

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

### Scrape Query Parameters

| Parameter | Values | Description |
|-----------|--------|-------------|
| `categories` | `1,2,3,4,5` | Specific category IDs |
| `categories` | `critical` | Categories 1,2 (Apartments, Houses) |
| `categories` | `standard` | Categories 3,4,5 (Land, Commercial, Other) |

## File Structure

```
sreality/
  src/
    index.ts                              # Express server, scrape orchestration
    scraper/
      threePhaseOrchestrator.ts           # Three-phase checksum orchestrator
    scrapers/
      listingsScraper.ts                  # ListingsScraper class (legacy path)
      detailScraper.ts                    # Detail fetch with p-limit concurrency
    transformers/
      srealityTransformer.ts              # Category router
      apartments/apartmentTransformer.ts  # Apartment -> ApartmentPropertyTierI
      houses/houseTransformer.ts          # House -> HousePropertyTierI
      land/landTransformer.ts             # Land -> LandPropertyTierI
      commercial/commercialTransformer.ts # Commercial -> CommercialPropertyTierI
      other/otherTransformer.ts           # Other -> OtherPropertyTierI
    adapters/
      ingestAdapter.ts                    # POST to bulk-ingest endpoint
    queue/
      detailQueue.ts                      # BullMQ queue, worker, batch flush
    types/
      srealityApiTypes.ts                 # FIELD_NAMES, SRealityItemField, API types
      srealityTypes.ts                    # SRealityListing, SRealityDetailResponse
    utils/
      fetchData.ts                        # API fetch with retry, pagination
      rateLimiter.ts                      # Token bucket rate limiter
      checksumExtractor.ts                # Checksum creation from listings
      categoryDetection.ts                # Category detection from listing data
      headers.ts                          # Realistic browser header rotation
      userAgents.ts                       # 100+ user agent pool
      itemsParser.ts                      # Type-safe items[] array parser
      srealityHelpers.ts                  # Shared helper functions
      changeDetector.ts                   # Local change detection (legacy)
  Dockerfile
  package.json
  tsconfig.json
```
