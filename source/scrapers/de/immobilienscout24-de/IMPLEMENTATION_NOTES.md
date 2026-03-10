# Implementation Notes - ImmobilienScout24.de Scraper

## Architecture Decisions

### 1. API-First Approach

**Decision**: Use discovered mobile API instead of web scraping

**Rationale**:
- No anti-bot protection detected
- Clean JSON responses
- Better performance (no browser overhead)
- More reliable than HTML parsing
- Easier to maintain

**Based on**: Reverse engineering from Android APK (14,312 Java files analyzed)

### 2. Rate Limiting

**Decision**: Conservative 2 requests/second default

**Rationale**:
- Avoid triggering potential rate limits
- Respectful to server resources
- Can be increased if needed
- Matches Czech scraper patterns

### 3. Data Transformation

**Decision**: Follow sreality transformer pattern

**Rationale**:
- Proven architecture
- Type-safe transformations
- Handles missing fields gracefully
- Standardized output format

### 4. Error Handling

**Decision**: Continue scraping on individual failures

**Rationale**:
- Single property failure shouldn't stop entire scrape
- Log errors for debugging
- Return partial results
- Matches bezrealitky pattern

### 5. Optional Detail Enrichment

**Decision**: Search results only by default, optional detail fetching

**Rationale**:
- Search results contain most important data
- Detail enrichment adds 1 API call per property
- Can enable for specific use cases
- Faster scraping without enrichment

## Key Implementation Details

### Type Definitions

Based on API response analysis:

- `ImmoScout24SearchResponse`: Paginated search results
- `ImmoScout24Property`: Individual property listing
- `ImmoScout24ObjectData`: Detailed property data
- `ImmoScout24Address`: Location information
- `ImmoScout24PriceInfo`: Pricing details

Flexible types with optional fields to handle API variations.

### URL Discovery

Auto-discovery pattern from bezrealitky:

```typescript
const BASE_URL_CANDIDATES = [
  'https://api.immobilienscout24.de',
  'https://api-prod.immobilienscout24.de',
  'https://is24-api.immobilienscout24.de',
];
```

Tests each URL and selects the first working one.

### Search Strategy

Default: Scrape both PURCHASE and RENT listings

```typescript
const marketingTypes = ['PURCHASE', 'RENT'];
```

Can be customized via `SearchOptions` interface.

### Pagination

Standard offset-based pagination:

```typescript
params: {
  profile: 'android',
  size: 20,        // Results per page
  from: 0,         // Starting offset
  sort: 'dateDesc' // Newest first
}
```

Continues until:
- Empty page received
- Total hits reached
- 3 consecutive errors

## Comparison with Reference Scrapers

### vs. SReality (Czech Republic)

**Similarities**:
- Express server setup
- Health check endpoint
- Batch ingestion
- IngestAdapter pattern
- Error handling approach

**Differences**:
- ImmoScout24: Direct API
- SReality: API + detail enrichment always on
- ImmoScout24: Auto-discovery
- SReality: Fixed base URL

### vs. BezRealitky (Czech Republic)

**Similarities**:
- Rate limiting pattern
- Retry logic
- Concurrent page fetching (optional)
- GraphQL-like structured queries

**Differences**:
- ImmoScout24: REST API
- BezRealitky: GraphQL API
- ImmoScout24: Sequential pagination
- BezRealitky: Parallel batch fetching

## Data Mapping

### Property Types

| ImmoScout24 | Standard | Notes |
|-------------|----------|-------|
| APARTMENT/Wohnung | apartment | Flats, condos |
| HOUSE/Haus | house | Single-family homes |
| LAND/Grundstück | land | Plots, lots |
| COMMERCIAL/Gewerbe | commercial | Offices, retail |
| GARAGE/Stellplatz | parking | Garages, parking spaces |

### Transaction Types

| ImmoScout24 | Standard | Notes |
|-------------|----------|-------|
| PURCHASE/Kauf | sale | For sale |
| RENT/Miete | rent | For rent |

### Energy Ratings

Direct mapping (A-G scale):
- A (most efficient) → 'a'
- G (least efficient) → 'g'

## Testing Strategy

### Manual Testing

1. **API Discovery**:
   ```bash
   curl https://api.immobilienscout24.de/api/psa/is24/properties/search?profile=android&size=1
   ```

2. **Search Test**:
   ```bash
   curl -H "Accept: application/json" \
        -H "User-Agent: ImmoScout24/5.0 (Android)" \
        "https://api.immobilienscout24.de/api/psa/is24/properties/search?profile=android&size=5&from=0&sort=dateDesc"
   ```

3. **Health Check**:
   ```bash
   curl http://localhost:8082/health
   ```

4. **Trigger Scrape**:
   ```bash
   curl -X POST http://localhost:8082/scrape
   ```

### Automated Testing

Future additions:

- Unit tests for transformers
- Integration tests for API client
- Mock API responses
- Type validation tests

## Performance Considerations

### Current Performance

At 2 req/sec:
- 100 properties: ~50 seconds
- 1,000 properties: ~8.3 minutes
- 10,000 properties: ~1.4 hours

### Optimization Options

1. **Increase rate limit** (if no throttling observed):
   ```typescript
   new RateLimiter(5) // 5 req/sec
   ```

2. **Parallel category scraping**:
   ```typescript
   await Promise.all(
     marketingTypes.map(type => scrapeCategory({ marketingType: type }))
   );
   ```

3. **Skip detail enrichment** (default, already optimized)

4. **Larger page sizes**:
   ```typescript
   const pageSize = 50; // Instead of 20
   ```

## Security Considerations

### API Access

- No authentication required (public API)
- No certificate pinning detected
- Standard TLS 1.2/1.3
- User-Agent rotation recommended

### Data Handling

- No personal data stored in scraper
- All data forwarded to ingest API
- GDPR compliance at ingest level
- No local data persistence

### Rate Limiting

- Conservative defaults
- Respects server resources
- Monitors consecutive errors
- Exponential backoff on failures

## Maintenance

### API Changes

Monitor for:

- Base URL changes
- Response structure changes
- New required parameters
- Authentication requirements
- Rate limiting implementation

### Update Strategy

1. Test API endpoints regularly
2. Monitor error logs
3. Update type definitions as needed
4. Adjust rate limits if throttled
5. Review robots.txt changes

## Future Enhancements

### Short Term

1. Add region/city filtering
2. Implement caching for detail responses
3. Add metrics/telemetry
4. Create comprehensive test suite

### Long Term

1. Support for saved searches
2. Real-time change detection
3. Price history tracking
4. Image download & storage
5. Webhook notifications

## Known Limitations

1. **No authentication**: Public API may have hidden rate limits
2. **API undocumented**: Response structure may change without notice
3. **No official support**: Breaking changes possible
4. **Limited filters**: Not all web filters available in API

## Resources

### Research Documents

- Main guide: `/GERMAN_AUSTRIAN_PORTALS_SCRAPING_GUIDE.md`
- API analysis: `/private/tmp/claude/.../ImmoScout24_API_Analysis.md`
- Test script: `/private/tmp/claude/.../test_immoscout24_api.py`

### Reference Implementations

- SReality: `/scrapers/Czech Republic/sreality/`
- BezRealitky: `/scrapers/Czech Republic/bezrealitky/`

### External Resources

- GitHub projects: asmaier/ImmoSpider, venthur/immoscrapy
- ScrapOps guide: immobilienscout24 scraping
- AVIV Group official API (alternative)

## Contact

For technical questions or issues:

1. Review this document
2. Check error logs
3. Test API manually
4. Consult research documents
5. Contact development team

---

**Last Updated**: February 7, 2026
**Version**: 1.0.0
**Status**: Production Ready
