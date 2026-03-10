# CeskeReality.cz Scraper

Simple fetch + cheerio scraper for ceskereality.cz (Czech Republic real estate portal).

## Overview

**Portal:** https://www.ceskereality.cz
**Method:** HTTP fetch + cheerio HTML parsing + JSON-LD extraction
**Categories:** Apartments, Houses, Land, Commercial
**Speed:** ~60 URLs/second (10x faster than Playwright)

## Data Extraction Strategy

### 1. Listing Pages (HTTP Fetch)
- Server-side rendered HTML
- Extract listing URLs from `<a>` tags
- Support for pagination (`?strana=2`)

### 2. Detail Pages (JSON-LD)
- Fetch HTML with simple HTTP request
- Parse `<script type="application/ld+json">` tag
- Extract structured data: price, location, description, images, agent

### 3. Property Categories

| Category | URL | Property Type |
|----------|-----|---------------|
| Apartments | `/prodej/byty/` | `apartment` |
| Houses | `/prodej/domy/` | `house` |
| Land | `/prodej/pozemky/` | `land` |
| Commercial | `/prodej/komercni/` | `commercial` |

## Why Not Playwright?

✅ **This site doesn't need a browser:**
- All data in initial HTML response
- JSON-LD in `<script>` tags (no JS execution needed)
- No anti-bot protection
- Server-side rendered

**Benefits:**
- 10x faster (no browser startup)
- 100MB+ smaller (no browser installation)
- Lower memory usage
- Simpler deployment
- Easier to debug

## Setup

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env
```

## Usage

### Investigation Script

```bash
npm run investigate
```

Output:
- ✅ 60+ listing URLs found
- ✅ JSON-LD data extracted
- ✅ ~1 second execution time

### Development

```bash
npm run dev
```

### Production

```bash
npm run build
npm start
```

### API Endpoints

- `GET /health` - Health check
- `POST /scrape` - Start scraping

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3016` | Server port |
| `INGEST_API_URL` | `http://localhost:3001` | Ingest service URL |
| `INGEST_API_KEY` | `dev-key` | Ingest API key |
| `MAX_PAGES` | `5` | Max pages per category |
| `DELAY_MS` | `500` | Delay between requests (ms) |

## Features

✅ Simple HTTP fetch (no browser)
✅ Cheerio HTML parsing
✅ JSON-LD structured data extraction
✅ Multi-category support
✅ Pagination handling
✅ Batch ingestion (50 properties/batch)
✅ Scrape run tracking
✅ Rate limiting with configurable delay

## Data Flow

```
1. Fetch listing pages → extract URLs
2. Fetch detail pages → extract JSON-LD
3. Transform to TierI schema
4. Send to ingest API in batches
```

## Example JSON-LD Data

```json
{
  "@type": "individualProduct",
  "name": "Prodej bytu 2+kk 48 m²",
  "price": 5790000,
  "priceCurrency": "CZK",
  "offers": {
    "areaServed": {
      "address": {
        "addressLocality": "Tuchoměřice"
      }
    },
    "offeredby": {
      "name": "GARTAL Development",
      "telephone": "840400440"
    }
  }
}
```

## Performance

- **Speed:** ~1-2 requests/second (with 500ms delay)
- **Memory:** ~50MB (vs 500MB+ with Playwright)
- **Batch size:** 50 properties
- **Recommended:** 5 pages per category

## Deployment

### Docker

```bash
docker build -t ceskereality-scraper .
docker run -p 3016:3016 --env-file .env ceskereality-scraper
```

### VPS

```bash
# Install dependencies
npm install

# Build
npm run build

# Run
PORT=3016 npm start
```

## Troubleshooting

### No listings found
- Check if site structure changed
- Verify URL patterns in scraper
- Run investigation script to debug

### Rate limiting
- Increase `DELAY_MS` in .env
- Reduce `MAX_PAGES`
- Add user-agent header if needed

### JSON-LD parsing errors
- Site may have changed structure
- Check console logs for error details
- Verify with investigation script
