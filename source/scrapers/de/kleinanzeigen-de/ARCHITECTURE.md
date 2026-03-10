# Architecture Documentation

## Design Philosophy

This scraper follows the **established landomo-world scraper architecture** as demonstrated by the Czech SReality scraper, adapted for the Kleinanzeigen.de API.

## Architecture Comparison

### Reference: SReality (Czech Republic)

```
sreality/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts                    # Express server + orchestration
│   ├── adapters/
│   │   └── ingestAdapter.ts       # Ingest API client
│   ├── scrapers/
│   │   └── listingsScraper.ts     # Scraping logic
│   ├── types/
│   │   └── srealityTypes.ts       # API types
│   ├── transformers/
│   │   └── srealityTransformer.ts # Data transformation
│   └── utils/
│       ├── fetchData.ts           # API client
│       └── userAgents.ts          # User agent rotation
```

### Implementation: Kleinanzeigen.de (Germany)

```
kleinanzeigen-de/
├── package.json                    ✅ Same structure
├── tsconfig.json                   ✅ Same configuration
├── src/
│   ├── index.ts                    ✅ Same pattern
│   ├── adapters/
│   │   └── ingestAdapter.ts       ✅ Identical interface
│   ├── scrapers/
│   │   └── listingsScraper.ts     ✅ Same pattern
│   ├── types/
│   │   └── kleinanzeigenTypes.ts  ✅ Portal-specific types
│   ├── transformers/
│   │   └── kleinanzeigenTransformer.ts  ✅ Transform to StandardProperty
│   └── utils/
│       ├── fetchData.ts           ✅ API client with retry
│       └── userAgents.ts          ✅ User agent pool
```

## Key Architectural Patterns

### 1. Express Server with Health Check

**Pattern:** Microservice architecture with HTTP endpoints

```typescript
// Both scrapers implement identical endpoints
app.get('/health', ...)    // Health monitoring
app.post('/scrape', ...)   // Trigger endpoint
```

**Benefits:**
- Centralized orchestration
- Easy monitoring
- Standard interface across all scrapers

### 2. Async Response Pattern

**Pattern:** Fire-and-forget with immediate acknowledgment

```typescript
app.post('/scrape', async (req, res) => {
  // Respond immediately (202 Accepted)
  res.status(202).json({ status: 'scraping started' });

  // Run async
  runScraper().catch(error => console.error(error));
});
```

**Benefits:**
- Prevents timeout issues
- Allows long-running scrapes
- Scheduler doesn't wait

### 3. Layered Architecture

#### Layer 1: Data Fetching (`utils/fetchData.ts`)

**SReality:**
```typescript
export const fetchCategoryData = async (
  category: number,
  userAgent: string,
  perPage: number,
  tms: number,
  processPage: (estates: any[], pageNumber: number) => Promise<void>
): Promise<number>
```

**Kleinanzeigen:**
```typescript
export const fetchListings = async (
  categoryId: number,
  userAgent: string,
  locationId?: number,
  query?: string,
  processPage?: (listings: any[], pageNumber: number) => Promise<void>
): Promise<any[]>
```

**Shared Features:**
- Pagination handling
- Retry logic with exponential backoff
- Rate limiting
- Error recovery

#### Layer 2: Scraping Orchestration (`scrapers/listingsScraper.ts`)

**SReality:**
```typescript
export class ListingsScraper {
  async scrapeAll(): Promise<SRealityListing[]>
  private async scrapeCategory(category: number): Promise<SRealityListing[]>
}
```

**Kleinanzeigen:**
```typescript
export class ListingsScraper {
  async scrapeAll(): Promise<KleinanzeigenListing[]>
  private async scrapeCategory(categoryId: number): Promise<KleinanzeigenListing[]>
  async scrapeByQuery(query: string): Promise<KleinanzeigenListing[]>
}
```

**Shared Features:**
- Category-based scraping
- Progress tracking
- Detail enrichment (optional)
- Parallel/sequential processing

#### Layer 3: Data Transformation (`transformers/*Transformer.ts`)

**Pattern:** Portal-specific → StandardProperty

**SReality:**
```typescript
export function transformSRealityToStandard(
  listing: SRealityListing
): StandardProperty
```

**Kleinanzeigen:**
```typescript
export function transformKleinanzeigenToStandard(
  listing: KleinanzeigenListing
): StandardProperty
```

**Shared Transformation Logic:**
- Extract common fields (title, price, location)
- Normalize amenities
- Map property types
- Handle optional fields gracefully
- Extract media (images, videos)
- Country-specific fields

#### Layer 4: Ingestion (`adapters/ingestAdapter.ts`)

**Pattern:** Identical interface across all scrapers

```typescript
export class IngestAdapter {
  constructor(portal: string)
  async sendProperties(properties: PropertyPayload[]): Promise<void>
  async sendProperty(property: PropertyPayload): Promise<void>
}
```

**Shared Features:**
- Batch processing
- Error handling
- API authentication
- Timeout management

### 4. Type Safety

**Pattern:** Full TypeScript with strict types

**Portal-Specific Types:**
```typescript
// SReality
export interface SRealityListing { ... }
export interface SRealityDetailResponse { ... }

// Kleinanzeigen
export interface KleinanzeigenListing { ... }
export interface KleinanzeigenDetailResponse { ... }
```

**Shared Types (from @landomo/core):**
```typescript
export interface StandardProperty { ... }
export interface PropertyPayload { ... }
export interface IngestionPayload { ... }
```

### 5. Error Handling Strategy

**Pattern:** Graceful degradation with detailed logging

```typescript
// Retry with exponential backoff
for (let attempt = 0; attempt < retries; attempt++) {
  try {
    return await axios.get(url, { headers, timeout });
  } catch (error) {
    // Don't retry 4xx errors
    if (axiosError.response?.status >= 400 && < 500) throw error;

    // Exponential backoff with jitter
    const delayMs = Math.min(1000 * Math.pow(2, attempt) + Math.random() * 1000, 10000);
    await delay(delayMs);
  }
}
```

**Shared Principles:**
- Don't retry client errors (4xx)
- Exponential backoff for server errors
- Jitter to avoid thundering herd
- Max retry limit
- Detailed error logging

### 6. Rate Limiting

**Pattern:** Configurable delays with randomization

**SReality:**
```typescript
// 300-500ms between pages
await new Promise(resolve =>
  setTimeout(resolve, 300 + Math.random() * 200)
);
```

**Kleinanzeigen:**
```typescript
// 500-1000ms between pages
await new Promise(resolve =>
  setTimeout(resolve, 500 + Math.random() * 500)
);
```

**Principles:**
- Delay between pages
- Longer delay between categories
- Random jitter
- Respect API limits

### 7. User Agent Rotation

**Pattern:** Pool of realistic user agents

**Both implement:**
```typescript
export const userAgents: string[] = [ ... ];
export function getRandomUserAgent(): string;
```

**Kleinanzeigen Addition:**
```typescript
export function getMobileUserAgent(): string;  // API-specific
```

## Data Flow

### 1. Trigger
```
HTTP POST /scrape → runScraper()
```

### 2. Fetch
```
ListingsScraper → fetchListings() → API
```

### 3. Transform
```
Raw listings → transformToStandard() → StandardProperty[]
```

### 4. Ingest
```
IngestAdapter → sendProperties() → Ingest API
```

### 5. Log
```
Console output → Monitoring
```

## Standardized Property Schema

Both scrapers transform to the same `StandardProperty` interface:

### Core Fields (Identical)
- title, price, currency
- property_type, transaction_type
- source_url, source_platform

### Location (Identical)
- address, city, region, country
- postal_code, coordinates

### Details (Identical)
- bedrooms, bathrooms, sqm
- floor, total_floors, rooms

### Amenities (Identical)
- has_parking, has_garage, has_balcony
- has_garden, has_terrace, has_elevator
- ... (20+ standardized amenities)

### Country-Specific (Different)

**Czech Republic (SReality):**
```typescript
country_specific: {
  czech_disposition: '2+kk' | '3+1' | ...,
  czech_ownership: 'personal' | 'cooperative' | ...,
  // Czech-specific fields
}
```

**Germany (Kleinanzeigen):**
```typescript
country_specific: {
  condition: 'new' | 'renovated' | ...,
  furnished: 'furnished' | 'not_furnished' | ...,
  heating_type: 'central_heating' | ...,
  // German-specific fields
}
```

## Configuration Management

### Environment Variables
```bash
PORT=808X                                    # Unique per scraper
INGEST_API_URL=http://localhost:3004        # Shared
INGEST_API_KEY_{PORTAL}=key                 # Portal-specific
```

### Dependencies
```json
{
  "dependencies": {
    "@landomo/core": "file:../../../shared-components",  // Shared types
    "axios": "^1.6.0",                                    // HTTP client
    "express": "^4.18.2"                                  // Server
  }
}
```

## Testing Strategy

### Unit Tests (Recommended)
```typescript
// Transform tests
describe('transformKleinanzeigenToStandard', () => {
  it('should transform basic listing', () => { ... });
  it('should handle missing fields', () => { ... });
});

// Fetch tests
describe('fetchListings', () => {
  it('should handle pagination', () => { ... });
  it('should retry on failure', () => { ... });
});
```

### Integration Tests
```bash
# API connectivity test
curl -H "Authorization: ..." "https://api.kleinanzeigen.de/api/ads.json?..."

# Health check test
curl http://localhost:8082/health

# End-to-end test
curl -X POST http://localhost:8082/scrape
```

## Monitoring & Logging

### Standardized Log Format

**Progress Logging:**
```
🚀 Starting {portal} scrape...
📡 Fetching listings from {portal} API...
Category {id}: {count} listings
🔄 Transforming {count} listings...
✅ Successfully transformed {count} listings
📤 Sending batch {n}/{total} ({count} properties)...
✅ Sent {count} properties to ingest API
✅ Scrape completed in {duration}s
```

**Error Logging:**
```
❌ Failed to fetch category {id}: {error}
⚠️  No listings found
Error transforming listing {id}: {error}
```

## Scalability Considerations

### Horizontal Scaling
Each scraper is a standalone microservice:
- Can run multiple instances
- Load balanced by orchestrator
- Independent failure domains

### Vertical Scaling
- Async processing
- Batch ingestion
- Concurrent category scraping (configurable)

### Resource Management
- Memory: ~100-200 MB per instance
- CPU: Low (I/O bound)
- Network: Rate-limited

## Future Enhancements

### Potential Additions (Following SReality Pattern)

1. **Detail Enrichment Toggle**
   ```typescript
   constructor(categories, locationId, enrichWithDetails = false)
   ```

2. **Location Filtering**
   ```typescript
   const scraper = new ListingsScraper(categories, BERLIN_LOCATION_ID);
   ```

3. **Search Support**
   ```typescript
   await scraper.scrapeByQuery("immobilien");
   ```

4. **Change Detection**
   - Track listing updates
   - Detect price changes
   - Monitor status changes

5. **Incremental Scraping**
   - Only fetch new listings
   - Skip already-processed items
   - Optimize API usage

## Conclusion

The Kleinanzeigen.de scraper is a **faithful implementation** of the established architecture, with portal-specific adaptations:

✅ **Identical structure** to SReality scraper
✅ **Same design patterns** across all layers
✅ **Consistent interfaces** for orchestration
✅ **Shared type system** via @landomo/core
✅ **Production-ready** with error handling & monitoring

This consistency enables:
- Easy maintenance
- Knowledge transfer between scrapers
- Shared tooling and infrastructure
- Predictable behavior
