# Realingo Scraper

## Overview
- **Portal**: realingo
- **URL**: https://www.realingo.cz
- **Country**: Czech Republic
- **Categories**: apartment, house, land, commercial, other
- **Data Source**: GraphQL API
- **Anti-bot**: None (public GraphQL endpoint)

## Quick Stats
- **Scrape Frequency**: Triggered by centralized scheduler
- **Port**: 8102
- **Modes**: Streaming (default), Checksum-based change detection

## Technology Stack
- **Language**: TypeScript
- **HTTP Client**: Axios
- **Framework**: Express
- **Category Detection**: `property` field from API (FLAT/HOUSE/LAND/COMMERCIAL/OTHERS) + `category` field parsing
- **Checksum**: price, category, url, area.floor, purpose

## Data Flow
```
Realingo GraphQL API
    |
    v
ListingsScraper (paginated queries, 100/page)
    |
    v
realingoTransformer (routes by property type)
    |
    +--> realingoApartmentTransformer
    +--> realingoHouseTransformer
    +--> realingoLandTransformer
    +--> realingoCommercialTransformer
    +--> realingoOthersTransformer
    |
    v
IngestAdapter --> POST /api/v1/properties/bulk-ingest
```

## Quick Start

### Run Locally
```bash
cd "scrapers/Czech Republic/realingo"
npm install
npm run dev
```

### Trigger Scrape
```bash
curl -X POST http://localhost:8102/scrape
```

### Health Check
```bash
curl http://localhost:8102/health
```

## Key Files
- `src/index.ts` - Express server, scrape orchestration
- `src/scrapers/listingsScraper.ts` - GraphQL API client with pagination
- `src/transformers/realingoTransformer.ts` - Category router
- `src/transformers/apartments/realingoApartmentTransformer.ts` - Apartment transformer
- `src/transformers/houses/realingoHouseTransformer.ts` - House transformer
- `src/transformers/land/realingoLandTransformer.ts` - Land transformer
- `src/transformers/commercial/realingoCommercialTransformer.ts` - Commercial transformer
- `src/transformers/others/realingoOthersTransformer.ts` - Other transformer
- `src/utils/categoryParser.ts` - Disposition parsing from category field
- `src/utils/checksumExtractor.ts` - Checksum fields for change detection
- `src/types/realingoTypes.ts` - TypeScript interfaces for API responses
- `src/adapters/ingestAdapter.ts` - Ingest API client

## Notes
- Realingo exposes a public GraphQL API at `https://www.realingo.cz/graphql` -- no authentication required
- The API does not provide detail-level fields (description, features, condition, heating, etc.) -- only listing-level data from `searchOffer`
- Two scrape modes: **streaming** (sends batches as scraped) and **checksum** (compares hashes to skip unchanged listings, enabled via `ENABLE_CHECKSUM_MODE=true`)
- Sales and rentals are scraped separately with `purpose: SELL` and `purpose: RENT`
- Images use the pattern `https://www.realingo.cz/image/{photoId}`
- 500ms delay between pagination requests to respect the API
