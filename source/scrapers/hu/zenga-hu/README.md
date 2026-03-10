# Zenga.hu Scraper

AI-enhanced Hungarian real estate portal scraper for the Landomo World platform.

## Overview

- **Portal**: zenga.hu
- **Country**: Hungary
- **Market Share**: 10-15%
- **Technology**: AI-enhanced platform with Angular frontend
- **Port**: 8090

## Features

- Scrapes property listings from major Hungarian cities
- Extracts structured data from JSON-LD schema
- Handles both listing pages and detail pages
- Supports Zenga Premier listings
- Transforms to standardized Hungarian property format
- Sends data to Hungary ingest service (port 3009)

## Architecture

```
src/
├── index.ts                      # Express server (port 8090)
├── scrapers/
│   └── listingsScraper.ts       # Web scraping logic
├── transformers/
│   └── zengaTransformer.ts      # Transform to StandardProperty
├── adapters/
│   └── ingestAdapter.ts         # Send to ingest API (port 3009)
├── types/
│   └── zengaTypes.ts            # TypeScript interfaces
├── utils/
│   └── userAgents.ts            # Random user agent rotation
└── shared/
    └── hungarian-value-mappings.ts  # Canonical Hungarian mappings

```

## Development

### Install Dependencies
```bash
npm install
```

### Run in Development Mode
```bash
npm run dev
```

### Build
```bash
npm run build
```

### Run Production
```bash
npm start
```

## API Endpoints

### Health Check
```bash
GET http://localhost:8090/health
```

Response:
```json
{
  "status": "healthy",
  "scraper": "zenga-hu",
  "version": "1.0.0",
  "country": "Hungary",
  "platform": "zenga.hu",
  "timestamp": "2024-01-15T12:00:00.000Z"
}
```

### Trigger Scrape
```bash
POST http://localhost:8090/scrape
Content-Type: application/json

{
  "maxRegions": 3,
  "maxPages": 2
}
```

Configuration options:
- `maxRegions`: Limit number of regions to scrape (default: all 10)
- `maxPages`: Pages per region (default: 5)

## Regions

Default regions scraped (in order):
1. Budapest
2. Debrecen
3. Szeged
4. Miskolc
5. Pécs
6. Győr
7. Nyíregyháza
8. Kecskemét
9. Székesfehérvár
10. Szombathely

## Docker

### Build Image
```bash
docker build -t landomo/scraper-zenga-hu .
```

### Run Container
```bash
docker run -p 8090:8090 \
  -e INGEST_API_URL=http://ingest-hungary:3009 \
  landomo/scraper-zenga-hu
```

## Data Flow

1. **Scrape**: Fetch listings from zenga.hu search pages
2. **Extract**: Parse HTML and JSON-LD structured data
3. **Transform**: Convert to StandardProperty format
4. **Normalize**: Apply Hungarian value mappings
5. **Send**: Batch upload to ingest-hungary service (port 3009)

## Zenga.hu Specifics

### URL Format
```
https://zenga.hu/[location]+[transaction]+[type]
https://zenga.hu/budapest+elado+lakas?page=2
```

### JSON-LD Schema
Zenga.hu embeds RealEstateListing structured data:
```json
{
  "@type": "RealEstateListing",
  "gtin": "8879096",
  "name": "Property title",
  "offers": {
    "price": 45000000,
    "priceCurrency": "HUF"
  },
  "floorSize": {"value": 85},
  "numberOfRooms": 3
}
```

### Zenga Premier
Premium listings are identified by:
- `[class*="premier"]` CSS selector
- "Zenga Premier" text in listing
- Tracked in `isPremier` field

## Environment Variables

- `PORT`: Server port (default: 8090)
- `INGEST_API_URL`: Hungary ingest service URL (default: http://localhost:3009)
- `INGEST_API_KEY_ZENGA_HU`: API key for authentication (default: dev_key_hu_2)

## Integration

This scraper integrates with:
- **ingest-hungary** (port 3009): Receives transformed properties
- **shared-components**: Uses StandardProperty types
- **hungarian-value-mappings**: Canonical Hungarian field mappings

## Notes

- Respects rate limits with 2-4 second delays between pages
- Uses rotating user agents to avoid detection
- Handles both HTML parsing and JSON-LD extraction
- Angular-based site requires careful selector handling
- Premier listings may have enhanced metadata
