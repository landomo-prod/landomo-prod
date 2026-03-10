# kiinteistomaailma-fi Scraper

Scraper for [Kiinteistömaailma.fi](https://www.kiinteistomaailma.fi), Finland's largest residential real estate agency chain. Covers for-sale and rental listings across apartments, houses, and land plots.

## Portal Overview

| Field | Value |
|-------|-------|
| Portal | Kiinteistömaailma.fi |
| Country | Finland |
| Language | Finnish |
| Listing types | For sale, Rental |
| Property categories | Apartment, House, Land (Commercial: reserved/unused) |
| Total listings (Feb 2026) | ~6,696 (~6,278 for sale, ~418 rental) |
| Auth required | No — public REST API |
| Expected runtime | 2–5 minutes |
| Port | 8234 |

---

## Architecture

```
index.ts
  └── ListingsScraper (listingsScraper.ts)
        ├── fetchPage()          GET /api/km/KM/?rental=false  (for-sale)
        └── fetchPage()          GET /api/km/KM/?rental=true   (rental)
              ↓ KMListing[]
  └── transformKMListing (transformers/index.ts)
        ├── detectCategory()     → apartment / house / land / commercial
        ├── transformKMApartment → ApartmentPropertyTierI
        ├── transformKMHouse     → HousePropertyTierI
        ├── transformKMLand      → LandPropertyTierI
        └── transformKMCommercial → CommercialPropertyTierI (safeguard only)
              ↓ TierI property
  └── IngestAdapter (ingestAdapter.ts)
        └── POST /api/v1/properties/bulk-ingest  (ingest-finland:3000)
```

---

## API

**Endpoint:** `GET https://www.kiinteistomaailma.fi/api/km/KM/`

No authentication required. The API is publicly accessible.

### Query Parameters

| Parameter | Value used | Description |
|-----------|-----------|-------------|
| `areaType` | `living` | Always fixed |
| `limit` | `100` | Page size (max 100) |
| `offset` | incremented | Pagination offset |
| `rental` | `true` / `false` | Toggles for-sale vs rental |
| `sort` | `latestPublishTimestamp` | Sort field |
| `sortOrder` | `desc` | Newest first |
| `type` | `property` | All property types |
| `maxArea`, `minArea` | `` (empty) | No area filter |
| `maxYearBuilt`, `minYearBuilt` | `` (empty) | No year filter |

### Response Structure

```json
{
  "success": true,
  "data": {
    "matches": 6278,
    "minPrice": 10000,
    "maxPrice": 4900000,
    "results": [ /* KMListing[] */ ]
  }
}
```

---

## Scraping Strategy

The scraper processes two targets sequentially:

1. **For-sale listings** (`rental=false`) — ~6,278 listings
2. **Rental listings** (`rental=true`) — ~418 listings

For each target:
- Fetches page 0 to determine total `matches`
- Builds remaining page offsets
- Fetches up to **5 pages concurrently** (`CONCURRENT_PAGES=5`)
- Streams each batch via the `onBatch` callback as pages arrive
- Waits **300 ms** between concurrent batches (`DELAY_BETWEEN_BATCHES_MS`)
- Waits **1,000 ms** between the two targets (`DELAY_BETWEEN_TARGETS_MS`)

Page failures are logged and skipped — the scrape continues with remaining pages. Target failures are also caught and logged so the second target still runs.

### Ingest Batching

Transformed listings are chunked at **500 properties per API call** (`CHUNK_SIZE=500`) before being sent to the ingest service.

---

## Property Type Codes

The `type` field in each listing is a two-letter Finnish property code:

| Code | Finnish | English | Category |
|------|---------|---------|----------|
| `KT` | Kerrostalo | Apartment block | `apartment` |
| `RT` | Rivitalo | Row house | `house` |
| `PT` | Paritalo | Semi-detached | `house` |
| `OT` | Omakotitalo | Detached / single-family | `house` |
| `ET` | Erillistalo | Detached variant | `house` |
| `MO` | Mökki/Huvila | Cottage / villa | `house` |
| `TO` | Tontti | Land plot | `land` |

**Group codes** provide secondary classification:

| Code | Finnish | Meaning |
|------|---------|---------|
| `As` | Asunto | Apartment or house — use `type` code |
| `To` | Tontti | Land plot → `land` |
| `Va` | Vapaa-ajan asunto | Vacation property → `house` |

### Category Detection Logic (`categoryDetector.ts`)

1. `group === 'To'` OR `type === 'TO'` → `land`
2. `type === 'KT'` → `apartment`
3. `type` in `{RT, PT, OT, ET, MO}` → `house`
4. `group === 'Va'` → `house`
5. `isApartment === true` → `apartment`
6. Default fallback → `apartment`

---

## Field Mapping

### Shared Utilities (`transformers/shared.ts`)

| Helper | Output | Notes |
|--------|--------|-------|
| `buildPortalId(listing)` | `"kiinteistomaailma-{key}"` | Unique ID |
| `buildLocation(listing)` | `PropertyLocation` | Coords: GeoJSON `[lon, lat]` → `{lat, lon}` |
| `buildMedia(listing)` | `PropertyMedia` | MAIN + NORMAL images, GROUND_PLAN as floor plan, video URL |
| `buildImageUrls(listing)` | `string[]` | MAIN + NORMAL images as URL array |
| `buildTitle(listing, typeName)` | `string` | `"Kerrostalo, 3h+k, 65 m², Kallio"` pattern |
| `resolvePrice(listing)` | `number \| undefined` | Rental → `rentPerMonth`; Sale → `salesPriceUnencumbered ?? salesPrice` |
| `deriveBedrooms(roomAmount)` | `number \| undefined` | `roomAmount - 1` (Finnish rooms include living room) |
| `buildFeatures(listing)` | `string[]` | See feature tags below |

**Image URL pattern:** `https://www.kiinteistomaailma.fi/km/images{image.path}/{image.name}`

**Feature tags generated:**

| Tag | Condition |
|-----|-----------|
| `new_construction` | `listing.newConstruction === true` |
| `online_offer` | `listing.onlineOffer === true` |
| `value_listing` | `listing.valueListing === true` |
| `viewing_scheduled` | `listing.openHouses.length > 0` |
| `video_tour` | `listing.videoPresentationUrl` is set |
| `vacation_property` | `listing.group === 'Va'` (house transformer only) |

### Apartment Transformer (`ApartmentPropertyTierI`)

| TierI field | Source | Notes |
|-------------|--------|-------|
| `property_category` | `'apartment'` | Fixed |
| `price` | `resolvePrice()` | Debt-free price preferred |
| `currency` | `'EUR'` | Fixed |
| `transaction_type` | `rental ? 'rent' : 'sale'` | |
| `bedrooms` | `deriveBedrooms(roomAmount)` | `roomAmount - 1` |
| `sqm` | `livingArea` | Living area in m² |
| `has_elevator` | `false` | Not in list-level API |
| `has_balcony` | `false` | Not in list-level API |
| `has_parking` | `false` | Not in list-level API |
| `has_basement` | `false` | Not in list-level API |
| `rooms` | `roomAmount` | All rooms (Finnish convention) |
| `deposit` | `rentInfo.deposit` | Rental only |

### House Transformer (`HousePropertyTierI`)

| TierI field | Source | Notes |
|-------------|--------|-------|
| `property_category` | `'house'` | Fixed |
| `bedrooms` | `deriveBedrooms(roomAmount)` | `roomAmount - 1` |
| `sqm_living` | `livingArea` | Living area in m² |
| `sqm_plot` | `landOwnership.landArea_m2` | Plot area in m² |
| `has_garden` | `false` | Not in list-level API |
| `has_garage` | `false` | Not in list-level API |
| `has_parking` | `false` | Not in list-level API |
| `has_basement` | `false` | Not in list-level API |

### Land Transformer (`LandPropertyTierI`)

| TierI field | Source | Notes |
|-------------|--------|-------|
| `property_category` | `'land'` | Fixed |
| `transaction_type` | `'sale'` | Land plots are always for sale |
| `area_plot_sqm` | `landOwnership.landArea_m2 ?? housingCompany.area` | Fallback chain |

### Commercial Transformer (`CommercialPropertyTierI`)

Commercial properties are not present in the Kiinteistömaailma API (residential-only chain). This transformer exists as a safeguard in case future API changes introduce commercial listings.

| TierI field | Source |
|-------------|--------|
| `sqm_total` | `totalArea ?? livingArea` |
| `has_elevator` | `false` |
| `has_parking` | `false` |
| `has_bathrooms` | `false` |

---

## Country-Specific Fields (`country_specific` JSONB)

All categories store Finnish-specific data in the `country_specific` JSONB column with `fi_` prefix:

| Field | Type | Description |
|-------|------|-------------|
| `fi_key` | string | Kiinteistömaailma listing key |
| `fi_type_code` | string | Raw type code (KT, RT, PT, etc.) |
| `fi_group_code` | string | Raw group code (As, To, Va) |
| `fi_room_types` | string | Room configuration string (e.g. `"3h + k + s"`) |
| `fi_new_construction` | boolean | New construction flag |
| `fi_online_offer` | boolean | Online offer/purchase available |
| `fi_postcode` | string | Finnish postal code |
| `fi_municipality` | string | Municipality name |
| `fi_county` | string | County name |
| `fi_total_area_sqm` | number | Total area including common areas |
| `fi_housing_company_area` | number | Housing company shared area (m²) |
| `fi_land_area_ha` | number | Plot area in hectares (houses/land) |
| `fi_sales_price` | number | Asking price (may include housing company debt) |
| `fi_sales_price_unencumbered` | number | Debt-free asking price |
| `fi_rent_per_month` | number | Monthly rent (rentals only) |
| `fi_rent_deposit` | number | Rental deposit |
| `fi_rent_contract_time` | string | Contract duration description |
| `fi_open_houses_count` | number | Number of scheduled open houses |

---

## Finnish Price Convention

Finnish apartments often have a split price structure due to housing company loans:

- **`salesPrice`** — the asking price the buyer pays to the seller. May be lower because part of the property's value sits in housing company debt.
- **`salesPriceUnencumbered`** — the debt-free (velaton) price, representing total cost including the buyer's share of housing company debt.

The scraper uses `salesPriceUnencumbered` as the canonical `price` field, falling back to `salesPrice` when unencumbered price is not available.

---

## Room Count Convention

Finnish real estate counts rooms differently from most European markets:

- `roomAmount = 3` typically means `"3h + k"` (2 bedrooms + living room + kitchen)
- `bedrooms = roomAmount - 1` is an approximation (subtracts one room for the living area)
- The raw `roomTypes` string (e.g. `"3h + k + s"`) is preserved in `fi_room_types` for exact interpretation

---

## Portal ID Format

```
kiinteistomaailma-{listing.key}
```

Example: `kiinteistomaailma-1409481`

The `key` is Kiinteistömaailma's internal listing identifier, stable for the lifetime of the listing.

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8234` | HTTP server port |
| `INGEST_API_URL` | `http://ingest-finland:3000` | Finland ingest service URL |
| `INGEST_API_KEY` | `dev_key_fi_1` | Bearer token for ingest API |
| `INGEST_API_KEY_KIINTEISTOMAAILMA_FI` | — | Portal-specific key override |
| `MAX_RETRIES` | `3` | Ingest retry attempts |
| `INITIAL_RETRY_DELAY` | `1000` | Initial retry backoff (ms) |
| `INGEST_TIMEOUT` | `60000` | Ingest request timeout (ms) |

---

## HTTP Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Health check — returns `200` with status, version, timestamp |
| `POST` | `/scrape` | Trigger a scrape run — returns `202` immediately, runs async |
| `GET` | `/metrics` | Prometheus metrics (via `setupScraperMetrics`) |

---

## Ingest Adapter

Posts to `POST /api/v1/properties/bulk-ingest` with:

```json
{
  "portal": "kiinteistomaailma-fi",
  "country": "fi",
  "scrape_run_id": "...",
  "properties": [
    {
      "portal_id": "kiinteistomaailma-1409481",
      "data": { /* TierI property object */ },
      "raw_data": { /* original KMListing */ }
    }
  ]
}
```

**Retry policy:** Exponential backoff with jitter. Retries on network errors, HTTP 5xx, and HTTP 429. Non-retryable errors (4xx except 429) fail immediately. Max delay capped at 30 seconds.

---

## Docker

**Build context:** Repository root (requires `shared-components/` at build time).

```dockerfile
EXPOSE 8234
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3
```

Build example (from repository root):

```bash
docker build -f scrapers/Finland/kiinteistomaailma-fi/Dockerfile -t kiinteistomaailma-fi .
```

---

## Known Limitations

1. **Amenity flags not available from list-level API.** Fields `has_elevator`, `has_balcony`, `has_parking`, `has_basement`, `has_garden`, `has_garage` default to `false`. Accurate values would require fetching individual detail pages (not implemented — would increase runtime significantly).

2. **`published_date` not available** from the list-level API response. Set to `undefined`.

3. **Bedroom count is approximate.** `bedrooms = roomAmount - 1` follows Finnish convention but may be off by one for some property configurations (e.g. studios, properties without a separate kitchen).

4. **No commercial listings.** Kiinteistömaailma is a residential-only chain. The commercial transformer is a forward-compatibility safeguard only.

5. **No checksum/change detection.** Every scrape re-fetches and re-ingests all ~6,696 listings. Given the small dataset and 2–5 minute runtime, this is acceptable.

---

## File Structure

```
scrapers/Finland/kiinteistomaailma-fi/
├── Dockerfile
├── package.json
├── tsconfig.json
├── docs/
│   └── README.md                          # This file
└── src/
    ├── index.ts                           # Express server + scrape orchestration
    ├── adapters/
    │   └── ingestAdapter.ts               # POST to ingest service with retry
    ├── scrapers/
    │   └── listingsScraper.ts             # Parallel page fetching
    ├── transformers/
    │   ├── index.ts                       # Category routing entry point
    │   ├── shared.ts                      # Shared builder utilities
    │   ├── apartments/
    │   │   └── apartmentTransformer.ts    # KMListing → ApartmentPropertyTierI
    │   ├── houses/
    │   │   └── houseTransformer.ts        # KMListing → HousePropertyTierI
    │   ├── land/
    │   │   └── landTransformer.ts         # KMListing → LandPropertyTierI
    │   └── commercial/
    │       └── commercialTransformer.ts   # KMListing → CommercialPropertyTierI
    ├── types/
    │   └── kiinteistomaailmaTypes.ts      # KMListing, KMSearchResponse, etc.
    └── utils/
        ├── categoryDetector.ts            # type/group → category mapping
        └── userAgents.ts                  # Random UA rotation
```
