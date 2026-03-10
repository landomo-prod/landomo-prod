# Realo.be Scraper

| Field | Value |
|-------|-------|
| Portal | [realo.be](https://www.realo.be) |
| Listing Count | ~15,000-25,000 |
| Typical Runtime | 10-20 minutes (with checksum optimization) |
| Property Categories | Apartments, Houses, Land, Commercial |
| Docker Service | `be-realo` |
| Default Port | 8214 |
| Version | 1.0.0 |

## Overview

Realo is a Belgian real estate aggregator with heavy anti-bot protection. This scraper uses Cheerio-based HTML parsing with multiple extraction strategies: Next.js `__NEXT_DATA__`, Apollo GraphQL `__APOLLO_STATE__`, `window.__DATA__`, JSON-LD structured data, and HTML card fallback. Search pages use Dutch-language URL paths with 7 category-transaction combinations.

The scraper implements a **three-phase checksum-optimized** architecture:

1. **Phase 1 (Discovery):** Sequential page fetching across 7 search path combinations (~5-15 min)
2. **Phase 2 (Comparison):** Checksum comparison against ingest API (~10-30 sec)
3. **Phase 3 (Selective Fetch):** Only new/changed listings queued for detail fetch via BullMQ (~5-10 min)

## Category Mapping

| Realo Path | Property Category | Transaction Type |
|------------|-------------------|------------------|
| `/nl/te-koop/appartement` | `apartment` | sale |
| `/nl/te-huur/appartement` | `apartment` | rent |
| `/nl/te-koop/huis` | `house` | sale |
| `/nl/te-huur/huis` | `house` | rent |
| `/nl/te-koop/grond` | `land` | sale |
| `/nl/te-koop/commercieel` | `commercial` | sale |
| `/nl/te-huur/commercieel` | `commercial` | rent |

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
realo-be/
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
      rawTypes.ts                         # RawRealoListing, RawRealoSearchResponse
    utils/
      fetchData.ts                        # Cheerio HTML parsing, Apollo state extraction
      headers.ts                          # Realistic browser header rotation
      checksumExtractor.ts                # Checksum creation from listings
  Dockerfile
  package.json
  tsconfig.json
```

## Anti-Bot Status

Realo has **heavy** anti-bot protection (403 on direct HTTP requests). The scraper attempts multiple data extraction strategies but may require Puppeteer with stealth plugin for reliable production scraping. Data overlaps significantly with Immoweb and Zimmo, making this the lowest priority Belgian portal.
