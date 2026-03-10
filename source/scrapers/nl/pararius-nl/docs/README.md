# Pararius.nl Scraper

| Field | Value |
|-------|-------|
| Portal | [pararius.nl](https://www.pararius.nl) |
| Listing Count | ~12,000-18,000 |
| Typical Runtime | 10-20 minutes (with checksum optimization) |
| Property Categories | Apartments, Houses |
| Docker Service | `nl-pararius` |
| Default Port | 8221 |
| Version | 1.0.0 |

## Overview

Pararius is a major Dutch **rental-only** portal. All listings are rentals (`transaction_type: 'rent'`). This scraper uses HTML parsing with Cheerio to extract listing data from search and detail pages.

The scraper implements a **three-phase checksum-optimized** architecture:

1. **Phase 1 (Discovery):** Sequential page fetching for apartments and houses (~5-10 min)
2. **Phase 2 (Comparison):** Checksum comparison against ingest API (~10-30 sec)
3. **Phase 3 (Selective Fetch):** Only new/changed listings queued for detail fetch via BullMQ (~5-10 min)

## Category Mapping

| Pararius Type (Dutch) | URL Slug | Property Category |
|-----------------------|----------|-------------------|
| appartement | `/huurappartementen/` | `apartment` |
| huis | `/huurwoningen/` | `house` |

**Note:** Pararius does not list land or commercial properties. Only apartments and houses are scraped.

## Tech Stack

- **Runtime:** Node.js 20 (Alpine)
- **Language:** TypeScript
- **HTTP Client:** Axios
- **HTML Parser:** Cheerio
- **Job Queue:** BullMQ (Redis)
- **Shared:** `@landomo/core` (ScrapeRunTracker, ChecksumClient, metrics)

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Health check with queue stats |
| `POST` | `/scrape` | Trigger scrape (async, returns 202) |
| `GET` | `/metrics` | Prometheus metrics |

## File Structure

```
pararius-nl/
  src/
    index.ts                              # Express server, scrape orchestration
    scraper/
      threePhaseOrchestrator.ts           # Three-phase checksum orchestrator
    transformers/
      apartmentTransformer.ts             # Apartment -> ApartmentPropertyTierI
      houseTransformer.ts                 # House -> HousePropertyTierI
      landTransformer.ts                  # Land -> LandPropertyTierI (unused)
      commercialTransformer.ts            # Commercial -> CommercialPropertyTierI (unused)
    adapters/
      ingestAdapter.ts                    # POST to bulk-ingest endpoint
    queue/
      detailQueue.ts                      # BullMQ queue, worker, batch flush
    types/
      rawTypes.ts                         # ParariusSearchResult, ParariusDetailData
    utils/
      fetchData.ts                        # HTML fetch, search/detail parsing
      headers.ts                          # Dutch locale header rotation
      checksumExtractor.ts                # Checksum creation from listings
  Dockerfile
  package.json
  tsconfig.json
```
