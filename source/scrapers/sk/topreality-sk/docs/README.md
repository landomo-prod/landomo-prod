# TopReality.sk Scraper

## Overview
- **Portal**: https://www.topreality.sk
- **Country**: Slovakia
- **Port**: 8085
- **Source Platform**: `topreality-sk`
- **Estimated Listings**: ~65,770+ (from code comments)
- **Update Frequency**: Triggered by centralized scheduler via `POST /scrape`

## Fetch Strategy
- **HTTP client**: Axios with random User-Agent rotation and Slovak locale headers
- **Data extraction**: HTML parsing with Cheerio; tries multiple CSS selectors (`.estate`, `.property`, `.listing-item`, `article`, `[class*="property"]`, `[class*="estate"]`)
- **Pagination**: Sequential page-by-page with `p[page]=N` parameter; stops when no listing elements or no `a.next`/`link[rel="next"]`
- **Search structure**: 8 regions x 5 property types (byty, domy, pozemky, komercne, ostatne) x 2 transaction types (predaj, prenajom) = 80 combinations
- **Concurrency**: 3 parallel search combinations per batch
- **Rate limiting**: 300-500ms between pages (randomized), 1000ms between batches
- **Property count API**: `ajax.php` endpoint available for getting counts per search (used for monitoring)
- **Deduplication**: ID-based dedup after scraping

## Category Detection
Uses `propertyType` field extracted from URL and listing text:
- `byt*` / `garsónka` / `garsonka` / `studio` -> `apartment`
- `pozemok` / `pozemky` -> `land`
- `dom*` / `rodinný` / `komerčn*` / `ostatn*` -> `house`
- Fallback: if `rooms >= 2` -> `apartment`; if title mentions pozemok -> `land`; default -> `house`

## Field Extraction by Category

### Apartment
| Field | Source | Notes |
|-------|--------|-------|
| bedrooms | `listing.rooms` | Extracted via regex `(\d)\s*izb` from card text, falls back to 1 |
| sqm | `listing.area` | Extracted via regex `(\d+)\s*m²` from card text, falls back to 0 |
| floor | `listing.floor` or text extraction | `extractFloorFromText()` |
| total_floors | text extraction | `extractTotalFloorsFromText()` |
| has_elevator | text keyword: `vytah`, `elevator` | From `extractAmenitiesFromText()` |
| has_balcony | text keyword: `balkon`, `balcony` | From `extractAmenitiesFromText()` |
| has_parking | text keyword: `parkovanie`, `parking` | From `extractAmenitiesFromText()` |
| has_basement | text keyword: `pivnica`, `sklep`, `basement` | From `extractAmenitiesFromText()` |
| condition | text extraction | Normalize -> map to English; maps `very_good` -> `excellent`, `before_renovation`/`under_construction` -> `good` |
| heating_type | text extraction | Normalize -> map to English |
| furnished | text extraction | Normalize -> map to English |
| construction_type | text extraction | Maps `stone`/`wood`/`other` -> undefined for apartment schema |
| energy_class | text extraction | Normalized to a-g |
| deposit | text extraction | `extractDepositFromText()` |
| bathrooms | calculated | `Math.max(1, Math.floor(rooms / 2))` |

### House
| Field | Source | Notes |
|-------|--------|-------|
| bedrooms | `listing.rooms` | Falls back to 1 |
| sqm_living | `listing.area` | Interior space, falls back to 0 |
| sqm_plot | text extraction | `extractAreaPlotFromText()`, falls back to 0 |
| stories | `parsedTotalFloors` | From text extraction |
| has_garden | text keyword or `parsedAreaPlot` truthy | Inferred from plot area |
| has_garage | text keyword: `garaz`, `garage` | Boolean |
| has_parking | text keyword: `parkovanie`, `parking` | Boolean |
| has_basement | text keyword: `pivnica`, `sklep`, `basement` | Boolean |
| has_pool | text keyword: `bazen`, `pool` | Boolean |
| has_fireplace | text keyword: `krb`, `fireplace` | Boolean |
| construction_type | text extraction | Maps `panel`/`other` -> undefined for house schema |

### Land
| Field | Source | Notes |
|-------|--------|-------|
| area_plot_sqm | `listing.area` or text extraction | Falls back to 0 |

## Checksum Strategy
Two modes available:

**Full mode** (default): Scrapes all listings, transforms, and sends to ingest.

**Checksum mode** (`CHECKSUM_MODE=true`): Scrapes all listings, creates checksums, and sends only checksum objects to ingest API. Hashes 6 fields:
- `price`
- `title`
- `description`
- `sqm` (area)
- `disposition` (derived as `rooms-izbovy`)
- `floor`

## Country-Specific Fields (country_specific.slovakia)
- `disposition` - normalized from rooms (e.g., "3-izbovy")
- `ownership` - hardcoded to `'other'`
- `condition` - English-mapped condition
- `furnished` - English-mapped furnished status
- `energy_rating` - normalized energy rating
- `heating_type` - English-mapped heating type
- `construction_type` - English-mapped construction type
- `area_living` / `area_plot` - numeric area values
- `year_built` / `renovation_year` - extracted from text
- `floor` / `total_floors` / `rooms` - numeric values
- `balcony` / `terrace` / `elevator` / `garage` / `garden` / `loggia` / `pool` / `deposit` - from amenity extraction

## Environment Variables
| Variable | Default | Description |
|----------|---------|-------------|
| PORT | 8085 | Server port |
| INGEST_API_URL | `http://localhost:3008` | Ingest service URL |
| INGEST_API_KEY | `dev_key_sk_1` | Ingest API key |
| CHECKSUM_MODE | `false` | Enable checksum-only mode (sends checksums instead of full data) |

## Running Locally
```bash
cd scrapers/Slovakia/topreality-sk
npm install
PORT=8085 INGEST_API_URL=http://localhost:3008 INGEST_API_KEY=dev_key_sk_1 npx ts-node src/index.ts
# Trigger: curl -X POST http://localhost:8085/scrape
```

## Known Limitations
- HTML selector fallback chain (`.estate`, `.property`, `article`, etc.) means the scraper may pick up non-listing elements if selectors change
- Property type and transaction type are inferred from URL and card text, not structured data
- All enriched fields (condition, heating, etc.) extracted from title + description text via regex
- No coordinates available from HTML scraping
- Ownership always defaults to `'other'`
- Checksum mode sends checksums to the same `bulk-ingest` endpoint rather than a dedicated checksum endpoint
- Land transformer is minimal: only extracts area and condition; no utility or zoning fields
- 80 search combinations with 3 concurrency can take significant time for 65k+ listings
