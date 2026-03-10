# nybolig-dk Scraper

Scraper for [nybolig.dk](https://www.nybolig.dk), one of Denmark's largest real estate portals covering for-sale and for-rent listings across all property categories.

## Overview

| Field | Value |
|---|---|
| Portal | nybolig.dk |
| Country | Denmark |
| Currency | DKK |
| Categories | apartment, house, land, commercial |
| Transport | REST JSON API (axios) |
| Pagination | Cursor-based (scrollToken) |
| Default Port | 8201 |

## Architecture

```
index.ts (Express)
  └── listingsScraper.ts         # Pagination loop, batching, stats
        ├── transformers/index.ts # Category dispatch
        │     ├── apartments/apartmentTransformer.ts
        │     ├── houses/houseTransformer.ts
        │     ├── land/landTransformer.ts
        │     └── commercial/commercialTransformer.ts
        ├── utils/categoryDetector.ts
        ├── utils/userAgents.ts
        └── adapters/ingestAdapter.ts
```

## API

The scraper targets a single nybolig.dk internal JSON endpoint:

```
POST https://www.nybolig.dk/api/search/cases/find
```

**Request body:**

```json
{
  "siteName": "nybolig",
  "top": 100,
  "scrollToken": "<cursor or empty string>",
  "isRental": false
}
```

**Response:**

```json
{
  "results": 100,
  "total": 14832,
  "scrollToken": "<next-cursor>",
  "cases": [ ... ]
}
```

Pagination terminates when:
- `cases` array is empty, or
- `scrollToken` is absent or falsy, or
- the page returned fewer results than `PAGE_SIZE` (100).

## Scrape Flow

1. Two scrape modes run sequentially: `for-sale` then `for-rent`.
2. Each mode loops through pages using cursor-based pagination with a configurable delay (default 300 ms).
3. Raw cases accumulate in a buffer; when the buffer reaches 500 listings it is flushed as a batch to the ingest API.
4. After pagination ends, any remaining buffered listings are flushed.
5. `ScrapeRunTracker` records a scrape-run start/complete/fail event against the portal in the ingest service.

```
for-sale mode:
  page 1 → page 2 → ... → buffer flush → page N → final flush

for-rent mode:
  page 1 → page 2 → ... → buffer flush → page N → final flush
```

## Category Detection

`utils/categoryDetector.ts` maps the API `type` field to a Landomo category using `TYPE_TO_CATEGORY` from `nyboligTypes.ts`. If the `type` field is unrecognised, it falls back to parsing the URL path slug.

| Nybolig type | Landomo category |
|---|---|
| Condo, HousingCooperative, VillaApartment, Ejerlejlighed, Andelsbolig, Villalejlighed, Lejlighed | apartment |
| Villa, TerracedHouse, VacationHousing, FarmHouse, Rækkehus, Fritidshus, Sommerhus, Landejendom, Liebhaveri | house |
| AllYearRoundPlot, VacationPlot, Helårsgrund, Fritidsgrund, Grund | land |
| Erhverv | commercial |

Unknown types default to `house`.

## Transformers

All four transformers share the same structural pattern:

- `property_category` set to the appropriate constant.
- `title` constructed as `"<type>: <addressDisplayName>"`.
- `price` set from `cashPrice` (sale) or `rent` (rental); `transaction_type` set accordingly.
- `currency` is always `"DKK"`.
- `location` includes `country: "Denmark"`, city and postal code parsed from `addressSecondLine`, and coordinates from `addressLatitude`/`addressLongitude` when present.
- `source_url` is `https://www.nybolig.dk` + `listing.url`.
- `source_platform` is `"nybolig-dk"`.
- `portal_id` uses `caseNumber` with fallback to `id`.
- `status` is always `"active"`.

### Apartment (`ApartmentPropertyTierI`)

| Landomo field | Source |
|---|---|
| `bedrooms` | `totalNumberOfRooms - 1` (min 0) |
| `sqm` | `livingSpace` |
| `floor` | `floor` |
| `rooms` | `totalNumberOfRooms` |
| `has_basement` | `basementSize > 0` |
| `has_elevator` | `false` (not in API) |
| `has_balcony` | `false` (not in API) |
| `has_parking` | `false` (not in API) |
| `energy_class` | `energyClassification` |

### House (`HousePropertyTierI`)

| Landomo field | Source |
|---|---|
| `bedrooms` | `totalNumberOfRooms - 1` (min 0) |
| `sqm_living` | `livingSpace` |
| `sqm_plot` | `plotSizeHa * 10000` (ha → m²) |
| `has_garden` | `sqm_plot > 0` |
| `has_basement` | `basementSize > 0` |
| `has_garage` | `false` (not in API) |
| `has_parking` | `false` (not in API) |
| `energy_class` | `energyClassification` |

FarmHouse is detected via `type === "FarmHouse"` or `/landejendom/` in the URL and flagged in `country_specific.is_farmhouse`.

### Land (`LandPropertyTierI`)

| Landomo field | Source |
|---|---|
| `area_plot_sqm` | `plotSizeHa * 10000`; fallback to `propertySize` |
| `transaction_type` | always `"sale"` |

### Commercial (`CommercialPropertyTierI`)

| Landomo field | Source |
|---|---|
| `sqm_total` | `livingSpace`; fallback to `propertySize` |
| `has_elevator` | `false` (not in API) |
| `has_parking` | `false` (not in API) |
| `has_bathrooms` | `false` (not in API) |
| `energy_class` | `energyClassification` |

### country_specific JSONB

All categories populate a `country_specific` object stored in the JSONB column. Common fields:

| Field | Description |
|---|---|
| `case_number` | Nybolig case number |
| `nybolig_id` | Internal portal UUID |
| `site_name` | Always `"nybolig"` |
| `type_name` | Raw type string from API |
| `energy_classification` | Raw energy label |
| `is_new` | New listing flag |
| `is_rental` | Rental vs. sale flag |
| `open_house_text` | Open house schedule text (apartment, house) |
| `floor_side` | Floor/side descriptor (apartment, house) |
| `property_size_sqm` | Total property size (apartment, house, commercial) |
| `basement_size_sqm` | Basement size in m² (apartment, house) |
| `farmbuildings_size_sqm` | Farm buildings size (house only) |
| `plot_size_ha` | Plot size in hectares (house, land) |
| `is_farmhouse` | Boolean farmhouse flag (house only) |

## Ingest Adapter

`adapters/ingestAdapter.ts` posts batches to the ingest service:

```
POST {INGEST_API_URL}/api/v1/properties/bulk-ingest
Authorization: Bearer {INGEST_API_KEY}
```

Retries up to 3 times with exponential backoff (1 s, 2 s, 4 s) on network errors or 5xx responses. Non-retryable errors (4xx) are thrown immediately.

## HTTP Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Liveness check; returns `{ status: "healthy", scraper, country, version }` |
| `POST` | `/scrape` | Trigger a scrape run asynchronously; returns `202 Accepted` immediately |

A concurrency guard prevents overlapping runs: if a scrape is already in progress the new request is a no-op.

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `8201` | HTTP server port |
| `INGEST_API_URL` | `http://ingest-denmark:3000` | Base URL of the ingest service |
| `INGEST_API_KEY` | `dev_key_dk_1` | Bearer token for the ingest API |
| `INSTANCE_COUNTRY` | `dk` | Country code sent to ingest |
| `REQUEST_DELAY_MS` | `300` | Delay between paginated API requests (ms) |

## Docker

Built from the repo root (build context `../../..` relative to the scraper directory):

```bash
# From repo root
docker build -f scrapers/Denmark/nybolig-dk/Dockerfile -t nybolig-dk .
docker run -p 8201:8201 \
  -e INGEST_API_URL=http://ingest-denmark:3000 \
  -e INGEST_API_KEY=your_key \
  nybolig-dk
```

The Dockerfile uses a two-stage build: the first stage compiles shared-components and the scraper TypeScript; the second stage installs production-only dependencies and runs the compiled output.

The container exposes port `8201` and has a healthcheck polling `GET /health` every 30 seconds.

## Known Limitations

- `has_elevator`, `has_balcony`, `has_garage`, `has_parking`, and `has_bathrooms` are always `false` because the search API does not return these fields. They would require individual detail-page fetches.
- `land` listings are only categorised as `transaction_type: "sale"` — rental land plots do not exist on the platform.
- The user-agent rotation in `utils/userAgents.ts` is sequential (round-robin), not random.
- No checksum-based deduplication is implemented; every scrape re-ingests all active listings.

## Stats Tracking

`runScrape` returns a `ScrapeStats` object logged on completion:

| Field | Meaning |
|---|---|
| `total` | Total listings reported by the API across both modes |
| `fetched` | Listings successfully retrieved from the API |
| `transformed` | Listings successfully mapped to a TierI type |
| `ingested` | Listings successfully posted to the ingest API |
| `failed` | Listings that errored during fetch or ingest |
| `skipped` | Listings dropped because `transformListing` returned `null` |
