# iDNES Reality - Transformation Logic

## Overview

Transforms raw `IdnesListing` into category-specific TierI types:
- `ApartmentPropertyTierI` (apartments, and default for commercial/recreation)
- `HousePropertyTierI` (houses)
- `LandPropertyTierI` (land/plots)

No dedicated `CommercialPropertyTierI` or `OtherPropertyTierI` transformer exists -- commercial and recreation listings fall through to the apartment default.

## Category Detection

**File**: `src/transformers/idnesTransformer.ts`

The `detectPropertyCategory()` function examines `propertyType` + `title` as combined lowercase text:

| Search Terms | Detected Category |
|-------------|-------------------|
| `land`, `pozemek`, `parcela` | `land` |
| `house`, `dum`, `rodinny`, `\brd\b` | `house` |
| `apartment`, `byt`, `flat`, `\d+(?:kk\|1)` | `apartment` |
| *(none match)* | `apartment` (default) |

**Priority**: Land checked first, then house, then apartment. Default is apartment.

**Note**: The `propertyType` is pre-set by the scraper from the `CATEGORIES` config, so detection is mostly redundant but acts as a safety net.

## Apartment Transformer

**File**: `src/transformers/apartments/idnesApartmentTransformer.ts`

### Key Transformations

| Source | Target Field | Logic |
|--------|-------------|-------|
| `listing.rooms` | `bedrooms` | First number extracted via regex, default 1 |
| `listing.area` | `sqm` | Direct, default 0 |
| `listing.floor` | `floor` | Direct from detail attributes |
| `listing.floor` | `floor_location` | 0=ground, >=1=middle, undefined if unknown |
| `listing.features[]` | `has_elevator`, `has_balcony`, `has_basement`, `has_parking` | Via `parseCzechFeatures()` |
| `listing.condition` | `condition` | Via `normalizeCondition()` + remapping |
| `listing.heatingType` | `heating_type` | Via `normalizeHeatingType()` |
| `listing.constructionType` | `construction_type` | Via `normalizeConstructionType()` |
| `listing.energyRating` | `energy_class` | Via `normalizeEnergyRating()` |
| `listing.furnished` | `furnished` | Via `normalizeFurnished()` |
| `listing._attributes` | `deposit` | Czech keys: Kauce, Vratna kauce, Jistina, Deposit |
| `listing._attributes` | `renovation_year` | Czech keys: Rok rekonstrukce, Rekonstrukce rok |
| `listing._attributes` | `available_from` | Czech keys: K nastehování, Dostupne od, Volne od |

### Condition Remapping
After `normalizeCondition()`, additional mapping:
- `very_good` -> `excellent`
- `before_renovation` -> `requires_renovation`
- `project` -> `new`
- `under_construction` -> `new`

### Hardcoded Defaults
- `bathrooms`: always `1`
- `currency`: always `CZK`
- `property_category`: `apartment`
- `source_platform`: `idnes-reality`
- `status`: `active`

## House Transformer

**File**: `src/transformers/houses/idnesHouseTransformer.ts`

Follows same pattern as apartment with these differences:

| Source | Target Field | Logic |
|--------|-------------|-------|
| `listing.area` | `sqm_living` | Direct, default 0 |
| *(not available)* | `sqm_plot` | Hardcoded 0 (iDNES doesn't provide in list view) |
| `listing.features[]` | `has_garden`, `has_garage` | Via `parseCzechFeatures()` |
| `has_garage` | `garage_count` | 1 if has_garage, else undefined |
| `has_parking` | `parking_spaces` | 1 if has_parking, else undefined |

### Hardcoded Defaults
- `has_pool`: `false`
- `has_fireplace`: `false`
- `bathrooms`: `1`

## Land Transformer

**File**: `src/transformers/land/idnesLandTransformer.ts`

Minimal transformer since iDNES provides limited land data:

| Source | Target Field | Logic |
|--------|-------------|-------|
| `listing.area` | `area_plot_sqm` | Direct, default 0 |
| `listing.ownership` | `ownership_type` | Direct cast |

### Not Available from Portal
- `zoning`, `land_type`, `water_supply`, `sewage`, `electricity`, `gas`, `road_access`
- `building_permit`, `max_building_coverage`, `max_building_height`
- `terrain`, `soil_quality`, `cadastral_number`

## Shared Utilities

### Czech Value Mappings
**File**: `scrapers/Czech Republic/shared/czech-value-mappings.js`

Used across all transformers:
- `normalizeCondition()` - Czech condition text -> normalized enum
- `normalizeHeatingType()` - Czech heating text -> normalized enum
- `normalizeConstructionType()` - Czech construction text -> normalized enum
- `normalizeEnergyRating()` - Czech energy class text -> A-G
- `normalizeFurnished()` - Czech furnished text -> normalized enum
- `parseCzechFeatures()` - Feature string array -> boolean amenity flags

## Checksum Generation

**File**: `src/utils/checksumExtractor.ts`

Fields used for change detection:
```typescript
{
  price: listing.price,
  title: listing.title,
  description: listing.description,
  sqm: listing.area,
  disposition: listing.rooms,
  floor: listing.floor
}
```

These fields are hashed to detect listing changes. Other fields (images, agent info, metadata) do not trigger re-ingestion.

## Portal ID Format

All portal IDs are prefixed: `idnes-{listing.id}`

Where `listing.id` is either:
- A 24-character hex string from the URL path
- A numeric ID from URL or `data-id` attribute
