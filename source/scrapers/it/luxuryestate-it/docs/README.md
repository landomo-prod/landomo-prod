# LuxuryEstate.com Italy Scraper

| Field | Value |
|-------|-------|
| Portal | [luxuryestate.com](https://www.luxuryestate.com) |
| Coverage | Italy listings only |
| Listing Count | ~2,400 (high-end luxury segment) |
| Typical Runtime | 10-20 minutes (with checksum optimization) |
| Property Categories | Apartments, Houses (villas & houses) |
| Docker Service | `it-luxuryestate` |
| Default Port | 8123 |

## Overview

LuxuryEstate.com is an international luxury real estate portal. This scraper covers the Italian subset (~2,400 listings) across two property categories (apartments and houses/villas) and two transaction types (sale and rent), yielding 5 search configurations.

The scraper implements a **three-phase checksum-optimized** architecture:

1. **Phase 1 (Discovery):** Axios fetches HTML search result pages and extracts minimal listing data from an embedded `<script id="tracking-hydration">` JSON blob.
2. **Phase 2 (Comparison):** Per-page checksum comparison against the ingest API via a semaphore-limited 2-concurrent pipeline to detect new and changed listings.
3. **Phase 3 (Selective Detail Fetch):** Only new/changed listings are queued to BullMQ. A worker fetches individual detail pages, parses schema.org JSON-LD (`@graph` pattern), transforms, and ingests.

This achieves significant API call reduction on repeat runs by skipping unchanged listings.

## Search Configurations

| Config ID | URL Path | Property Category | Transaction |
|-----------|----------|-------------------|-------------|
| `apartments-sale` | `/apartments-italy` | `apartment` | `sale` |
| `apartments-rent` | `/rent/apartments-italy` | `apartment` | `rent` |
| `villas-sale` | `/villas-italy` | `house` | `sale` |
| `villas-rent` | `/rent/villas-italy` | `house` | `rent` |
| `houses-sale` | `/houses-italy` | `house` | `sale` |

## Tech Stack

| Component | Technology |
|-----------|------------|
| Runtime | Node.js 20 (Alpine) |
| Language | TypeScript |
| HTTP Client | Axios |
| HTML Parsing | Cheerio |
| Structured Data | schema.org JSON-LD (`@graph`) |
| Job Queue | BullMQ (Redis) |
| Anti-bot | User-agent rotation (no residential IP required) |

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Health check with queue statistics |
| `POST` | `/scrape` | Trigger full scrape (async, returns 202) |

## File Structure

```
luxuryestate-it/
  src/
    index.ts                                    # Express server (port 8123), BullMQ worker startup
    scraper/
      threePhaseOrchestrator.ts                 # Three-phase streaming orchestrator
    scrapers/
      listingsScraper.ts                        # Phase 1: HTML page fetch, tracking-hydration extraction
      detailScraper.ts                          # Phase 3: Detail page fetch, JSON-LD extraction
    transformers/
      apartments/apartmentTransformer.ts        # LuxuryEstateListing -> ApartmentPropertyTierI
      houses/houseTransformer.ts                # LuxuryEstateListing -> HousePropertyTierI
    adapters/
      ingestAdapter.ts                          # POST to /bulk-ingest endpoint
    queue/
      detailQueue.ts                            # BullMQ queue definition, worker, batch flush
    types/
      luxuryEstateTypes.ts                      # LuxuryEstateMinimalListing, LuxuryEstateJsonLd
    utils/
      userAgents.ts                             # User-agent rotation pool
  docs/
    README.md                                   # This file
    SCRAPER.md                                  # Fetch mechanics and phase details
    TRANSFORMERS.md                             # Field mapping and transformation logic
    CONFIGURATION.md                            # Environment variables and Docker config
    FIELD_MAPPING.md                            # Complete source-to-target field reference
  Dockerfile
  package.json
  tsconfig.json
```

## Anti-Bot Profile

LuxuryEstate.com does not employ significant bot-detection measures (no Cloudflare, no Datadome). Standard Axios requests with user-agent rotation are sufficient. No residential proxies are required for VPS deployment.

## Portal ID Format

All listings use the format `luxuryestate-it-{numericId}` where `numericId` is extracted from the listing URL via the pattern `/p(\d+)[-/]/`.

**Example:** URL `/p131940796-luxury-apartment-rome` → `portalId: 'luxuryestate-it-131940796'`
