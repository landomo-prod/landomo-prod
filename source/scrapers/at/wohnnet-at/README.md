# Wohnnet.at Scraper

Production-ready TypeScript scraper for Wohnnet.at (Austria's real estate portal).

## Architecture

This scraper follows the established landomo-world architecture pattern:

- **Traditional HTML Scraping**: Server-rendered HTML with Cheerio parsing
- **JSON-LD Extraction**: Structured data extraction from schema.org markup
- **Pagination Support**: Handles `?seite=N` pagination (1,400+ pages available)
- **Image API Integration**: Uses `https://api.wohnnet.at/v1/images` for image URLs
- **Rate Limiting**: 2 requests/second to respect server resources

## Features

- Full listing scraping with pagination
- JSON-LD structured data extraction
- Detail page enrichment (optional)
- Robust error handling with exponential backoff
- User-Agent rotation
- Express API endpoints for health checks and manual triggers
- Batch ingestion to central API

## Installation

```bash
npm install
```

## Configuration

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

Key settings:
- `PORT`: Server port (default: 8083)
- `MAX_PAGES`: Maximum pages to scrape (default: 1500)
- `REQUESTS_PER_SECOND`: Rate limit (default: 2)
- `ENABLE_DETAIL_SCRAPING`: Fetch detail pages (default: true)

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

### Manual Trigger
```bash
curl -X POST http://localhost:8083/scrape
```

## API Endpoints

- `GET /health` - Health check
- `POST /scrape` - Trigger scraping job

## Data Flow

1. **Fetch Listings**: Scrape listing pages with pagination
2. **Parse HTML**: Extract data using Cheerio + JSON-LD
3. **Enrich Details**: Optionally fetch detail pages for complete data
4. **Transform**: Convert to StandardProperty format
5. **Ingest**: Send to central ingest API in batches

## Wohnnet.at Specifics

### URL Structure
- Listings: `https://www.wohnnet.at/immobilien/?seite={page}`
- Detail: `https://www.wohnnet.at/immobilien/{slug}`
- Images: `https://api.wohnnet.at/v1/images/{id}?width={w}&height={h}`

### Data Extraction
- **JSON-LD**: Primary structured data source (schema.org)
- **HTML Fallback**: Custom parsing for missing fields
- **Image API**: Dedicated endpoint for high-quality images

### Pagination
- Format: `?seite=1` to `?seite=1409+`
- 20-30 listings per page
- Server-rendered (no JavaScript required)

## Anti-Bot Protection

**Status**: ❌ None

Wohnnet.at has no anti-bot protection:
- No Cloudflare
- No DataDome
- No rate limiting detected
- HTTP 200 responses with simple user agents

## Rate Limiting

Default: 2 requests/second (conservative)

Can be increased if needed, but current settings respect server resources and minimize risk.

## Error Handling

- **Exponential Backoff**: 1s → 2s → 4s delays on errors
- **Skip 4xx Errors**: Client errors are not retried
- **Continue on Failure**: Failed pages don't stop the entire scrape
- **Comprehensive Logging**: All errors logged with context

## Testing

The scraper has been validated against:
- ✅ Listing page structure
- ✅ JSON-LD schema.org markup
- ✅ Pagination handling
- ✅ Image API endpoints
- ✅ Detail page extraction

## Deployment

### Docker
```bash
docker build -t landomo-wohnnet-scraper .
docker run -p 8083:8083 --env-file .env landomo-wohnnet-scraper
```

### Docker Compose
```yaml
wohnnet-scraper:
  build: ./scrapers/Austria/wohnnet-at
  ports:
    - "8083:8083"
  env_file:
    - ./scrapers/Austria/wohnnet-at/.env
  restart: unless-stopped
```

## Maintenance

- **Check robots.txt**: `https://www.wohnnet.at/robots.txt`
- **Monitor rate limits**: Watch for 429 responses
- **Update selectors**: If HTML structure changes
- **JSON-LD schema**: Verify schema.org compliance

## License

Proprietary - Landomo World Platform
