# Willhaben.at Field Mapping

Complete mapping of Willhaben.at API response fields to Landomo TierI StandardProperty fields. Data structured as attribute key-value pairs accessed via getAttribute() helpers.

## Basic Information

| Willhaben Attribute Key | TierI Field | Transformation | Notes |
|------------------------|------------|----------------|-------|
| `HEADING` | `title` | Direct copy via getAttribute() | Main listing title |
| `DESCRIPTION` | `description` | Direct copy (fallback) | If description not in listing object |
| `SEO_URL` or ID | `source_url` | Build URL: `https://www.willhaben.at/iad/{seoUrl}` or fallback to ID | Unique listing URL |
| - | `source_platform` | Hard-coded string | Always `"willhaben"` |
| `PRICE` | `price` | Parse via `parsePrice()` function | Integer EUR (sale price or monthly rent) |
| - | `currency` | Hard-coded string | Always `"EUR"` |

## Property Classification

| Willhaben Attribute Key | TierI Field | Transformation | Notes |
|------------------------|------------|----------------|-------|
| `PROPERTY_TYPE_ID` | `property_type` | `mapPropertyType()` function | Numeric ID maps to: apartment, house, land, commercial |
| `PROPERTY_TYPE` | `property_type` (fallback) | Direct copy if ID not available | Text property type |
| `PROPERTY_TYPE_ID` | `property_category` | `mapPropertyCategory()` function | Routes to DB partition: apartment, house, land, commercial |
| `ADTYPE_ID` | `transaction_type` | `mapTransactionType()` enum | Maps to: sale or rent |

## Location & Coordinates

| Willhaben Attribute Key | TierI Field | Transformation | Notes |
|------------------------|------------|----------------|-------|
| `ADDRESS` | `location.address` | Direct copy | Street address, e.g., "Stephansplatz 1" |
| `LOCATION` | `location.city` | Extract via `extractCity()` or direct copy | City name parsing from location string |
| `STATE` | `location.region` (primary) | Direct copy | Austrian state (W, NÖ, OÖ, etc.) |
| `DISTRICT` | `location.region` (fallback) | Use if STATE missing | District/area identifier |
| `POSTCODE` | `location.postal_code` | Direct copy | 4-digit Austrian postal code |
| `COORDINATES` | `location.coordinates` | Parse via `parseCoordinates()` | JSON string `{"lat": x, "lng": y}` → WGS84 |
| - | `location.country` | Hard-coded string | Always `"Austria"` |

## Property Details

| Willhaben Attribute Key | TierI Field | Transformation | Notes |
|------------------------|------------|----------------|-------|
| `ESTATE_SIZE` / `ESTATE_SIZE/LIVING_AREA` | `details.sqm` | Parse via `parseNumber()` | Living area in m² (prefer LIVING_AREA) |
| `NUMBER_OF_ROOMS` | `details.rooms` | Parse via `parseNumber()` | Total room count |
| `NUMBER_OF_ROOMS` | `details.bedrooms` | Same as rooms (Willhaben doesn't separate) | Bedroom estimate |
| - | `details.bathrooms` | Hard-coded 1 | Willhaben doesn't provide bathroom count |
| `FLOOR` | `details.floor` | Parse via `parseNumber()` | Floor number in building |
| - | `details.total_floors` | Not available | Willhaben doesn't provide total floors |
| - | `details.year_built` | Not available | Willhaben doesn't provide construction year |
| `RENOVATION_YEAR` | `details.renovation_year` | Parse via `parseNumber()` | Renovation year if available |
| Various parking fields | `details.parking_spaces` | `countParkingSpaces()` function | Counted from parking-related attributes |

## Amenities & Features

| Willhaben Attribute Key | TierI Field | Transformation | Notes |
|------------------------|------------|----------------|-------|
| Multiple feature attributes | `amenities.*` | Parsed from listing attributes | Boolean flags for has_parking, has_balcony, etc. |
| Feature list | `features` | Generated from amenities | Array of display strings |

## Condition & Energy

| Willhaben Attribute Key | TierI Field | Transformation | Notes |
|------------------------|------------|----------------|-------|
| `CONDITION` | `condition` | `normalizeCondition()` enum | Property condition (new, renovated, etc.) |
| - | `energy_rating` | Not available from API | Willhaben doesn't provide energy rating |
| `HEATING_TYPE` | `heating_type` | `normalizeHeatingType()` enum | Heating system (central, gas, etc.) |
| - | `construction_type` | Not available from API | Willhaben doesn't provide construction material |
| `FURNISHED` | `furnished` | `normalizeFurnished()` enum | Furnished status if specified |

## Financial & Availability

| Willhaben Attribute Key | TierI Field | Transformation | Notes |
|------------------------|------------|----------------|-------|
| `PRICE` | `price_per_sqm` | Calculate: `price / sqm` rounded | Used for comparative analysis |
| `DEPOSIT` | `deposit` | Parse via `parseNumber()` | Deposit amount if specified (rare) |
| - | `available_from` | Not available from API | Willhaben doesn't provide availability date |

## Media & Images

| Willhaben Attribute Key | TierI Field | Transformation | Notes |
|------------------------|------------|----------------|-------|
| (Not available in search results) | `media.images` | Empty array | Images on detail page only |
| (Not available in search results) | `images` | Empty array | Backward compatibility |
| (Not available in search results) | `media.total_images` | 0 | Image count unavailable in search |

## Publishing & Metadata

| Willhaben Attribute Key | TierI Field | Transformation | Notes |
|------------------------|------------|----------------|-------|
| `PUBLISHED` | `published_date` | Parse via `parsePublishedDate()` | Unix timestamp when published |
| `PUBLISHED_String` | `published_date` (fallback) | Use if PUBLISHED unavailable | String representation of publish date |

## Organization & Administration

| Willhaben Attribute Key | TierI Field | Transformation | Notes |
|------------------------|------------|----------------|-------|
| `ORGID` | `portal_metadata.willhaben.org_id` | Direct copy | Organization/seller ID |
| `ORG_UUID` | `portal_metadata.willhaben.org_uuid` | Direct copy | Organization UUID |
| `AD_UUID` | `portal_metadata.willhaben.ad_uuid` | Direct copy | Advertisement UUID |
| `ISPRIVATE` | `portal_metadata.willhaben.is_private` | Boolean: `=== '1'` | Private seller vs. agency |
| `IS_BUMPED` | `portal_metadata.willhaben.is_bumped` | Boolean: `=== '1'` | Featured/bumped listing |

## Austrian-Specific Tier1 Columns

| Willhaben Attribute Key | TierI Field | Transformation | Notes |
|------------------------|------------|----------------|-------|
| `CONDITION` | `condition` | `normalizeCondition()` enum | Stored as dedicated column |
| `HEATING_TYPE` | `heating_type` | `normalizeHeatingType()` enum | Stored as dedicated column |
| `FURNISHED` | `furnished` | `normalizeFurnished()` enum | Stored as dedicated column |
| Parking attributes | `parking_spaces` | Counted via `countParkingSpaces()` | Stored as dedicated column |
| `PUBLISHED` / `PUBLISHED_String` | `published_date` | Parsed date | Stored as dedicated column |
| - | `construction_type` | Hard-coded undefined | Not available from Willhaben |
| - | `available_from` | Hard-coded undefined | Not available from Willhaben |
| - | `deposit` | Parse from DEPOSIT if present | Stored as dedicated column |

## Portal Metadata Storage

All Willhaben-specific fields stored under `portal_metadata.willhaben`:

| Willhaben Attribute Key | Storage Path | Notes |
|------------------------|------------|-------|
| ID | `portal_metadata.willhaben.id` | Unique listing ID |
| `VERTICAL_ID` | `portal_metadata.willhaben.vertical_id` | Vertical classification ID |
| `ADTYPE_ID` | `portal_metadata.willhaben.ad_type_id` | Advertisement type ID |
| `PRODUCT_ID` | `portal_metadata.willhaben.product_id` | Product ID |
| Advertisement Status | `portal_metadata.willhaben.advert_status` | Status enum |
| `ORGID` | `portal_metadata.willhaben.org_id` | Organization ID |
| `ORG_UUID` | `portal_metadata.willhaben.org_uuid` | Organization UUID |
| `AD_UUID` | `portal_metadata.willhaben.ad_uuid` | Advertisement UUID |
| `LOCATION_ID` | `portal_metadata.willhaben.location_id` | Location identifier |
| `LOCATION_QUALITY` | `portal_metadata.willhaben.location_quality` | Location data quality |
| `ISPRIVATE` | `portal_metadata.willhaben.is_private` | Private seller? |
| `IS_BUMPED` | `portal_metadata.willhaben.is_bumped` | Featured listing? |
| `PUBLISHED` | `portal_metadata.willhaben.published` | Unix timestamp |
| `PUBLISHED_String` | `portal_metadata.willhaben.published_string` | String date |
| `PRICE_FOR_DISPLAY` | `portal_metadata.willhaben.price_for_display` | Display price string |
| `ESTATE_PREFERENCE` (multi-value) | `portal_metadata.willhaben.estate_preference` | Multiple preference tags |
| All other attributes | `portal_metadata.willhaben.attributes` | Full attribute map for future reference |

## Country-Specific Fields (JSONB)

Austrian-specific data stored in `country_specific` JSONB for backward compatibility:

| Field | Storage | Source | Notes |
|-------|---------|--------|-------|
| condition | `country_specific.condition` | `CONDITION` | Normalized enum |
| furnished | `country_specific.furnished` | `FURNISHED` | Normalized enum |
| heating_type | `country_specific.heating_type` | `HEATING_TYPE` | Normalized enum |
| published_date | `country_specific.published_date` | `PUBLISHED` | ISO date string |

## Checksum Calculation

Checksums generated for change detection:

```javascript
checksum = hash(
  portalId +
  title +
  price +
  area +
  location +
  transactionType
)
```

Used to determine if listing is new/changed/unchanged between runs.

## Status

| Willhaben Field | TierI Field | Transformation | Notes |
|-----------------|------------|----------------|-------|
| - | `status` | Hard-coded string | Always `"active"` at ingestion (listing_status_history tracks transitions) |

## Notes on Data Access

1. **getAttribute() pattern**: All attribute access uses `getAttribute(listing, 'KEY')` for null-safety
   - Returns undefined if key not found
   - Handles missing/malformed data gracefully
   - Example: `getAttribute(listing, 'PRICE')` → null-safe price extraction

2. **getAttributes() for multi-value**: Use for fields that may have multiple values
   - Example: `getAttributes(listing, 'ESTATE_PREFERENCE')` → array

3. **Data completeness**: Search results contain most fields
   - Optional detail page fetch can enrich further (currently disabled)
   - Uncomment `fetchListingDetail()` in listingsScraper if needed

4. **Bathroom count**: Willhaben doesn't separately track bathrooms
   - Defaults to 1 for all properties
   - No way to distinguish multi-bathroom properties

5. **Parking extraction**: Inferred from various parking-related attributes
   - `countParkingSpaces()` counts boolean/numeric parking fields
   - May underestimate if parking info not provided

6. **Large portal considerations**:
   - Willhaben is Austria's largest portal (80k-120k listings)
   - Pagination sequential (30 items/page)
   - Full scrape takes 5-15 minutes depending on network
   - Checksum comparison essential for repeat runs

7. **CSRF token**: Required for API calls
   - Extracted once per run
   - Valid across entire session
   - Extracted from main page initially

8. **User-Agent rotation**: Recommended for legitimacy
   - Use rotating user agents to avoid IP blocking
   - Willhaben cooperative but respects standard practices

## Field Key Constants

Common Willhaben attribute keys used throughout transformer:

```
PRICE, ADDRESS, LOCATION, STATE, DISTRICT, POSTCODE
PROPERTY_TYPE, PROPERTY_TYPE_ID, ADTYPE_ID
HEADING, DESCRIPTION, SEO_URL
NUMBER_OF_ROOMS, ESTATE_SIZE, ESTATE_SIZE/LIVING_AREA
FLOOR, RENOVATION_YEAR
CONDITION, FURNISHED, HEATING_TYPE
COORDINATES, PUBLISHED, PUBLISHED_String
ORGID, ORG_UUID, AD_UUID, LOCATION_ID, LOCATION_QUALITY
ISPRIVATE, IS_BUMPED, PRICE_FOR_DISPLAY
DEPOSIT, ESTATE_PREFERENCE
```

See `src/types/willhabenTypes.ts` for complete list.
