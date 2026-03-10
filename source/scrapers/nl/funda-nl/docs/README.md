# Funda.nl Scraper

| Field | Value |
|-------|-------|
| Portal | [funda.nl](https://www.funda.nl) |
| Listing Count | ~80,000-100,000 |
| Typical Runtime | 15-30 minutes (with checksum optimization) |
| Property Categories | Apartments, Houses, Land, Commercial |
| Docker Service | `nl-funda` |
| Default Port | 8220 |
| Version | 1.0.0 |

## Overview

Funda is the largest Dutch real estate portal. This scraper uses HTML parsing with Cheerio to extract listing data from search pages and detail pages. It extracts structured data from Next.js `__NEXT_DATA__` script tags when available, with fallback to HTML element parsing.

**CAPTCHA WARNING:** Funda has an aggressive captcha/bot detection wall. The scraper may receive captcha challenge pages instead of listing data. Production use requires Puppeteer stealth plugins or residential proxy rotation. See [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for details.

The scraper implements a **three-phase checksum-optimized** architecture:

1. **Phase 1 (Discovery):** Fetch search pages for koop (sale) and huur (rent) transactions (~5-10 min)
2. **Phase 2 (Comparison):** Checksum comparison against ingest API to detect new/changed listings (~10-30 sec)
3. **Phase 3 (Selective Fetch):** Only new/changed listings queued for detail fetch via BullMQ (~10-20 min)

This achieves **80-90% API call reduction** on repeat runs.

## Category Mapping

| Funda Type (Dutch) | Property Category | Transaction Types |
|--------------------|-------------------|-------------------|
| appartement, flat, bovenwoning, benedenwoning, maisonnette, penthouse | `apartment` | koop, huur |
| woonhuis, villa, herenhuis, grachtenpand, landhuis, bungalow, tussenwoning, hoekwoning, twee-onder-een-kap, vrijstaand | `house` | koop, huur |
| bouwgrond, perceel, grond | `land` | koop, huur |
| bedrijfspand, kantoor, winkel, horeca, praktijk | `commercial` | koop, huur |

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
funda-nl/
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
      rawTypes.ts                         # FundaSearchResult, FundaDetailData
    utils/
      fetchData.ts                        # HTML fetch, search/detail parsing
      headers.ts                          # Dutch locale header rotation
      checksumExtractor.ts                # Checksum creation from listings
  Dockerfile
  package.json
  tsconfig.json
```
