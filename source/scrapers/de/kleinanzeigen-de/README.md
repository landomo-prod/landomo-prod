# Kleinanzeigen.de Scraper

Production-ready TypeScript scraper for **Kleinanzeigen.de** (formerly eBay Kleinanzeigen), following the established landomo-world scraper architecture.

## Features

- Direct API integration (no browser automation required)
- Comprehensive real estate category coverage
- Rate limiting and retry logic with exponential backoff
- Standardized data transformation to landomo-world format
- Batch ingestion with error handling
- Health check and trigger endpoints for orchestration

## Architecture

```
src/
├── index.ts                    # Express server and orchestration
├── scrapers/
│   └── listingsScraper.ts     # Main scraping logic
├── types/
│   └── kleinanzeigenTypes.ts  # API response types
├── transformers/
│   └── kleinanzeigenTransformer.ts  # Data transformation
├── adapters/
│   └── ingestAdapter.ts       # Ingest API client
└── utils/
    ├── fetchData.ts           # API client with retry logic
    └── userAgents.ts          # User agent rotation
```

## API Details

### Base Configuration
- **Base URL**: `https://api.kleinanzeigen.de/api`
- **Authentication**: Basic `YW5kcm9pZDpUYVI2MHBFdHRZ` (hardcoded in mobile app)
- **User Agent**: Mobile app user agents (okhttp/4.10.0)
- **Rate Limiting**: 500-1000ms between pages, 1s between categories

### Endpoints Used

#### Search Listings
```
GET /api/ads.json
Parameters:
  - categoryId: Category ID (e.g., 203 for apartments)
  - locationId: Location ID (optional)
  - q: Search query (optional)
  - size: Results per page (max 41)
  - page: Page number (0-indexed)
```

#### Get Details
```
GET /api/ads/{id}.json
```

#### Get Locations
```
GET /api/locations/top-locations.json?depth=0&q={query}
```

## Real Estate Categories

The scraper covers the following real estate categories:

| Category ID | Description | Type |
|------------|-------------|------|
| 203 | Apartments for Rent | rent |
| 196 | Apartments for Sale | sale |
| 205 | Houses for Rent | rent |
| 199 | Houses for Sale | sale |
| 187 | Vacation Rentals | rent |
| 195 | Commercial Properties | sale |
| 98 | Plots/Land | sale |

## Installation

```bash
cd /Users/samuelseidel/Development/landomo-world/scrapers/Germany/kleinanzeigen-de
npm install
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

### Trigger Scraping
```bash
# Via HTTP endpoint
curl -X POST http://localhost:8082/scrape

# Health check
curl http://localhost:8082/health
```

## Configuration

Environment variables:

```bash
PORT=8082                                    # Server port
INGEST_API_URL=http://localhost:3004        # Ingest API URL
INGEST_API_KEY_KLEINANZEIGEN=your_key_here  # API key for ingestion
```

## Data Transformation

The scraper transforms Kleinanzeigen listings into the standardized `StandardProperty` format:

### Extracted Fields

**Basic Info:**
- Title, price, currency
- Property type (apartment, house, land, etc.)
- Transaction type (sale/rent)
- Source URL

**Location:**
- Address, city, region, postal code
- GPS coordinates (lat/lon)
- Country: Germany

**Property Details:**
- Living area (sqm)
- Rooms, bedrooms, bathrooms
- Floor, total floors
- Year built

**Amenities:**
- Balcony, garden, terrace
- Basement/cellar
- Elevator/lift
- Parking, garage

**Media:**
- High-resolution images
- Thumbnail URLs
- Image metadata (order, ID)

**Country-Specific (Germany):**
- Condition (new, renovated, etc.)
- Furnished status
- Heating type
- Plot area

## API Response Handling

### Pagination
The scraper automatically handles pagination:
- Fetches up to 41 results per page (API maximum)
- Continues until no more results
- Implements delay between pages (500-1000ms)

### Error Handling
- Exponential backoff retry (3 attempts)
- No retry on 4xx errors (client errors)
- Rate limit detection (429 status)
- Graceful degradation on detail fetch failures

### Rate Limiting
To avoid triggering Kleinanzeigen's anti-abuse measures:
- 500-1000ms delay between page requests
- 1000ms delay between category requests
- Random jitter to appear more human-like
- Mobile app user agents

## Data Quality

### Validation
- Required fields: title, price, location
- Price validation (must be > 0)
- Coordinates validation (valid lat/lon)

### Enrichment Options
The scraper supports optional detail enrichment:
```typescript
const scraper = new ListingsScraper(
  categories,
  locationId,
  true  // Enable detail enrichment
);
```

**Note:** Detail enrichment increases API calls and scraping time significantly. Use only when needed.

## Performance

### Expected Throughput
- ~40 listings per page
- ~1-2 seconds per page (with delays)
- ~1000-2000 listings per minute per category

### Resource Usage
- Memory: ~100-200 MB
- CPU: Low (mostly I/O bound)
- Network: ~10-50 requests per minute

## Legal & Compliance

### Terms of Service
- The Kleinanzeigen API is intended for their mobile app
- Using this scraper may violate their ToS
- Consider contacting Kleinanzeigen for official API access
- robots.txt blocks `/api` endpoints

### Best Practices
1. Implement rate limiting (✓ included)
2. Use realistic user agents (✓ included)
3. Respect robots.txt where possible
4. Handle data according to GDPR
5. Don't overwhelm their infrastructure

### Recommendations
- For commercial use, seek official partnership
- Monitor for ToS changes
- Implement exponential backoff on errors
- Consider using official APIs when available

## Troubleshooting

### Common Issues

**401 Unauthorized**
- Check authentication header is correct
- Verify API endpoint URLs

**429 Rate Limited**
- Increase delay between requests
- Reduce concurrent requests
- Wait before retrying

**Empty Results**
- Verify category IDs are correct
- Check location ID is valid
- Ensure query parameters are properly encoded

**Transformation Errors**
- Check listing structure matches types
- Verify all required fields are present
- Review error logs for specific fields

## Testing

```bash
# Test API connection
curl -H "Authorization: Basic YW5kcm9pZDpUYVI2MHBFdHRZ" \
     -H "User-Agent: okhttp/4.10.0" \
     "https://api.kleinanzeigen.de/api/ads.json?categoryId=203&size=5"

# Test location lookup
curl -H "Authorization: Basic YW5kcm9pZDpUYVI2MHBFdHRZ" \
     "https://api.kleinanzeigen.de/api/locations/top-locations.json?depth=0&q=Berlin"
```

## Monitoring

The scraper provides detailed logging:
- Page-by-page progress
- Transformation success/failures
- Ingestion batch status
- Total statistics

Example output:
```
🚀 Starting Kleinanzeigen scrape...
📡 Fetching listings from Kleinanzeigen API...
Fetched page 1: 41 listings (total: 41)
Fetched page 2: 41 listings (total: 82)
Category 203: 82 listings
🔄 Transforming 82 listings...
✅ Successfully transformed 82 listings
📤 Sending batch 1/1 (82 properties)...
✅ Sent 82 properties to ingest API
✅ Scrape completed in 45.32s
```

## Future Enhancements

Potential improvements:
- [ ] Location-based filtering
- [ ] Search query support
- [ ] Price range filters
- [ ] Date range filtering
- [ ] Image downloading and storage
- [ ] Duplicate detection
- [ ] Change tracking
- [ ] Webhook notifications

## References

- [Kleinanzeigen.de Research Guide](../../../GERMAN_AUSTRIAN_PORTALS_SCRAPING_GUIDE.md)
- [GitHub: DanielWTE/ebay-kleinanzeigen-api](https://github.com/DanielWTE/ebay-kleinanzeigen-api)
- [GitHub: jonasehrlich/ek-scraper](https://github.com/jonasehrlich/ek-scraper)

## License

Part of the landomo-world platform.

## Support

For issues or questions, contact the landomo-world development team.
