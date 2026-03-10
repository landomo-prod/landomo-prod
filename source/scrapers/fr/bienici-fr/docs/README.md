# Bienici Scraper

## Overview
- **Portal**: Bienici.com
- **URL**: https://www.bienici.com
- **Country**: France
- **Categories**: Apartment, House, Land, Commercial
- **Data Source**: REST API (JSON)
- **Anti-bot**: None (Direct API access)

## Quick Stats
- **Active Listings**: ~500,000+ (estimated)
- **Scrape Frequency**: Configurable via scheduler
- **Technology**: TypeScript/Express with BullMQ queuing
- **Default Port**: 8230

## Data Flow
1. **Price Band Discovery** - Divides listings into 18 price bands (12 buy, 6 rent)
2. **Three-Phase Scrape**:
   - Phase 1: Fetch all listing IDs in each price band
   - Phase 2: Compare checksums against stored values (enables 40-80% skip rate on stable periods)
   - Phase 3: Queue detail fetches for new/changed listings only
3. **Detail Extraction** - Workers (default 40 concurrent) fetch and transform individual property details
4. **Transformation** - Raw API responses mapped to category-specific TierI types
5. **Ingestion** - Batch POST to ingest API with transformed data

## Key Files
- `src/index.ts` - Express server, health endpoint, scrape orchestration
- `src/scrapers/listingsScraper.ts` - Price band config, listing enumeration
- `src/transformers/` - Category transformers (apartment, house, land, commercial)
- `src/adapters/ingestAdapter.ts` - Bulk ingest API client
- `src/queue/detailQueue.ts` - BullMQ worker pool for detail fetches
- `src/scraper/threePhaseOrchestrator.ts` - Phase 1/2/3 orchestration
- `src/types/bieniciTypes.ts` - TypeScript interfaces for raw data

## Architecture Highlights

### Price Band Strategy
Bienici requires searches to be filtered by price bands to avoid massive result sets. The scraper uses:
- **Buy bands**: 0-50k, 50-100k, 100-150k, ..., 2M+
- **Rent bands**: 0-500, 500-800, 800-1200, ..., 4000+

Each band is fetched independently, then deduplicated by portal ID.

### Checksum-Based Deduplication
- Checksums computed from raw listing data and cached in `listing_checksums` table
- Phase 2 compares incoming checksums; only new/changed listings queued for detail fetch
- On stable periods, can skip 80% of API calls

### Worker Concurrency
Default: 40 concurrent detail workers (configurable via `WORKER_CONCURRENCY` env var)
- Each worker processes one detail fetch at a time
- Queue size auto-adjusts; workers poll every 2 seconds

### Graceful Shutdown
Both `SIGTERM` and `SIGINT` drain the queue before exit, preventing data loss.

## Transformer Details

### Apartment
- Required fields: `bedrooms` (derived from rooms or explicit), `sqm`, `has_elevator`, `has_balcony`, `has_parking`, `has_basement`
- Optional: bathrooms, floor, total_floors, condition (new/excellent/good), heating_type, furnished, year_built
- French-specific: `dpe_rating`, `dpe_value` (energy), `ges_rating`, `ges_value` (emissions)

### House
- Required: bedrooms, sqm_living, sqm_plot, has_garden, has_garage, has_parking, has_basement
- Optional: floor (for multi-story houses), renovation_year

### Land
- Required: area_plot_sqm

### Commercial
- Required: sqm_total, has_elevator, has_parking, has_bathrooms

## Environment Variables
```
PORT=8230                           # Server port
INSTANCE_COUNTRY=fr                 # Country code for ingest API
INGEST_API_URL=http://localhost:3000 # Ingest API endpoint
INGEST_API_KEY=dev_key_fr_1         # Auth token
WORKER_CONCURRENCY=40               # Detail fetch workers
```

## Common Issues

### High API Rate Limiting
- **Symptom**: 403/429 responses on price band fetches
- **Fix**: Reduce WORKER_CONCURRENCY or add delays between price band fetches
- **Note**: Bienici has per-IP limits; consider rotating through proxy IPs if large-scale

### Missing Energy Data
- **Symptom**: DPE/GES fields null
- **Cause**: Not all properties have energy certs (especially older/rental)
- **Fix**: Fields are optional; check country_specific.dpe_rating before using

### Checksum Mismatches
- **Symptom**: Phase 2 reports all listings as "new" even on re-runs
- **Cause**: API returning different JSON structure or fields not deterministic
- **Debug**: Compare raw payloads from two consecutive runs

## Testing
```bash
# Build
npm run build

# Run locally
PORT=8230 INGEST_API_URL=http://localhost:3000 npm start

# Trigger scrape
curl -X POST http://localhost:8230/scrape

# Check health
curl http://localhost:8230/health
```

## Performance Notes
- Typical full scrape: 40-60 minutes (500k listings)
- Memory: ~2GB (configurable via `--max-old-space-size=4096`)
- Checksum mode saves ~50-80% API calls on incremental runs
- Bottleneck: Detail fetch worker pool (CPU-bound on transformation)

## Monitoring
The scraper exposes Prometheus metrics via `/metrics` endpoint:
- `scrape_runs{portal,status}` - Run count (success/failure)
- `scrapeDuration{portal,category}` - Duration histogram
- `propertiesScraped{portal,category,result}` - Property counter
- `scrapeRunActive{portal}` - Boolean gauge (1=running, 0=idle)

## Notes
- Listings are never deleted; old listings marked `removed` then reactivated if re-listed
- Terminal statuses (sold/rented) are protected from overwrite
- Data includes agency contact info (name, phone) from `agency` field
- Images extracted from `photos` array (URL deduplication applied)
