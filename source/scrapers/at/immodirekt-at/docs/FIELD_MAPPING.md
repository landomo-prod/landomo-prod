# Immodirekt.at Field Mapping

Complete mapping of Immodirekt.at listing data fields to Landomo TierI StandardProperty fields.

## Basic Information

| Immodirekt Field | TierI Field | Transformation | Notes |
|-----------------|------------|----------------|-------|
| `title` | `title` | Direct copy or 'Untitled' if missing | String, extracted from listing card |
| `title` | `description` (fallback) | Used as description if description unavailable | May contain type + location info |
| `description` | `description` | Direct copy if available | Full property description text |
| `url` | `source_url` | Direct copy | Unique URL to listing detail page |
| - | `source_platform` | Hard-coded string | Always `"immodirekt-at"` |
| `price` | `price` | Direct copy or 0 if missing | Integer EUR (sale price or monthly rent) |
| - | `currency` | Hard-coded string | Always `"EUR"` |

## Property Classification

| Immodirekt Field | TierI Field | Transformation | Notes |
|-----------------|------------|----------------|-------|
| `propertyType` | `property_type` | `mapPropertyType()` function | Inferred from title or explicit classification; apartment, house, land, commercial |
| `propertyType` | `property_category` | `mapPropertyCategory()` function | Routes to DB partition: apartment, house (primary categories), land/commercial fallback to apartment |
| URL structure / location | `transaction_type` | `mapTransactionType()` infers from URL or title | Sale vs rent (determined by page context, Immodirekt often mixes on portal) |

## Location & Coordinates

| Immodirekt Field | TierI Field | Transformation | Notes |
|-----------------|------------|----------------|-------|
| `location.address` | `location.address` | Direct copy | Street address string, e.g., "Stephansplatz 1" |
| `location.city` | `location.city` | Direct copy or extracted from address | City name, e.g., "Wien", "Graz" |
| `location.postalCode` | `location.postal_code` | Direct copy | 4-digit Austrian postal code |
| `location.state` | `location.region` | Direct copy or fallback | State/region abbreviation (W, NÖ, OÖ, etc.) |
| `coordinates.lat` | `location.coordinates.lat` | Direct copy if both present | WGS84 decimal degrees |
| `coordinates.lng` | `location.coordinates.lon` | Direct copy if both present | WGS84 decimal degrees (note: Immodirekt uses 'lng') |
| - | `location.country` | Hard-coded string | Always `"Austria"` |

## Property Details

| Immodirekt Field | TierI Field | Transformation | Notes |
|-----------------|------------|----------------|-------|
| `area` | `details.sqm` | Direct copy | Living area in m² |
| `rooms` | `details.rooms` | Direct copy or undefined | Total room count |
| `bedrooms` | `details.bedrooms` | Direct copy or undefined | Bedroom count |
| `bathrooms` | `details.bathrooms` | Direct copy or undefined | Bathroom count |
| `floor` | `details.floor` | Direct copy or undefined | Floor number in building |
| `totalFloors` | `details.total_floors` | Direct copy or undefined | Total floors in building |
| `yearBuilt` | `details.year_built` | Direct copy or undefined | 4-digit construction year |
| - | `details.renovation_year` | Hard-coded undefined | Immodirekt does not provide renovation year |
| - | `details.parking_spaces` | Hard-coded undefined | Immodirekt does not provide parking space count |

## Amenities

| Immodirekt Field | TierI Field | Transformation | Notes |
|-----------------|------------|----------------|-------|
| Various feature flags/strings | `amenities.*` | Parsed from feature list | Extracted via `parseAmenities()` from features array |
| Feature list | `features` | Direct copy as string array | Raw feature strings for display |

## Condition & Energy

| Immodirekt Field | TierI Field | Transformation | Notes |
|-----------------|------------|----------------|-------|
| `condition` | `condition` | `normalizeCondition()` | Condition state (good, needs_renovation, new, etc.) |
| `energyRating` | `energy_rating` | `normalizeEnergyRating()` (if present) | Energy Pass rating if provided |
| `heatingType` | `heating_type` | `normalizeHeatingType()` | Heating system type |
| - | `construction_type` | Hard-coded undefined | Immodirekt does not provide construction material |
| - | `furnished` | `normalizeFurnished()` result | Furnished status if available |

## Availability

| Immodirekt Field | TierI Field | Transformation | Notes |
|-----------------|------------|----------------|-------|
| `availableFrom` | `available_from` | Direct copy | Availability date if specified |
| `metadata.published` | `published_date` | Direct copy | When listing was published |
| - | `deposit` | Hard-coded undefined | Immodirekt typically doesn't specify deposit separately |

## Financial Details

| Immodirekt Field | TierI Field | Transformation | Notes |
|-----------------|------------|----------------|-------|
| `price` | `price_per_sqm` | Calculate: `price / area` rounded | Used for comparative analysis |

## Media & Images

| Immodirekt Field | TierI Field | Transformation | Notes |
|-----------------|------------|----------------|-------|
| (Not typically extracted in listing) | `media.images` | Empty array | Immodirekt detail page scraping would be needed |
| (Not typically extracted in listing) | `images` | Empty array | Backward compatibility field |
| (Not typically extracted in listing) | `media.total_images` | 0 | Image count |

## Agent & Contact

| Immodirekt Field | TierI Field | Transformation | Notes |
|-----------------|------------|----------------|-------|
| `realtor.name` | `agent.name` | Direct copy | Agent/realtor name |
| `realtor.company` | `agent.agency` | Direct copy | Company name |
| `realtor.phone` | `agent.phone` | Direct copy | Contact phone number |
| `realtor.email` | `agent.email` | Direct copy | Contact email address |
| `realtor` (full object) | `agent` (subobj) | Mapped to agent structure | Complete contact information |

## Austrian-Specific Tier1 Columns

| Immodirekt Field | TierI Field | Transformation | Notes |
|-----------------|------------|----------------|-------|
| `condition` | `condition` | `normalizeCondition()` enum | Stored as dedicated column for Austrian properties |
| `heatingType` | `heating_type` | `normalizeHeatingType()` enum | Stored as dedicated column |
| `furnished` | `furnished` | `normalizeFurnished()` enum | Stored as dedicated column |
| `availableFrom` | `available_from` | Direct copy | Stored as dedicated column |
| `metadata.published` | `published_date` | Direct copy | Stored as dedicated column |
| - | `construction_type` | Hard-coded undefined | Not available from Immodirekt |
| - | `deposit` | Hard-coded undefined | Not available from Immodirekt |
| - | `parking_spaces` | Hard-coded undefined | Not available from Immodirekt |

## Portal Metadata Storage

All Immodirekt-specific fields stored under `portal_metadata.immodirekt`:

| Immodirekt Field | Storage Path | Notes |
|-----------------|------------|-------|
| `id` | `portal_metadata.immodirekt.id` | Unique listing ID |
| `propertyType` | `portal_metadata.immodirekt.property_type` | Property classification |
| `transactionType` | `portal_metadata.immodirekt.transaction_type` | Sale or rent |
| `condition` | `portal_metadata.immodirekt.condition` | Condition description |
| `energyRating` | `portal_metadata.immodirekt.energy_rating` | Energy Pass rating if available |
| `heatingType` | `portal_metadata.immodirekt.heating_type` | Heating system |
| `constructionYear` | `portal_metadata.immodirekt.construction_year` | Year built |
| `furnished` | `portal_metadata.immodirekt.furnished` | Furnished status |
| `availableFrom` | `portal_metadata.immodirekt.available_from` | Availability date |
| `area` | `portal_metadata.immodirekt.area` | Living area in m² |
| `plotArea` | `portal_metadata.immodirekt.plot_area` | Land/plot area if applicable |
| `totalFloors` | `portal_metadata.immodirekt.total_floors` | Building floor count |
| `realtor.*` | `portal_metadata.immodirekt.realtor_*` | Agent contact info split fields |
| `realtor` (object) | `portal_metadata.immodirekt.realtor` | Full contact object |
| `metadata` | `portal_metadata.immodirekt.metadata` | Full metadata object |

## Country-Specific Fields (JSONB)

All Austrian-specific data also stored in `country_specific` JSONB for backward compatibility:

| Field | Storage | Source | Notes |
|-------|---------|--------|-------|
| condition | `country_specific.condition` | `condition` field | Normalized enum |
| furnished | `country_specific.furnished` | `furnished` field | Normalized enum |
| energy_rating | `country_specific.energy_rating` | `energyRating` field | A-G scale if present |
| heating_type | `country_specific.heating_type` | `heatingType` field | Normalized enum |
| available_from | `country_specific.available_from` | `availableFrom` field | Date string |

## Checksum Calculation

Checksums generated for change detection:

```javascript
checksum = hash(
  portalId +
  title +
  price +
  area +
  location.city +
  transactionType
)
```

Used to determine if listing is new/changed/unchanged between runs.

## Status

| Immodirekt Field | TierI Field | Transformation | Notes |
|-----------------|------------|----------------|-------|
| - | `status` | Hard-coded string | Always `"active"` at ingestion (listing_status_history tracks transitions) |

## Notes on Data Coverage

1. **Listing card vs detail page**: Mapping above reflects listing card extraction (discovery phase)
   - Card provides: ID, title, price, location, area, rooms
   - Detail page (worker phase) adds: description, images, agent info, full amenities
   - Transformer handles both scenarios gracefully

2. **Property type inference**: Immodirekt doesn't always clearly specify property type
   - Falls back to title/URL keyword matching
   - Defaults to 'apartment' if ambiguous

3. **Missing data prevalence**:
   - bedrooms: ~40% of listings (often omitted)
   - bathrooms: ~60% missing
   - parking spaces: rarely specified
   - condition: ~30% specified
   - renovation_year: not provided by portal

4. **Fallback behavior**:
   - Missing fields default to `undefined` (not 0 or null)
   - Transformer sets `property_category` with fallback chain

5. **Transaction type determination**:
   - Immodirekt may not always separate sale/rent clearly
   - Inferred from page context, URL structure, or presence of rent price
   - Stored separately from property_category

6. **Feature list parsing**:
   - Features array contains strings like "Balcony", "Elevator", "Garden"
   - Parsed into amenities boolean fields via `parseAmenities()`
   - Used for both structured data and feature display

7. **Coordinate precision**:
   - May be approximate (city-level) rather than exact address
   - Useful for map display but not pinpoint location

8. **Title handling**:
   - Often includes property type + location info
   - May be used as fallback description source
   - Type inference can rely on title analysis
