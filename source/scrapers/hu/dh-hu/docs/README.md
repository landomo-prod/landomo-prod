# Duna House (dh.hu) Scraper

## Overview
- **Portal**: Duna House
- **URL**: https://dh.hu
- **Country**: Hungary
- **Categories**: Apartment, House, Land, Commercial
- **Data Source**: API
- **Anti-bot**: CycleTLS (browser TLS fingerprinting)

## Quick Stats
- **Active Listings**: ~10,000-15,000 (estimated)
- **Scrape Frequency**: Configurable via maxRegions/maxPages
- **Technology**: TypeScript/Express with BullMQ queue-based detail fetching
- **Concurrency**: 30 workers (configurable)

## Data Flow
Portal → Fast Scan (API discovery) → Phase 1 Checksum Comparison → Phase 2 Detail Fetch → Transformation → Ingestion API

## Key Features
- **Two-Phase Architecture**:
  - Phase 1: Fast listing discovery across 41 regions via API endpoint
  - Phase 2: Queue-based detail fetching with configurable worker concurrency
- **Checksum-Optimized**: Compares listing checksums to skip unchanged properties (80-90% savings on stable periods)
- **CycleTLS Protection Bypass**: Uses browser TLS fingerprinting to bypass Cloudflare anti-bot
- **Regional Coverage**: All 19 Hungarian counties + 22 major cities and regional capitals

## Key Files
- `src/index.ts` - Express server and main orchestrator
- `src/scrapers/listingsScraper.ts` - API discovery and listing extraction
- `src/transformers/dhTransformer.ts` - Portal format to TierI conversion
- `src/adapters/ingestAdapter.ts` - Ingest API communication
- `src/queue/detailQueue.ts` - BullMQ queue for detail fetching (auto-generated from orchestrator)

## Technical Details

### Discovery Method
- Uses DH.hu's hidden API endpoint: `https://newdhapi01.dh.hu/api/getProperties`
- Multipart form-data request with URL path parameter
- Returns 16 items per page (pagination-based)
- Processes regions in parallel batches of 5 (1-2 second delays between batches)

### Regions Covered
- **Priority Cities (10)**: Budapest, Debrecen, Szeged, Miskolc, Pécs, Győr, Nyíregyháza, Kecskemét, Székesfehérvár, Szombathely
- **Regional Capitals (14)**: Eger, Veszprém, Tatabánya, Sopron, Kaposvár, Zalaegerszeg, Szolnok, Érd, Dunaújváros, Hódmezővásárhely, Szekszárd, Salgótarján, Nagykanizsa, Békéscsaba
- **County Regions (17)**: All 19 counties represented

### Transaction Types
- `elado` (Sale)
- `kiado` (Rental)

### Property Types
- Lakás (Apartment)
- Ház (House)
- Telek (Land)
- Garázs (Garage)
- Iroda (Office/Commercial)
- Üzlet (Shop/Commercial)

## Configuration
```bash
# Port (default 8089)
PORT=8089

# Worker concurrency for detail fetching (default 30)
WORKER_CONCURRENCY=30

# Ingest API (shared config)
INGEST_API_URL=http://localhost:3004
INGEST_API_KEY_DH_HU=dev_key_hu_1
```

## API Endpoints
- `GET /health` - Health check with queue stats
- `POST /scrape` - Start scraping (optional: `maxRegions`, `maxPages`)
  ```json
  {
    "maxRegions": 10,
    "maxPages": 5
  }
  ```

## Known Limitations
- Listing detail data (description, images, amenities) are extracted from the API response
- Agent/seller information limited to name and company
- Detailed condition/heating info not always available from API

## Performance Notes
- Estimated 10-15 minutes for full Hungary scrape (all 41 regions)
- Queue-based architecture allows concurrent detail fetching while scanning continues
- Checksum deduplication significantly reduces API calls on repeated runs

## Notes
- DH.hu API uses a hidden endpoint; structure may change without notice
- Portal enforces rate limiting; parallel batch approach helps manage requests
- CycleTLS provides reliable anti-bot bypass for Cloudflare protection
- Terminal statuses (sold/rented) are protected and never overwritten
