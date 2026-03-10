# ImmoScout24 Austria Scraper

Production-ready TypeScript scraper for immobilienscout24.at following the landomo-world architecture.

## 🎯 Features

- **Direct API Access**: Uses reverse-engineered ImmoScout24 Android API (no authentication required)
- **Full Property Details**: Fetches comprehensive property data including images, floor plans, and agent info
- **Smart Pagination**: Automatically handles pagination and deduplication
- **Rate Limiting**: Built-in delays to avoid overwhelming the API (300-500ms between requests)
- **Error Handling**: Exponential backoff with retry logic
- **Two Scrape Modes**:
  - **Full Scrape**: Complete property catalog across all categories
  - **Quick Scrape**: Only recently added properties (last N days)
- **Type-Safe**: Full TypeScript implementation with comprehensive type definitions

## 📋 API Discovery

This scraper is based on reverse engineering the official ImmoScout24 Android app (v5.0):

- **14,312 Java files analyzed** from decompiled APK
- **4 API endpoints discovered** and documented
- **No authentication required** - public API
- **Base URL**: `https://api.is24.at` (auto-discovered at runtime)

See `/GERMAN_AUSTRIAN_PORTALS_SCRAPING_GUIDE.md` for full research documentation.

## 🚀 Quick Start

### Installation

```bash
cd /Users/samuelseidel/Development/landomo-world/scrapers/Austria/immobilienscout24-at
npm install
```

### Configuration

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` with your configuration:

```env
PORT=8082
INGEST_API_URL=http://localhost:3004
INGEST_API_KEY_IMMOBILIENSCOUT24_AT=your_api_key_here
```

### Build

```bash
npm run build
```

### Development

```bash
npm run dev
```

### Production

```bash
npm run build
npm start
```

## 📡 API Endpoints

### Health Check

```bash
GET http://localhost:8082/health
```

Response:
```json
{
  "status": "healthy",
  "scraper": "immobilienscout24-at",
  "version": "1.0.0",
  "timestamp": "2026-02-07T10:30:00.000Z"
}
```

### Trigger Full Scrape

```bash
POST http://localhost:8082/scrape
```

Scrapes all property categories (apartments, houses, both sale and rent).

### Trigger Quick Scrape

```bash
POST http://localhost:8082/scrape/recent
Content-Type: application/json

{
  "days": 7
}
```

Scrapes only properties added in the last N days (default: 7).

## 🏗️ Architecture

```
src/
├── index.ts                    # Express server & main orchestration
├── scrapers/
│   └── listingsScraper.ts     # Core scraping logic with pagination
├── types/
│   └── immoscout24Types.ts    # API response type definitions
├── transformers/
│   └── immoscout24Transformer.ts  # Transform to StandardProperty
├── adapters/
│   └── ingestAdapter.ts       # Send to ingest API
└── utils/
    ├── fetchData.ts           # HTTP client with retry logic
    └── userAgents.ts          # User agent rotation
```

## 🔧 Configuration Options

### Scraper Configuration

The `ListingsScraper` accepts the following configuration:

```typescript
{
  // Property types to scrape
  propertyTypes: ['APARTMENT', 'HOUSE', 'LAND'],

  // Transaction types
  transactionTypes: ['SALE', 'RENT'],

  // Specific locations (optional)
  locations: ['Vienna', 'Salzburg', 'Innsbruck'],

  // Price ranges (optional)
  priceRanges: [
    { min: 0, max: 200000 },
    { min: 200000, max: 500000 },
    { min: 500000, max: undefined }
  ],

  // Fetch full details for each property?
  fetchDetails: true,

  // Max pages per category
  maxPagesPerCategory: 50,

  // Page size (max 100)
  pageSize: 20
}
```

## 📊 API Endpoints Used

### 1. Search Properties

```
GET /api/psa/is24/properties/search
```

**Parameters:**
- `profile=android` (required)
- `size=20` (page size, max 100)
- `from=0` (offset for pagination)
- `sort=dateDesc|priceAsc|priceDesc|sizeAsc|sizeDesc`
- `country=AT`
- `propertyType=APARTMENT|HOUSE|LAND`
- `transactionType=SALE|RENT`
- `priceMin` / `priceMax`
- `areaMin` / `areaMax`

### 2. Property Details

```
GET /api/psa/is24/property/{exposeId}
```

**Parameters:**
- `includeChildren=false`

### 3. Similar Properties

```
GET /api/psa/is24/property/{exposeId}/similar
```

## 🎨 Data Transformation

Properties are transformed to the `StandardProperty` format used across all landomo scrapers:

```typescript
{
  title: string;
  price: number;
  currency: "EUR";
  property_type: "apartment" | "house" | "land" | "commercial";
  transaction_type: "sale" | "rent";

  location: {
    address: string;
    city: string;
    region: string;
    country: "Austria";
    postal_code: string;
    coordinates: { lat: number; lon: number; }
  };

  details: {
    bedrooms: number;
    bathrooms: number;
    sqm: number;
    floor: number;
    total_floors: number;
    rooms: number;
    year_built: number;
  };

  amenities: { ... };
  media: { images, virtual_tour_url, floor_plan_urls, ... };
  agent: { name, phone, email, agency, ... };

  // Portal-specific metadata preserved
  portal_metadata: {
    immobilienscout24: { ... }
  };

  // Austrian-specific fields
  country_specific: {
    condition: "new" | "renovated" | ...;
    furnished: "furnished" | "not_furnished";
    energy_rating: "a" | "b" | "c" | ...;
    heating_type: "central_heating" | ...;
    accessible: boolean;
    pets_allowed: boolean;
  };
}
```

## ⚙️ Rate Limiting

The scraper implements multiple levels of rate limiting:

- **Between API requests**: 300-500ms random delay
- **Between pages**: Automatic via `fetchAllProperties`
- **Between categories**: 1-2 seconds
- **Between detail fetches**: 200-400ms per batch of 10
- **Retry backoff**: Exponential backoff on errors (1s, 2s, 4s)

These delays ensure we stay well under any rate limits while maintaining good performance.

## 🛡️ Error Handling

- **Retry Logic**: 3 attempts with exponential backoff
- **404 Handling**: Skip missing properties and continue
- **429 Rate Limiting**: Automatic backoff up to 30 seconds
- **Network Errors**: Graceful degradation with logging
- **Transformation Errors**: Skip invalid properties, log errors

## 📈 Performance

### Full Scrape
- **Estimated time**: 15-30 minutes for ~10,000 properties
- **Memory usage**: ~200-500 MB
- **Network requests**: ~10,000-15,000 (including details)

### Quick Scrape (7 days)
- **Estimated time**: 1-3 minutes for ~500 properties
- **Memory usage**: ~50-100 MB
- **Network requests**: ~100-200

## 🧪 Testing

Test the API manually:

```bash
# Test search endpoint
curl -X GET 'https://api.is24.at/api/psa/is24/properties/search?profile=android&size=5&from=0&sort=dateDesc' \
  -H 'Accept: application/json' \
  -H 'User-Agent: ImmoScout24/5.0 (Android)' \
  --compressed

# Test property details
curl -X GET 'https://api.is24.at/api/psa/is24/property/EXPOSE_ID_HERE' \
  -H 'Accept: application/json' \
  -H 'User-Agent: ImmoScout24/5.0 (Android)' \
  --compressed
```

Or use the included Python test script:

```bash
python3 /private/tmp/claude/.../test_immoscout24_api.py
```

## 📝 Logging

The scraper provides detailed logging:

```
🚀 Starting ImmoScout24 Austria scrape...
   Property types: APARTMENT, HOUSE
   Transaction types: SALE, RENT
📋 Generated 4 search combinations

[1/4] Processing: APARTMENT / SALE
   📄 Page 1: fetched 20 properties (20/1250 total)
   📄 Page 2: fetched 20 properties (40/1250 total)
   ...
   📡 Fetching details for 240 properties...
   ✅ Enriched 240 properties with details
   ✅ Found 240 properties

✅ Scraping complete:
   Total properties: 8,542
   Unique properties: 8,542
```

## 🔐 Security & Legal

### API Access
- No authentication required (public API)
- No API keys or tokens needed
- Uses official Android app endpoints
- Respects rate limits

### Best Practices
- Reasonable rate limiting (1-2 req/sec)
- User-Agent rotation
- Error handling and retry logic
- No aggressive scraping patterns

### Legal Considerations
- Review ImmoScout24 Terms of Service
- Consider contacting ImmoScout24 for commercial API access
- Implement exponential backoff on errors
- Monitor for ToS changes

## 📚 Related Documentation

- **Main Guide**: `/Users/samuelseidel/Development/landomo-world/GERMAN_AUSTRIAN_PORTALS_SCRAPING_GUIDE.md`
- **Reverse Engineering**: `/private/tmp/claude/.../ImmoScout24_API_Analysis.md`
- **Test Script**: `/private/tmp/claude/.../test_immoscout24_api.py`
- **Czech Reference**: `/Users/samuelseidel/Development/landomo-world/scrapers/Czech Republic/sreality/`

## 🐛 Troubleshooting

### API Base URL Not Found

If the scraper can't discover the API base URL:

```bash
# Test each URL manually
curl -I https://api.is24.at/api/psa/is24/properties/search?profile=android&size=1
curl -I https://api-prod.immobilienscout24.at/api/psa/is24/properties/search?profile=android&size=1
```

Set the working URL in your environment:

```env
IMMOSCOUT24_BASE_URL=https://api.is24.at
```

### Rate Limiting (429 Errors)

Increase delays in `fetchData.ts`:

```typescript
// Increase delay between requests
await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second
```

### Missing Property Details

Some properties may not have detail endpoints. The scraper handles this gracefully:

```
⚠️  Failed to fetch detail for 123456
```

Properties without details are still included with listing-level data.

## 🚀 Future Enhancements

- [ ] Add support for commercial properties
- [ ] Implement change detection (price changes, status changes)
- [ ] Add image download and storage
- [ ] Support for saved searches
- [ ] Webhooks for new listings
- [ ] German version (immobilienscout24.de)
- [ ] Prometheus metrics
- [ ] Health check with API connectivity test

## 📄 License

Part of the landomo-world project.

## 👥 Contributors

- Architecture based on Czech Republic sreality scraper
- API reverse engineered from ImmoScout24 Android app v5.0
- Created: February 7, 2026
