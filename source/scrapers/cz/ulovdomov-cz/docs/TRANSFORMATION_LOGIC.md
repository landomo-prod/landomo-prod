# UlovDomov - Transformation Logic

## Overview

Transforms `UlovDomovOffer` (API response) into `StandardProperty` (ingest format) with category-specific TierI typing. Uses shared Czech value normalization functions from `czech-value-mappings.js`.

## Category Detection

### Detection Logic
Direct 1:1 mapping from API `propertyType` field:

```typescript
function mapPropertyType(propertyType?: string): string {
  const typeMap: Record<string, string> = {
    'FLAT': 'apartment',
    'HOUSE': 'house',
    'ROOM': 'room',
    'LAND': 'land',
    'COMMERCIAL': 'commercial'
  };
  return propertyType ? (typeMap[propertyType] || 'other') : 'other';
}
```

### Classification Rules
| API propertyType | TierI Category | Notes |
|---|---|---|
| FLAT | apartment | Most common |
| HOUSE | house | |
| LAND | land | |
| COMMERCIAL | commercial | |
| ROOM | room (maps to other) | Single rooms, not full apartments |
| (missing/unknown) | other | Fallback |

No ambiguous cases -- the API provides explicit property type classification.

## Transformation Flow

```
UlovDomovOffer
    -> mapPropertyType() -> property_category
    -> buildAddress() -> location.address
    -> extractBedrooms() -> details.bedrooms
    -> extractRooms() -> details.rooms
    -> normalizeCondition/HeatingType/Furnished/etc -> Tier 1 fields
    -> parseCzechFeatures() -> amenities
    -> Output: StandardProperty
```

## Key Transformations

### Bedroom Extraction
Parses Czech disposition format. Extracts the leading number:

```typescript
function extractBedrooms(disposition?: string): number | undefined {
  if (!disposition) return undefined;
  const match = disposition.match(/^(\d)/);
  return match ? parseInt(match[1]) : undefined;
}
```

| Disposition | Bedrooms |
|---|---|
| "1+kk" | 1 |
| "2+1" | 2 |
| "3+kk" | 3 |
| "4+1" | 4 |

### Room Count Extraction
Accounts for kitchen type (`+kk` = kitchenette integrated, `+1` = separate kitchen):

```typescript
function extractRooms(disposition?: string): number | undefined {
  const match = disposition.match(/^(\d)\+(\d|kk)/i);
  if (!match) return undefined;
  const baseRooms = parseInt(match[1]);
  const additional = match[2].toLowerCase() === 'kk' ? 0 : 1;
  return baseRooms + additional;
}
```

| Disposition | Rooms | Logic |
|---|---|---|
| "2+kk" | 2 | 2 rooms, kitchenette integrated |
| "2+1" | 3 | 2 rooms + separate kitchen |
| "3+kk" | 3 | 3 rooms, kitchenette integrated |

### Price Per Sqm
```typescript
price_per_sqm: offer.price && offer.area
  ? Math.round(offer.price / offer.area) : undefined
```

### Address Building
Concatenates available location parts:
```typescript
function buildAddress(location): string | undefined {
  const parts = [location.street, location.city, location.district].filter(Boolean);
  return parts.length > 0 ? parts.join(', ') : undefined;
}
```

### Floor Location
```typescript
function extractFloorLocation(floorNum?: number) {
  if (floorNum === 0) return 'ground_floor';
  if (floorNum >= 1) return 'middle_floor';
  return undefined;
}
```
Note: `top_floor` is never returned because the API does not reliably indicate the last floor.

### Heating Type Extraction
Scans the `features` array for Czech heating keywords:
```typescript
function extractHeatingFromFeatures(features?: string[]): string | undefined {
  const heatingFeature = features.find(f =>
    f?.toLowerCase().includes('topeni') ||
    f?.toLowerCase().includes('heating') ||
    f?.toLowerCase().includes('tepelne cerpadlo')
  );
  return heatingFeature;
}
```
Result is then passed through `normalizeHeatingType()` from shared mappings.

### Boolean Amenity Fields
Amenity booleans use a pattern of `!== false` to distinguish between `false` (explicitly no) and `undefined` (unknown):
```typescript
has_parking: offer.parking !== false ? offer.parking : undefined,
has_balcony: offer.balcony !== false ? offer.balcony : undefined,
```
Additionally merged with `parseCzechFeatures(offer.features)` from shared mappings.

## Shared Normalization Functions

From `scrapers/Czech Republic/shared/czech-value-mappings.js`:

| Function | Input Example | Output |
|---|---|---|
| `normalizeDisposition()` | "2+kk" | Normalized disposition |
| `normalizeOwnership()` | "Osobni" | Normalized ownership |
| `normalizeCondition()` | "Dobry stav" | Normalized condition |
| `normalizeFurnished()` | "YES" / "PARTIAL" | "furnished" / "partially_furnished" |
| `normalizeEnergyRating()` | "C" | Normalized rating |
| `normalizeHeatingType()` | "Ustredni topeni" | Normalized heating |
| `normalizeConstructionType()` | "Cihla" | Normalized construction |
| `parseCzechFeatures()` | ["Balkon", "Vytah"] | `{ has_balcony: true, ... }` |

## HTML Data Mapper (`htmlDataMapper.ts`)

When using the HTML fallback scraper, `mapHtmlToUlovDomovOffer()` maps the `__NEXT_DATA__` structure to `UlovDomovOffer`:

- Location: `village.name` -> `location.city`, `villagePart.name` -> `location.district`
- Price: `rentalPrice.value` / `salePrice.value` based on `offerType`
- Features: Merges `convenience[]` + `houseConvenience[]` arrays
- Amenities: `extractFeatures()` scans feature names for Czech keywords (parking, balkon, vytah, sklep, etc.)
- Furnished: Extracted from feature names ("zarizeny" -> YES, "castecne" -> PARTIAL, "nezarizeny" -> NO)
- Images: `photos[].url` mapped to string array

## Validation

- No explicit runtime validation beyond TypeScript types
- Missing `property_category` would cause ingest rejection
- Price defaults to 0 if missing
- Title defaults to "Unknown" if missing
- Bathrooms default to 1 (API never provides this)
- Failed transformations are caught per-listing and skipped
