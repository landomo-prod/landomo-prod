# vuokraovi-fi Scraper

Scraper for [vuokraovi.com](https://www.vuokraovi.com) — Finland's largest dedicated rental portal, owned by Alma Media and sharing backend infrastructure with etuovi.com (the "Valtti" platform). Covers approximately 30,000 residential rental listings at any given time.

## Overview

| Field | Value |
|---|---|
| Portal | vuokraovi.com |
| Country | Finland |
| Portal ID | `vuokraovi-fi` |
| Listing type | Rent only (pure rental portal) |
| Categories | `apartment`, `house` |
| Listing volume | ~30,000 residential + ~400 other |
| Scrape time | ~17 minutes |
| Port | 8232 |

## API Details

Vuokraovi exposes a JSON REST API without authentication. No browser session, cookies, or API key registration is required. Only the `X-PORTAL-IDENTIFIER: VUOKRAOVI` header must be present.

```
Base URL:  https://api.vuokraovi.com/distant/swordsman/v3
Endpoint:  POST /announcements/rental/search/listpage
Auth:      None (X-PORTAL-IDENTIFIER: VUOKRAOVI header only)
Infra:     AWS API Gateway + CloudFront (verified 2026-02-24)
```

### Request format

```json
{
  "locationSearchCriteria": {},
  "lessorType": "ALL",
  "publishingTimeSearchCriteria": "ANY_DAY",
  "propertyType": "RESIDENTIAL",
  "pagination": {
    "sortingOrder": { "property": "PUBLISHED_OR_UPDATED_AT", "direction": "DESC" },
    "firstResult": 0,
    "maxResults": 30,
    "page": 1
  },
  "residentialPropertyTypes": [],
  "rightOfOccupancy": "ALL",
  "newBuildingSearchCriteria": "ALL_PROPERTIES"
}
```

### Pagination

- Page size: 30 results per request (API maximum)
- `firstResult` = `(page - 1) * 30`
- Total count returned in `countOfAllResults`
- Strategy: fetch page 1 for total count, then remaining pages in parallel batches of 10 with 500ms delay between batches

## Source Files

```
src/
├── index.ts                                  # Express server, scrape orchestration
├── scrapers/
│   └── listingsScraper.ts                    # API fetch, pagination, concurrency
├── transformers/
│   ├── index.ts                              # Category router
│   ├── shared.ts                             # Image URL builder, room structure parser, availability mapper
│   ├── apartments/
│   │   └── apartmentTransformer.ts           # VuokrauviAnnouncement → ApartmentPropertyTierI
│   └── houses/
│       └── houseTransformer.ts               # VuokrauviAnnouncement → HousePropertyTierI
├── adapters/
│   └── ingestAdapter.ts                      # POST to Finland ingest API with retry
├── types/
│   └── vuokrauviTypes.ts                     # Full TypeScript type definitions for the API
└── utils/
    ├── categoryDetector.ts                   # propertySubtype → 'apartment' | 'house'
    └── userAgents.ts                         # User-agent rotation pool
```

## Property Categories

### Apartment subtypes (`property_category: 'apartment'`)

| API subtype | Finnish name | English |
|---|---|---|
| `APARTMENT_HOUSE` | Kerrostalo | Apartment block |
| `LOFT_HOUSE` | Luhtitalo | Corridor-access house |
| `WOODEN_HOUSE` | Puutalo-osake | Wooden apartment share |
| `OTHER` | Muu | Other (fallback) |

### House subtypes (`property_category: 'house'`)

| API subtype | Finnish name | English |
|---|---|---|
| `ROW_HOUSE` | Rivitalo | Row house |
| `SEMI_DETACHED` | Paritalo | Semi-detached |
| `DETACHED_HOUSE` | Omakotitalo | Detached house |

## Field Mappings

### Apartment (`ApartmentPropertyTierI`)

| Landomo field | Source field | Notes |
|---|---|---|
| `price` | `searchRent` | Monthly rent in EUR |
| `currency` | — | Hardcoded `'EUR'` |
| `transaction_type` | — | Hardcoded `'rent'` |
| `title` | `propertySubtype` + `addressLine2` | e.g. `"Kerrostalo - Helsinki"` |
| `location.address` | `addressLine1` | Street address |
| `location.city` | `addressLine2` (last word) | Split on space |
| `location.region` | `addressLine2` (all but last word) | District |
| `location.coordinates` | `latitude`, `longitude` | Present on most listings |
| `bedrooms` | `roomCount` via `ROOM_COUNT_MAP` | Rooms minus kitchen |
| `rooms` | `roomCount` | Total room count |
| `sqm` | `area` or `totalArea` | Living area in m² |
| `has_elevator` | `roomStructure` | Contains `'hissi'` |
| `has_balcony` | `roomStructure` | Contains `'parveke'` or `'terassi'` |
| `has_parking` | `roomStructure` | Contains `'autotalli'`, `'autopaikka'`, or `'autokatos'` |
| `has_basement` | `roomStructure` | Contains `'kellari'` or `'varastohuone'` |
| `year_built` | `constructionFinishedYear` | |
| `available_from` | `rentalAvailability` | See availability mapping below |
| `images` | `mainImageUri` | CloudFront URL at 1024x768 |
| `description` | `roomStructure` | Raw Finnish room structure string |
| `source_url` | `friendlyId` | `https://www.vuokraovi.com/vuokra-asunto/{friendlyId}` |
| `portal_id` | `id` | `vuokraovi-{id}` |
| `published_date` | `publishingTime` or `publishedOrUpdatedAt` | |
| `status` | — | Hardcoded `'active'` |

### House (`HousePropertyTierI`)

Same as apartment with the following differences:

| Landomo field | Source field | Notes |
|---|---|---|
| `sqm_living` | `area` or `totalArea` | (instead of `sqm`) |
| `sqm_plot` | — | Always `0` — not available from list API |
| `has_garden` | `roomStructure` | Contains `'puutarha'` or `'piha'` |
| `has_garage` | `roomStructure` | Contains `'autotalli'` |

### Tier II: Finland-specific fields (`country_specific`)

| Key | Source | Notes |
|---|---|---|
| `fi_building_type` | `propertySubtype` | Human-readable Finnish label (e.g. `'Kerrostalo'`) |
| `fi_room_structure` | `roomStructure` | Raw string, e.g. `"2H + K + S + p"` |
| `fi_room_count_enum` | `roomCount` | API enum value, e.g. `'TWO_ROOMS'` |
| `fi_new_building` | `newBuilding` | Boolean |
| `fi_right_of_occupancy` | `rightOfOccupancy` | Boolean — asumisoikeusasunto |
| `fi_has_sauna` | `roomStructure` | Parsed: `\bs\b` or `'sauna'` |
| `fi_furnished` | `roomStructure` | Parsed: `'kalusteet'` or `'kalustettu'` |
| `fi_office_id` | `office.id` | Listing agency/office ID |
| `fi_office_name` | `office.name` | Listing agency/office name |
| `fi_rental_availability_type` | `rentalAvailability.type` | `IMMEDIATELY`, `VACANCY`, `BY_AGREEMENT` |
| `fi_rental_vacancy_date` | `rentalAvailability.vacancyDate` | ISO date, present when type is `VACANCY` |

## Room Count Mapping

The API returns room counts as enums. Bedrooms are derived by subtracting 1 for the kitchen.

| API enum | Total rooms | Bedrooms |
|---|---|---|
| `ONE_ROOM` | 1 | 0 (studio) |
| `TWO_ROOMS` | 2 | 1 |
| `THREE_ROOMS` | 3 | 2 |
| `FOUR_ROOMS` | 4 | 3 |
| `FIVE_ROOMS` | 5 | 4 |
| `FIVE_ROOMS_OR_MORE` | 5+ | 5 |

## Room Structure Parsing

The `roomStructure` field (e.g. `"3H + K + S + p"`, `"2h, kk, khh, ph"`) is parsed to infer amenities. The string is not normalized — both abbreviations and full Finnish words appear.

| Signal | Detection |
|---|---|
| Sauna | `\bs\b` (standalone `s`) or `'sauna'` |
| Furnished | `'kalusteet'` or `'kalustettu'` |
| Balcony | `'parveke'`, `\bp\b`, or `'terassi'` |
| Elevator | `'hissi'` |
| Parking | `'autotalli'`, `'autopaikka'`, `'autokatos'` |
| Basement | `'kellari'`, `'varastohuone'` |
| Garden/yard | `'puutarha'`, `'piha'` (house only) |
| Garage | `'autotalli'` (house only) |

Common Finnish abbreviations in room structure strings:

| Abbreviation | Finnish | English |
|---|---|---|
| `h` | huone | room |
| `k` | keittiö | kitchen |
| `kk` | keittokomero | kitchenette |
| `s` | sauna | sauna |
| `p` | parveke | balcony |
| `t` | terassi | terrace |
| `ph` | pesuhuone | bathroom |
| `khh` | kylpyhuone | bathroom |

## Availability Mapping

`rentalAvailability.type` is mapped to `available_from`:

| API type | `available_from` |
|---|---|
| `IMMEDIATELY` | Today's ISO date |
| `VACANCY` | `vacancyDate` (ISO string from API) |
| `BY_AGREEMENT` | `undefined` |

## Image URLs

The API returns CloudFront image URIs with a `{imageParameters}` placeholder:

```
//d3ls91xgksobn.cloudfront.net/{imageParameters}/etuovimedia/images/rental/.../ORIGINAL.jpeg
```

The scraper substitutes `w_1024,h_768,c_limit` for full-size images. Thumbnails use `w_400,h_300,c_fill`.

## Scraping Strategy

1. Fetch page 1 to obtain `countOfAllResults`
2. Stream page 1 listings immediately to ingest
3. Calculate total pages: `ceil(total / 30)`
4. Fetch remaining pages in parallel batches of 10
5. After each batch: stream results to ingest, then wait 500ms
6. Ingest payloads are chunked at 500 properties per API call

The streaming/batching approach means ingest begins before scraping completes, reducing end-to-end latency.

## Ingest Adapter

Sends data to the Finland ingest service at `http://ingest-finland:3000`.

| Setting | Default | Env var |
|---|---|---|
| Ingest URL | `http://ingest-finland:3000` | `INGEST_API_URL` |
| API key | `dev_key_fi_1` | `INGEST_API_KEY` |
| Max retries | 3 | `MAX_RETRIES` |
| Initial retry delay | 1000ms | `INITIAL_RETRY_DELAY` |
| Request timeout | 60000ms | `INGEST_TIMEOUT` |

Retry logic: exponential backoff with jitter (max 30s), retries on network errors, 5xx, and 429. Non-retryable on 4xx (except 429).

## HTTP Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Returns `{"status":"healthy","scraper":"vuokraovi-fi","version":"1.0.0"}` |
| `POST` | `/scrape` | Triggers a scrape run asynchronously, returns 202 immediately |
| `GET` | `/metrics` | Prometheus metrics (via `setupScraperMetrics`) |

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `8232` | HTTP server port |
| `INGEST_API_URL` | `http://ingest-finland:3000` | Finland ingest API base URL |
| `INGEST_API_KEY` | `dev_key_fi_1` | Bearer token for ingest API |
| `MAX_RETRIES` | `3` | Max ingest retry attempts |
| `INITIAL_RETRY_DELAY` | `1000` | Initial backoff delay (ms) |
| `INGEST_TIMEOUT` | `60000` | Ingest HTTP request timeout (ms) |

## Docker

Built with a multi-stage Dockerfile. Build context must be the repository root (not the scraper directory) because `shared-components/` is copied in.

```bash
# Build from repo root
docker build -f scrapers/Finland/vuokraovi-fi/Dockerfile -t vuokraovi-fi .

# Run
docker run -p 8232:8232 \
  -e INGEST_API_URL=http://ingest-finland:3000 \
  -e INGEST_API_KEY=dev_key_fi_1 \
  vuokraovi-fi

# Trigger scrape
curl -X POST http://localhost:8232/scrape

# Health check
curl http://localhost:8232/health
```

## Known Limitations

- `sqm_plot` is always `0` for houses — the list API does not return plot area; a detail fetch would be required to obtain it.
- Only `RESIDENTIAL` property type is scraped. The ~400 `OTHER` listings (commercial/industrial rentals) are excluded.
- Amenity detection relies on free-text parsing of `roomStructure`. Listings with unusual formatting or missing room structure strings will have all amenity flags set to `false`.
- `bedrooms` for `FIVE_ROOMS_OR_MORE` is capped at 5 regardless of actual room count.
- Images: only the main image is captured per listing; additional images require a detail API call.
