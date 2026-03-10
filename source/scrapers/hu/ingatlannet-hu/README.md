# Ingatlannet.hu Scraper

Regional Hungarian real estate portal scraper with focus on the Szeged region.

## Overview

**Portal**: Ingatlannet.hu
**Market Share**: 5-10%
**Geographic Focus**: Szeged and surrounding regions
**Country**: Hungary
**Port**: 8091

## Features

- JSON-LD structured data extraction (primary method)
- HTML fallback parsing for robustness
- Support for major Hungarian cities with Szeged priority
- Hungarian-specific property attributes (disposition, ownership, heating types)
- Automatic price formatting (handles "M Ft" million format)
- Batch processing with rate limiting
- Comprehensive error handling

## Architecture

```
src/
├── index.ts                    # Express server and main orchestration
├── scrapers/
│   └── listingsScraper.ts     # Web scraping logic with JSON-LD extraction
├── transformers/
│   └── ingatlannetTransformer.ts  # Transform to StandardProperty format
├── adapters/
│   └── ingestAdapter.ts       # Send to ingest-hungary API
├── types/
│   └── ingatlannetTypes.ts    # Portal-specific TypeScript types
├── utils/
│   └── userAgents.ts          # User agent rotation
└── shared/
    └── hungarian-value-mappings.ts  # Standardized Hungarian mappings
```

## Data Extraction

### Primary Method: JSON-LD
Ingatlannet.hu embeds property data in Schema.org ItemList format:
- More reliable than HTML selectors
- Includes complete property metadata
- Structured format with all details

### Fallback Method: HTML Parsing
If JSON-LD extraction fails, falls back to HTML scraping with Cheerio.

## Property Types Supported

- **Lakás** (Apartments)
- **Ház** (Houses)
- **Telek** (Land)
- **Garázs** (Garages)
- **Iroda** (Offices)

## Hungarian-Specific Fields

- **Disposition**: 1-szobás, 2-szobás, garzonlakás, etc.
- **Ownership**: tulajdon, társasházi, szövetkezeti
- **Heating**: központi, gázfűtés, távfűtés, elektromos
- **Construction**: panel, tégla, vasbeton
- **Condition Rating**: 1-10 scale

## Usage

### Development
```bash
npm install
npm run dev
```

### Production
```bash
npm run build
npm start
```

### Docker
```bash
docker build -t landomo-scraper-ingatlannet-hu .
docker run -p 8091:8091 \
  -e INGEST_API_URL=http://ingest-hungary:3000 \
  -e INGEST_API_KEY_INGATLANNET_HU=dev_key_hu_1 \
  landomo-scraper-ingatlannet-hu
```

## API Endpoints

### Health Check
```bash
GET /health
```

### Trigger Scrape
```bash
POST /scrape
Content-Type: application/json

{
  "maxRegions": 3,    # Optional: limit number of regions
  "maxPages": 5       # Optional: pages per region (default: 5)
}
```

## Environment Variables

- `PORT`: Server port (default: 8091)
- `INGEST_API_URL`: Ingest service URL (default: http://localhost:3009)
- `INGEST_API_KEY_INGATLANNET_HU`: API key for authentication

## Regions Scraped

Priority order (Szeged first):
1. Szeged
2. Budapest
3. Debrecen
4. Miskolc
5. Pécs
6. Győr

## Rate Limiting

- 2-4 seconds between pages
- 2-3 seconds between regions
- 500ms between batch sends
- Batch size: 100 properties

## Error Handling

- Graceful degradation from JSON-LD to HTML parsing
- Per-listing error isolation
- Batch-level retry logic
- Comprehensive logging

## Data Flow

1. Fetch HTML from Ingatlannet.hu search pages
2. Extract JSON-LD structured data (or parse HTML)
3. Transform to IngatlannetListing format
4. Map to StandardProperty using hungarian-value-mappings
5. Send to ingest-hungary API in batches
6. Store in landomo_hungary database

## Integration

Works with:
- **ingest-hungary** service (port 3009)
- **landomo_hungary** PostgreSQL database
- **Hungarian value mappings** (shared across all Hungarian scrapers)

## Notes

- Ingatlannet.hu is a regional portal with strong presence in Szeged
- 5-10% market share nationally
- Complements ingatlan.com (national leader) for regional coverage
- Uses same Hungarian standardization as other Hungarian scrapers
- JSON-LD extraction provides high reliability

## Maintenance

- Monitor for schema.org structure changes
- Update selectors if HTML fallback fails
- Verify Hungarian mapping consistency
- Test with production data regularly
