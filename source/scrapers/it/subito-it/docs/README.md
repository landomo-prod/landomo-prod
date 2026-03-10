# Subito.it Scraper

| Field | Value |
|-------|-------|
| Portal | [subito.it](https://www.subito.it) |
| Country | Italy |
| Listing Count | ~500,000 |
| Typical Runtime | 20-40 minutes (first run), 5-10 minutes (repeat with checksum optimization) |
| Property Categories | Apartments, Houses |
| Docker Service | `it-subito` |
| Default Port | 8122 |
| Data Source | Hades REST API (`hades.subito.it/v1/search/items`) |

## Overview

Subito.it is Italy's largest online classifieds marketplace and the dominant property listing platform in the country, with approximately 500,000 active property listings. This scraper uses the **Hades REST API** — Subito's internal search backend — which returns clean JSON responses without any HTML parsing.

The scraper implements a **three-phase streaming orchestrator** with BullMQ:

1. **Phase 1 (Discovery):** Axios fetches listing summaries from the Hades API per region/category/contract combination. Full item data is already present in the Phase 1 response — no separate detail fetch is required.
2. **Phase 2 (Checksum Comparison):** Per-page checksums are compared against the ingest API to detect new and changed listings (max 2 concurrent checksum calls via semaphore).
3. **Phase 3 (Queue Dispatch):** New or changed listings are enqueued to BullMQ as 50-item batches for transformation and ingestion.

This achieves **80-90% API call reduction** on stable repeat runs.

> **Important:** The Hades API is blocked from VPS/datacenter IP ranges. This scraper must run on a **residential IP** (i.e., locally or via a residential proxy). Subito also blocks HTML detail page scraping from all IP types — the Hades API is the only viable data source.

## Search Combinations

| Dimension | Values | Count |
|-----------|--------|-------|
| Italian regions | 20 (lazio, lombardia, campania, ...) | 20 |
| Property categories | appartamenti (7), case-ville (4) | 2 |
| Contract types | vendita (s), affitto (k) | 2 |
| **Total combinations** | | **80** |

Combinations run with p-limit concurrency of **3 simultaneous combos**. Pages are fetched with a **300ms delay** between requests within a combo.

## Category Mapping

| Hades Category | Category ID | Property Category | Transaction Types |
|----------------|-------------|-------------------|-------------------|
| appartamenti | 7 | `apartment` | vendita (sale), affitto (rent) |
| case-ville | 4 | `house` | vendita (sale), affitto (rent) |

## Tech Stack

- **Runtime:** Node.js 20 (Alpine)
- **Language:** TypeScript
- **HTTP Client:** Axios
- **Job Queue:** BullMQ (Redis)
- **Concurrency:** p-limit (combo-level), semaphore (checksum calls)
- **Shared:** `@landomo/core` (ScrapeRunTracker, ChecksumClient)

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Health check with queue stats |
| `POST` | `/scrape` | Trigger scrape (async, returns 202) |

## File Structure

```
subito-it/
  src/
    index.ts                                  # Express server (port 8122), BullMQ worker startup
    scraper/
      threePhaseOrchestrator.ts               # Three-phase streaming orchestrator
    scrapers/
      listingsScraper.ts                      # Hades API client (ListingsScraper class)
      detailScraper.ts                        # HTML detail scraper (fallback only, not used)
    transformers/
      index.ts                                # Category router
      apartments/apartmentTransformer.ts      # SubitoItem -> ApartmentPropertyTierI
      houses/houseTransformer.ts              # SubitoItem -> HousePropertyTierI
    queue/
      detailQueue.ts                          # BullMQ queue, worker, batch flush
    types/
      subitoTypes.ts                          # SubitoItem, SubitoMinimalListing, SUBITO_REGIONS,
                                              # SUBITO_CATEGORY_IDS, SUBITO_CONTRACT_KEYS
    utils/
      checksumExtractor.ts                    # Checksum creation from SubitoMinimalListing
      subitoHelpers.ts                        # extractIdFromUrn, getFeatureValueByUri,
                                              # parseNumeric, parseFloor, buildSourceUrl,
                                              # mapTransactionType, mapCondition
      userAgents.ts                           # 6 rotating user agent strings
  docs/
    README.md
    SCRAPER.md
    TRANSFORMERS.md
    CONFIGURATION.md
    FIELD_MAPPING.md
  Dockerfile
  package.json
  tsconfig.json
```

## First-Run Performance

| Metric | Value |
|--------|-------|
| Regions | 20 |
| Combos | 80 |
| Avg listings per combo | ~6,250 |
| Page size | 35 |
| Pages per combo (avg) | ~178 |
| Properties ingested (observed) | 3,599+ |
| Runtime (first run) | 20-40 min |
| Runtime (repeat, checksum) | 5-10 min |
