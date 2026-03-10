# WG-Gesucht Scraper Architecture

## Overview

This scraper follows the **proven Czech scraper architecture** used by the sreality scraper, adapted for the WG-Gesucht API.

## Design Principles

1. **Separation of Concerns** - Each module has a single responsibility
2. **Type Safety** - Full TypeScript coverage with strict mode
3. **Error Resilience** - Retry logic, exponential backoff, graceful degradation
4. **Rate Limiting** - Built-in delays to avoid triggering anti-bot measures
5. **Standardization** - All data transformed to Landomo StandardProperty format

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    Express Server (index.ts)                 │
│  - Health check endpoint (/health)                          │
│  - Scrape trigger endpoint (/scrape)                        │
│  - Orchestrates scraping pipeline                           │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│              ListingsScraper (scrapers/)                     │
│  - Manages multi-city scraping                              │
│  - Handles authentication                                   │
│  - Enriches with detail data                                │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│              FetchData Utilities (utils/)                    │
│  - API authentication (OAuth2)                              │
│  - Token refresh logic                                      │
│  - Rate limiting (5-8s delays)                              │
│  - Retry with exponential backoff                           │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│            WG-Gesucht API                                    │
│  https://www.wg-gesucht.de/api/asset/offers/               │
│  - Search offers: GET /?city_id=8&categories=0              │
│  - Offer details: GET /{offerId}                            │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼ (Raw data)
┌─────────────────────────────────────────────────────────────┐
│         WGGesuchtTransformer (transformers/)                │
│  - Maps WG-Gesucht fields to StandardProperty               │
│  - Extracts amenities from features                         │
│  - Normalizes German-specific data                          │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼ (Standardized data)
┌─────────────────────────────────────────────────────────────┐
│              IngestAdapter (adapters/)                       │
│  - Batches properties (100 per batch)                       │
│  - Sends to Ingest API                                      │
│  - Handles API errors gracefully                            │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                  Ingest API                                  │
│  - Deduplication by portal_id                               │
│  - Change detection                                         │
│  - Database storage                                         │
└─────────────────────────────────────────────────────────────┘
```

## Module Breakdown

### 1. index.ts (Orchestrator)

**Responsibilities:**
- Express server setup
- Health check endpoint
- Scrape trigger endpoint
- Pipeline orchestration (authenticate → scrape → transform → ingest)
- Error handling and logging

**Key Features:**
- Responds immediately (202) to scheduler
- Runs scraping asynchronously
- Graceful shutdown handling

### 2. scrapers/listingsScraper.ts

**Responsibilities:**
- Multi-city scraping coordination
- Category-based filtering
- Authentication management
- Detail enrichment

**Key Methods:**
- `authenticate()` - Authenticates with WG-Gesucht API
- `scrapeAll()` - Scrapes all configured cities
- `scrapeCity()` - Scrapes a single city
- `scrapeCustom()` - Custom search parameters

**Features:**
- Configurable cities and categories
- Optional detail fetching
- Progress logging

### 3. utils/fetchData.ts

**Responsibilities:**
- HTTP requests to WG-Gesucht API
- OAuth2 authentication flow
- Token storage and refresh
- Rate limiting and retry logic

**Key Functions:**
- `authenticate()` - Password grant flow
- `refreshAccessToken()` - Refresh token flow
- `fetchDataWithRetry()` - HTTP GET with retry
- `fetchOffers()` - Search API
- `fetchOfferDetail()` - Detail API
- `fetchPaginatedData()` - Pagination handler

**Features:**
- Automatic token refresh (5 min before expiry)
- 5-8 second delays between requests
- Exponential backoff on errors
- 401 handling with token refresh

### 4. utils/userAgents.ts

**Responsibilities:**
- User agent rotation
- Bot detection avoidance

**Features:**
- Pool of 6 realistic browser user agents
- Random selection for each request

### 5. types/wgGesuchtTypes.ts

**Responsibilities:**
- TypeScript type definitions
- API response structures
- Constants (city IDs, categories)

**Key Types:**
- `WGGesuchtOffer` - Listing data
- `WGGesuchtOfferDetail` - Detailed data
- `WGGesuchtSearchParams` - Search parameters
- `WGGesuchtAuthResponse` - Auth tokens

**Constants:**
- `CITY_IDS` - Major German cities
- `CATEGORY_TYPES` - Property categories

### 6. transformers/wgGesuchtTransformer.ts

**Responsibilities:**
- Transform WG-Gesucht data to StandardProperty
- Extract amenities from features
- Normalize German-specific fields

**Key Function:**
- `transformWGGesuchtToStandard()` - Main transformation

**Mappings:**
- Property type: WG-Zimmer → 'room', Wohnung → 'apartment'
- Furnished status: möbliert → 'furnished', unmöbliert → 'not_furnished'
- Amenities: Balkon → has_balcony, Parkplatz → has_parking

### 7. adapters/ingestAdapter.ts

**Responsibilities:**
- Send properties to Ingest API
- Batch processing (100 per batch)
- Error handling

**Key Methods:**
- `sendProperties()` - Batch send
- `sendProperty()` - Single send

**Features:**
- Automatic batching
- Retry on failure
- Detailed error logging

## Data Flow

### 1. Authentication Phase

```
User Credentials
    ↓
authenticate(username, password)
    ↓
POST /api/oauth/token
    ↓
Store tokens in memory
{
  accessToken: "...",
  refreshToken: "...",
  expiresAt: timestamp
}
```

### 2. Scraping Phase

```
City IDs + Categories
    ↓
For each city:
  ↓
  fetchPaginatedData(cityId, categories)
    ↓
    For each page:
      ↓
      GET /api/asset/offers/?city_id=8&categories=0&page=1
        ↓
        Rate limit delay (5-8s)
        ↓
      If fetchDetails:
        ↓
        For each offer:
          ↓
          GET /api/asset/offers/{offerId}
            ↓
            Rate limit delay (5-8s)
            ↓
          Merge detail with listing
    ↓
  Aggregate all listings
```

### 3. Transformation Phase

```
Raw WG-Gesucht Data
    ↓
transformWGGesuchtToStandard()
    ↓
Extract fields:
  - title, price, size
  - city, district, coordinates
  - amenities (balcony, parking, etc.)
  - WG-specific (flatmates, furnished)
    ↓
Map to StandardProperty format
    ↓
Standardized Data
```

### 4. Ingestion Phase

```
Standardized Properties
    ↓
Split into batches (100 each)
    ↓
For each batch:
  ↓
  POST /api/v1/properties/bulk-ingest
  {
    portal: "wg-gesucht",
    country: "germany",
    properties: [...]
  }
    ↓
    Ingest API:
      - Deduplicates by portal_id
      - Detects changes
      - Stores in database
```

## Error Handling

### Levels of Error Handling

1. **Request Level** (fetchData.ts)
   - Retry 3 times with exponential backoff
   - Handle 401 with token refresh
   - Don't retry 4xx errors (except 401)

2. **Detail Fetch Level** (listingsScraper.ts)
   - Log warning if detail fetch fails
   - Return original listing without details
   - Continue with next listing

3. **City Level** (listingsScraper.ts)
   - Log error if city scraping fails
   - Continue with next city
   - Return partial results

4. **Pipeline Level** (index.ts)
   - Log full error stack
   - Return 500 if authentication fails
   - Continue processing even if some batches fail

## Rate Limiting Strategy

### Why 5-8 Seconds?

WG-Gesucht uses reCAPTCHA to detect bot activity. Testing shows:
- **< 3 seconds**: Almost always triggers reCAPTCHA
- **3-5 seconds**: Sometimes triggers reCAPTCHA
- **5-8 seconds**: Rarely triggers reCAPTCHA
- **> 10 seconds**: Very safe but slow

### Implementation

```typescript
// After each successful request
const delayMs = 5000 + Math.random() * 3000; // 5-8 seconds
await delay(delayMs);
```

### Additional Measures

1. **User Agent Rotation** - Looks like different browsers
2. **Authentication** - Uses official OAuth2 flow
3. **Exponential Backoff** - Backs off on errors

## Performance Characteristics

### Scraping Speed

With 5-8 second delays:
- **Single listing**: ~6-7 seconds (with detail fetch)
- **Page of 20 listings**: ~2-3 minutes (with details)
- **100 listings**: ~10-15 minutes
- **Full Berlin scrape**: ~2-3 hours (estimated 450 listings)
- **5 cities**: ~10-12 hours

### Optimization Options

1. **Disable detail fetching**: `fetchDetails: false` → 2x faster
2. **Reduce cities**: Start with 1-2 cities
3. **Filter by category**: Only WG rooms, not apartments
4. **Incremental scraping**: Only fetch new listings

### Bottlenecks

1. **Rate limiting** - Mandatory 5-8s delays
2. **Detail fetching** - Each detail requires separate request
3. **Authentication** - Initial token fetch takes 2-3 seconds

## Comparison with Czech Scraper

### Similarities

✅ Same directory structure
✅ Same orchestration pattern (index.ts)
✅ Same transformation approach
✅ Same IngestAdapter interface
✅ Same error handling philosophy

### Differences

❌ **Authentication**: WG-Gesucht requires OAuth2, SReality doesn't
❌ **Rate limiting**: WG-Gesucht requires 5-8s, SReality 300-500ms
❌ **Detail enrichment**: WG-Gesucht detail fetch, SReality has all data in listing
❌ **Property types**: WG-Gesucht has shared housing, SReality doesn't

### Lessons Learned from Czech Scraper

1. ✅ **Express server pattern** - Clean separation of concerns
2. ✅ **Batch ingestion** - 100 properties per batch
3. ✅ **Progress logging** - User-friendly console output
4. ✅ **Type safety** - Comprehensive TypeScript types
5. ✅ **Error resilience** - Continue on partial failures

## Future Enhancements

### Short Term

1. **Incremental scraping** - Only fetch new/changed listings
2. **Image downloading** - Store images locally
3. **Change detection** - Track price/availability changes

### Medium Term

1. **Proxy support** - Rotate IPs to avoid rate limits
2. **HTML fallback** - Switch to Playwright if API blocked
3. **Mobile API** - Use official mobile app endpoints

### Long Term

1. **Machine learning** - Predict best times to scrape
2. **Multi-region** - Support Austrian cities
3. **Real-time alerts** - Notify on new listings

## Security Considerations

### Credential Storage

- Store in environment variables
- Never commit to git
- Use secrets manager in production

### Token Management

- Tokens stored in memory (not persisted)
- Auto-refresh before expiry
- Clear on shutdown

### API Key Handling

- Ingest API key from environment
- Different keys per portal
- Rotate keys regularly

## Monitoring

### Key Metrics

1. **Listings scraped** - Total per city
2. **Success rate** - Transformed / Total
3. **Error rate** - Failed requests / Total requests
4. **Average request time** - Response time monitoring
5. **Auth failures** - Token refresh failures

### Logging

All logs include:
- Timestamp (ISO 8601)
- Log level (emoji + text)
- Context (city, page, listing ID)
- Error details (message + stack)

### Alerting

Consider alerts for:
- Authentication failures (> 3 in a row)
- Rate limit hits (reCAPTCHA triggered)
- Zero listings scraped
- High error rate (> 10%)

---

**Last Updated:** February 7, 2026
**Architecture Version:** 1.0
**Based on:** Czech Republic sreality scraper
