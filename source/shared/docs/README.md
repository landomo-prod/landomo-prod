# @landomo/core (shared-components)

Shared TypeScript package providing types, utilities, and base classes for the Landomo scraper ecosystem. Published as `@landomo/core`. All exports are optional -- scrapers can use all, some, or none.

## Installation

```bash
npm install @landomo/core
# or link locally
npm link ../shared-components
```

## Package Info

- **Name:** `@landomo/core`
- **Main:** `dist/index.js`
- **Types:** `dist/index.d.ts`
- **Build:** `npm run build` (runs `tsc`)

## What This Package Exports

Everything is re-exported from `src/index.ts`:

### Types (`src/types/`)

- **Category Tier I types:** `ApartmentPropertyTierI`, `HousePropertyTierI`, `LandPropertyTierI`, `CommercialPropertyTierI`, `OtherPropertyTierI`
- **Type guards:** `isApartmentProperty()`, `isHouseProperty()`, `isLandProperty()`, `isCommercialProperty()`, `isOtherProperty()`
- **Base types:** `StandardProperty`, `PropertyLocation`, `PropertyDetails`, `PropertyMedia`, `PropertyImage`, `PropertyAgent`, `PropertyAmenities`, `RawProperty`
- **Ingestion types:** `IngestionPayload`, `IngestionResponse`, `ListingEvent`, `ScraperConfig`
- **Portal metadata:** `PortalMetadata`, `PortalUIConfig`
- **Country-specific Tier II:** `CzechSpecificFields`, `AustrianSpecificFields`, `GermanSpecificFields`, `SlovakSpecificFields`, `HungarianSpecificFields`, `FrenchSpecificFields`, `SpanishSpecificFields`, `UKSpecificFields`
- **Czech Tier II:** `CzechApartmentTierII`, `CzechHouseTierII`, `CzechLandTierII`
- **Database types:** from `src/types/database.ts`
- **Scraper types:** from `src/types/scraper.ts`
- **Boundary types:** from `src/types/boundary.ts`
- **ML pricing types:** from `src/types/ml-pricing.ts`

### Core Service Clients (`src/core-client/`)

- **`CoreServiceClient`** -- HTTP client for ingest API (single + bulk ingest, health check)
- **`ChecksumClient`** -- HTTP client for checksum comparison API (compare, batch compare, update, stats)
- Helper functions: `sendToCoreService()`, `sendBulkToCoreService()`

### Utilities (`src/utils/`)

- **Change detection:** `detectChanges()`, `isPriceChangeSignificant()`
- **Parsers:** `parsePrice()`, `parsePriceCZK()`, `parsePriceEUR()`, `parseArea()`, `parseRoomCount()`, `normalizePropertyType()`, `getCurrency()`, `randomDelay()`, `sleep()`, `extractNumber()`, `parseCoordinates()`, `parseDate()`, `normalizeAddress()`
- **Normalization:** `normalizeDisposition()`, `normalizeOwnership()`, `normalizeCondition()`, `normalizeFurnished()`, `normalizeEnergyRating()`, `normalizeHeatingType()`
- **Checksum:** `generateChecksum()`, `createListingChecksum()`, `batchCreateChecksums()`
- **Validation:** `validateStandardProperty()`

### Scraper Base Class (`src/scraper/`)

- **`BaseScraper`** -- Abstract base class with Express health endpoint, `ScrapeRunTracker` auto-wiring, batch ingest
- **`HttpClient`** -- HTTP client with retry, backoff, rate limiting

### Scrape Run Tracking (`src/scrape-run-tracker.ts`)

- **`ScrapeRunTracker`** -- Best-effort lifecycle tracking (start/complete/fail) via ingest API

### Logger (`src/logger.ts`)

- **`createLogger()`** -- Pino structured JSON logger with redaction of sensitive fields

### Tracing (`src/tracing/setup.ts`)

- **`initTracing()`** -- OpenTelemetry distributed tracing setup (HTTP, Fastify, pg, ioredis instrumentation)
- **`shutdownTracing()`** -- Manual shutdown

### Geocoding (`src/services/geocoding.ts`)

- **`geocodeAddress()`** -- Nominatim geocoding with Redis caching (90-day TTL) and rate limiting (1 req/sec)
- **`buildAddressString()`** -- Build address from location parts

### Prometheus Metrics (`src/metrics/`)

- **`setupScraperMetrics()`** -- Add `/metrics` endpoint and request tracking middleware to Express app
- **`scraperMetrics`** -- Pre-configured Prometheus counters, histograms, and gauges for scraper monitoring
- **`scraperRegistry`** -- prom-client registry

## Import Examples

```typescript
// Types
import { ApartmentPropertyTierI, HousePropertyTierI } from '@landomo/core';

// Utilities
import { parsePrice, normalizeCondition, generateChecksum } from '@landomo/core';

// Scraper base class
import { BaseScraper, HttpClient } from '@landomo/core';

// API clients
import { CoreServiceClient, ChecksumClient } from '@landomo/core';

// Scrape run tracking
import { ScrapeRunTracker } from '@landomo/core';

// Logger
import { createLogger } from '@landomo/core';

// Metrics
import { setupScraperMetrics, scraperMetrics } from '@landomo/core';
```

## Dependencies

- `axios` -- HTTP client (API clients, scrape run tracker)
- `pino` -- Structured JSON logging
- `prom-client` -- Prometheus metrics
- `redis` -- Redis client (geocoding cache)
- `pg` -- PostgreSQL client (database types)
- `bullmq` -- BullMQ types
- `@opentelemetry/*` -- Distributed tracing
