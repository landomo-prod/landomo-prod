# Immowelt.at Field Mapping

Complete mapping of Immowelt.at listing data fields to Landomo TierI StandardProperty fields. Data may be sourced from compressed JSON, HTML parsing, or detail pages.

## Basic Information

| Immowelt Field | TierI Field | Transformation | Notes |
|---------------|-----------  |----------------|-------|
| `title` | `title` | Direct copy or 'Untitled' if missing | String, typically includes type + location |
| `description` | `description` | Direct copy if available | Full property description text |
| `url` | `source_url` | Direct copy | Unique URL to listing detail page |
| - | `source_platform` | Hard-coded string | Always `"immowelt-at"` |
| `price` | `price` | Direct copy or 0 if missing | Integer EUR (sale price or monthly rent) |
| - | `currency` | Hard-coded string | Always `"EUR"` |

## Property Classification

| Immowelt Field | TierI Field | Transformation | Notes |
|---------------|-----------  |----------------|-------|
| `propertyType` | `property_type` | `mapPropertyType()` function | apartment, house, land, commercial |
| `propertyType` | `property_category` | `mapPropertyCategory()` function | Routes to DB partition: apartment, house (primary), land/commercial fallback |
| URL / context | `transaction_type` | `mapTransactionType()` infers | Sale vs rent determined by listing context |

## Location & Coordinates

| Immowelt Field | TierI Field | Transformation | Notes |
|---------------|-----------  |----------------|-------|
| `location.address` | `location.address` | Direct copy | Street address string, e.g., "Stephansplatz 1" |
| `location.city` | `location.city` | Direct copy | City name, e.g., "Wien" |
| `location.district` | `location.region` | Direct copy or fallback | District/region identifier |
| `location.postalCode` | `location.postal_code` | Direct copy | 4-digit Austrian postal code |
| `coordinates.lat` | `location.coordinates.lat` | Direct copy if both present | WGS84 decimal degrees |
| `coordinates.lng` | `location.coordinates.lon` | Direct copy if both present | WGS84 decimal degrees (note: Immowelt uses 'lng') |
| - | `location.country` | Hard-coded string | Always `"Austria"` |

## Property Details

| Immowelt Field | TierI Field | Transformation | Notes |
|---------------|-----------  |----------------|-------|
| `area` | `details.sqm` | Direct copy | Living area in m² |
| `rooms` | `details.rooms` | Direct copy or undefined | Total room count |
| `bedrooms` | `details.bedrooms` | Direct copy or undefined | Bedroom count |
| `bathrooms` | `details.bathrooms` | Direct copy or undefined | Bathroom count |
| `floor` | `details.floor` | Direct copy or undefined | Floor number in building |
| `totalFloors` | `details.total_floors` | Direct copy or undefined | Total floors in building |
| `yearBuilt` | `details.year_built` | Direct copy or undefined | 4-digit construction year |
| `renovationYear` | `details.renovation_year` | Direct copy or undefined | 4-digit renovation year |
| `parkingSpaces` | `details.parking_spaces` | Direct copy or undefined | Parking space count |

## Amenities & Features

| Immowelt Field | TierI Field | Transformation | Notes |
|---------------|-----------  |----------------|-------|
| `features[]` | `features` | Direct copy as string array | Feature descriptions for display |
| Feature list | `amenities.*` | Parsed via `parseAmenities()` | Extracted boolean fields from features |

## Condition & Energy

| Immowelt Field | TierI Field | Transformation | Notes |
|---------------|-----------  |----------------|-------|
| `condition` | `condition` | `normalizeCondition()` enum | Property condition state (new, good, needs_renovation, etc.) |
| `energyRating` | `energy_rating` | `normalizeEnergyRating()` (if present) | Energy Pass rating A-G |
| `heatingType` | `heating_type` | `normalizeHeatingType()` | Heating system type |
| `constructionType` | `construction_type` | `normalizeConstructionType()` | Building material/construction method |
| `buildingType` | `country_specific.building_type` | `normalizeBuildingType()` | Building classification (detached, terraced, etc.) |
| `ownershipType` | `austrian_ownership` | `normalizeOwnershipType()` | Austrian ownership type (Eigentumsrecht, Baurecht, etc.) |

## Furnished & Availability

| Immowelt Field | TierI Field | Transformation | Notes |
|---------------|-----------  |----------------|-------|
| `furnished` | `furnished` | `normalizeFurnished()` enum | Furnished status (furnished, partially_furnished, not_furnished) |
| `availableFrom` | `available_from` | Direct copy | Availability date if specified |

## Costs & Areas

| Immowelt Field | TierI Field | Transformation | Notes |
|---------------|-----------  |----------------|-------|
| `price` | `price_per_sqm` | Calculate: `price / area` rounded | Used for comparative analysis |
| `plotArea` | `country_specific.area_plot` | Direct copy | Land/plot area if applicable |
| - | `deposit` | Hard-coded undefined | Immowelt does not provide deposit separately |

## Media & Images

| Immowelt Field | TierI Field | Transformation | Notes |
|---------------|-----------  |----------------|-------|
| `images[]` | `media.images[]` | Direct copy as URL array | Array of image URLs from listing |
| `images[]` | `images` | Direct copy | Backward compatibility field |
| `images.length` | `media.total_images` | Integer count | Total image count |

## Agent & Contact

| Immowelt Field | TierI Field | Transformation | Notes |
|---------------|-----------  |----------------|-------|
| `realtor.name` | `agent.name` | Direct copy | Agent/realtor full name |
| `realtor.company` | `agent.agency` | Direct copy | Real estate agency name |
| `realtor.phone` | `agent.phone` | Direct copy | Contact phone number |
| `realtor.email` | `agent.email` | Direct copy | Contact email address |
| `realtor.logo` | `agent.agency_logo` | Direct copy | Agency logo URL |
| `realtor` (object) | `agent` (subobj) | Mapped structure | Complete contact information |

## Metadata & Publishing

| Immowelt Field | TierI Field | Transformation | Notes |
|---------------|-----------  |----------------|-------|
| `metadata.published` | `published_date` | Direct copy | When listing was published |

## Austrian-Specific Tier1 Columns

| Immowelt Field | TierI Field | Transformation | Notes |
|---------------|-----------  |----------------|-------|
| `condition` | `condition` | `normalizeCondition()` enum | Stored as dedicated column for Austrian properties |
| `heatingType` | `heating_type` | `normalizeHeatingType()` enum | Stored as dedicated column |
| `furnished` | `furnished` | `normalizeFurnished()` enum | Stored as dedicated column |
| `constructionType` | `construction_type` | `normalizeConstructionType()` enum | Stored as dedicated column |
| `availableFrom` | `available_from` | Direct copy | Stored as dedicated column |
| `metadata.published` | `published_date` | Direct copy | Stored as dedicated column |
| `parkingSpaces` | `parking_spaces` | Direct copy | Stored as dedicated column |
| `ownershipType` | `austrian_ownership` | `normalizeOwnershipType()` | Stored as dedicated column |
| - | `deposit` | Hard-coded undefined | Not available from Immowelt |

## Portal Metadata Storage

All Immowelt-specific fields stored under `portal_metadata.immowelt`:

| Immowelt Field | Storage Path | Notes |
|---------------|-----------  |-------|
| `id` | `portal_metadata.immowelt.id` | Unique listing ID |
| `propertyType` | `portal_metadata.immowelt.property_type` | Property classification |
| `transactionType` | `portal_metadata.immowelt.transaction_type` | Sale or rent |
| `condition` | `portal_metadata.immowelt.condition` | Condition state |
| `energyRating` | `portal_metadata.immowelt.energy_rating` | Energy Pass rating |
| `heatingType` | `portal_metadata.immowelt.heating_type` | Heating system |
| `constructionType` | `portal_metadata.immowelt.construction_type` | Building material |
| `buildingType` | `portal_metadata.immowelt.building_type` | Building classification |
| `yearBuilt` | `portal_metadata.immowelt.year_built` | Construction year |
| `furnished` | `portal_metadata.immowelt.furnished` | Furnished status |
| `area` | `portal_metadata.immowelt.area` | Living area m² |
| `plotArea` | `portal_metadata.immowelt.plot_area` | Land area m² |
| `availableFrom` | `portal_metadata.immowelt.available_from` | Availability date |
| `parkingSpaces` | `portal_metadata.immowelt.parking_spaces` | Parking count |
| `ownershipType` | `portal_metadata.immowelt.ownership_type` | Austrian ownership type |
| `realtor.*` | `portal_metadata.immowelt.realtor_*` | Agent contact info split |
| `realtor` (object) | `portal_metadata.immowelt.realtor` | Full contact object |
| `metadata` | `portal_metadata.immowelt.metadata` | Full metadata object |

## Country-Specific Fields (JSONB)

All Austrian-specific data also stored in `country_specific` JSONB for backward compatibility:

| Field | Storage | Source | Notes |
|-------|---------|--------|-------|
| condition | `country_specific.condition` | `condition` | Normalized enum |
| furnished | `country_specific.furnished` | `furnished` | Normalized enum |
| energy_rating | `country_specific.energy_rating` | `energyRating` | A-G scale |
| heating_type | `country_specific.heating_type` | `heatingType` | Normalized enum |
| construction_type | `country_specific.construction_type` | `constructionType` | Normalized enum |
| ownership_type | `country_specific.ownership_type` | `ownershipType` | Austrian-specific |
| building_type | `country_specific.building_type` | `buildingType` | Building classification |
| year_built | `country_specific.year_built` | `yearBuilt` | 4-digit year |
| renovation_year | `country_specific.renovation_year` | `renovationYear` | 4-digit year |
| area_living | `country_specific.area_living` | `area` | m² |
| area_plot | `country_specific.area_plot` | `plotArea` | m² |
| available_from | `country_specific.available_from` | `availableFrom` | Date string |
| parking_spaces | `country_specific.parking_spaces` | `parkingSpaces` | Count |

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

| Immowelt Field | TierI Field | Transformation | Notes |
|---------------|-----------  |----------------|-------|
| - | `status` | Hard-coded string | Always `"active"` at ingestion (listing_status_history tracks transitions) |

## Notes

1. **Data source**: Compressed JSON from SPA, may be enriched with detail page HTML
2. **Missing data prevalence**:
   - renovation_year: ~50% missing
   - parking_spaces: ~70% missing
   - condition: ~40% specified
   - energy_rating: ~60% missing

3. **Fallback behavior**:
   - Missing numeric fields default to `undefined`
   - Enum fields use fallback mappings or 'other'

4. **Compressed data**: lz-string decompression happens transparently
   - Some fields may be abbreviated in compressed form
   - All fields mapped consistently after decompression

5. **Feature list parsing**:
   - Features array contains strings describing amenities
   - Parsed into structured amenities boolean fields
   - Used for both search and display

6. **Apartment vs House classification**:
   - Immowelt explicitly provides propertyType
   - No ambiguity in classification
   - Always maps to correct partition

7. **Coordinate precision**:
   - Generally accurate to building level
   - Some listings may have approximate coordinates

8. **Building type classification**:
   - Mapped to Austrian standard: detached, terraced, apartment building, etc.
   - Used for filtering/analysis in frontend
