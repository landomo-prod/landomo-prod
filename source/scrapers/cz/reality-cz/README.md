# Reality.cz Scraper

API-based scraper for **Reality.cz**, a Czech real estate portal.

## Overview

- **Portal**: Reality.cz
- **Technology**: REST API (reverse-engineered mobile API v3.1.4)
- **Port**: 8086
- **Estimated Volume**: ~6,500 listings across all categories

## Features

- Scrapes both **sales** (`prodej`) and **rentals** (`pronajem`)
- Property types: apartments (byty), houses (domy), land (pozemky), commercial (komercni)
- **GPS coordinates** extracted for all listings
- Full detail pages with structured information (disposition, area, ownership, condition, etc.)
- Contact info (broker, real estate agency)
- Photo URLs for all listings
- Checksum-based change detection (95-99% fewer ingestions on repeat scrapes)
- Rate limiting (500ms between requests)
- Session-based authentication with auto-renewal

## Configuration

```bash
PORT=8086
INGEST_API_URL=http://ingest-czech:3000
INGEST_API_KEY=dev_key_czech_reality
ENABLE_CHECKSUM_MODE=true
```

## Usage

### Development
```bash
npm run dev
```

### Production
```bash
npm run build
npm start
```

### Docker
```bash
docker build -t landomo/scraper-reality .
docker run -p 8086:8086 --env-file .env landomo/scraper-reality
```

## API Endpoints

### Health Check
```
GET /health
```

### Trigger Scrape
```
POST /scrape
```

## Architecture

```
src/
├── index.ts                    # Express server & orchestration
├── adapters/
│   └── ingestAdapter.ts        # Send data to ingest API
├── scrapers/
│   └── realityApiScraper.ts    # API-based scraper (search + detail)
├── transformers/
│   └── realityTransformer.ts   # RealityListing -> category-specific types
├── types/
│   └── realityTypes.ts         # API response & internal types
└── utils/
    ├── realityAuth.ts          # Session-based API authentication
    └── checksumExtractor.ts    # Checksum generation for change detection
```

## Data Flow

1. **Authenticate**: Obtain session cookie from Reality.cz API
2. **Search**: Paginate through search results (100 per page) to discover listing IDs
3. **Detail**: Fetch full detail for each listing (GPS, info, photos, contact)
4. **Transform**: Convert to category-specific types (apartment, house, land, commercial)
5. **Checksum**: Compare against previous scrape to identify new/changed listings
6. **Ingest**: Batch send to ingest API (100 per request)

## License

MIT License - Part of Landomo World platform
