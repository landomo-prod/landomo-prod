# Nehnutelnosti.sk Scraper

## Overview
- **Portal**: https://www.nehnutelnosti.sk
- **Country**: Slovakia
- **Port**: 8082
- **Source Platform**: `nehnutelnosti-sk`
- **Estimated Listings**: ~20,000-40,000 (8 regions x 5 category/transaction combos)
- **Update Frequency**: Triggered by centralized scheduler via `POST /scrape`

## Fetch Strategy
- **HTTP client**: Axios with browser-like headers (Chrome UA, Slovak locale)
- **Data extraction**: Parses Next.js App Router embedded JSON from `self.__next_f.push()` script tags using Cheerio
- **Pagination**: Sequential page-by-page with `?p[page]=N` parameter; stops when no listings or no next page button found
- **Search structure**: 8 Slovak regions x 5 combos (byty/domy/pozemky x predaj/prenajom, no land rental) = 40 searches processed sequentially
- **Rate limiting**: 300ms between searches, 500ms between pages
- **Anti-bot**: Standard browser headers only; no TLS fingerprinting needed
- **Batch size**: 100 properties per ingest API call, 500ms between batches

## Category Detection
Uses `property_type` / `category` fields from listing data (derived from `parameters.category.mainValue`):
- `byt*` / `garsónka` / `garsonka` / `studio` -> `apartment`
- `pozemok` / `pozemky` -> `land`
- `dom*` / `rodinný` / `garáž` / `komerčn*` -> `house`
- Fallback: if disposition matches `\d+\s*\+\s*(kk|1)` -> `apartment`; if only land area -> `land`; default -> `house`

## Field Extraction by Category

### Apartment
| Field | Source | Notes |
|-------|--------|-------|
| bedrooms | `_raw.parameters.totalRoomsCount` or `extractBedrooms()` | Falls back to 1 |
| sqm | `extractSqm()` from area fields | Falls back to 0 |
| floor | `extractFloor()` | From listing data |
| total_floors | `listing.total_floors` | Direct field |
| has_elevator | features keyword search: `vytah`, `elevator` | Boolean |
| has_balcony | features keyword: `balkon`, `balcony` | Boolean |
| has_parking | features keyword: `parkovanie`, `parking` | Boolean |
| has_basement | features keyword: `pivnica`, `sklep`, `basement` | Boolean |
| condition | `_raw.parameters.realEstateState` | Normalized via `normalizeCondition()` |
| heating_type | `listing.heating` | Normalized via `normalizeHeatingType()` |
| construction_type | `listing.construction_type` | Normalized via `normalizeConstructionType()` |
| energy_class | `listing.energy_rating` | Normalized to a-g |
| deposit | `extractDeposit()` | From listing data |
| available_from | `extractAvailableFrom()` | From listing data |

### House
| Field | Source | Notes |
|-------|--------|-------|
| bedrooms | `_raw.parameters.totalRoomsCount` or `extractBedrooms()` | Falls back to 1 |
| sqm_living | `extractSqm()` | Interior space |
| sqm_plot | `extractLandArea()` or `listing.area_land` | Land area |
| has_garden | features keyword or `sqm_plot > sqm_living` | Inferred |
| has_garage | features keyword: `garaz`, `garage` | Boolean |
| has_parking | features keyword: `parkovanie`, `parking` | Boolean |
| has_basement | features keyword: `pivnica`, `sklep`, `basement` | Boolean |
| has_pool | features keyword: `bazen`, `pool` | Boolean |
| has_fireplace | features keyword: `krb`, `fireplace` | Boolean |

### Land
| Field | Source | Notes |
|-------|--------|-------|
| area_plot_sqm | `extractLandArea()` or `listing.area_land` or `listing.area` | Required, falls back to 0 |
| water_supply | features keyword: `voda`, `water` | `'mains'` or undefined |
| sewage | features keyword: `kanalizacia`, `sewage` | `'mains'` or undefined |
| electricity | features keyword: `elektricky`, `electricity` | `'connected'` or undefined |

## Checksum Strategy
Hashes 6 fields using `createListingChecksum()` from `@landomo/core`:
- `price` (most frequent change)
- `title`
- `description`
- `sqm` (area)
- `disposition`
- `floor`

Checksums compared in batches of 1000 via `ChecksumClient.compareChecksums()`. Only new/changed listings are sent to ingest.

## Country-Specific Fields (country_specific.slovakia)
- `disposition` - mapped from `parameters.category.subValue` (e.g., "TWO_ROOM_APARTMENT" -> "2-room")
- `ownership` - from `listing.ownership` (not available in API)
- `condition` - normalized Slovak condition string
- `heating_type` - normalized heating type
- `construction_type` - normalized construction type
- `energy_rating` - normalized energy rating
- `has_floor_plan` - from `_raw.flags.hasFloorPlan`
- `has_3d_tour` - from `_raw.flags.hasInspections3d`
- `has_video` - from `_raw.flags.hasVideo`

## Environment Variables
| Variable | Default | Description |
|----------|---------|-------------|
| PORT | 8082 | Server port |
| INGEST_API_URL | `http://localhost:3008` | Ingest service URL |
| INGEST_API_KEY | `dev_key_sk_1` | Ingest API key |
| USE_CHECKSUMS | `false` | Enable checksum-based deduplication |

## Running Locally
```bash
cd scrapers/Slovakia/nehnutelnosti-sk
npm install
PORT=8082 INGEST_API_URL=http://localhost:3008 INGEST_API_KEY=dev_key_sk_1 npx ts-node src/index.ts
# Trigger: curl -X POST http://localhost:8082/scrape
```

## Known Limitations
- Next.js embedded JSON parsing is fragile; relies on specific `self.__next_f.push()` format that may change with portal updates
- Manual JSON brace-matching parser (not standard JSON.parse) for extracting results from concatenated script chunks
- No coordinates extraction from list pages (available in API response but not always populated)
- `devProjectsInitial` array is also extracted but may contain developer projects rather than individual listings
- Many Tier I fields (heating, construction, ownership) are noted as "Not available in API" and may be empty
- Sequential scraping across 40 search combinations can be slow
