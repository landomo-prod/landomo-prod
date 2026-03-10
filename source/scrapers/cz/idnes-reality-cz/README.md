# Reality.idnes.cz Scraper

**Lightweight fetch-based scraper** for Reality.idnes.cz, one of the Czech Republic's major real estate portals.

## Overview

This scraper uses **fetch + Cheerio** for fast, lightweight HTML scraping:
- Static HTML parsing (no browser needed)
- Multi-category scraping (flats, houses, sales, rentals)
- Pagination support
- Low resource footprint

## Architecture

```
┌─────────────────┐
│   Scheduler     │
│   (Triggers)    │
└────────┬────────┘
         │ POST /scrape
         ▼
┌─────────────────────────────────┐
│  Reality.idnes.cz Scraper       │
│  (Port 8087)                    │
│                                 │
│  ┌───────────────────────┐     │
│  │ Fetch + Cheerio       │     │
│  │ - HTTP requests       │     │
│  │ - Parse HTML          │     │
│  │ - Extract listings    │     │
│  └───────────────────────┘     │
│           │                     │
│           ▼                     │
│  ┌───────────────────────┐     │
│  │ Transformer           │     │
│  │ Idnes → Standard      │     │
│  └───────────────────────┘     │
│           │                     │
│           ▼                     │
│  ┌───────────────────────┐     │
│  │ Ingest Adapter        │     │
│  │ Batch upload (100)    │     │
│  └───────────────────────┘     │
└─────────────────────────────────┘
         │
         ▼
┌─────────────────┐
│  Ingest API     │
│  (Port 3004)    │
└─────────────────┘
```

## Features

- **Static HTML scraping** with fetch + Cheerio
- **Multi-category scraping** (flats, houses, sales, rentals)
- **Pagination support** (automatically navigates through pages)
- **Rate limiting** to avoid overwhelming the portal
- **Batch ingestion** (100 properties per batch)
- **Error resilience** (continues on individual failures)
- **Health checks** for monitoring

## Installation

### 1. Install Dependencies

```bash
cd "/Users/samuelseidel/Development/landomo-world/scrapers/Czech Republic/idnes-reality"
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env`:

```bash
# Ingest API Configuration
INGEST_API_URL=http://localhost:3004
INGEST_API_KEY_IDNES_REALITY=dev_key_czech_1

# Scraper Configuration
PORT=8087

# Rate Limiting
RATE_LIMIT_DELAY=1000  # Delay between page loads (ms)
MAX_RETRIES=3          # Retry failed requests
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
docker build -t landomo-scraper-idnes-reality .
docker run -p 8087:8087 --env-file .env landomo-scraper-idnes-reality
```

## API Endpoints

### Health Check

```bash
GET http://localhost:8087/health
```

**Response:**
```json
{
  "status": "healthy",
  "scraper": "idnes-reality",
  "version": "1.0.0",
  "timestamp": "2026-02-06T12:00:00.000Z",
  "features": ["fetch", "cheerio", "lightweight"]
}
```

### Trigger Scrape

```bash
POST http://localhost:8087/scrape
```

**Response:**
```json
{
  "status": "scraping started",
  "timestamp": "2026-02-06T12:00:00.000Z"
}
```

## Scraping Process

### 1. Category Scraping
Scrapes these categories:
- Flats for Sale (`/s/prodej/byty/`)
- Flats for Rent (`/s/pronajem/byty/`)
- Houses for Sale (`/s/prodej/domy/`)
- Houses for Rent (`/s/pronajem/domy/`)

### 2. Pagination
- Fetches HTML and parses with Cheerio
- Extracts listings from current page
- Looks for "next page" link
- Navigates to next page
- Repeats until no more pages (max 5 per category)

### 3. Data Extraction
From each listing card:
- Title
- URL
- Price
- Location
- Area (m²)
- Images
- Property type
- Transaction type

### 4. Transformation
Converts Idnes format to StandardProperty:
- Maps property types (byt → APARTMENT, dům → HOUSE)
- Maps transaction types (prodej → SALE, pronájem → RENT)
- Parses Czech room notation (3+kk, 2+1)
- Extracts city from location string

### 5. Batch Upload
- Groups properties into batches of 100
- Sends to Ingest API
- Continues even if batch fails

## Debugging

### Logs

The scraper provides detailed console output:
- ✅ Success messages
- ⚠️ Warnings
- ❌ Errors
- 📊 Statistics

Example:
```
🚀 Starting Reality.idnes.cz scrape...
   Using fetch + Cheerio

📄 Scraping category: Flats for Sale
   URL: https://reality.idnes.cz/s/prodej/byty/
   ✓ Page 1: Found 25 listings
   ✓ Page 2: Found 25 listings
   ...

✅ Category complete: Flats for Sale - 125 listings
```

## Performance

### Timing
- **Page fetch + parse**: ~200-500ms per page
- **Listing extraction**: ~10ms per page
- **Full scrape**: ~30-60 seconds (depends on listings count)

### Resources
- **Memory**: ~50 MB
- **CPU**: Low
- **Network**: ~100-500 KB per page

## Troubleshooting

### Timeout Errors

Increase timeout or retry count in `.env`:
```bash
MAX_RETRIES=5
```

### No Listings Found

- Check if website structure changed
- Update CSS selectors in `listingsScraper.ts`
- Inspect page HTML to verify selectors

### Docker Build Fails

```bash
docker build --no-cache -t landomo-scraper-idnes-reality .
```

## Data Quality

### Coverage
- Flats for sale: ~80-90%
- Flats for rent: ~80-90%
- Houses for sale: ~70-80%
- Houses for rent: ~70-80%

### Limitations
- Only first 5 pages per category (configurable)
- Detailed listing information requires additional requests
- Some listings may have incomplete data
- Sponsored/featured listings may have different HTML structure

## Integration

This scraper integrates with:
- **Ingest API** (Port 3004): Receives scraped properties
- **Scheduler**: Triggers scrapes at intervals
- **Monitoring**: Health check endpoint for uptime tracking

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8087` | HTTP server port |
| `INGEST_API_URL` | `http://localhost:3004` | Ingest API endpoint |
| `INGEST_API_KEY_IDNES_REALITY` | `dev_key_czech_1` | API authentication key |
| `MAX_RETRIES` | `3` | Retry attempts for failed requests |
| `RATE_LIMIT_DELAY` | `1000` | Delay between pages (ms) |

## Future Improvements

- [ ] Scrape detailed listing pages for complete data
- [ ] Add support for more property types (commercial, land)
- [ ] Implement caching for already-seen listings
- [ ] Add support for location-specific searches
- [ ] Add metrics tracking (listings/minute, success rate)
- [ ] Support for price change notifications

## License

Internal use only - Landomo platform

## Support

For issues or questions, contact the platform team.
