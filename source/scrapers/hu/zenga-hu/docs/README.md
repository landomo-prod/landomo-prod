# Zenga.hu Scraper

## Overview
- **Portal**: Zenga.hu
- **URL**: https://zenga.hu
- **Country**: Hungary
- **Categories**: Apartment, House, Land, Commercial
- **Data Source**: REST API (JSON responses)
- **Anti-bot**: CycleTLS (browser TLS fingerprinting)

## Quick Stats
- **Active Listings**: ~20,000-30,000 (estimated)
- **Scrape Frequency**: Configurable via maxRegions/maxPagesPerRegion
- **Technology**: TypeScript/Express with REST API calls + CycleTLS
- **API Endpoint**: `POST https://www.zenga.hu/api/rels/v1/adverts/search`
- **Concurrency**: 30 workers for detail fetching (configurable)

## Data Flow
Portal → REST API Calls (CycleTLS) → Phase 1 Checksum Comparison → Phase 2 Detail Fetch → Transformation → Ingestion API

## Key Features
- **Modern REST API**: Direct JSON responses from Angular-backed portal
- **CycleTLS Protection Bypass**: Browser TLS fingerprinting for anti-bot
- **Queue-Based Detail Processing**: BullMQ workers handle additional data fetching
- **Checksum Optimization**: Compares checksums to skip unchanged listings (80-90% savings)
- **Comprehensive Regional Coverage**: All 19 Hungarian counties + 24 major cities

## Key Files
- `src/index.ts` - Express server and main orchestrator
- `src/scrapers/listingsScraper.ts` - REST API calls and response parsing
- `src/transformers/zengaTransformer.ts` - Portal format to StandardProperty conversion
- `src/adapters/ingestAdapter.ts` - Ingest API communication
- `src/queue/detailQueue.ts` - BullMQ queue for detail fetching

## Technical Details

### Discovery Method
- **REST API Endpoint**: `POST https://www.zenga.hu/api/rels/v1/adverts/search`
- **Payload Structure**:
  ```json
  {
    "pageSize": 20,
    "page": 1,
    "agency": null,
    "textSearch": "elado+lakas+budapest",
    "searchObject": {}
  }
  ```
- **Response Format**: JSON with result.items containing property objects
- **Pagination**: Page-based, 20 items per page
- **CycleTLS**: All API requests use browser TLS fingerprinting

### Regions Covered
- **Priority Cities (10)**: Budapest, Debrecen, Szeged, Miskolc, Pécs, Győr, Nyíregyháza, Kecskemét, Székesfehérvár, Szombathely
- **Regional Capitals (14)**: Eger, Veszprém, Tatabánya, Sopron, Kaposvár, Zalaegerszeg, Szolnok, Érd, Dunaújváros, Hódmezővásárhely, Szekszárd, Salgótarján, Nagykanizsa, Békéscsaba
- **County Regions (10)**: All 19 counties with Pest megye, Bács-Kiskun megye, etc.

### Transaction Types
- `elado` (Sale)
- Extensible to `kiado` (Rental) via parameter modification

### API Response Structure
Zenga API returns detailed property objects:
- Basic info: ID, title, price, location
- Details: area, rooms, floor, year built
- Amenities: parking, elevator, balcony, etc.
- Images: array of image URLs
- Agent: contact information
- Metadata: view count, premier status, etc.

## Configuration
```bash
# Port (default 8090)
PORT=8090

# Worker concurrency for detail fetching (default 30)
WORKER_CONCURRENCY=30

# Ingest API (shared config)
INGEST_API_URL=http://localhost:3004
INGEST_API_KEY_ZENGA_HU=dev_key_hu_1
```

## API Endpoints
- `GET /health` - Health check with queue stats and worker info
- `POST /scrape` - Start scraping (all regions, no parameters)
  ```json
  {}
  ```

## Known Limitations
- Regional searches encoded in textSearch parameter; no separate region filtering
- API responses don't always include all amenity fields
- Some listings missing images or agent information
- Detail page structure may vary between property types
- Pricing per sqm sometimes not provided in response

## Performance Notes
- Estimated 20-30 minutes for full Hungary scrape (all regions, multiple pages)
- REST API responses are fast compared to HTML scraping
- CycleTLS adds minimal overhead with good reliability
- 30 worker concurrency provides good throughput
- Checksum optimization critical for performance on repeated runs
- Parallel region processing (sequential with 1-2s delays per region)

## Notes
- Zenga.hu is a modern, AI-enhanced portal with clean API interface
- REST API provides more complete data than HTML scraping or DataLayer extraction
- Portal responsive to API rate limiting; delays between regions help manage requests
- Terminal statuses (sold/rented) protected from overwrite
- Zenga API changes less frequently than HTML-based portals, making maintenance easier
