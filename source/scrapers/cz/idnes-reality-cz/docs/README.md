# iDNES Reality Scraper

## Overview
- **Portal**: Reality.idnes.cz
- **URL**: https://reality.idnes.cz
- **Country**: Czech Republic
- **Categories**: apartment, house, land, commercial (commercial/recreation scraped but routed to apartment default)
- **Data Source**: HTML scraping (fetch + Cheerio)
- **Anti-bot**: None (basic User-Agent header)

## Quick Stats
- **Scrape Frequency**: Scheduled via centralized scheduler
- **Categories Scraped**: 8 (flats sale/rent, houses sale/rent, land sale, commercial sale/rent, recreation sale)
- **Port**: 8102

## Technology Stack
- **Language**: TypeScript
- **Scraping**: Native `fetch` + Cheerio (no headless browser)
- **Framework**: Express
- **Category Detection**: Text-based matching on `propertyType` + `title`
- **Checksum**: price, title, description, sqm, disposition, floor

## Data Flow
```
Portal HTML Pages
    -> Discovery (list pages with pagination)
    -> Detail Page Enrichment (optional, per-listing fetch)
    -> Category Detection (apartment/house/land)
    -> Category-Specific Transformer
    -> IngestAdapter (bulk-ingest API)
```

## Modes of Operation

### Legacy/Streaming Mode (default)
Scrapes categories sequentially, streams each category batch to ingest API immediately after scraping.

### Checksum Mode (`ENABLE_CHECKSUM_MODE=true`)
Scrapes all listings first, generates checksums, compares against database, and only sends new/changed listings. Achieves 95-99% fewer ingestions on subsequent runs.

## Quick Start

### Run Locally
```bash
cd "scrapers/Czech Republic/idnes-reality"
npm install
npm run dev
```

### Trigger Scrape
```bash
curl -X POST http://localhost:8102/scrape
```

### Docker
```bash
docker compose up idnes-reality
```

## Key Files
- `src/index.ts` - Express server, scrape orchestration, mode selection
- `src/scrapers/listingsScraper.ts` - HTML discovery, pagination, detail extraction
- `src/transformers/idnesTransformer.ts` - Category detection and routing
- `src/transformers/apartments/idnesApartmentTransformer.ts` - Apartment -> ApartmentPropertyTierI
- `src/transformers/houses/idnesHouseTransformer.ts` - House -> HousePropertyTierI
- `src/transformers/land/idnesLandTransformer.ts` - Land -> LandPropertyTierI
- `src/utils/checksumExtractor.ts` - Checksum field extraction
- `src/adapters/ingestAdapter.ts` - Bulk ingest API client
- `src/types/idnesTypes.ts` - Portal-specific type definitions

## Environment Variables
| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8102` | Server port |
| `ENABLE_CHECKSUM_MODE` | `false` | Enable checksum-based change detection |
| `FETCH_DETAILS` | `true` | Fetch individual detail pages for enrichment |
| `MAX_PAGES_PER_CATEGORY` | `999999` (unlimited) | Max pagination pages per category |
| `RATE_LIMIT_DELAY` | `1000` | Delay between page fetches (ms) |
| `MAX_RETRIES` | `3` | Max retries for failed requests |
| `TIMEOUT` | `30000` | Request timeout (ms) |
| `INGEST_API_URL` | `http://ingest-czech:3000` | Ingest service URL |
| `INGEST_API_KEY` | `dev_key_cz_1` | Ingest API key |

## Notes
- Commercial and recreation categories are scraped but currently routed to the apartment transformer as default (no dedicated commercial transformer)
- Detail page enrichment adds coordinates, attributes (floor, ownership, condition, etc.) but adds significant scrape time
- The scraper uses a 500-1000ms random delay between detail page fetches to avoid rate limiting
- Portal IDs are prefixed with `idnes-` (e.g., `idnes-abc123`)
