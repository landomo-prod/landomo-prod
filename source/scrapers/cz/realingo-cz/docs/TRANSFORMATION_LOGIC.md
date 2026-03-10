# Realingo - Transformation Logic

## Overview

Transforms raw `RealingoOffer` objects from the GraphQL API into category-specific TierI types:
- `ApartmentPropertyTierI` (FLAT)
- `HousePropertyTierI` (HOUSE)
- `LandPropertyTierI` (LAND)
- `CommercialPropertyTierI` (COMMERCIAL)
- `OtherPropertyTierI` (OTHERS)

## Category Detection

### Detection Flow
```
offer.property
    |
    +--> "COMMERCIAL" --> transformRealingoCommercial()
    +--> "OTHERS"     --> transformRealingoOthers()
    +--> "FLAT"       --> detectPropertyCategory() --> "apartment" --> transformRealingoApartment()
    +--> "HOUSE"      --> detectPropertyCategory() --> "house"     --> transformRealingoHouse()
    +--> "LAND"       --> detectPropertyCategory() --> "land"      --> transformRealingoLand()
    +--> undefined    --> detectPropertyCategory() fallback        --> "apartment" (default)
```

### Detection Logic

COMMERCIAL and OTHERS are routed directly by `offer.property`. For FLAT/HOUSE/LAND, `detectPropertyCategory()` combines `property` and `category` fields:

```typescript
function detectPropertyCategory(propertyType?: string, category?: string): 'apartment' | 'house' | 'land' {
  const searchText = `${propertyType || ''} ${category || ''}`.toLowerCase();

  if (propertyType === 'LAND' || searchText.includes('land') || searchText.includes('pozemek'))
    return 'land';
  if (propertyType === 'HOUSE' || searchText.includes('house') || searchText.includes('family'))
    return 'house';
  if (searchText.includes('flat') || searchText.includes('byt') || /\d\+(?:kk|1)/.test(searchText))
    return 'apartment';

  return 'apartment'; // Default
}
```

### Classification Rules
| `offer.property` | `offer.category` | TierI Category |
|-------------------|-------------------|----------------|
| `FLAT` | `FLAT3_KK` | apartment |
| `HOUSE` | `HOUSE_FAMILY` | house |
| `LAND` | `LAND_BUILDING` | land |
| `COMMERCIAL` | any | commercial |
| `OTHERS` | any | other |
| undefined | contains `flat`/`byt` | apartment |
| undefined | contains `house`/`family` | house |
| undefined | anything else | apartment (default) |

## Disposition Parsing

The `categoryParser.ts` utility extracts disposition info from the `category` field:

```typescript
parseDisposition("FLAT3_KK")  // { disposition: "3+kk", bedrooms: 3, rooms: 4 }
parseDisposition("FLAT2_1")   // { disposition: "2+1", bedrooms: 2, rooms: 3 }
parseDisposition("HOUSE_FAMILY") // { subtype: "family" }
parseDisposition("LAND_BUILDING") // { subtype: "building" }
```

Pattern: `FLAT{N}_{KK|1}` where N = room count. Bedrooms = N, rooms = N+1.

## Category Transformers

### Apartment Transformer
**File**: `src/transformers/apartments/realingoApartmentTransformer.ts`

**Key mappings**:
- `bedrooms`: from disposition parsing (default: 1)
- `rooms`: from disposition parsing (bedrooms + 1)
- `sqm`: `area.floor` (default: 0)
- `has_elevator/balcony/basement/parking`: all `false` (not in API)
- `bathrooms`: hardcoded `1`
- `title`: disposition string or category

### House Transformer
**File**: `src/transformers/houses/realingoHouseTransformer.ts`

**Key mappings**:
- `sqm_living`: `area.floor` (default: 0)
- `sqm_plot`: `area.plot` (default: 0)
- `bedrooms`: hardcoded `1`
- `stories`: hardcoded `1`
- `has_*`: all `false`
- `title`: subtype from category or raw category string

### Land Transformer
**File**: `src/transformers/land/realingoLandTransformer.ts`

**Key mappings**:
- `area_plot_sqm`: `area.plot` or fallback to `area.floor` (default: 0)
- Infrastructure fields (water, sewage, electricity, gas, road): all `undefined`
- `title`: subtype from category or raw category string

### Commercial Transformer
**File**: `src/transformers/commercial/realingoCommercialTransformer.ts`

**Key mappings**:
- `sqm_total`: `area.floor` (default: 0)
- `has_elevator/parking`: `false`
- `has_bathrooms`: `false`
- `title`: raw category string

### Others Transformer
**File**: `src/transformers/others/realingoOthersTransformer.ts`

**Key mappings**:
- `sqm_total`: `area.floor` (default: 0)
- `property_subtype`: hardcoded `"other"`
- `has_parking/has_electricity`: `false`

## Common Transformation Patterns

### Location Parsing
All transformers share the same location logic:
```typescript
const addressParts = (offer.location?.address || '').split(',').map(s => s.trim());
const location = {
  address: offer.location?.address || 'Unknown',
  city: addressParts[addressParts.length - 1] || 'Unknown',  // Last part = city
  region: addressParts.length > 1 ? addressParts[0] : undefined, // First part = region
  country: 'Czech Republic',
  coordinates: { lat, lon }  // if both present
};
```

### Transaction Type
```typescript
const transaction_type = offer.purpose === 'RENT' ? 'rent' : 'sale';
```

### Image URL Construction
```typescript
const imageUrl = offer.photos?.main ? `https://www.realingo.cz/image/${offer.photos.main}` : undefined;
const galleryUrls = (offer.photos?.list || []).map(img => `https://www.realingo.cz/image/${img}`);
```

### Source URL Construction
```typescript
const source_url = offer.url
  ? `https://www.realingo.cz${offer.url}`
  : `https://www.realingo.cz/nemovitost/${offer.id}`;
```

### Portal ID
```typescript
const portal_id = `realingo-${offer.id}`;
```

## Checksum Generation

**File**: `src/utils/checksumExtractor.ts`

**Fields used**:
```typescript
{
  price: offer.price?.total ?? null,
  title: offer.category ?? null,
  description: offer.url ?? null,
  sqm: offer.area?.floor ?? null,
  disposition: offer.category ?? null,
  purpose: offer.purpose ?? null,
}
```

Uses `createListingChecksum` from `@landomo/core` to generate hash.

## Validation

### Required Field Handling
- All required TierI fields are populated with defaults when API data is missing
- Numeric defaults: `0` for price, sqm, bedrooms
- Boolean defaults: `false` for all `has_*` fields
- String defaults: `''` for description, `'Unknown'` for address/city

### Type Safety
- TypeScript compile-time checks via return type annotations
- Each transformer returns its specific TierI type
- `as const` assertions on `property_category` and `status`

### No Runtime Validation
- No explicit runtime validation or listing rejection
- Listings with missing critical data (e.g., no price, no area) are still ingested with defaults
