# Ingatlannet.hu Scraper

## Overview
- **Portal**: Ingatlannet.hu
- **URL**: https://ingatlannet.hu
- **Country**: Hungary
- **Categories**: Apartment, House, Land, Commercial
- **Data Source**: HTML with JSON-LD and DataLayer extraction
- **Anti-bot**: CycleTLS (browser TLS fingerprinting) + Playwright fallback

## Quick Stats
- **Active Listings**: ~5,000-10,000 (estimated, regional portal)
- **Scrape Frequency**: Configurable via maxRegions/maxPages
- **Technology**: TypeScript/Express with CycleTLS and Cheerio parsing
- **Regional Concurrency**: 10 regions in parallel
- **Concurrency**: 50 workers for detail fetching (configurable)

## Data Flow
Portal → Fast Scan (HTML/JSON-LD) → Phase 1 Checksum Comparison → Phase 2 Detail Fetch → Transformation → Ingestion API

## Key Features
- **Regional Focus**: Szeged priority (largest regional city) with full Hungary coverage
- **Dual Extraction Methods**: JSON-LD preferred, HTML fallback for reliability
- **CycleTLS Protection Bypass**: Browser TLS fingerprinting for anti-bot bypass
- **Queue-Based Detail Processing**: BullMQ workers handle detail page fetching
- **Checksum Optimization**: Compares checksums to skip unchanged listings (80-90% savings)

## Key Files
- `src/index.ts` - Express server and main orchestrator
- `src/scrapers/listingsScraper.ts` - HTML parsing and JSON-LD extraction
- `src/transformers/ingatlannetTransformer.ts` - Portal format to StandardProperty conversion
- `src/adapters/ingestAdapter.ts` - Ingest API communication
- `src/queue/detailQueue.ts` - BullMQ queue for detail page fetching

## Technical Details

### Discovery Method
- Two-phase scraping: fast scan (listing IDs) + detail fetch
- Search URLs: `https://ingatlannet.hu/elado-lakas-{location}`
- HTML parsing with Cheerio for initial data
- JSON-LD extraction from page structured data (more reliable than HTML parsing)
- CycleTLS used for all HTTP requests to bypass anti-bot

### Regions Covered
- **Priority**: Szeged (largest city in southeast region)
- **Major Cities (9)**: Budapest, Debrecen, Miskolc, Pécs, Győr, Nyíregyháza, Kecskemét, Székesfehérvár, Szombathely
- **Regional Capitals (14)**: Eger, Veszprém, Tatabánya, Sopron, Kaposvár, Zalaegerszeg, Szolnok, Érd, Dunaújváros, Hódmezővásárhely, Szekszárd, Salgótarján, Nagykanizsa, Békéscsaba
- **County Regions (10)**: All regions with Pest megye, Bács-Kiskun megye, etc.

### Extraction Methods
1. **JSON-LD (Preferred)**: Structured data embedded in page script tags
2. **HTML Parsing (Fallback)**: CSS selectors for listing cards if JSON-LD unavailable

### Transaction Types
- Primary: Sale (elado)
- Extensible to rental (kiado) via URL modification

## Configuration
```bash
# Port (default 8091)
PORT=8091

# Worker concurrency for detail fetching (default 50)
WORKER_CONCURRENCY=50

# Ingest API (shared config)
INGEST_API_URL=http://localhost:3004
INGEST_API_KEY_INGATLANNET_HU=dev_key_hu_1
```

## API Endpoints
- `GET /health` - Health check with queue stats and worker info
- `POST /scrape` - Start scraping (optional: `maxRegions`, `maxPages`)
  ```json
  {
    "maxRegions": 10,
    "maxPages": 5
  }
  ```

## Known Limitations
- Regional portal; listing density lower than national portals
- JSON-LD extraction highly dependent on page structure (requires maintenance)
- Detail page content may be limited compared to listing cards
- Images and descriptions not always available
- Agent/company information inconsistently provided

## Performance Notes
- Estimated 10-15 minutes for full Hungary scrape
- Queue-based architecture allows concurrent detail fetching
- 50 workers provide good throughput for detail pages
- CycleTLS adds overhead but handles anti-bot protection
- Checksum optimization critical for performance on repeated runs

## Notes
- Szeged priority designed for regional market analysis
- Regional portal makes consistent HTML structure less likely than national portals
- JSON-LD extraction more robust than HTML selectors for this portal
- Terminal statuses (sold/rented) protected from overwrite
