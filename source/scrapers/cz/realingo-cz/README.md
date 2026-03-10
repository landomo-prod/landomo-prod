# Realingo.cz Scraper

Scraper for Realingo.cz real estate portal using their GraphQL API.

## Features

- ✅ **GraphQL API-based** - Uses official Realingo GraphQL endpoint
- ✅ **Large property database** - ~65,000+ properties total
- ✅ **Full property data** - Fetches all sales and rentals with detailed information
- ✅ **Geo-coordinates** - Includes latitude/longitude for map display
- ✅ **Czech-specific fields** - Disposition, ownership, energy ratings, features
- ✅ **Batch ingestion** - Sends data in batches of 100 to ingest service
- ✅ **HTTP-triggered** - Integrates with centralized scheduler
- ✅ **Health checks** - `/health` endpoint for monitoring

## API Details

**GraphQL Endpoint**: `https://www.realingo.cz/graphql`

**Main Query**: `SearchOffer`

**Variables**:
- `purpose`: SALE | RENT
- `property`: FLAT | HOUSE | LAND | COMMERCIAL | OTHER
- `area`: { min, max } - Area in m²
- `price`: { min, max } - Price in CZK
- `location`: { city, district, region }
- `limit`: Items per page (default: 100)
- `offset`: Pagination offset

**Authentication**: None required (public API)

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
PORT=8085
INGEST_API_URL=http://localhost:3004
INGEST_API_KEY_REALINGO=your_api_key_here
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
docker build -t landomo-scraper-realingo .

# Run container
docker run -p 8085:8085 --env-file .env landomo-scraper-realingo
```

## API Endpoints

### Health Check

```bash
GET http://localhost:8085/health
```

Response:
```json
{
  "status": "healthy",
  "scraper": "realingo",
  "version": "1.0.0",
  "timestamp": "2026-02-06T12:00:00.000Z"
}
```

### Trigger Scrape

```bash
POST http://localhost:8085/scrape
```

Response:
```json
{
  "status": "scraping started",
  "timestamp": "2026-02-06T12:00:00.000Z"
}
```

The scraper will:
1. Fetch all sales properties via GraphQL
2. Fetch all rental properties via GraphQL
3. Transform to StandardProperty format
4. Send to ingest API in batches of 100

## GraphQL Query Example

```graphql
query SearchOffer(
  $purpose: OfferPurpose,
  $property: PropertyType,
  $limit: Int,
  $offset: Int
) {
  searchOffer(
    filter: {
      purpose: $purpose
      property: $property
    }
    limit: $limit
    offset: $offset
  ) {
    total
    items {
      id
      title
      purpose
      property
      price
      area
      plotArea
      location {
        name
        city
        district
        coordinates {
          lat
          lng
        }
      }
      images
      description
      url
    }
  }
}
```

**Variables**:
```json
{
  "purpose": "SALE",
  "property": "FLAT",
  "limit": 100,
  "offset": 0
}
```

## Data Transformation

Realingo properties are transformed to `StandardProperty` format:

**Mapped fields**:
- Property type: FLAT → apartment, HOUSE → house, etc.
- Transaction type: SALE → sale, RENT → rent
- Location: city, district, coordinates (lat/lon)
- Details: area (sqm), plot area, floor, bedrooms, bathrooms
- Czech-specific: disposition, ownership, energy rating, features

**Portal metadata** (preserved in `portal_metadata.realingo`):
- Original property ID
- Purpose, property type
- Plot area, total floors
- Ownership, construction, condition
- Disposition, features, energy rating
- Furnished status
- Agent information
- Published/updated dates

## Expected Volume

Based on API inspection (Feb 2026):
- **46,589 properties for sale**
- **~18,000 rental properties** (estimated)
- **Total: ~65,000 listings**

Scraping time: ~15-20 minutes for all listings (due to large volume)

## Integration

This scraper integrates with:
- **Ingest Service** (`POST /api/v1/properties/bulk-ingest`)
- **Scheduler** (triggers via `POST /scrape`)
- **Shared Components** (`@landomo/core` for StandardProperty type)

## Czech-Specific Fields

This scraper handles Czech real estate terminology:

- **Disposition**: "1+kk", "2+1", "3+kk", "4+1" (room layouts)
- **Ownership**: Ownership type (personal, cooperative, state)
- **Energy Rating**: Energy efficiency classification
- **Features**: parking, balcony, terrace, cellar, elevator, furnished

## Performance Optimization

- **Offset-based pagination** - 100 items per GraphQL query
- **Parallel category scraping** - Sales and rentals fetched separately
- **Rate limiting** - 500ms delay between requests
- **Batch ingestion** - 100 properties per batch to ingest API

## Error Handling

- Automatic retry on network errors (axios default)
- Failed batches don't stop the scrape
- Transformation errors are logged but don't fail the scrape
- GraphQL errors are logged with full details
- All errors are logged with timestamps

## Monitoring

Check scraper status:
```bash
curl http://localhost:8085/health
```

Trigger manual scrape:
```bash
curl -X POST http://localhost:8085/scrape
```

View logs:
```bash
docker logs -f <container_id>
```

## Development

### Project Structure

```
realingo/
├── src/
│   ├── index.ts              # Express server + main logic
│   ├── adapters/
│   │   └── ingestAdapter.ts  # Send to ingest API
│   ├── scrapers/
│   │   └── listingsScraper.ts # Realingo GraphQL client
│   ├── transformers/
│   │   └── realingoTransformer.ts # To StandardProperty
│   └── types/
│       └── realingoTypes.ts  # TypeScript types
├── package.json
├── tsconfig.json
├── Dockerfile
└── README.md
```

### Adding Features

1. **Add new filters**: Update `RealingoSearchVariables` in types
2. **Modify GraphQL query**: Edit query in `listingsScraper.ts`
3. **Modify transformation**: Edit `realingoTransformer.ts`

## Troubleshooting

**GraphQL query errors**:
- Check GraphQL schema hasn't changed
- Verify field names match API
- Review error.response.data.errors for details

**Empty results**:
- Verify Realingo GraphQL endpoint is accessible
- Check if filters are too restrictive
- Review console logs for GraphQL errors

**Transformation errors**:
- Check `portal_metadata.realingo` for raw data
- Review transformer logic in `realingoTransformer.ts`
- Some fields may be optional (null/undefined)

**Ingestion fails**:
- Verify `INGEST_API_URL` is correct
- Check API key is valid
- Ensure ingest service is running

## License

MIT
