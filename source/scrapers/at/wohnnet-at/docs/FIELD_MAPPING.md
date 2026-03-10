# Wohnnet.at Field Mapping

Complete mapping of Wohnnet.at HTML and JSON-LD structured data fields to Landomo TierI StandardProperty fields.

## Basic Information

| Wohnnet Source | TierI Field | Transformation | Notes |
|---|---|---|---|
| HTML title / `jsonLd.name` | `title` | Direct copy or 'Unknown' if missing | Primary from HTML, fallback to JSON-LD |
| HTML description | `description` | Direct copy or from jsonLd.description | Full property description text |
| HTML href / `jsonLd.url` | `source_url` | Direct copy | Unique URL to listing detail page |
| - | `source_platform` | Hard-coded string | Always `"wohnnet"` |
| HTML price / `jsonLd.offers.price` | `price` | Parse via `parsePrice()` | Integer EUR (sale price or monthly rent) |
| `jsonLd.offers.priceCurrency` | `currency` | Direct copy or `"EUR"` | Currency code from JSON-LD or hardcoded |

## Property Classification

| Wohnnet Source | TierI Field | Transformation | Notes |
|---|---|---|---|
| HTML title / URL | `property_type` | `inferPropertyType()` | Inferred from title keywords and URL path |
| HTML title / URL | `transaction_type` | `inferTransactionType()` | Inferred from title and URL context (sale vs rent) |
| Inferred type | `property_category` | `mapPropertyCategory()` | Routes to DB partition: apartment, house (default: apartment) |

## Location & Coordinates

| Wohnnet Source | TierI Field | Transformation | Notes |
|---|---|---|---|
| `listing.location.address` | `location.address` | Direct copy | Street address, e.g., "Stephansplatz 1" |
| `listing.location.city` | `location.city` | Direct copy or `extractCity()` from address | City name, e.g., "Wien" |
| `jsonLd.address.addressLocality` | `location.city` (fallback) | Direct copy if listing.location.city missing | Standard schema.org address city |
| `listing.location.region` | `location.region` | Direct copy | State/region abbreviation |
| `jsonLd.address.addressRegion` | `location.region` (fallback) | Direct copy if listing.location.region missing | Standard schema.org region |
| `listing.location.postalCode` | `location.postal_code` | Direct copy | 4-digit Austrian postal code |
| `jsonLd.address.postalCode` | `location.postal_code` (fallback) | Direct copy if listing.location missing | Schema.org postal code |
| `listing.coordinates` | `location.coordinates` | Direct copy if present | GeoJSON-style {lat, lon} |
| `jsonLd.geo` | `location.coordinates` | Extract via `extractCoordinates()` | Schema.org Geo object: {latitude, longitude} |
| - | `location.country` | Hard-coded string | Always `"Austria"` |

## Property Details

| Wohnnet Source | TierI Field | Transformation | Notes |
|---|---|---|---|
| `listing.details.sqm` | `details.sqm` | Direct copy | Living area in m² |
| `jsonLd.floorSize` | `details.sqm` (fallback) | Parse via `parseFloorSize()` | Schema.org floor size string, e.g., "100 m²" |
| `listing.details.rooms` | `details.rooms` | Direct copy | Total room count |
| `jsonLd.numberOfRooms` | `details.rooms` (fallback) | Parse via `parseNumber()` | Schema.org numberOfRooms integer |
| `listing.details.bedrooms` | `details.bedrooms` | Direct copy | Bedroom count |
| `listing.details.bathrooms` | `details.bathrooms` | Direct copy or default 1 | Bathroom count (default if not specified) |
| `listing.details.floor` | `details.floor` | Direct copy | Floor number in building |
| - | `details.total_floors` | Not available | Wohnnet does not provide total floors |
| - | `details.year_built` | Not available | Wohnnet does not provide construction year |
| - | `details.renovation_year` | Hard-coded undefined | Not available from Wohnnet |
| - | `details.parking_spaces` | Hard-coded undefined | Not available from Wohnnet |

## Property Type Inference

| HTML/URL Pattern | `property_type` | Notes |
|---|---|---|
| Title contains "wohnung" or "apartment" | apartment | German/English indicators |
| Title contains "haus" or "house" | house | German/English indicators |
| Title contains "land" or "grund" | land | Land/plot property |
| Title contains "gewerbe" or "commercial" | commercial | Commercial property |
| URL path contains "/wohnung/" | apartment | URL-based inference |
| URL path contains "/haus/" | house | URL-based inference |
| Default | apartment | Fallback category |

## Transaction Type Inference

| HTML/URL Pattern | `transaction_type` | Notes |
|---|---|---|
| Title contains "miete" or "rent" | rent | German/English indicators |
| Title contains "verkauf" or "sale" | sale | German/English indicators |
| URL path contains "/miete/" | rent | URL-based inference |
| URL path contains "/verkauf/" or "/kaufen/" | sale | URL-based inference |
| Default | sale | Fallback type |

## Amenities & Features

| Wohnnet Source | TierI Field | Transformation | Notes |
|---|---|---|---|
| HTML feature list | `features` | Direct copy as string array | Feature descriptions extracted from HTML |
| Feature strings | `amenities.*` | Parsed via keyword matching | Boolean flags inferred from feature text |

## Condition & Energy

| Wohnnet Source | TierI Field | Transformation | Notes |
|---|---|---|---|
| - | `condition` | Not extracted | Wohnnet does not provide property condition |
| - | `energy_rating` | Not extracted | Wohnnet does not provide energy rating |
| - | `heating_type` | Not extracted | Wohnnet does not provide heating type |
| - | `construction_type` | Not extracted | Wohnnet does not provide construction type |
| - | `furnished` | Not extracted | Wohnnet does not provide furnished status |

## Financial & Availability

| Wohnnet Source | TierI Field | Transformation | Notes |
|---|---|---|---|
| `price` | `price_per_sqm` | Calculate: `price / sqm` rounded | Used for comparative analysis |
| - | `available_from` | Not extracted | Wohnnet does not provide availability date |
| - | `deposit` | Not extracted | Wohnnet does not provide deposit information |
| - | `hoa_fees` | Not extracted | Wohnnet does not provide operating costs |

## Media & Images

| Wohnnet Source | TierI Field | Transformation | Notes |
|---|---|---|---|
| `listing.images[]` | `media.images[]` | Direct copy as URL array | Array of image URLs from listing |
| `extractImagesFromJsonLd(jsonLd)` | `media.images[]` | Extract from image array in JSON-LD | Schema.org image objects |
| `listing.images` | `images` | Direct copy | Backward compatibility field |
| `listing.images.length` | `media.total_images` | Integer count | Total image count |

## Publishing & Metadata

| Wohnnet Source | TierI Field | Transformation | Notes |
|---|---|---|---|
| (Not typically available) | `published_date` | Not extracted | Wohnnet does not provide publish date in listings |
| `jsonLd.datePublished` | `published_date` | Direct copy if present | JSON-LD structured data publish date |

## Austrian-Specific Tier1 Columns

| Wohnnet Source | TierI Field | Transformation | Notes |
|---|---|---|---|
| - | `condition` | Hard-coded undefined | Not available from Wohnnet |
| - | `heating_type` | Hard-coded undefined | Not available from Wohnnet |
| - | `furnished` | Hard-coded undefined | Not available from Wohnnet |
| - | `construction_type` | Hard-coded undefined | Not available from Wohnnet |
| - | `available_from` | Hard-coded undefined | Not available from Wohnnet |
| - | `published_date` | Not extracted | Not available from Wohnnet |
| - | `deposit` | Hard-coded undefined | Not available from Wohnnet |
| - | `parking_spaces` | Hard-coded undefined | Not available from Wohnnet |

## Portal Metadata Storage

All Wohnnet-specific fields stored under `portal_metadata.wohnnet`:

| Wohnnet Source | Storage Path | Notes |
|---|---|---|
| `listing.id` | `portal_metadata.wohnnet.id` | Unique listing ID |
| `listing.url` | `portal_metadata.wohnnet.url` | Full listing URL |
| `listing.title` | `portal_metadata.wohnnet.title` | Original title from portal |
| Inferred type | `portal_metadata.wohnnet.inferred_type` | Property type inference logic |
| Inferred transaction | `portal_metadata.wohnnet.inferred_transaction_type` | Transaction type inference |
| `jsonLd` (object) | `portal_metadata.wohnnet.json_ld` | Full JSON-LD structured data object |
| Raw listing | `portal_metadata.wohnnet.raw_listing` | Full listing object for reference |

## Country-Specific Fields (JSONB)

Minimal Austrian-specific data for Wohnnet (limited data availability):

| Field | Storage | Source | Notes |
|---|---|---|---|
| - | `country_specific` | Empty or partial | Most Austrian fields not available from Wohnnet |

## Status

| Wohnnet Field | TierI Field | Transformation | Notes |
|---|---|---|---|
| - | `status` | Hard-coded string | Always `"active"` at ingestion (listing_status_history tracks transitions) |

## Data Extraction Priority

Wohnnet uses dual-source extraction pattern (HTML + JSON-LD):

### HTML Parsing (Primary)
1. Use CSS selectors to extract from HTML
2. Fallback to JSON-LD if HTML extraction fails
3. More complete for listing-specific fields (title, location, price, area)
4. Vulnerable to HTML structure changes

### JSON-LD (Fallback)
1. Extract schema.org Property object from `<script type="application/ld+json">`
2. Standardized format (less fragile than HTML)
3. Better coverage for structured fields (address, geo, offers)
4. May be less current than HTML (cached data)

### Extraction Strategy

```typescript
// Example pattern used in transformer
const city = listing.location?.city ||
            extractCity(jsonLd?.address?.addressLocality || listing.location?.address || '');

const sqm = listing.details?.sqm ||
           parseFloorSize(jsonLd?.floorSize);

const coordinates = listing.coordinates ||
                   extractCoordinates(jsonLd?.geo);
```

## Data Availability Summary

| Category | Completeness | Quality | Notes |
|---|---|---|---|
| Location | 95% | Good | Address, city, postal code usually present |
| Price | 95% | Good | Consistent across HTML and JSON-LD |
| Area (sqm) | 80% | Good | Often in HTML or JSON-LD |
| Rooms/Bedrooms | 70% | Fair | May be missing or inferred from title |
| Images | 90% | Excellent | Well-represented in listings |
| Condition/Energy | 5% | Poor | Not provided by portal |
| Contact Info | 0% | N/A | Not extracted from Wohnnet |

## Notes

1. **Stateless architecture**: No checksums or change detection
   - Each run fetches all data from scratch
   - No optimization for repeat runs
   - Simpler but less efficient

2. **HTML parsing**: Prone to breakage with design changes
   - CSS selectors must be maintained
   - Test frequently for selector validity
   - JSON-LD fallback helps mitigate this

3. **Property type inference**: Not always accurate
   - Relies on title keywords and URL
   - May default to 'apartment' incorrectly
   - German language makes inference harder

4. **Transaction type inference**: Similar challenges
   - "Miete" = rent, "Verkauf/Kaufen" = sale
   - URL path most reliable source

5. **Missing Austrian-specific data**:
   - No condition, energy, heating, construction type
   - No furnished status or deposits
   - Limits Austrian-specific filtering/analysis

6. **Optional detail enrichment**:
   - Can enable `ENABLE_DETAIL_SCRAPING=true`
   - Fetches detail page per listing (2-3x slower)
   - May extract additional fields from detail page

7. **JSON-LD advantages**:
   - Stable schema.org format
   - Less fragile than HTML selectors
   - Some fields only in JSON-LD (offers.priceRange, etc.)

8. **Rate limiting considerations**:
   - Default: 2 requests/second
   - Respectful and not aggressive
   - Wohnnet server responsive and cooperative
