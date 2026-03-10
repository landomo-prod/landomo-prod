# API Reference

> Complete reference for types, interfaces, and API schemas

## Table of Contents

- [HTTP Endpoints](#http-endpoints)
- [TypeScript Types](#typescript-types)
- [SReality API Types](#sreality-api-types)
- [Transformation Types](#transformation-types)
- [Queue Types](#queue-types)

## HTTP Endpoints

### POST /scrape

Trigger a scrape run with optional category filtering.

**Request**:
```http
POST /scrape?categories=1,2 HTTP/1.1
Host: localhost:8102
Content-Type: application/json
```

**Query Parameters**:

| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| `categories` | string | Category filter | `1,2` or `critical` or `standard` |

**Category Filters**:
- `1,2,3,4,5` - Specific category IDs
- `critical` - Apartments and houses (1,2)
- `standard` - Land, commercial, other (3,4,5)
- *omitted* - All categories

**Response** (202 Accepted):
```json
{
  "status": "scraping started",
  "categories": "1,2",
  "timestamp": "2026-02-16T10:30:00.000Z"
}
```

**Error Responses**:
```json
// Invalid category
{
  "error": "Invalid category ID",
  "status": 400
}

// Scrape already running
{
  "error": "Scrape already in progress",
  "status": 409
}
```

### GET /health

Health check endpoint with queue statistics.

**Request**:
```http
GET /health HTTP/1.1
Host: localhost:8102
```

**Response** (200 OK):
```json
{
  "status": "healthy",
  "scraper": "sreality",
  "version": "2.0.0-queue",
  "workers": 200,
  "queue": {
    "waiting": 1250,
    "active": 200,
    "completed": 3450,
    "failed": 5
  },
  "timestamp": "2026-02-16T10:30:00.000Z"
}
```

**Status Values**:
- `healthy` - All systems operational
- `degraded` - Some workers failed, queue backed up
- `unhealthy` - Critical failure (Redis down, etc.)

### GET /metrics

Prometheus metrics endpoint.

**Request**:
```http
GET /metrics HTTP/1.1
Host: localhost:8102
```

**Response** (200 OK):
```
# HELP scraper_scrape_runs_total Total number of scrape runs
# TYPE scraper_scrape_runs_total counter
scraper_scrape_runs_total{portal="sreality",status="success"} 45
scraper_scrape_runs_total{portal="sreality",status="failure"} 2

# HELP scraper_scrape_duration_seconds Scrape duration in seconds
# TYPE scraper_scrape_duration_seconds histogram
scraper_scrape_duration_seconds_bucket{portal="sreality",category="all",le="600"} 40
scraper_scrape_duration_seconds_bucket{portal="sreality",category="all",le="900"} 45

# HELP scraper_properties_scraped_total Total properties scraped
# TYPE scraper_properties_scraped_total counter
scraper_properties_scraped_total{portal="sreality",category="all",result="success"} 98543

# HELP scraper_scrape_run_active Active scrape run indicator
# TYPE scraper_scrape_run_active gauge
scraper_scrape_run_active{portal="sreality"} 0
```

## TypeScript Types

### SRealityListing

Complete listing object from SReality API list endpoint.

**File**: `src/types/srealityApiTypes.ts:219`

```typescript
interface SRealityListing {
  // Basic fields
  name?: string;                    // Property title
  locality?: string;                // Location string
  price?: number;                   // Price in CZK
  new?: boolean;                    // New listing flag
  is_auction?: boolean;             // Auction listing
  auctionPrice?: number;            // Starting auction price
  hash_id?: number;                 // Unique listing ID
  region_tip?: number;              // Featured in region

  // Media flags
  has_panorama?: number;            // 1 = has virtual tour
  has_floor_plan?: number;          // 1 = has floor plan
  has_video?: number;               // 1 = has video

  // Marketing
  labels?: string[];                // ["Tip", "Novinka", "Exkluzivně"]
  exclusively_at_rk?: boolean;      // Exclusive to agency

  // Location
  gps?: SRealityGPS;                // Coordinates

  // Detail fields (from items array)
  items?: SRealityItemField[];      // Property characteristics

  // Price detail
  price_czk?: SRealityPrice;        // Price object with formatting
  price_note?: string;              // Price note (e.g., "Info o ceně v RK")

  // SEO
  seo?: SRealitySeo;                // Category and type codes

  // Meta
  advert_images_count?: number;     // Total images

  // HAL structure
  _links?: SRealityLinks;           // API links
  _embedded?: SRealityEmbedded;     // Embedded resources
}
```

### SRealityItemField

Structure of items in the SReality API items array.

**File**: `src/types/srealityApiTypes.ts:91`

```typescript
interface SRealityItemField {
  name: string;                     // Czech field name
  value: any;                       // Value (string, number, boolean, array, object)
  unit?: string;                    // Unit (e.g., "m²", "Kč")
  type?: 'string' | 'number' | 'boolean' | 'area' | 'set';
}
```

**Example**:
```json
{
  "name": "Užitná plocha",
  "value": "52",
  "unit": "m²",
  "type": "area"
}
```

### ChecksumFields

Fields extracted for checksum generation.

**File**: `src/utils/checksumExtractor.ts:15`

```typescript
interface ChecksumFields {
  price: number | null;             // Price in CZK
  title: string | null;             // Property title
  description: string | null;       // Full description
  bedrooms: number | null;          // Number of bedrooms
  bathrooms: number | null;         // Number of bathrooms
  sqm: number | null;               // Living area in m²
}
```

### ListingChecksum

Complete checksum object for comparison.

**File**: `@landomo/core` (shared-components)

```typescript
interface ListingChecksum {
  portal: string;                   // "sreality"
  portalId: string;                 // Listing ID (e.g., "12345678")
  contentHash: string;              // SHA-256 hash of ChecksumFields
  lastSeen?: Date;                  // Timestamp of last fetch
}
```

## SReality API Types

### Field Names Constants

Czech field names used in items array.

**File**: `src/types/srealityApiTypes.ts:12`

```typescript
const FIELD_NAMES = {
  // Area fields
  LIVING_AREA: 'Užitná plocha',
  LIVING_AREA_TRUNCATED: 'Užitná ploch',
  TOTAL_AREA: 'Celková plocha',
  PLOT_AREA: 'Plocha pozemku',
  BUILT_UP_AREA: 'Zastavěná plocha',

  // Outdoor spaces
  BALCONY: 'Balkón',
  BALCONY_ALT: 'Balkon',
  LOGGIA: 'Lodžie',
  TERRACE: 'Terasa',
  GARDEN: 'Zahrada',

  // Storage
  CELLAR: 'Sklep',
  BASEMENT: 'Suterén',

  // Building characteristics
  BUILDING_TYPE: 'Typ budovy',
  CONSTRUCTION: 'Stavba',
  FLOOR: 'Podlaží',
  TOTAL_FLOORS: 'Počet podlaží',

  // Property details
  DISPOSITION: 'Dispozice',
  CONDITION: 'Stav objektu',
  OWNERSHIP: 'Vlastnictví',
  FURNISHED: 'Vybavení',

  // Utilities
  HEATING: 'Vytápění',
  WATER: 'Voda',
  ELECTRICITY: 'Elektřina',
  GAS: 'Plyn',

  // Energy
  ENERGY_CLASS: 'Třída PENB',
  ENERGY_RATING: 'Energetická náročnost budovy',

  // Amenities
  ELEVATOR: 'Výtah',
  PARKING: 'Parkování',
  GARAGE: 'Garáž',

  // Land-specific
  ZONING: 'Druh pozemku',
  LAND_TYPE: 'Typ pozemku',
} as const;
```

### API Response Examples

**List Endpoint** (`/estates?page=1&per_page=100&category_main_cb=1`):

```json
{
  "_embedded": {
    "estates": [
      {
        "name": "Prodej bytu 2+kk 52 m²",
        "locality": "Praha 10",
        "price": 5500000,
        "hash_id": 12345678,
        "price_czk": {
          "value_raw": 5500000,
          "name": "5 500 000 Kč"
        },
        "seo": {
          "category_main_cb": 1,
          "category_type_cb": 1,
          "category_sub_cb": "byt-2-kk"
        },
        "gps": {
          "lat": 50.0755,
          "lon": 14.4378
        },
        "labels": ["Tip", "Novinka"],
        "has_floor_plan": 1,
        "has_video": 0,
        "advert_images_count": 12,
        "_links": {
          "self": {
            "href": "https://www.sreality.cz/api/cs/v2/estates/12345678"
          }
        }
      }
    ]
  },
  "result_size": 58742,
  "_links": {
    "self": {
      "href": "https://www.sreality.cz/api/cs/v2/estates?page=1"
    }
  }
}
```

**Detail Endpoint** (`/estates/12345678`):

```json
{
  "name": "Prodej bytu 2+kk 52 m²",
  "hash_id": 12345678,
  "price_czk": {
    "value_raw": 5500000,
    "name": "5 500 000 Kč"
  },
  "items": [
    {
      "name": "Užitná plocha",
      "value": "52",
      "unit": "m²",
      "type": "area"
    },
    {
      "name": "Balkón",
      "value": "6 m²",
      "type": "area"
    },
    {
      "name": "Výtah",
      "value": true,
      "type": "boolean"
    },
    {
      "name": "Parkování",
      "value": "vlastní",
      "type": "string"
    }
  ],
  "text": {
    "value": "Nabízíme k prodeji moderní byt 2+kk..."
  },
  "_embedded": {
    "images": [
      {
        "_links": {
          "dynamicDown": {
            "href": "https://img.sreality.cz/thumb/400x300/hash.jpg"
          },
          "dynamicUp": {
            "href": "https://img.sreality.cz/thumb/800x600/hash.jpg"
          },
          "gallery": {
            "href": "https://img.sreality.cz/hash.jpg"
          }
        },
        "order": 1
      }
    ]
  }
}
```

## Transformation Types

### ApartmentPropertyTierI

Output type for apartment transformers.

**File**: `@landomo/core/src/types/ApartmentPropertyTierI.ts`

```typescript
interface ApartmentPropertyTierI {
  // Category
  property_category: 'apartment';

  // Core fields
  title: string;
  price: number;
  currency: string;
  transaction_type: 'sale' | 'rent';

  // Location
  location: {
    city?: string;
    country: string;
    coordinates?: { lat: number; lon: number };
  };

  // Apartment-specific (REQUIRED)
  bedrooms: number;
  sqm: number;
  has_elevator: boolean;
  has_balcony: boolean;
  has_parking: boolean;
  has_basement: boolean;

  // Optional apartment fields
  bathrooms?: number;
  floor?: number;
  total_floors?: number;
  balcony_area?: number;
  has_loggia?: boolean;
  loggia_area?: number;
  has_terrace?: boolean;
  terrace_area?: number;
  has_garage?: boolean;
  cellar_area?: number;

  // Building context
  year_built?: number;
  construction_type?: 'panel' | 'brick' | 'concrete' | 'mixed';
  condition?: 'new' | 'excellent' | 'good' | 'after_renovation' | 'requires_renovation';
  heating_type?: string;
  energy_class?: string;
  floor_location?: 'ground_floor' | 'middle_floor' | 'top_floor';
  rooms?: number;

  // Tier 1 Universal Fields
  furnished?: 'furnished' | 'partially_furnished' | 'not_furnished';
  renovation_year?: number;
  published_date?: string;

  // Media
  media?: {
    images?: string[];
    total_images?: number;
  };
  description?: string;
  features?: string[];

  // Tier II: Country-Specific
  country_specific?: {
    czech?: {
      disposition?: string;          // "2+kk", "3+1"
      ownership?: string;             // "personal", "cooperative"
      condition?: string;             // Normalized condition
      heating_type?: string;          // Normalized heating
      energy_rating?: string;         // "A", "B", "C", etc.
      furnished?: string;             // Normalized furnished
      construction_type?: string;     // Normalized construction
    };
  };

  // Tier III: Portal Metadata
  portal_metadata?: {
    sreality?: {
      hash_id?: number;
      category_main_cb?: number;
      labels?: string[];
      is_auction?: boolean;
      has_floor_plan?: boolean;
      has_video?: boolean;
      virtual_tour_url?: string;
    };
  };

  // Source
  source_url: string;
  source_platform: string;
  portal_id: string;
  status: 'active' | 'removed' | 'sold' | 'rented';
}
```

## Queue Types

### DetailJob

Job data for BullMQ queue.

**File**: `src/queue/detailQueue.ts:37`

```typescript
interface DetailJob {
  hashId: number;                   // SReality listing ID
  category: number;                 // Category ID (1-5)
  url: string;                      // Detail API URL
}
```

**Example**:
```json
{
  "hashId": 12345678,
  "category": 1,
  "url": "https://www.sreality.cz/api/cs/v2/estates/12345678"
}
```

### EstateDetailResult

Result from detail fetch operation.

**File**: `src/utils/fetchData.ts:44`

```typescript
interface EstateDetailResult {
  data?: any;                       // SReality detail response
  isInactive: boolean;              // True if listing removed
  inactiveReason?: 'http_410' | 'logged_in_false';
}
```

**Example (active)**:
```json
{
  "data": { /* SReality detail response */ },
  "isInactive": false
}
```

**Example (inactive)**:
```json
{
  "isInactive": true,
  "inactiveReason": "http_410"
}
```

### PhaseStats

Statistics from three-phase orchestration.

**File**: `src/scraper/threePhaseOrchestrator.ts:10`

```typescript
interface PhaseStats {
  phase1: {
    categoriesProcessed: number;    // Categories fetched (10)
    totalListings: number;          // Total discovered (~100k)
    durationMs: number;             // Time taken (120-180s)
  };
  phase2: {
    totalChecked: number;           // Checksums compared (~100k)
    new: number;                    // New listings (~5k)
    changed: number;                // Changed listings (~5k)
    unchanged: number;              // Unchanged (~90k)
    savingsPercent: number;         // Savings % (~90%)
    durationMs: number;             // Time taken (10-30s)
  };
  phase3: {
    queued: number;                 // Jobs queued (~10k)
    durationMs: number;             // Time taken (1-2s)
  };
}
```

## Error Types

### Transform Error

Thrown when transformation fails.

```typescript
class TransformError extends Error {
  constructor(
    message: string,
    public listingId: number,
    public category: string,
    public cause?: Error
  ) {
    super(message);
    this.name = 'TransformError';
  }
}
```

### Fetch Error

Thrown when API fetch fails.

```typescript
class FetchError extends Error {
  constructor(
    message: string,
    public url: string,
    public statusCode?: number,
    public cause?: Error
  ) {
    super(message);
    this.name = 'FetchError';
  }
}
```
