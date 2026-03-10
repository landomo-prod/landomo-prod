# Nieruchomosci-Online.pl Field Mapping

## Universal (All Categories)

| Nieruchomosci-Online Field | TierI Field | Type | Notes |
|---|---|---|---|
| Tile: adId (numeric part) | `portal_id` | string | Extracted from tile_props key; numeric ID only |
| Detail URL | `source_url` | string | Constructed from city subdomain + ID or base URL |
| `title` | `title` | string | From detail page; may be empty from tiles |
| Tile: `prc` | `price` | number | PLN; required from tile data |
| (implicit) | `currency` | string | Always "PLN" |
| Transaction type | `transaction_type` | enum | Derived from search config (sale/rent) |
| Tile: `rloccta` | `location.city` | string | City from subdomain name (decoded from tile data) |
| Detail: district | `location.district` | string | District/neighborhood from detail page |
| Detail: street | `location.street` | string | Street name from detail page |
| Detail: address | `location.address` | string | Full address from detail page; may be empty |
| Detail: voivodeship | `location.region` | string | Region/voivodeship if available |
| Detail: latitude | `location.latitude` | number | Optional |
| Detail: longitude | `location.longitude` | number | Optional |
| (implicit) | `location.country` | string | Always "Poland" |
| (implicit) | `location.country_code` | string | Always "PL" |
| Detail: description | `description` | string | Property description if available |
| Detail: images[] | `images[]` | array | Image URLs from detail page |
| Combined | `media.images` | array | All images with order |
| (implicit) | `source_platform` | string | Always "nieruchomosci-online" |
| (implicit) | `status` | string | Always "active" |

## Apartment

| Nieruchomosci-Online Field | TierI Field | Type | Transformation |
|---|---|---|---|
| Tile: `rooms` | `bedrooms` | number | `max(rooms - 1, 0)` if rooms > 0 |
| Tile: `rooms` | `rooms` | number | Direct from tile or detail |
| Detail feature: "łazienki" | `bathrooms` | number | Parsed from feature value |
| Tile: `rsur` | `sqm` | number | Area from tile data; required |
| Detail feature: "piętro" | `floor` | number | Parsed from feature value |
| Detail: totalFloors | `total_floors` | number | Optional |
| Detail feature: "winda" / "ascensore" | `has_elevator` | boolean | true if feature present |
| Detail feature: "balkon" / "balkonki" | `has_balcony` | boolean | true if feature present |
| Detail feature: "parking" / "garaż" | `has_parking` | boolean | true if feature present |
| Detail feature: "piwnica" / "piwnice" | `has_basement` | boolean | true if feature present |
| Detail feature: "taras" | `has_terrace` | boolean | true if feature present |
| Detail feature: "stan" | `condition` | enum | nowy→new, bardzo dobry→excellent, dobry→good, po remoncie→after_renovation, do remontu→requires_renovation |
| Detail feature: "ogrzewanie" | `heating_type` | string | Type of heating system |
| Detail feature: "umeblowane" / "meble" | `furnished` | enum | tak→furnished, nie→not_furnished |
| Detail feature: "materiał" / "budynek" | `construction_type` | enum | panel, brick, concrete, mixed |
| Detail feature: "rok budowy" | `year_built` | number | Construction year |
| All features | `features[]` | array | Combined from tile + detail pages |

## House

| Nieruchomosci-Online Field | TierI Field | Type | Transformation |
|---|---|---|---|
| Tile: `rooms` | `bedrooms` | number | `max(rooms - 1, 0)` |
| Detail: area_living | `sqm_living` | number | Living area |
| Detail feature: "działka" / "ogród" | `sqm_plot` | number | Plot/land area |
| Tile: `rooms` | `rooms` | number | Direct |
| Detail feature: "piętro" | `floor` | number | Optional |
| Detail feature: "winda" | `has_elevator` | boolean | true if present |
| Detail feature: "garaż" | `has_garage` | boolean | true if present |
| Detail feature: "parking" | `has_parking` | boolean | true if present |
| Detail feature: "piwnica" | `has_basement` | boolean | true if present |
| Detail feature: "ogród" | `has_garden` | boolean | true if present |
| Detail feature: "stan" | `condition` | enum | Same as apartment |
| Detail feature: "rok budowy" / "rok remontu" | `year_built` | number | Construction/renovation year |

## Land

| Nieruchomosci-Online Field | TierI Field | Type | Transformation |
|---|---|---|---|
| Tile: `rsur` | `area_plot_sqm` | number | Land plot area from tile data |
| Detail feature: "działka" | `area_plot_sqm` | number | Alternative if detail has explicit field |
| (inherited) | All universal fields | - | Same as apartment |

## Commercial

| Nieruchomosci-Online Field | TierI Field | Type | Transformation |
|---|---|---|---|
| Tile: `rsur` | `sqm_total` | number | Total commercial space from tile |
| Detail: area | `sqm_total` | number | Alternative from detail page |
| Detail feature: "winda" | `has_elevator` | boolean | true if present |
| Detail feature: "parking" / "miejsce parkingowe" | `has_parking` | boolean | true if present |
| Detail feature: "łazienka" / "łazienki" | `has_bathrooms` | boolean | true if count > 0 |
| Detail feature: "ogrzewanie" | `heating_type` | string | Heating type |

## Search & Pagination

### Search URL Pattern
`https://www.nieruchomosci-online.pl/szukaj.html?3,{category},{transaction}`

**Categories** (with URL slugs):
- `mieszkanie` - Apartment
- `dom` - House
- `dzialka` - Land
- `lokal-uzytkowy` - Commercial

**Transactions**:
- `sprzedaz` - Sale
- `wynajem` - Rent (not available for land)

### Pagination
- Page 1: Base URL (no `&p` parameter)
- Page N>1: Add `&p={N}` query parameter
- Each page returns ~47 listings (site-dependent)
- Pagination detects via new listings found vs. duplicates

## Tile Data Extraction

### JSON Structure
Tile data is embedded in `<script>` tags with variable name `tile_props`:
```javascript
NOTrafficEventBuilder.cachedProps = {
  tile_props: {
    "a26088950": { "prc": 250000, "rsur": 45, "rooms": 2, "rloccta": "warszawa" },
    "i41579_25465008": { "prc": 3500, "rsur": 32, "rooms": 1, "rloccta": "krakow" }
  }
}
```

### ID Normalization
- Raw key: "a26088950" or "i41579_25465008"
- Normalize: Remove leading letter (a/i) and everything after underscore
- Result: Numeric string ID for detail URL construction

### Tile Data Fields
| Field | Type | Usage |
|---|---|---|
| `prc` | number | Price (PLN) |
| `rsur` | number | Area (sqm) |
| `rooms` | number | Room count |
| `rloccta` | string | City subdomain (lowercase) |
| Other fields | various | May include additional metadata |

### Fallback Strategy
If JSON extraction fails, parse `<a>` tags:
- Selector: `a[href*=".nieruchomosci-online.pl/"]`
- Extract numeric ID from URL path
- Skip non-listing links (szukaj, kontakt, pomoc)
- Build detail URLs from subdomain + ID

## Detail URL Construction
```
Primary: https://{city}.nieruchomosci-online.pl/{numeric_id}.html
Fallback: https://www.nieruchomosci-online.pl/{numeric_id}.html
```

City subdomain extracted from tile data `rloccta` field (e.g., "warszawa", "krakow", "wroclaw").

## Polish Feature Keywords Reference

| Feature | Polish Keywords |
|---|---|
| Elevator | winda, dźwig |
| Balcony | balkon, balkona, balkonki |
| Parking | parking, miejsce parkingowe, garaż, garażu, box |
| Basement | piwnica, piwnice, suterena |
| Terrace | taras, tarasa |
| Garage | garaż, garażu |
| Garden | ogród, ogrodu, działka |
| Bathroom count | łazienki, łazienka, łazienkami |
| Condition | stan, stan nieruchomości, stan wykończenia |
| Heating | ogrzewanie, gaz, węgiel, pompa ciepła, ciepła woda |
| Furnished | umeblowane, meble, meblami |
| Construction | materiał, technologia, rodzaj budynku, cegła, panel, beton, zabytek |
| Year built | rok budowy, rok wzniesienia |

### Boolean Parsing
Polish values mapped to boolean:
- True: "tak", "yes", "1", "true", "włączone", "posiada"
- False: "nie", "no", "0", "false", "wyłączone", "brak"

## Data Quality Notes
- **Price from tile**: Most reliable (always present for listed properties)
- **Area from tile**: Highly reliable
- **Rooms from tile**: Generally reliable; may be null for commercial
- **City from tile**: Very reliable (from subdomain)
- **Detail page fields**: Optional; supplement tile data
- **Features**: Comprehensive from both tile and detail sources
- **Location**: City/district from detail page only; may be partial address
- **Images**: Only from detail pages; list may be empty

## Deduplication Strategy

### Per-Page Deduplication
- Tracks `seenIds` Set of all IDs encountered within a search
- When `newListings.length === 0`, pagination terminates (prevents infinite loops)

### Cross-Transaction Deduplication
- Separate tracking per category/transaction combo
- Same property can appear in sale and rental variants
- Both stored separately in database

## Pagination Termination Conditions
1. No new listings found on page (all IDs already seen)
2. Empty page returned from server (HTTP 200 but no results)
3. Max pages reached (3000 by default; rarely hit)
4. Network error on page fetch (graceful error handling)

## Rate Limiting
Built-in rate limiter prevents blocking:
- Delay: 300-700ms (randomized) between page requests
- Realistic headers rotate User-Agent strings
- Graceful error handling on timeouts

## Notes
- Tile data parsing is primary strategy (more reliable than HTML parsing)
- HTML fallback automatically used if JSON extraction fails
- Both strategies can coexist on single page (unusual; tile data preferred)
- City subdomain may contain spaces encoded as dashes (e.g., "zielona-gora" for Zielona Góra)
- Detail page optional for initial ingest; summary data sufficient from tiles
- Checksum comparison enables 60-80% skip rate on subsequent runs
- Terminal protection: sold/rented never overwritten by active status
- Listing removal: old listings marked `removed` status after 72 hours inactive
