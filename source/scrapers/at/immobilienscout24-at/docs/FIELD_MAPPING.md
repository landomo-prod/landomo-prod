# ImmobilienScout24.at Field Mapping

Complete mapping of ImmoScout24 API response fields to Landomo TierI StandardProperty fields.

## Basic Information

| ImmoScout24 Field | TierI Field | Transformation | Notes |
|------------------|------------|----------------|-------|
| `objectData.title` | `title` | Direct copy | String, 255 chars max |
| `objectData.description` | `description` | Direct copy, substring to 100 chars if used as fallback title | Full description text, typically 100-2000 chars |
| `id` | `source_url` | Prepend `https://www.immobilienscout24.at/expose/` | Unique expose ID on portal |
| - | `source_platform` | Hard-coded string | Always `"immobilienscout24-at"` |
| `objectData.priceInformation.price` | `price` | Direct copy or 0 if missing | Integer EUR cents or whole euros (verify in API docs) |
| `objectData.priceInformation.currency` | `currency` | Direct copy or `"EUR"` | Hardcoded for Austria |

## Property Classification

| ImmoScout24 Field | TierI Field | Transformation | Notes |
|------------------|------------|----------------|-------|
| `objectData.characteristics.propertyType` | `property_type` | `mapPropertyType()` enum function | APARTMENT, HOUSE, SINGLE_FAMILY_HOUSE, MULTI_FAMILY_HOUSE, VILLA, TOWNHOUSE, LAND, COMMERCIAL, OFFICE, RETAIL, GARAGE, PARKING → apartment/house/land/commercial/other |
| `objectData.characteristics.propertyType` | `property_category` | `mapPropertyCategory()` enum function | Routes to correct DB partition: apartment, house, land, commercial (defaults to apartment) |
| `objectData.characteristics.transactionType` | `transaction_type` | `mapTransactionType()` enum function | RENT/LEASE → rent, others → sale |

## Location & Coordinates

| ImmoScout24 Field | TierI Field | Transformation | Notes |
|------------------|------------|----------------|-------|
| `objectData.localization.street` | `location.address` (street) | `buildAddress()` concatenates street + houseNumber + postalCode + city + district | String format: "Straße 1, 1010 Wien, Innere Stadt" |
| `objectData.localization.houseNumber` | `location.address` (number) | Appended to street in buildAddress() | House/building number |
| `objectData.localization.postalCode` | `location.postal_code` | Direct copy | Numeric string, 4 digits in Austria |
| `objectData.localization.city` | `location.city` | Direct copy or 'Unknown' if missing | e.g., "Wien", "Graz", "Salzburg" |
| `objectData.localization.district` | `location.region` | Used as fallback for region | District/municipal area |
| `objectData.localization.region` | `location.region` | Direct copy | Austrian state abbreviation (W, NÖ, OÖ, etc.) |
| `objectData.localization.latitude` | `location.coordinates.lat` | Direct copy if both lat+lng present | WGS84 decimal degrees |
| `objectData.localization.longitude` | `location.coordinates.lon` | Direct copy if both lat+lng present | WGS84 decimal degrees |
| - | `location.country` | Hard-coded string | Always `"Austria"` |

## Property Details

| ImmoScout24 Field | TierI Field | Transformation | Notes |
|------------------|------------|----------------|-------|
| `objectData.area.numberOfBedrooms` | `details.bedrooms` | Direct copy or undefined | Integer count, may be 0 for studios |
| `objectData.area.numberOfBathrooms` | `details.bathrooms` | Direct copy or undefined | Integer count |
| `objectData.area.numberOfRooms` | `details.rooms` | Direct copy or undefined | Total room count |
| `objectData.area.livingArea` | `details.sqm` | Prefer livingArea over usableArea | Living area in m² (more accurate than usableArea) |
| `objectData.area.usableArea` | `details.sqm` (fallback) | Use if livingArea missing | Fallback to usableArea if livingArea unavailable |
| `objectData.area.plotArea` | - | Not mapped to TierI | Stored in `country_specific.area_plot` for houses/land |
| `objectData.area.floor` | `details.floor` | Direct copy or undefined | Floor number (0 = ground, negative = basement) |
| `objectData.area.totalFloors` | `details.total_floors` | Direct copy or undefined | Total floors in building |
| `objectData.characteristics.constructionYear` | `details.year_built` | Direct copy or undefined | 4-digit year |
| `objectData.characteristics.renovationYear` | `details.renovation_year` | Direct copy or undefined | 4-digit year |

## Parking & Amenities

| ImmoScout24 Field | TierI Field | Transformation | Notes |
|------------------|------------|----------------|-------|
| `objectData.characteristics.parking` | `details.parking_spaces` | Count from parking + garage boolean flags, return 1-2 or undefined | `countParkingSpacesFromCharacteristics()` counts bools |
| `objectData.characteristics.garage` | `details.parking_spaces` | Counted in parking_spaces total | |
| `objectData.characteristics.balcony` | `amenities.has_balcony` | Boolean direct copy | |
| `objectData.characteristics.terrace` | `amenities.has_terrace` | Boolean direct copy | |
| `objectData.characteristics.garden` | `amenities.has_garden` | Boolean direct copy | |
| `objectData.characteristics.basement` | `amenities.has_basement` | Boolean direct copy | |
| `objectData.characteristics.elevator` | `amenities.has_elevator` | Boolean direct copy | |
| `objectData.characteristics.accessible` | `amenities.is_barrier_free` | Boolean direct copy | |
| `objectData.characteristics.petsAllowed` | `amenities.is_pet_friendly` | Boolean direct copy | |
| `objectData.characteristics.furnished` | `amenities.is_furnished` | Boolean direct copy | |

## Condition & Energy

| ImmoScout24 Field | TierI Field | Transformation | Notes |
|------------------|------------|----------------|-------|
| `objectData.characteristics.condition` | `condition` | `normalizeCondition()` enum | NEW, REFURBISHED, RENOVATED, GOOD, NEEDS_RENOVATION, PROJECT, UNDER_CONSTRUCTION → new, excellent, after_renovation, good, requires_renovation, project, under_construction |
| `objectData.characteristics.energyRating` | `energy_rating` | `normalizeEnergyRating()` extracts A-G | Energy Pass rating A (best) to G (worst), normalized to lowercase |
| `objectData.characteristics.heatingType` | `heating_type` | `normalizeHeatingType()` enum | CENTRAL, DISTRICT, GAS, ELECTRIC, OIL, HEAT_PUMP, FLOOR_HEATING, WOOD, SOLAR → central_heating, district_heating, gas_heating, electric_heating, oil_heating, heat_pump, floor_heating, other |
| `objectData.characteristics.buildingType` | `construction_type` | `normalizeConstructionType()` maps German terms | ziegel, beton, holz, stein, stahl, massiv, fertigteil, etc. → brick, concrete, wood, stone, steel, masonry, panel, mixed, other |
| `objectData.characteristics.buildingType` | `country_specific.building_type` | `normalizeBuildingType()` enum | einfamilienhaus, mehrfamilienhaus, reihenhaus, doppelhaushälfte, villa, etc. → detached, apartment_building, terraced, semi_detached, villa, townhouse, farmhouse, etc. |

## Furnished & Availability

| ImmoScout24 Field | TierI Field | Transformation | Notes |
|------------------|------------|----------------|-------|
| `objectData.characteristics.furnished` | `furnished` | `normalizeFurnishedStatus()` with furnishedType | FULLY_FURNISHED, PARTIALLY_FURNISHED, UNFURNISHED → furnished, partially_furnished, not_furnished |
| `objectData.characteristics.furnishedType` | `furnished` (input to normalizeFurnishedStatus) | Checked first, type overrides boolean | |
| - | `available_from` | Hard-coded undefined | ImmoScout24 API does not provide availability date |

## Costs & Pricing

| ImmoScout24 Field | TierI Field | Transformation | Notes |
|------------------|------------|----------------|-------|
| `objectData.priceInformation.price` | `price_per_sqm` | Calculate: `price / sqm` rounded to integer | Used for comparative analysis |
| `objectData.priceInformation.operatingCosts` | `hoa_fees` | Direct copy or undefined | Monthly operating/maintenance costs in EUR |
| `objectData.priceInformation.operatingCosts` | `country_specific.operating_costs` | Direct copy | Austrian-specific storage |
| `objectData.priceInformation.additionalCosts` | `hoa_fees` (fallback) | Use if operatingCosts missing | |
| `objectData.priceInformation.heatingCosts` | `country_specific.heating_costs` | Direct copy | Separate heating cost (if provided) |
| `objectData.priceInformation.deposit` | `deposit` | Direct copy or undefined | Deposit amount if applicable |
| `objectData.priceInformation.originalPrice` | `portal_metadata.immobilienscout24.original_price` | Stored for reference | Price before reduction |
| `objectData.priceInformation.priceReduction` | `portal_metadata.immobilienscout24.price_reduction` | Stored for reference | Discount amount if any |

## Media & Images

| ImmoScout24 Field | TierI Field | Transformation | Notes |
|------------------|------------|----------------|-------|
| `objectData.pictures[]` | `media.images[]` | Map to ImageData structure | Array of image objects with metadata |
| `picture.url` | `media.images[].url` | Direct copy (or urlLarge/urlMedium fallback) | Full-size image URL |
| `picture.urlSmall` | `media.images[].thumbnail_url` | Direct copy | Thumbnail URL for listings |
| `picture.caption` | `media.images[].alt` | Direct copy | Image description/alt text |
| `picture.order` | `media.images[].order` | Direct copy | Display order in gallery |
| `picture.isMainPicture` | `media.images[].is_main` | Boolean direct copy | Indicates primary image |
| `picture.width` | `media.images[].width` | Direct copy | Image pixel width |
| `picture.height` | `media.images[].height` | Direct copy | Image pixel height |
| `picture.id` | `media.images[].image_id` | Direct copy | Portal's image ID |
| `objectData.pictures[]` | `images` (backward compat) | Extract URLs only as string array | Array of URL strings for legacy support |
| `objectData.virtualTours[]` | `media.virtual_tour_url` | First item's URL | 360° virtual tour link if available |
| `objectData.floorPlans[]` | `media.floor_plan_urls` | Array of URLs | Floor plan images/documents |
| `objectData.pictures.length` | `media.total_images` | Integer count | Total image count for property |

## Agent & Contact

| ImmoScout24 Field | TierI Field | Transformation | Notes |
|------------------|------------|----------------|-------|
| `contactData.name` | `agent.name` | Direct copy or fallback to company | Agent full name or company name |
| `contactData.company` | `agent.agency` | Direct copy if agencyName missing | Fallback agency name |
| `contactData.agencyName` | `agent.agency` | Direct copy (preferred) | Real estate agency name |
| `contactData.phone` | `agent.phone` | Direct copy | Phone number |
| `contactData.mobile` | `agent.phone` (fallback) | Use if phone missing | Mobile number fallback |
| `contactData.email` | `agent.email` | Direct copy | Email address |
| `contactData.agencyLogo` | `agent.agency_logo` | Direct copy | Logo URL |

## Austrian-Specific Top-Level Columns

| ImmoScout24 Field | TierI Field | Transformation | Notes |
|------------------|------------|----------------|-------|
| `objectData.characteristics.ownershipType` | `austrian_ownership` | `normalizeOwnershipType()` enum | EIGENTUM, BAURECHT, MIETKAUF, ERBPACHT, GENOSSENSCHAFT → eigentumsrecht, baurecht, mietkauf, erbpacht, genossenschaft, other |
| `objectData.priceInformation.operatingCosts` | `austrian_operating_costs` | Direct copy | Stored as dedicated column for Austrian properties |
| `objectData.priceInformation.heatingCosts` | `austrian_heating_costs` | Direct copy | Stored as dedicated column for Austrian properties |

## Portal Metadata Storage

All ImmoScout24-specific fields stored under `portal_metadata.immobilienscout24`:

| ImmoScout24 Field | Storage Path | Notes |
|------------------|------------|-------|
| `id` | `portal_metadata.immobilienscout24.expose_id` | Unique property ID |
| `objectData.characteristics.propertyType` | `portal_metadata.immobilienscout24.property_type` | Raw enum value |
| `objectData.characteristics.propertySubType` | `portal_metadata.immobilienscout24.property_sub_type` | Sub-category if available |
| `objectData.characteristics.transactionType` | `portal_metadata.immobilienscout24.transaction_type` | SALE, RENT, LEASE, etc. |
| `objectData.priceInformation.priceType` | `portal_metadata.immobilienscout24.price_type` | SALE_PRICE, RENT_PRICE, etc. |
| `objectData.priceInformation.priceIntervalType` | `portal_metadata.immobilienscout24.price_interval_type` | MONTHLY, ANNUAL, TOTAL, etc. |
| `publishedDate` | `portal_metadata.immobilienscout24.published_date` | When listing was created |
| `lastModificationDate` | `portal_metadata.immobilienscout24.last_modification_date` | When last updated |
| `creationDate` | `portal_metadata.immobilienscout24.creation_date` | Original creation timestamp |
| `advertisementData.externalId` | `portal_metadata.immobilienscout24.external_id` | Agent's external reference ID |
| `advertisementData.provisionFree` | `portal_metadata.immobilienscout24.provision_free` | Boolean - commission-free? |
| `advertisementData.advertisementType` | `portal_metadata.immobilienscout24.advertisement_type` | Premium, standard, etc. |

## Status

| ImmoScout24 Field | TierI Field | Transformation | Notes |
|------------------|------------|----------------|-------|
| - | `status` | Hard-coded string | Always `"active"` at ingestion (listing_status_history tracks transitions) |
| `publishedDate` | `published_date` | Direct copy | Used by staleness checker (72h default) |

## Country-Specific Fields (JSONB)

All Austrian-specific data also stored in `country_specific` JSONB for backward compatibility:

| Field | Storage | Source | Notes |
|-------|---------|--------|-------|
| condition | `country_specific.condition` | `objectData.characteristics.condition` | Normalized enum |
| furnished | `country_specific.furnished` | `objectData.characteristics.furnished` | Normalized enum |
| energy_rating | `country_specific.energy_rating` | `objectData.characteristics.energyRating` | A-G scale |
| heating_type | `country_specific.heating_type` | `objectData.characteristics.heatingType` | Normalized enum |
| construction_type | `country_specific.construction_type` | `objectData.characteristics.buildingType` | Normalized enum |
| ownership_type | `country_specific.ownership_type` | `objectData.characteristics.ownershipType` | Austrian-specific |
| building_type | `country_specific.building_type` | `objectData.characteristics.buildingType` | Normalized building classification |
| year_built | `country_specific.year_built` | `objectData.characteristics.constructionYear` | 4-digit year |
| renovation_year | `country_specific.renovation_year` | `objectData.characteristics.renovationYear` | 4-digit year |
| operating_costs | `country_specific.operating_costs` | `objectData.priceInformation.operatingCosts` | Monthly EUR |
| heating_costs | `country_specific.heating_costs` | `objectData.priceInformation.heatingCosts` | Monthly EUR |
| area_living | `country_specific.area_living` | `objectData.area.livingArea` | m² |
| area_total | `country_specific.area_total` | `objectData.area.usableArea` | m² |
| area_plot | `country_specific.area_plot` | `objectData.area.plotArea` | m² for land/houses |
| accessible | `country_specific.accessible` | `objectData.characteristics.accessible` | Boolean |
| pets_allowed | `country_specific.pets_allowed` | `objectData.characteristics.petsAllowed` | Boolean |

## Features List

| ImmoScout24 Field | TierI Field | Transformation | Notes |
|------------------|------------|----------------|-------|
| Various characteristics | `features` | Array of display strings | `extractFeatures()` generates: "Balcony", "Elevator", "Parking", "Furnished", "New construction", "Energy rating: A", etc. |

## Checksum Calculation

Checksums generated for change detection:

```javascript
checksum = hash(
  portalId +
  title +
  price +
  area.livingArea +
  location.city +
  publishedDate
)
```

Used to determine if listing is new/changed/unchanged between runs.

## Notes

1. **Missing fields**: available_from, deposit (sometimes), parking_spaces (inferred only)
2. **Conditional fields**: renovation_year, year_built, bathrooms (API returns 0/null often)
3. **Enum mappings**: All enums have fallback values to prevent NULL insertions
4. **Backward compat**: All Tier1 universal fields also stored in country_specific JSONB
5. **Image fallback**: url → urlLarge → urlMedium sequence ensures best available image
6. **Address building**: Multiple localization fields combined into single readable address string
