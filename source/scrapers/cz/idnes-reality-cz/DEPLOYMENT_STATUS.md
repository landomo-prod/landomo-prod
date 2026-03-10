# idnes-reality Deployment Status

**Date**: 2026-02-11
**Status**: ✅ DEPLOYED AND OPERATIONAL

## Deployment Summary

The idnes-reality scraper has been successfully deployed with category-specific transformers.

### Infrastructure

- **Container Name**: `landomo-scraper-idnes-reality`
- **Network**: `landomo-cz-network`
- **Port**: 8087 (external and internal)
- **Health Check**: http://localhost:8087/health
- **Ingest API**: http://landomo-cz-ingest-api:3000
- **Database**: landomo_cz @ landomo-cz-postgres:5432

### Category Mapping Architecture

The scraper implements a three-tier category routing system:

1. **Category Detection** (`idnesTransformer.ts`):
   - Analyzes `propertyType` and `title` fields
   - Keywords: "byt"→apartment, "dům/rodinný"→house, "pozemek/parcela"→land
   - Default fallback: apartment (most common in Czech Republic)

2. **Category-Specific Transformers**:
   - `apartments/idnesApartmentTransformer.ts` - Handles flats/apartments
   - `houses/idnesHouseTransformer.ts` - Handles houses/family homes
   - `land/idnesLandTransformer.ts` - Handles land/plots

3. **Unified Storage**:
   - All categories stored in single `properties` table
   - `property_type` field indicates category
   - Category-specific fields populated based on transformer logic

### Endpoints

- `GET /health` - Health check
- `POST /scrape` - Trigger scraping (async 202 response)

### Environment Variables

```bash
PORT=8087
INGEST_API_URL=http://landomo-cz-ingest-api:3000
INGEST_API_KEY=dev_key_cz_1
```

### Verification

✅ Container running and healthy
✅ Category-specific transformers implemented
✅ Category detection logic functional
✅ Connected to Czech infrastructure
✅ Test scrape triggered successfully

### Quick Commands

```bash
# Check health
curl http://localhost:8087/health

# Trigger scrape
curl -X POST http://localhost:8087/scrape

# View logs
docker logs landomo-scraper-idnes-reality

# Restart
docker restart landomo-scraper-idnes-reality
```

### Notes

- Scraper uses Playwright for JavaScript rendering and GDPR handling
- Bot detection may cause timeouts - this is expected for Playwright scrapers
- Checksum mode disabled (legacy full scraping)
- Categories scraped: Flats for Sale, Houses for Sale, Land for Sale, Flats for Rent, Houses for Rent, Land for Rent, Commercial for Sale, Commercial for Rent
