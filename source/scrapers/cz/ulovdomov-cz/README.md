# UlovDomov.cz Scraper

Scraper for UlovDomov.cz real estate portal using HTML + JSON extraction.

## Features

- ✅ **HTML + JSON Extraction** - Uses Puppeteer + `window.__NEXT_DATA__`
- ✅ **Full property data** - Fetches all sales and rentals
- ✅ **Geo-coordinates** - Includes latitude/longitude for map display
- ✅ **Czech-specific fields** - Disposition ("2+kk", "3+1"), ownership, features
- ✅ **Batch ingestion** - Sends data in batches of 100 to ingest service
- ✅ **HTTP-triggered** - Integrates with centralized scheduler
- ✅ **Health checks** - `/health` endpoint for monitoring
- ✅ **User agent rotation** - Prevents bot detection
- ✅ **Rate limiting** - 500ms delay between requests

## Scraping Method

**UPDATE (Feb 2026)**: The REST API (`https://ud.api.ulovdomov.cz/v1`) is currently returning 500 errors. The scraper now uses:

1. **HTML scraping** - Extract listing URLs from category pages
2. **JSON extraction** - Get complete data from `window.__NEXT_DATA__` on detail pages
3. **Browser automation** - Puppeteer for JavaScript-rendered content

**Data Source**: `window.__NEXT_DATA__.props.pageProps`

See `API_INVESTIGATION.md` for full details on the API issue and implementation strategy.

## Installation

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Build TypeScript
npm run build
```

## Configuration

Edit `.env`:

```env
PORT=8084
INGEST_API_URL=http://localhost:3004
INGEST_API_KEY_ULOVDOMOV=your_api_key_here
```

## Usage

### Development Mode

```bash
npm run dev
```

### Production Mode

```bash
npm run build
npm start
```

### Docker

```bash
# Build image
docker build -t landomo-scraper-ulovdomov .

# Run container
docker run -p 8084:8084 --env-file .env landomo-scraper-ulovdomov
```

## API Endpoints

### Health Check

```bash
GET http://localhost:8084/health
```

Response:
```json
{
  "status": "healthy",
  "scraper": "ulovdomov",
  "version": "1.0.0",
  "timestamp": "2026-02-06T12:00:00.000Z"
}
```

### Trigger Scrape

```bash
POST http://localhost:8084/scrape
```

Response:
```json
{
  "status": "scraping started",
  "timestamp": "2026-02-06T12:00:00.000Z"
}
```

The scraper will:
1. Fetch all sales properties
2. Fetch all rental properties
3. Transform to StandardProperty format
4. Send to ingest API in batches of 100

## Data Transformation

UlovDomov properties are transformed to `StandardProperty` format:

**Mapped fields**:
- Property type: FLAT → apartment, HOUSE → house, etc.
- Transaction type: SALE → sale, RENT → rent
- Location: city, district, coordinates (lat/lon)
- Details: area (sqm), floor, bedrooms, rooms
- Czech-specific: disposition, ownership, features

**Portal metadata** (preserved in `portal_metadata.ulovdomov`):
- Original property ID
- Property type, offer type
- Total floors, construction, condition
- Furnished status, energy efficiency
- Agent information
- Published/updated dates

## Expected Volume

Based on API inspection (Feb 2026):
- **~3,500 rental properties**
- **~3,500 sale properties**
- **Total: ~7,000 listings**

Scraping time: ~2-3 minutes for all listings

## Integration

This scraper integrates with:
- **Ingest Service** (`POST /api/v1/properties/bulk-ingest`)
- **Scheduler** (triggers via `POST /scrape`)
- **Shared Components** (`@landomo/core` for StandardProperty type)

## Czech-Specific Fields

This scraper handles Czech real estate terminology:

- **Disposition**: "1+kk", "2+1", "3+kk", "4+1" (room layouts)
- **Ownership**: "Osobní", "Družstevní", "Státní"
- **Features**: parking, balcony, terrace, cellar, elevator, barrier-free

## Error Handling

- Automatic retry on network errors (axios default)
- Failed batches don't stop the scrape
- Transformation errors are logged but don't fail the scrape
- All errors are logged with details

## Monitoring

Check scraper status:
```bash
curl http://localhost:8084/health
```

Trigger manual scrape:
```bash
curl -X POST http://localhost:8084/scrape
```

View logs:
```bash
docker logs -f <container_id>
```

## Development

### Project Structure

```
ulovdomov/
├── src/
│   ├── index.ts              # Express server + main logic
│   ├── adapters/
│   │   └── ingestAdapter.ts  # Send to ingest API
│   ├── scrapers/
│   │   └── listingsScraper.ts # UlovDomov REST API client
│   ├── transformers/
│   │   └── ulovdomovTransformer.ts # To StandardProperty
│   └── types/
│       └── ulovdomovTypes.ts # TypeScript types
├── package.json
├── tsconfig.json
├── Dockerfile
└── README.md
```

### Adding Features

1. **Add new filters**: Update `UlovDomovSearchFilters` in types
2. **Modify transformation**: Edit `ulovdomovTransformer.ts`
3. **Change scraping logic**: Edit `listingsScraper.ts`

## Troubleshooting

**API returns empty results**:
- Check if UlovDomov API is accessible
- Verify API endpoint hasn't changed
- Check console logs for detailed error messages

**Transformation errors**:
- Check `portal_metadata.ulovdomov` for raw data
- Review transformer logic in `ulovdomovTransformer.ts`
- Some fields may be optional (null/undefined)

**Ingestion fails**:
- Verify `INGEST_API_URL` is correct
- Check API key is valid
- Ensure ingest service is running

## License

MIT
