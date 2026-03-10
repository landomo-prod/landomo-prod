# Reality.sk Scraper

## Overview
- **Portal**: https://www.reality.sk
- **Country**: Slovakia
- **Port**: 8084
- **Source Platform**: `reality-sk`
- **Estimated Listings**: ~30,000-50,000 (byty/domy/pozemky x predaj/prenajom with room filters)
- **Update Frequency**: Triggered by centralized scheduler via `POST /scrape`

## Fetch Strategy
- **HTTP client**: CycleTLS (browser TLS fingerprinting) with random User-Agent rotation
- **Prerequisite**: Requires `curl-impersonate-chrome` binary installed and in PATH; scraper fails immediately without it
- **Data extraction**: HTML parsing with Cheerio; extracts from `.offer` elements
- **Pagination**: Sequential page-by-page with `?page=N`; stops when no `.offer` elements or no `a.next`/`link[rel="next"]`
- **Search structure**: 3 categories (byty, domy, pozemky) x 2 types (predaj, prenajom); byty/domy use 6 room filters each to avoid 600-page limit = 26 combinations
- **Concurrency**: 3 parallel search combinations per batch
- **Rate limiting**: 500-1000ms between pages (randomized), 1000ms between batches
- **Deduplication**: ID-based dedup after scraping to remove overlap from room filter splits

## Category Detection
Uses `propertyType` field extracted from URL structure (`/byty/predaj`, `/domy/predaj`, `/pozemky/predaj`):
- `byt*` -> `apartment`
- `pozemk*` -> `land`
- `dom*` / `chaty` / `chalupy` / `kancelarie` / `garaz*` -> `house`
- Default fallback -> `house`

## Field Extraction by Category

### Apartment
| Field | Source | Notes |
|-------|--------|-------|
| bedrooms | `listing.rooms` | Extracted from `.offer-params` text via regex `(\d)\s*[-\s]?izbov[yy]` |
| sqm | `listing.sqm` | Extracted from `.offer-params` text via regex `(\d+)\s*m[^2]` |
| floor | text extraction from title+description | `extractFloorFromText()` |
| total_floors | text extraction | `extractTotalFloorsFromText()` |
| has_elevator | text keyword: `vytah`, `elevator` | From `extractAmenitiesFromText()` |
| has_balcony | text keyword: `balkon`, `balcony` | From `extractAmenitiesFromText()` |
| has_parking | text keyword: `parkovanie`, `parking` | From `extractAmenitiesFromText()` |
| has_basement | text keyword: `pivnica`, `sklep`, `basement` | From `extractAmenitiesFromText()` |
| condition | text extraction | `extractConditionFromText()` -> normalize -> map to English |
| heating_type | text extraction | `extractHeatingFromText()` -> normalize -> map to English |
| furnished | text extraction | `extractFurnishedFromText()` -> normalize -> map to English |
| construction_type | text extraction | `extractConstructionTypeFromText()` -> normalize -> map to English |
| energy_class | text extraction | `extractEnergyRatingFromText()` -> normalize |
| deposit | text extraction | `extractDepositFromText()` |
| bathrooms | calculated | `Math.max(1, Math.floor(rooms / 2))` |

### House
| Field | Source | Notes |
|-------|--------|-------|
| bedrooms | `listing.rooms` | Falls back to 1 |
| sqm_living | `listing.sqm` | Interior space from params |
| sqm_plot | text extraction | `extractAreaPlotFromText()`, falls back to 0 |
| has_garden | text keyword or `parsedAreaPlot` truthy | Inferred from plot area |
| has_garage | text keyword: `garaz`, `garage` | Boolean |
| has_parking | text keyword: `parkovanie`, `parking` | Boolean |
| has_basement | text keyword: `pivnica`, `sklep`, `basement` | Boolean |
| has_pool | text keyword: `bazen`, `pool` | Boolean |
| has_fireplace | text keyword: `krb`, `fireplace` | Boolean |
| house_type | text analysis | Detects: villa, cottage, townhouse, semi_detached, detached (default) |

### Land
| Field | Source | Notes |
|-------|--------|-------|
| area_plot_sqm | `extractAreaPlotFromText()` or `listing.sqm` | Falls back to 0 |
| land_type | text analysis | Detects: building_plot (default), vineyard, orchard, forest, arable, grassland |
| zoning | text analysis | Detects: residential, commercial, industrial, agricultural, mixed |
| has_water_connection | text utility extraction | Boolean from available/nearby |
| has_sewage_connection | text utility extraction | Boolean from available/nearby |
| has_electricity_connection | text utility extraction | Boolean from available/nearby |
| has_gas_connection | text utility extraction | Boolean from available/nearby |

## Checksum Strategy
Hashes 5 fields using `createListingChecksum()` from `@landomo/core`:
- `price`
- `title`
- `description`
- `sqm`
- `bedrooms` (from rooms)

Checksums compared in batches of 1000. After ingestion, checksums are updated in the database via `checksumClient.updateChecksums()`.

## Country-Specific Fields (country_specific.slovakia)
- `disposition` - derived from rooms (e.g., "3-room")
- `ownership` - hardcoded to `'other'` (not available from HTML)
- `condition` - English-mapped condition string
- `furnished` - English-mapped furnished status
- `energy_rating` - normalized energy rating
- `heating_type` - English-mapped heating type
- `construction_type` - English-mapped construction type
- `area_living` / `area_plot` - numeric area values
- `year_built` / `renovation_year` - extracted from text
- `rooms` - room count
- `balcony` / `terrace` / `elevator` / `garage` / `loggia` / `deposit` - from amenity extraction

## Environment Variables
| Variable | Default | Description |
|----------|---------|-------------|
| PORT | 8084 | Server port |
| INGEST_API_URL | `http://ingest-slovakia:3000` | Ingest service URL |
| INGEST_API_KEY | (empty) | Ingest API key |
| ENABLE_CHECKSUM_MODE | `false` | Enable checksum-based deduplication |

## Running Locally
```bash
cd scrapers/Slovakia/reality-sk
npm install
PORT=8084 INGEST_API_URL=http://localhost:3008 INGEST_API_KEY=dev_key_sk_1 npx ts-node src/index.ts
# Trigger: curl -X POST http://localhost:8084/scrape
```

## Known Limitations
- Requires `curl-impersonate-chrome` binary; will not start without it
- HTML-only scraper: all enriched fields (condition, heating, construction, etc.) are extracted from title + description text via regex; accuracy depends on listing text quality
- No coordinates available (HTML scraping, not API)
- Room count extracted from `.offer-params` text; may miss non-standard formats
- Ownership always defaults to `'other'` since it is not available in list view HTML
- 600-page limit on Reality.sk search results requires room filter subdivision for byty/domy
- Price parsing handles both Slovak decimal format (`1,50`) and thousands separator (`145,000`)
