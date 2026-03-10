# Immovlan.be Scraper

| Field | Value |
|-------|-------|
| Portal | [immovlan.be](https://www.immovlan.be) |
| Listing Count | ~30,000-50,000 |
| Typical Runtime | 10-20 minutes (with checksum optimization) |
| Property Categories | Apartments, Houses, Land, Commercial |
| Docker Service | `be-immovlan` |
| Default Port | 8212 |
| Version | 1.0.0 |

## Overview

Immovlan is a mid-sized Belgian real estate portal. This scraper uses HTML parsing with multiple extraction strategies: `__NEXT_DATA__` JSON (Next.js), `__INITIAL_DATA__` window variable, JSON-LD structured data, and HTML `data-property-id` fallback. Search pages use French-language URL slugs.

The scraper implements a **three-phase checksum-optimized** architecture:

1. **Phase 1 (Discovery):** Parallel page fetching across 4 categories x 2 transaction types (~5-10 min)
2. **Phase 2 (Comparison):** Checksum comparison against ingest API (~10-30 sec)
3. **Phase 3 (Selective Fetch):** Only new/changed listings queued for detail fetch via BullMQ (~5-15 min)

## Category Mapping

| Immovlan Category | URL Slug (French) | Property Category | Transaction Types |
|-------------------|-------------------|-------------------|-------------------|
| apartment | `appartements` | `apartment` | a-vendre, a-louer |
| house | `maisons` | `house` | a-vendre, a-louer |
| land | `terrains` | `land` | a-vendre, a-louer |
| commercial | `commerces` | `commercial` | a-vendre, a-louer |

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
immovlan-be/
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
      rawTypes.ts                         # Raw type definitions
    utils/
      fetchData.ts                        # HTML search + detail fetch
      headers.ts                          # Realistic browser header rotation
      checksumExtractor.ts                # Checksum creation from listings
  Dockerfile
  package.json
  tsconfig.json
```

## Anti-Bot Status

Immovlan has **moderate** anti-bot protection (likely Cloudflare or similar). HTML content may require proper browser headers. The scraper uses realistic header rotation. Rate limiting with 500-1500ms delays is sufficient.
