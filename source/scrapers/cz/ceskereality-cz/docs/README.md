# CeskeReality Scraper

## Overview
- **Portal**: ceskereality-cz
- **URL**: https://www.ceskereality.cz
- **Country**: Czech Republic
- **Categories**: apartment, house, land, commercial
- **Data Source**: Hybrid (JSON-LD structured data + HTML scraping)
- **Anti-bot**: None (plain HTTP fetch with Cheerio)

## Technology Stack
- **Language**: TypeScript
- **Scraping**: Native `fetch` + Cheerio (HTML parsing)
- **Framework**: Express (port 8109)
- **Category Detection**: URL-based (separate category URLs on portal)
- **Queue**: Optional BullMQ detail queue for parallel processing

## Data Flow
```
POST /scrape
  -> scrapeListings()
    -> For each category (apartments, houses, land, commercial):
      -> Paginate listing pages (Cheerio, collect URLs)
      -> Scrape each detail page (fetch HTML)
      -> Extract JSON-LD + HTML property details
      -> Transform via category-specific transformer
      -> Batch send to Ingest API (50 per batch)
```

## Quick Start

### Run Locally
```bash
cd "scrapers/Czech Republic/ceskereality"
npm install
npm run dev
```

### Trigger Scrape
```bash
curl -X POST http://localhost:8109/scrape
```

### Environment Variables
| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8109` | Server port |
| `MAX_PAGES` | `5` | Max pagination pages per category |
| `DELAY_MS` | `500` | Delay between requests (ms) |
| `INGEST_API_URL` | `http://localhost:3001` | Ingest service URL |
| `INGEST_API_KEY_CESKEREALITY` | `dev_key_cz_1` | API key |

## Key Files
- `src/index.ts` - Express server, `/scrape` endpoint
- `src/scrapers/listingsScraper.ts` - Discovery + detail extraction
- `src/transformers/ceskerealityApartmentTransformer.ts` - Apartment transformer
- `src/transformers/ceskerealityHouseTransformer.ts` - House transformer
- `src/transformers/ceskerealityLandTransformer.ts` - Land transformer
- `src/transformers/ceskerealityCommercialTransformer.ts` - Commercial transformer
- `src/transformers/propertyDetailsMapper.ts` - Czech HTML label -> standardized field mapper
- `src/adapters/ingestAdapter.ts` - Direct batch ingest via fetch
- `src/adapters/queueIngestAdapter.ts` - Queue-based ingest via axios
- `src/queue/detailQueue.ts` - BullMQ detail page processing queue
- `src/utils/scrapeRunTracker.ts` - Scrape run lifecycle tracking

## Notes
- Portal provides JSON-LD structured data on detail pages, which is the primary data source
- HTML property details table (`.i-info` elements) supplements JSON-LD with additional fields like floor, construction type, condition, utilities
- Images are extracted from HTML gallery (`img[src*="img.ceskereality.cz/foto"]`) rather than JSON-LD (which only has one image)
- Two ingestion paths exist: direct batch (ingestAdapter.ts) and queue-based (detailQueue.ts + queueIngestAdapter.ts)
- Portal ID extracted from URL pattern: `-{numeric_id}.html` -> `cr-{id}`
- All categories are sale-only (`transaction_type: 'sale'`)
