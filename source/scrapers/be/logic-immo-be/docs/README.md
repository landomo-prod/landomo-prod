# Logic-Immo.be Scraper

| Field | Value |
|-------|-------|
| Portal | [logic-immo.be](https://www.logic-immo.be) |
| Listing Count | ~25,000-40,000 |
| Typical Runtime | 10-25 minutes (with checksum optimization) |
| Property Categories | Apartments, Houses, Land, Commercial (Offices) |
| Docker Service | `be-logic-immo` |
| Default Port | 8213 |
| Version | 1.0.0 |

## Overview

Logic-Immo is part of the larger Logic-Immo network (also present in France). This scraper uses Cheerio-based HTML parsing with three extraction strategies: Next.js `__NEXT_DATA__`, JSON-LD structured data, and CSS selector-based HTML card parsing. Search pages use French-language URL paths with 7 category-transaction combinations.

The scraper implements a **three-phase checksum-optimized** architecture:

1. **Phase 1 (Discovery):** Sequential page fetching across 7 search path combinations (~5-15 min)
2. **Phase 2 (Comparison):** Checksum comparison against ingest API (~10-30 sec)
3. **Phase 3 (Selective Fetch):** Only new/changed listings queued for detail fetch via BullMQ (~5-15 min)

## Category Mapping

| Logic-Immo Path | Property Category | Transaction Type |
|-----------------|-------------------|------------------|
| `/fr/vente/appartement/` | `apartment` | sale |
| `/fr/location/appartement/` | `apartment` | rent |
| `/fr/vente/maison/` | `house` | sale |
| `/fr/location/maison/` | `house` | rent |
| `/fr/vente/terrain/` | `land` | sale |
| `/fr/vente/bureau/` | `commercial` | sale |
| `/fr/location/bureau/` | `commercial` | rent |

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Runtime | Node.js 20 (Alpine) |
| Language | TypeScript |
| HTTP Client | Axios |
| HTML Parser | Cheerio |
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
logic-immo-be/
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
      rawTypes.ts                         # RawLogicImmoListing, RawLogicImmoSearchResponse
    utils/
      fetchData.ts                        # Cheerio HTML parsing, detail fetch
      headers.ts                          # Realistic browser header rotation
      checksumExtractor.ts                # Checksum creation from listings
  Dockerfile
  package.json
  tsconfig.json
```

## Anti-Bot Status

Logic-Immo has **moderate** anti-bot protection. The scraper uses proper browser headers and 200-500ms delays between requests. A page limit of 200 pages prevents infinite loops. Rate limiting (429) is handled with Retry-After header respect.
