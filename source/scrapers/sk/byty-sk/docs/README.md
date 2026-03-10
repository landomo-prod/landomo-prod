# Byty.sk Scraper

## Overview
- **Portal**: https://www.byty.sk
- **Country**: Slovakia
- **Port**: 8086
- **Source Platform**: `byty-sk`
- **Estimated Listings**: ~15,000-30,000 (6 category/type combos x 6 room filters)
- **Update Frequency**: Triggered by centralized scheduler via `POST /scrape`

## Fetch Strategy
- **HTTP client**: CycleTLS (browser TLS fingerprinting) to bypass Imperva WAF
- **Prerequisite**: Requires `curl-impersonate-chrome` binary installed and in PATH; scraper fails immediately without it
- **Data extraction**: HTML parsing with Cheerio; extracts from `div.inzerat` elements
- **Pagination**: Sequential page-by-page with `p[page]=N`; stops when no `.inzerat` elements or no `a.next.s[href*="page"]`/`link[rel="next"]`
- **Search structure**: 6 categories (byty/domy/pozemky x predaj/prenajom) x 6 room filters = 36 combinations
- **Concurrency**: 2 parallel search combinations per batch
- **Rate limiting**: 1000-2000ms between pages (randomized, higher than other scrapers due to WAF), 1000ms between batches
- **Deduplication**: ID-based dedup after scraping

## Category Detection
Uses `propertyType` field set directly from scraper URL category:
- `byty` -> `apartment`
- `domy` -> `house`
- `pozemky` -> `land`
- Default fallback -> `apartment` (with console warning)

Simple 1:1 mapping with 100% accuracy since category comes from URL structure.

## Field Extraction by Category

### Apartment
| Field | Source | Notes |
|-------|--------|-------|
| bedrooms | details/title regex `(\d+)\s*[-\s]?izb` | n-1 rooms (living room excluded), falls back to 1 |
| sqm | `listing.area` | From `.condition-info` spans via regex `(\d+)\s*m²`, falls back to 0 |
| floor | details/title regex `(\d+)\s*\/\s*(\d+)` or poschodie pattern | Also extracts total_floors |
| total_floors | from floor pattern or separate extraction | |
| floor_location | calculated | ground_floor/middle_floor/top_floor from floor vs total_floors |
| has_elevator | `parseSlovakFeatures()` on details array | Boolean |
| has_balcony | `parseSlovakFeatures()` (includes loggia) | Boolean |
| has_parking | `parseSlovakFeatures()` (includes garage) | Boolean |
| has_basement | `parseSlovakFeatures()` | Boolean |
| condition | details/title keyword matching | 8 Slovak condition keywords -> normalize -> map to English |
| heating_type | details combined text | `normalizeHeatingType()` |
| construction_type | details combined text | `normalizeConstructionType()`, maps stone/wood/other -> undefined |
| energy_class | details regex: `energ*trieda [a-g]` | Normalized to a-g |
| furnished | details combined text | `normalizeFurnished()` |
| deposit | details regex: `kaucia/deposit :? (\d+)` or months multiplier | For rentals only |
| hoa_fees | details regex: `rezia/poplatky/charges/hoa :? (\d+)` | Monthly common charges |
| year_built | details/title regex `(19\d{2}|20[0-3]\d)` | 4-digit year 1800-2030 |
| published_date | `listing.date` | Parses: "dnes", "vcera", "DD.MM.YYYY" |
| bathrooms | calculated | `Math.max(1, Math.floor(rooms / 2))` |

### House
| Field | Source | Notes |
|-------|--------|-------|
| bedrooms | details/title rooms extraction | n-1 rooms, falls back to 1 |
| sqm_living | `listing.area` | Area in list view treated as living space |
| sqm_plot | details regex: `pozemok/plot/land :? (\d+)` | Falls back to sqm_living |
| stories | details regex: `(\d+)\s*podlaz/poschodie/floor` | 1-5 range |
| property_subtype | title+details text analysis | Detects: villa, townhouse, cottage, bungalow, farmhouse, semi_detached, detached (default) |
| has_garden | `parseSlovakFeatures()` | Boolean |
| has_garage | `parseSlovakFeatures()` | Boolean |
| has_parking | `parseSlovakFeatures()` or has_garage | Boolean |
| has_basement | `parseSlovakFeatures()` | Boolean |
| construction_type | details text | Maps panel/other -> undefined for house schema |

### Land
| Field | Source | Notes |
|-------|--------|-------|
| area_plot_sqm | `listing.area` | For land, area is always plot area, falls back to 0 |
| property_subtype | title+details text analysis | Detects: forest, vineyard, orchard, industrial, recreational, agricultural, building_plot (default) |
| building_permit | details keyword: `stavebne povolenie` | Boolean or undefined |
| road_access | details keyword: `pristup`, `cesta`, `asfalt` | Maps to paved/none/undefined |
| zoning | details/title text analysis | residential/commercial/industrial/agricultural/mixed |
| terrain | details slope keywords | flat/sloped/hilly/mountainous from rovinn/miern/stredny svah/strmy |

## Checksum Strategy
Hashes 4 fields using `createListingChecksum()` from `@landomo/core`:
- `price`
- `title`
- `description`
- `sqm` (area)

Note: `disposition` and `floor` are always null (not available in listing cards).

Checksums compared in batches of 1000. After comparison, checksums for new/changed listings are updated via `checksumClient.updateChecksums()`.

## Country-Specific Fields (country_specific.slovakia)
- `disposition` - normalized from rooms (e.g., "3-izbovy")
- `ownership` - extracted from details (osobne/druzstevne/obecne/statne), defaults to `'other'`
- `has_loggia` - from `parseSlovakFeatures()`
- `is_barrier_free` - from `parseSlovakFeatures()`
- `is_low_energy` - from `parseSlovakFeatures()`

## Environment Variables
| Variable | Default | Description |
|----------|---------|-------------|
| PORT | 8086 | Server port |
| INGEST_API_URL | `http://localhost:3008` | Ingest service URL |
| INGEST_API_KEY | `dev_key_sk_1` | Ingest API key |
| ENABLE_CHECKSUM_MODE | `false` | Enable checksum-based deduplication |

## Running Locally
```bash
cd scrapers/Slovakia/byty-sk
npm install
PORT=8086 INGEST_API_URL=http://localhost:3008 INGEST_API_KEY=dev_key_sk_1 npx ts-node src/index.ts
# Trigger: curl -X POST http://localhost:8086/scrape
```

## Known Limitations
- Requires `curl-impersonate-chrome` binary to bypass Imperva WAF; will not start without it
- Higher rate limiting (1-2s between pages) needed due to WAF; slower than other Slovak scrapers
- Only 2 concurrent searches (vs 3 for others) to avoid WAF detection
- Listing card data is limited: many fields extracted from `.condition-info` spans and `.advertisement-content-p` text
- Room filters applied to all categories including pozemky (land), which may not benefit from room filtering
- `sqm_plot` for houses falls back to `sqm_living` when plot area is not separately listed
- Land transformer extracts building permit, road access, zoning, and terrain from details text; accuracy depends on listing description quality
- Published date parsing handles Slovak relative dates ("dnes"/"vcera") and DD.MM.YYYY format
- ID extraction strips "i" prefix from element IDs (e.g., `id="i12345"` -> `"12345"`)
