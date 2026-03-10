# BezRealitky Scraper

**Portal:** [bezrealitky.cz](https://www.bezrealitky.cz)
**Listing Count:** ~20,000 listings
**Scrape Duration:** 5-10 minutes
**Docker Service:** `cz-bezrealitky`
**Port:** 8102 (configurable via `PORT` env var)
**Version:** 2.0.0-checksum

## Overview

BezRealitky is a Czech real estate portal with a public GraphQL API. The scraper fetches listings directly via GraphQL queries -- no HTML parsing or browser automation required. Discovery returns full listing data in a single request (all-in-one pattern), eliminating the need for separate detail fetches.

## Property Categories

| Estate Type | Category | Transformer |
|---|---|---|
| `BYT` | `apartment` | `apartmentTransformer.ts` |
| `DUM` | `house` | `houseTransformer.ts` |
| `POZEMEK` | `land` | `landTransformer.ts` |
| `GARAZ` | `commercial` | `commercialTransformer.ts` |
| `KANCELAR` | `commercial` | `commercialTransformer.ts` |
| `NEBYTOVY_PROSTOR` | `commercial` | `commercialTransformer.ts` |
| `REKREACNI_OBJEKT` | `house` (cottage subtype) | `houseTransformer.ts` |

## Offer Types

- `PRODEJ` (sale)
- `PRONAJEM` (rent)

Total category combinations: 2 offer types x 7 estate types = **14 categories**

## Source Structure

```
src/
├── index.ts                              # Express server, scrape orchestration
├── scrapers/listingsScraper.ts           # GraphQL API client, parallel page fetching
├── adapters/ingestAdapter.ts             # Ingest API client with retry/backoff
├── transformers/
│   ├── index.ts                          # Router: estateType → category transformer
│   ├── apartments/apartmentTransformer.ts
│   ├── houses/houseTransformer.ts
│   ├── land/landTransformer.ts
│   └── commercial/commercialTransformer.ts
├── types/bezrealitkyTypes.ts             # GraphQL response types
└── utils/
    ├── bezrealitkyHelpers.ts             # Disposition parsing, floor parsing, ownership normalization
    ├── categoryDetector.ts               # estateType → category mapping
    ├── checksumExtractor.ts              # Checksum field extraction for dedup
    └── userAgents.ts                     # User agent rotation pool
```

## Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Health check (includes checksum mode status) |
| `POST` | `/scrape` | Trigger scrape (returns 202, runs async) |
| `GET` | `/metrics` | Prometheus metrics |

## Modes

1. **Legacy (streaming) mode** -- Default. Fetches all pages, transforms, and streams batches to ingest API as they arrive.
2. **Checksum mode** -- Enabled via `ENABLE_CHECKSUM_MODE=true`. Fetches all pages, generates checksums, compares against DB, and only ingests new/changed listings. Achieves 80-90% reduction in ingestion volume.

## Quick Start

```bash
# Local development
cd scrapers/Czech\ Republic/bezrealitky
npm install
npm run dev

# Trigger scrape
curl -X POST http://localhost:8102/scrape

# Docker
docker compose up cz-bezrealitky
```

## Data Quality

- 95%+ field completion rate
- Direct boolean amenity fields (no string parsing)
- Multiple area measurements (balcony, loggia, terrace, cellar)
- Explicit enum-based category detection (100% accuracy)
- Structured GraphQL data (no HTML parsing needed)

## API Quirks

- Timestamps in Unix epoch seconds (need `* 1000` for JS Date)
- Some fields use nullable vs false
- Image URLs require `filter: RECORD_MAIN` parameter
- Prices sometimes null for "price on request"
- `gps.lng` maps to `coordinates.lon`
