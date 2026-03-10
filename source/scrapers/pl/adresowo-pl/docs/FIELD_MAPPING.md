# Adresowo.pl Field Mapping

## Universal (All Categories)

| Adresowo Field | TierI Field | Type | Notes |
|---|---|---|---|
| `portalId` | `portal_id` | string | Prefixed with "adresowo-", extracted from URL slug |
| Reconstructed | `source_url` | string | `https://www.adresowo.pl{url}` |
| `title` | `title` | string | From search card text or detail page |
| `price` | `price` | number | Always from search page; PLN |
| (implicit) | `currency` | string | Always "PLN" |
| Transaction type | `transaction_type` | enum | Derived from URL slug (sale/rent) |
| Detail: city | `location.city` | string | City from detail page |
| Detail: district | `location.district` | string | District/neighborhood if available |
| Detail: street | `location.street` | string | Street name if available |
| Detail: address | `location.address` | string | Full address; fallback to search location |
| Search: location | `location.address` | string | Fallback if detail address missing |
| Detail: latitude | `location.latitude` | number | Optional |
| Detail: longitude | `location.longitude` | number | Optional |
| (implicit) | `location.country` | string | Always "Poland" |
| (implicit) | `location.country_code` | string | Always "PL" |
| Detail: description | `description` | string | Property description if available |
| Search: imageUrl | `images[]` | array | Primary image from search card |
| Detail: images[] | `images[]` | array | Additional images from detail page |
| Combined | `media.images` | array | All unique images with order |
| (implicit) | `source_platform` | string | Always "adresowo" |
| (implicit) | `status` | string | Always "active" |

## Apartment

| Adresowo Field | TierI Field | Type | Transformation |
|---|---|---|---|
| `rooms` (detail) | `bedrooms` | number | `max(rooms - 1, 0)` or 0 if missing |
| `rooms` | `rooms` | number | Direct from detail |
| Feature: "łazienki" / "liczba łazienek" | `bathrooms` | number | Parsed from feature value |
| `area` | `sqm` | number | From search or detail page |
| `floor` (parsed) | `floor` | number | Extracted from text (e.g., "piętro 3") |
| Detail: totalFloors | `total_floors` | number | Optional |
| Feature: "winda" | `has_elevator` | boolean | true if feature present |
| Feature: "balkon" / "balcona" | `has_balcony` | boolean | true if feature present |
| Feature: "parking" / "miejsce parkingowe" | `has_parking` | boolean | true if feature present |
| Feature: "piwnica" / "piwnice" | `has_basement` | boolean | true if feature present |
| Feature: "taras" | `has_terrace` | boolean | true if feature present |
| Feature: "garaż" | `has_garage` | boolean | true if feature present |
| Feature: "stan" | `condition` | enum | nowe→new, bardzo dobry→excellent, dobry→good, po remoncie→after_renovation, do remontu→requires_renovation |
| Feature: "ogrzewanie" | `heating_type` | string | Type of heating system |
| Feature: "meble" | `furnished` | enum | tak/yes→furnished, nie/no→not_furnished |
| Feature: "materiał" / "budynek" | `construction_type` | enum | panel, brick, concrete, mixed |
| Feature: "rok budowy" | `year_built` | number | Construction year |
| Feature: "dostęp od" | `available_from` | string | Availability date if present |
| All features | `features[]` | array | Combined from search + detail pages |

## House

| Adresowo Field | TierI Field | Type | Transformation |
|---|---|---|---|
| `rooms` | `bedrooms` | number | `max(rooms - 1, 0)` |
| Detail: area_living | `sqm_living` | number | Living area |
| Feature: "działka" / "ogród" | `sqm_plot` | number | Plot/land area |
| `rooms` | `rooms` | number | Direct |
| `floor` (parsed) | `floor` | number | Optional (for multi-story houses) |
| Feature: "winda" | `has_elevator` | boolean | true if present |
| Feature: "garaż" | `has_garage` | boolean | true if present |
| Feature: "parking" | `has_parking` | boolean | true if present |
| Feature: "piwnica" | `has_basement` | boolean | true if present |
| Feature: "ogród" | `has_garden` | boolean | true if present |
| Feature: "stan" | `condition` | enum | Same as apartment |
| Feature: "rok budowy" / "rok remontu" | `year_built` | number | Construction/renovation year |

## Land

| Adresowo Field | TierI Field | Type | Transformation |
|---|---|---|---|
| `area` (from search) | `area_plot_sqm` | number | Land plot area in m² |
| Feature: "działka" | `area_plot_sqm` | number | Alternative if detail has explicit field |
| (inherited) | All universal fields | - | Same as apartment |

## Commercial

| Adresowo Field | TierI Field | Type | Transformation |
|---|---|---|---|
| `area` | `sqm_total` | number | Total commercial space |
| Feature: "winda" | `has_elevator` | boolean | true if present |
| Feature: "parking" / "miejsce parkingowe" | `has_parking` | boolean | true if present |
| Feature: "łazienka" / "łazienki" | `has_bathrooms` | boolean | true if count > 0 |
| Feature: "ogrzewanie" | `heating_type` | string | Heating type |

## URL Structure

### Search Pages
- Base: `https://www.adresowo.pl/{transaction-slug}/`
- Pagination: `{transaction-slug}/_l{N}` for page N > 1

**Transaction Slugs**:
- `mieszkania` - Apartment sales
- `mieszkania-wynajem` - Apartment rentals
- `domy` - House sales
- `domy-wynajem` - House rentals
- `dzialki` - Land sales (no rental variant)
- `nieruchomosci-komercyjne` - Commercial sales
- `nieruchomosci-komercyjne-wynajem` - Commercial rentals

### Detail Pages
- Constructed from: `https://www.adresowo.pl{listing_url}` (relative path)
- Example: `/o/mieszkanie-warszawa-zoliborz-ul-xyz-3-pokojowe-l1a2u2`

## HTML Parsing Details

### Search Page Listing Cards
- Link selector: `a[href^="/o/"]`
- Portal ID extraction: Regex match on last segment after dash: `-([a-z0-9]+)$`
- Price parsing: Text regex `/([\d\s]+)\s*(?:zł|PLN)/i`
- Area parsing: Text regex `/([\d,\.]+)\s*m[²2]/i` (converts comma to decimal)
- Rooms parsing: Text regex `/(\d+)\s*pok/i` (looking for "pok" suffix)
- Floor parsing: Text regex `/(?:piętro|piętr[oa])\s*(\d+)|(\d+)\s*\/\s*\d+\s*(?:piętro|piętr)/i`
- Image URL: `img` src or data-src attributes
- Title: Image alt text or first line of link text

### Detail Page Parsing
- Features extracted from feature table/list
- City/district/street from address section
- Total floors parsed from text
- Full description from content area
- Images from gallery section
- Price may be updated if detail page shows different value

## Field Extraction Helpers

### Polish Feature Keywords
| Feature | Polish Keywords |
|---|---|
| Elevator | winda, dźwig |
| Balcony | balkon, balkona, balkonki |
| Parking | parking, miejsce parkingowe, garaż, garażu |
| Basement | piwnica, piwnice, suterena |
| Terrace | taras, tarasa |
| Garage | garaż, garażu |
| Garden | ogród, ogrodu, działka |
| Bathroom count | łazienki, łazienka |
| Condition | stan, stan wykończenia |
| Heating | ogrzewanie, gaz, węgiel, pompa ciepła |
| Furnished | umeblowane, meble |
| Construction | materiał, technologia, budynek, cegła, panel, beton |

### Boolean Parsing
Polish values mapped to boolean:
- True: "tak", "yes", "1", "true", "włączone"
- False: "nie", "no", "0", "false", "wyłączone"

## Data Quality Notes
- **Price**: Always present from search page; reliable
- **Area**: Always present from search page; reliable
- **Rooms**: Reliable from parsed text (varies format)
- **Floor**: Extracted from text; may be missing or incomplete
- **Bathrooms**: Only in detail page; often missing
- **Features**: Combined from both sources; comprehensive
- **Location**: City/district only from detail page; may be null on search fallback
- **Condition**: Mapped from Polish descriptors; reliable for apartments
- **Images**: Search has primary image; detail may have gallery
- **Description**: Only available from detail page; may be marketing text

## Pagination & Deduplication

### Automatic Duplicate Detection
- Phase 1 uses `seenIds` Set to track all portal IDs encountered
- When `newListings.length === 0` (all results on page already seen), pagination stops
- Prevents infinite loops on sites that cycle results

### Page Detection
- Checks for `a[href*="/_l"]` links with `_l{page+1}` pattern
- If next link not found, pagination terminates

## Rate Limiting
Built-in rate limiter prevents blocking:
- Delay: 200-800ms (randomized) between page requests
- Realistic headers rotate User-Agent strings
- Graceful backoff on 403/429 responses

## Notes
- Deduplication per transaction type; same property can appear in sale and rental variants
- Terminal protection: sold/rented never overwritten by active status
- Listing removal: old listings marked `removed` status after 72 hours inactive
- Detail page optional for first phase (summary used if detail fails)
- Checksum comparison enables 60-80% skip rate on subsequent runs
