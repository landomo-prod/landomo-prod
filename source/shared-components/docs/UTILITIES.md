# Shared Utilities

All utility functions exported from `@landomo/core`. Source files in `src/utils/`, `src/core-client/`, `src/scraper/`, `src/scrape-run-tracker.ts`, `src/logger.ts`, `src/tracing/setup.ts`, `src/services/geocoding.ts`, `src/metrics/`.

---

## Parsers (`src/utils/parsers.ts`)

### `parsePrice(priceText: string): number | undefined`
Parse price from various string formats. Removes currency symbols and thousand separators.

### `parsePriceCZK(priceText: string): number | undefined`
Parse Czech price format: `"5 500 000 Kc"` or `"5.500.000 Kc"`.

### `parsePriceEUR(priceText: string): number | undefined`
Parse EUR format: `"1,500,000EUR"` or `"1.500.000EUR"`.

### `parseArea(areaText: string): number | undefined`
Parse area in sqm. Strips `m2`, `sqm`, `sq m` suffixes.

### `parseRoomCount(text: string): number | undefined`
Extract integer room/bedroom/bathroom count from text.

### `normalizePropertyType(type: string): string`
Map portal-specific property types to standard values. Supports Czech (byt, dum), German (wohnung, haus), Italian, Spanish, French. Returns `'other'` for unknown types.

### `getCurrency(country: string): string`
Map country name to ISO 4217 currency code. Supports 30+ countries. Defaults to `'USD'`.

### `randomDelay(min: number, max: number): Promise<void>`
Sleep for random duration between min and max milliseconds.

### `sleep(ms: number): Promise<void>`
Sleep for specified milliseconds.

### `extractNumber(text: string): number | undefined`
Extract first numeric value from text (supports decimals and negatives).

### `parseCoordinates(input): {lat: number, lon: number} | undefined`
Parse coordinates from string (`"48.24,16.34"`) or object (`{lat, lon/lng/longitude}`). Validates ranges.

### `parseDate(dateInput): string | undefined`
Parse date from string, number (unix timestamp), or Date object. Supports ISO 8601, European `DD.MM.YYYY`, Czech `1. 3. 2024` formats. Returns ISO 8601 string.

### `normalizeAddress(address: string): string | undefined`
Trim whitespace, collapse multiple spaces, remove trailing commas.

---

## Normalization (`src/utils/normalization.ts`)

### `normalizeDisposition(disposition: string): string | undefined`
Normalize Czech room disposition format. Validates `1+KK` through `6+1` patterns.

### `normalizeOwnership(ownership: string): string | undefined`
Map ownership types to Czech standard values. Maps `'personal'`/`'private'` to `'Osobni'`, `'cooperative'` to `'Druzstevni'`, `'state'`/`'government'` to `'Statni'`.

### `normalizeCondition(condition: string): string | undefined`
Standardize property condition. Maps Czech terms (novy, vyborny, dobry, spatny) and English variants to canonical values: `new`, `excellent`, `good`, `fair`, `poor`, `renovated`.

### `normalizeFurnished(furnished: string): string | undefined`
Map furnished status to canonical values: `furnished`, `unfurnished`, `partially_furnished`. Handles Czech (vybaveny, nevybaveny, castecne), English, and boolean-like values.

### `normalizeEnergyRating(rating: string): string | undefined`
Normalize energy rating to single letter A-G. Handles Czech class names (`trida_a`, `class_a`).

### `normalizeHeatingType(heating: string): string | undefined`
Standardize heating types. Maps Czech terms and English variants to canonical values: `central_heating`, `individual_heating`, `boiler`, `electric_heating`, `heat_pump`, `solar_heating`, `fireplace`, `none`.

---

## Change Detection (`src/utils/change-detection.ts`)

### `detectChanges(oldData, newData, fieldsToCheck?): ChangeDetectionResult`
Compare old and new property data. Default fields checked: title, price, description, images, bedrooms, bathrooms, sqm, features, status. Returns `{hasChanges, fields, oldValues, newValues}`.

### `isPriceChangeSignificant(oldPrice, newPrice, thresholdPercent?): boolean`
Check if price changed by more than threshold (default 5%).

---

## Checksum (`src/utils/checksum.ts`)

### `generateChecksum(fields: ChecksumFields): string`
Generate SHA256 hash from key property fields (price, title, description, bedrooms, bathrooms, sqm). Used for change detection without fetching full details.

### `createListingChecksum(portal, portalId, listing, extractFields): ListingChecksum`
Create a checksum object from raw listing data using a custom field extractor function.

### `batchCreateChecksums(portal, listings, getPortalId, extractFields): ListingChecksum[]`
Batch create checksums from an array of listings.

---

## Validation (`src/utils/validation.ts`)

### `validateStandardProperty(property): ValidationResult`
Runtime validation of `StandardProperty` objects. Checks:
- Required fields: title (string), price (non-negative number), currency (string), property_type (string), transaction_type (sale/rent)
- Location: city and country required, coordinate range validation
- Details: non-negative bedrooms/bathrooms/sqm, year_built range (1000 to current+5)
- Status: must be active/removed/sold/rented
- source_url: must start with http(s)://

Returns `{valid: boolean, errors: ValidationError[]}`.

---

## Core Service Client (`src/core-client/api-client.ts`)

### `CoreServiceClient`
HTTP client for the ingest API. Constructor: `new CoreServiceClient(baseUrl?, apiKey?)`.

| Method | Description |
|--------|-------------|
| `ingestProperty(payload)` | POST single property to `/api/v1/properties/ingest` |
| `bulkIngest(portal, country, properties)` | POST batch to `/api/v1/properties/bulk-ingest` (60s timeout) |
| `healthCheck()` | GET `/api/v1/health` |

### Helper functions
- `sendToCoreService(payload)` -- Quick single-property ingest
- `sendBulkToCoreService(portal, country, properties)` -- Quick bulk ingest

---

## Checksum Client (`src/core-client/checksum-client.ts`)

### `ChecksumClient`
HTTP client for the checksum comparison API. Constructor: `new ChecksumClient(baseURL, apiKey)`.

| Method | Description |
|--------|-------------|
| `compareChecksums(checksums, scrapeRunId?)` | POST to `/api/v1/checksums/compare`. Returns `{new, changed, unchanged}` counts and per-listing results |
| `compareChecksumsInBatches(checksums, scrapeRunId?, batchSize?, onProgress?)` | Batch comparison (default 5000 per batch). Aggregates results across batches |
| `updateChecksums(checksums, scrapeRunId?)` | POST to `/api/v1/checksums/update`. Mark properties as seen after ingestion |
| `getStats(portal)` | GET `/api/v1/checksums/stats`. Returns total properties, last scraped, average change rate |

---

## Scrape Run Tracker (`src/scrape-run-tracker.ts`)

### `ScrapeRunTracker`
Best-effort lifecycle tracking via ingest API. All calls are non-blocking with 5s timeout. Constructor: `new ScrapeRunTracker(portal, {baseUrl?, apiKey?})`.

| Method | Description |
|--------|-------------|
| `start()` | POST `/api/v1/scrape-runs/start`. Returns run ID or null on failure |
| `complete(stats)` | POST `/api/v1/scrape-runs/{runId}/complete`. No-op if start failed |
| `fail()` | POST `/api/v1/scrape-runs/{runId}/fail`. No-op if start failed |
| `getRunId()` | Get current run ID (null if not started) |

---

## Base Scraper (`src/scraper/base-scraper.ts`)

### `BaseScraper` (abstract class)
Express server with health endpoint and scrape run lifecycle. Extend and implement `scrape()`.

| Method | Description |
|--------|-------------|
| `start()` | Launch HTTP server with `GET /health` and `POST /scrape` endpoints |
| `run()` | Execute full scrape: start tracker, call `scrape()`, send to ingest in batches, complete tracker |
| `scrape()` | **Abstract.** Implement to return `ScrapeResult[]` |
| `stop()` | Close HTTP server |

Config (`BaseScraperConfig`): `portal`, `country`, `port` (default PORT env or 3020), `ingestUrl`, `ingestApiKey`, `batchSize` (default 50), `httpClientOptions`.

---

## HTTP Client (`src/scraper/http-client.ts`)

### `HttpClient`
Axios-based HTTP client with retry, exponential backoff, and rate limiting.

| Method | Description |
|--------|-------------|
| `get(url, config?)` | GET with retry |
| `post(url, data?, config?)` | POST with retry |
| `getAxiosInstance()` | Access underlying axios instance |

Config (`HttpClientOptions`): `baseURL`, `timeout` (30s), `maxRetries` (3), `retryDelay` (1000ms), `retryMultiplier` (2), `headers`, `rateLimitMs` (0 = no limit), `userAgent`.

Retry behavior: Retries on network errors, 5xx, 429 (uses Retry-After header). Does not retry other 4xx. Applies jitter (10% of delay).

---

## Logger (`src/logger.ts`)

### `createLogger(opts: LoggerOptions): pino.Logger`
Create a Pino structured JSON logger. Automatically redacts sensitive fields: password, db_password, api_key, apiKey, authorization, token, redis.password, database.password.

Options: `service` (required), `country`, `portal`, `level` (default LOG_LEVEL env or `'info'`).

---

## Tracing (`src/tracing/setup.ts`)

### `initTracing(config: TracingConfig): void`
Initialize OpenTelemetry distributed tracing. Must be called before any other imports. Instruments: HTTP, Fastify, pg, ioredis. Ignores `/health` endpoints to reduce noise.

Config: `serviceName` (required), `serviceVersion`, `environment`, `otlpEndpoint` (default `http://jaeger:4317`), `enabled` (default true unless `OTEL_TRACING_ENABLED=false`).

### `shutdownTracing(): Promise<void>`
Manually shut down the tracing SDK.

---

## Geocoding (`src/services/geocoding.ts`)

### `geocodeAddress(address, country, redisConfig): Promise<GeocodingResult | null>`
Geocode an address using OpenStreetMap Nominatim. Features:
- Redis caching with 90-day TTL (negative results cached 7 days)
- Rate limiting: 1 request per 1.1 seconds
- 5-second request timeout
- Never throws (returns null on failure)
- Maps 12+ country names to ISO country codes for Nominatim filtering

### `buildAddressString(location): string | null`
Build address string from `{address?, city?, region?, country?}`. Returns `address` if present, otherwise joins available parts with commas.

---

## Prometheus Metrics (`src/metrics/scraper-metrics.ts`)

### `setupScraperMetrics(app: Express, portal: string): void`
Add `/metrics` endpoint and request tracking middleware to Express app. Collects default Node.js metrics with `landomo_scraper_` prefix.

### `scraperMetrics` object

| Metric | Type | Labels | Description |
|--------|------|--------|-------------|
| `httpRequestsTotal` | Counter | method, route, status | Total HTTP requests |
| `httpRequestDurationSeconds` | Histogram | method, route | Request duration |
| `scrapeDuration` | Histogram | portal, category | Full scrape run duration |
| `propertiesScraped` | Counter | portal, category, result | Properties scraped |
| `scrapeRuns` | Counter | portal, status | Scrape run count |
| `scrapeRunActive` | Gauge | portal | 1 if scrape running |
| `ingestBatchesSent` | Counter | portal, status | Batches sent to ingest |
| `ingestBatchDuration` | Histogram | portal | Batch send duration |
| `listingsFound` | Gauge | portal, category | Listings in last run |
| `lastRunTimestamp` | Gauge | portal | Unix timestamp of last run |
| `errorCount` | Counter | portal, error_type | Errors by type |
