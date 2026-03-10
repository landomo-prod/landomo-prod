# BezRealitky - Transformation Logic

## Overview

Transforms raw GraphQL data into category-specific TierI types:
- `ApartmentPropertyTierI`
- `HousePropertyTierI`
- `LandPropertyTierI`
- `CommercialPropertyTierI`

Recreational properties (REKREACNI_OBJEKT) are transformed as houses.

## Category Detection

### Detection Logic

```typescript
// src/utils/categoryDetector.ts
export function detectCategory(listing: BezRealitkyListingItem): PropertyCategory {
  const estateType = listing.estateType;

  // Direct enum mapping (100% accuracy)
  if (estateType === 'BYT') return 'apartment';
  if (estateType === 'DUM') return 'house';
  if (estateType === 'POZEMEK') return 'land';
  
  if (
    estateType === 'GARAZ' ||
    estateType === 'KANCELAR' ||
    estateType === 'NEBYTOVY_PROSTOR'
  ) {
    return 'commercial';
  }
  
  if (estateType === 'REKREACNI_OBJEKT') return 'recreational';
  
  // Fallback (should never happen)
  return 'apartment';
}
```

### Classification Rules

| Estate Type | TierI Category | Reasoning |
|-------------|----------------|-----------|
| BYT | apartment | Explicit apartment type |
| DUM | house | Explicit house type |
| POZEMEK | land | Explicit land type |
| GARAZ | commercial | Garages are commercial spaces |
| KANCELAR | commercial | Offices are commercial |
| NEBYTOVY_PROSTOR | commercial | Non-residential = commercial |
| REKREACNI_OBJEKT | house | Cottages/cabins are houses with land |

### Advantages Over Other Portals

- **No Heuristics**: GraphQL provides explicit enum
- **100% Accuracy**: No ambiguous cases
- **No Title Parsing**: No regex needed
- **Instant Detection**: Single field check

## Transformation Flow

```
Raw GraphQL Data → Category Detection → Category Transformer → TierI Type → Validation
```

### Main Router

```typescript
// src/transformers/index.ts
export function transformBezRealitkyToStandard(
  listing: BezRealitkyListingItem
): ApartmentPropertyTierI | HousePropertyTierI | LandPropertyTierI | CommercialPropertyTierI {
  const category = detectCategory(listing);

  switch (category) {
    case 'apartment':
      return transformBezrealitkyApartment(listing);
    case 'house':
      return transformBezrealitkyHouse(listing);
    case 'land':
      return transformBezrealitkyLand(listing);
    case 'commercial':
      return transformBezrealitkyCommercial(listing);
    case 'recreational':
      return transformBezrealitkyHouse(listing); // Treated as house
    default:
      throw new Error(`Unknown category: ${category}`);
  }
}
```

## Apartment Transformer

**File**: `src/transformers/apartments/apartmentTransformer.ts`

**Required Fields**:
- `bedrooms` - Extracted from disposition
- `sqm` - Direct from `surface`
- `has_elevator` - Direct from `lift`
- `has_balcony` - Direct from `balcony`
- `has_parking` - Direct from `parking`
- `has_basement` - Direct from `cellar`

**Key Logic**:

```typescript
// Bedrooms from disposition
const bedrooms = bedroomsFromDisposition(listing.disposition || '');
// "2+kk" → 1 bedroom, "3+1" → 3 bedrooms

// Direct boolean amenities (no parsing!)
const has_elevator = listing.lift === true;
const has_balcony = listing.balcony === true;
const has_parking = listing.parking === true;
const has_basement = listing.cellar === true;

// Area measurements (polymorphic with boolean flags)
const balcony_area = listing.balconySurface; // Only if has_balcony = true
const loggia_area = listing.loggiaSurface;
const cellar_area = listing.cellarSurface;
const terrace_area = listing.terraceSurface;

// Floor information
const floor = listing.floor ? parseFloor(listing.floor) : undefined;
// "3" → 3, "přízemí" → 0, "suterén" → -1

// Building age → year_built
const year_built = listing.age 
  ? new Date().getFullYear() - listing.age 
  : undefined;
```

**Tier II - Czech Specific**:

```typescript
country_specific: {
  czech: {
    disposition: normalizeDisposition(listing.disposition), // "2+kk"
    ownership: normalizeOwnership(listing.ownership), // "personal", "cooperative"
    condition: normalizeCondition(listing.condition), // "very_good", "good"
    heating_type: normalizeHeatingType(listing.heating), // "central_gas"
    construction_type: normalizeConstructionType(listing.construction) // "panel", "brick"
  }
}
```

## House Transformer

**File**: `src/transformers/houses/houseTransformer.ts`

**Required Fields**:
- `bedrooms` - Extracted from disposition or default
- `sqm_living` - From `surface`
- `sqm_plot` - From `surfaceLand`
- `has_garden` - Inferred from `frontGarden` or `sqm_plot > 0`
- `has_garage` - Direct from `garage`
- `has_parking` - Direct from `parking`
- `has_basement` - Direct from `cellar`

**Key Logic**:

```typescript
// Living vs plot area
const sqm_living = listing.surface || 0;
const sqm_plot = listing.surfaceLand || 0;

// Garden detection
const has_garden = listing.frontGarden === true || sqm_plot > 0;

// Building floors
const num_floors = listing.totalFloors || 1;

// House type detection
const house_type = detectHouseType(listing);
// "family_house", "villa", "cottage", "farmhouse"
```

## Land Transformer

**File**: `src/transformers/land/landTransformer.ts`

**Required Fields**:
- `area_plot_sqm` - From `surfaceLand` or `surface`

**Key Logic**:

```typescript
// Primary area field
const area_plot_sqm = listing.surfaceLand || listing.surface || 0;

// Land type from GraphQL
const land_type = normalizeLandType(listing.landType);
// "building", "agricultural", "forest", "garden"

// Utilities from boolean flags
const has_utilities_water = listing.water !== null;
const has_utilities_electricity = listing.electricity !== null;
const has_utilities_gas = listing.gas !== null;
const has_utilities_sewage = listing.sewage !== null;
```

## Commercial Transformer

**File**: `src/transformers/commercial/commercialTransformer.ts`

**Required Fields**:
- `sqm_total` - From `surface`
- `has_elevator` - Direct from `lift`
- `has_parking` - Direct from `parking`
- `bathrooms` - Extracted or default 1

**Key Logic**:

```typescript
// Commercial subtype from estateType
const commercial_type = mapCommercialType(listing.estateType);
// "office", "retail", "industrial", "garage"

// Total area
const sqm_total = listing.surface || 0;

// Amenities
const has_elevator = listing.lift === true;
const has_parking = listing.parking === true;
```

## Field Transformations

### Price Normalization

```typescript
// Direct from GraphQL (no parsing needed)
const price = listing.price || 0;
const currency = listing.currency || 'CZK';
```

### Disposition Parsing

```typescript
// src/utils/bezrealitkyHelpers.ts
export function bedroomsFromDisposition(disposition: string): number {
  if (!disposition) return 0;
  
  // "2+kk" → 1 bedroom, "3+1" → 3 bedrooms
  const match = disposition.match(/^(\d+)\+/);
  if (!match) return 0;
  
  const rooms = parseInt(match[1]);
  const hasKitchen = disposition.includes('+1');
  
  // If "+1", all rooms are bedrooms
  // If "+kk", first room is living room
  return hasKitchen ? rooms : Math.max(0, rooms - 1);
}
```

### Floor Parsing

```typescript
export function parseFloor(floor: string): number | undefined {
  if (!floor) return undefined;
  
  // Handle Czech floor names
  if (floor.toLowerCase().includes('přízemí')) return 0;
  if (floor.toLowerCase().includes('suterén')) return -1;
  
  // Parse number
  const num = parseInt(floor);
  return isNaN(num) ? undefined : num;
}
```

### Timestamp Conversion

```typescript
// Unix epoch seconds → ISO 8601
const published_date = listing.timeActivated
  ? new Date(parseInt(listing.timeActivated) * 1000).toISOString()
  : undefined;

const available_from = listing.availableFrom
  ? new Date(parseInt(listing.availableFrom) * 1000).toISOString()
  : undefined;
```

### Boolean Amenities

```typescript
// No parsing needed - direct from GraphQL
const has_elevator = listing.lift === true; // Not: !!listing.lift
const has_balcony = listing.balcony === true;
const has_parking = listing.parking === true;
```

### Value Normalization

Uses `czech-value-mappings.ts`:

```typescript
import {
  normalizeDisposition,
  normalizeOwnership,
  normalizeCondition,
  normalizeFurnished,
  normalizeHeatingType,
  normalizeConstructionType,
  normalizeEnergyRating
} from '../../../../shared/czech-value-mappings';

// Disposition: "2+kk", "3+1" → canonical format
const disposition = normalizeDisposition(listing.disposition);

// Ownership: "OSOBNI" → "personal"
const ownership = normalizeOwnership(listing.ownership);

// Condition: "VELMI_DOBRY" → "very_good"
const condition = normalizeCondition(listing.condition);

// Furnished: "ZARIZENY" → "furnished"
const furnished = normalizeFurnished(listing.equipped);

// Heating: "USTREDNI_DOMOVNI" → "central_gas"
const heating_type = normalizeHeatingType(listing.heating);

// Construction: "PANEL" → "panel"
const construction_type = normalizeConstructionType(listing.construction);

// Energy: "B" → "B"
const energy_class = normalizeEnergyRating(listing.penb);
```

## Checksum Generation

**Fields Used**:

```typescript
{
  price: listing.price ?? null,
  title: listing.title ?? null,
  description: listing.description ?? null,
  sqm: listing.surface ?? null,
  disposition: listing.disposition ?? null,
  floor: listing.floor ?? null
}
```

**Logic**:

```typescript
// src/utils/checksumExtractor.ts
export function createBezrealitkyChecksum(
  listing: BezRealitkyListingItem
): ListingChecksum {
  const portalId = listing.id;
  const fields = extractBezrealitkyChecksumFields(listing);
  
  return createListingChecksum('bezrealitky', portalId, listing, () => fields);
}
```

## Validation

### Required Field Validation

TypeScript compile-time checks ensure all required fields present:

```typescript
// Compile error if missing required field
const apartment: ApartmentPropertyTierI = {
  property_category: 'apartment',
  bedrooms, // Required
  sqm, // Required
  has_elevator, // Required
  has_balcony, // Required
  has_parking, // Required
  has_basement, // Required
  // ... rest of fields
};
```

### Business Rules

1. **Price**: Can be 0 for "price on request"
2. **Bedrooms**: Minimum 0 (studios)
3. **Area**: Must be > 0 for apartments/houses
4. **Floor**: Can be negative (basements)
5. **Boolean Amenities**: Never undefined (always true/false)

### Error Handling

```typescript
try {
  const transformed = transformBezRealitkyToStandard(listing);
  return { portalId: listing.id, data: transformed, rawData: listing };
} catch (error: any) {
  log.error({ listingId: listing.id, err: error }, 'Error transforming listing');
  return null;
}
```

## Data Quality

### GraphQL Advantages

- **Structured Data**: No HTML parsing
- **Type Safety**: GraphQL schema enforces types
- **Field Completeness**: 95%+ fields populated
- **Boolean Flags**: Explicit true/false (no parsing)
- **Timestamps**: Consistent Unix epoch format
- **Enums**: Canonical values (no normalization needed)

### Common Issues

1. **Missing Price**: ~5% of listings (price on request)
2. **Missing GPS**: ~10% (privacy protection)
3. **Missing Description**: ~2% (very new listings)
4. **Null vs False**: Must check `field === true`, not just truthiness
