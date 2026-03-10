# Nehnuteľnosti.sk Scraper

Scraper for **Nehnuteľnosti.sk**, Slovakia's largest real estate portal (~55% market share).

## Overview

This scraper fetches property listings from Nehnuteľnosti.sk and transforms them into the Landomo standardized format.

## Features

- ✅ Multi-category scraping (apartments, houses, land)
- ✅ Both sale and rent listings
- ✅ Detail page enrichment
- ✅ Slovak-specific field mappings (disposition, ownership, etc.)
- ✅ Automatic transformation to StandardProperty format
- ✅ Integration with Landomo Ingest Service
- ✅ Rate limiting and retry logic
- ✅ User agent rotation

## Installation

```bash
npm install
```

## Development

```bash
npm run dev
```

## Build

```bash
npm run build
npm start
```

## Environment Variables

```bash
PORT=8082                                    # Server port
INGEST_API_URL=http://localhost:3008       # Ingest service URL (Slovakia instance)
INGEST_API_KEY_NEHNUTELNOSTI_SK=your_key   # API key for authentication
```

## API Endpoints

### Health Check
```
GET /health
```

### Trigger Scraping
```
POST /scrape
```

## Categories Scraped

1. **Byty (Apartments)**
   - Predaj (Sale)
   - Prenájom (Rent)

2. **Domy (Houses)**
   - Predaj (Sale)
   - Prenájom (Rent)

3. **Pozemky (Land)**
   - Predaj (Sale)

## Slovak-Specific Fields

The scraper maps Slovak-specific fields to standardized values:

- **Disposition**: `1-izbový`, `2-izbový`, `3-izbový`, etc. or `garsónka` (studio)
- **Ownership**: `osobné`, `družstevné`, `štátne`, `iné`
- **Condition**: `novostavba`, `výborný`, `dobrý`, `po_rekonštrukcii`, etc.
- **Furnished**: `zariadený`, `čiastočne_zariadený`, `nezariadený`
- **Energy Rating**: `a`, `b`, `c`, `d`, `e`, `f`, `g`
- **Heating**: `ústredné`, `lokálne`, `elektrické`, `plynové`, etc.
- **Construction**: `panel`, `tehla`, `murovaný`, `drevo`, `betón`, etc.

## Architecture

```
┌─────────────────────┐
│  Nehnutelnosti.sk   │
│       API           │
└──────────┬──────────┘
           │
           ↓
┌─────────────────────┐
│  ListingsScraper    │
│  - Fetch listings   │
│  - Enrich details   │
└──────────┬──────────┘
           │
           ↓
┌─────────────────────┐
│    Transformer      │
│  - Map Slovak fields│
│  - StandardProperty │
└──────────┬──────────┘
           │
           ↓
┌─────────────────────┐
│   IngestAdapter     │
│  - Send to API      │
│  - Batch processing │
└──────────┬──────────┘
           │
           ↓
┌─────────────────────┐
│   Ingest Service    │
│   (Slovakia:3008)   │
└─────────────────────┘
```

## Notes

- The scraper follows the same pattern as Czech Republic scrapers
- API URLs may need adjustment based on actual Nehnuteľnosti.sk API structure
- Detail page fetching can be disabled if API rate limits are hit
- Respects rate limiting with delays between requests
- Implements exponential backoff for retries

## License

Proprietary - Landomo
