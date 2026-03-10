# Czech Republic Property Schema Guide

**Target Market**: Czech Republic only
**Source**: Czech scrapers (sreality, bezrealitky, reality, idnes, ulovdomov, etc.)

---

## Czech-Specific Fields

### 1. **Disposition** (`czech_disposition`)
Czech room layout notation unique to Czech/Slovak markets.

**Examples**:
- `1+kk` - 1 room + kitchenette
- `1+1` - 1 room + separate kitchen
- `2+kk` - 2 rooms + kitchenette
- `2+1` - 2 rooms + separate kitchen
- `3+kk` - 3 rooms + kitchenette (most common)
- `3+1` - 3 rooms + separate kitchen
- `4+kk`, `5+1`, etc.

**Extraction**:
```typescript
// Backend: country_specific.czech.disposition
// Frontend: getDisposition(property) or property.czech_disposition
```

### 2. **Ownership** (`czech_ownership`)
Type of property ownership in Czech Republic.

**Values**:
- `personal` - Personal ownership (Osobní)
- `cooperative` - Cooperative ownership (Družstevní)
- `state` - State ownership (Státní)
- `other` - Other

**Extraction**:
```typescript
// Backend: country_specific.czech.ownership
// Frontend: property.czech_ownership
```

### 3. **Building Type** (`construction_type`)
Material/construction of the building.

**Values**:
- `brick` - Brick building (Cihlová)
- `panel` - Panel building (Panelová) - Communist-era prefab
- `stone` - Stone
- `wood` - Wooden
- `other` - Other materials

**Extraction**:
```typescript
// Backend: construction_type (Tier I)
// Frontend: property.construction_type
```

### 4. **Condition** (`condition`)
Property condition/state.

**Values**:
- `after_reconstruction` - After reconstruction
- `very_good` - Very good
- `good` - Good
- `original_state` - Original state
- `under_construction` - Under construction
- `project` - Project/planning phase

**Extraction**:
```typescript
// Backend: condition (Tier I)
// Frontend: property.condition
```

### 5. **Heating Type** (`heating_type`)
Type of heating system.

**Common Values**:
- `central` - Central heating (Ústřední)
- `gas` - Gas heating (Plynové)
- `electric` - Electric heating (Elektrické)
- `remote` - Remote/district heating (Dálkové)
- `solid_fuel` - Solid fuel (coal, wood)
- `heat_pump` - Heat pump

**Extraction**:
```typescript
// Backend: heating_type (Tier I)
// Frontend: property.heating_type
```

### 6. **Energy Rating** (`energy_class`)
Energy efficiency class (EU standard).

**Values**: `A` (best) to `G` (worst)

**Extraction**:
```typescript
// Backend: energy_class or country_specific.czech.energy_rating
// Frontend: property.energy_class
```

### 7. **Furnished** (`furnished`)
Furniture status.

**Values**:
- `furnished` - Fully furnished
- `partially_furnished` - Partially furnished
- `unfurnished` - Not furnished
- `true`/`false` (legacy boolean)

**Extraction**:
```typescript
// Backend: furnished (Tier I)
// Frontend: property.furnished
```

---

## Apartment-Specific Fields

### Core Fields
```typescript
{
  property_category: 'apartment',
  bedrooms: number,          // Extracted from disposition
  bathrooms: number,
  sqm: number,              // Living area
  floor: number,            // Floor number (0 = ground)
  total_floors: number,     // Floors in building
  rooms: number,            // Total rooms
}
```

### Amenities (Always Boolean)
```typescript
{
  has_elevator: boolean,    // Výtah
  has_balcony: boolean,     // Balkón
  has_basement: boolean,    // Sklep/Suterén
  has_parking: boolean,     // Parkování
  has_loggia: boolean,      // Lodžie (Czech-specific)
  has_terrace: boolean,     // Terasa
  has_garage: boolean,      // Garáž
}
```

### Additional Areas
```typescript
{
  balcony_area?: number,    // m²
  loggia_area?: number,     // m² (lodžie)
  cellar_area?: number,     // m² (sklep)
  terrace_area?: number,    // m²
}
```

### Building Context
```typescript
{
  year_built?: number,          // Rok stavby
  renovation_year?: number,     // Rok rekonstrukce
  construction_type?: string,   // brick/panel/etc
  condition?: string,           // Property condition
  floor_location?: string,      // 'ground' | 'middle' | 'top'
}
```

---

## House-Specific Fields

```typescript
{
  property_category: 'house',
  bedrooms: number,
  bathrooms: number,
  sqm_living: number,       // Living area
  sqm_plot: number,         // Plot/land area
  has_garden: boolean,
  has_garage: boolean,
  has_parking: boolean,
  has_basement: boolean,
}
```

---

## Data Flow

### Backend → Frontend Transformation

```typescript
// Backend PropertyResult (from search-service API)
{
  id: "sreality-12345",
  portal: "sreality",
  portal_id: "12345",
  title: "Prodej bytu 3+kk 78 m²",
  price: 7500000,
  currency: "CZK",
  property_category: "apartment",
  transaction_type: "sale",

  // Location
  city: "Praha 2",
  region: "Prague",
  country: "cz",
  latitude: 50.0755,
  longitude: 14.4378,

  // Apartment details
  bedrooms: 3,
  bathrooms: 1,
  sqm: 78,
  floor: 3,
  total_floors: 5,

  // Amenities
  has_elevator: false,
  has_balcony: true,
  has_parking: true,
  has_basement: true,

  // Building
  year_built: 1928,
  construction_type: "brick",
  condition: "after_reconstruction",
  heating_type: "central",
  furnished: "unfurnished",

  // Czech-specific (in country_specific.czech)
  czech_disposition: "3+kk",
  czech_ownership: "personal",

  // Media
  images: ["url1", "url2", "url3"],
  description: "Beautiful apartment...",

  // Metadata
  created_at: "2026-01-15T10:00:00Z",
  updated_at: "2026-02-10T14:30:00Z",
  status: "active"
}
```

### Frontend Computed Fields

```typescript
// adaptProperty() adds these:
{
  coordinates: { lat: 50.0755, lng: 14.4378 },
  features: [
    { id: 'parking', name: 'Parking', icon: 'parking-circle' },
    { id: 'balcony', name: 'Balcony', icon: 'snowflake' },
    { id: 'basement', name: 'Basement', icon: 'box' }
  ],
  pricePerSqm: 96154, // 7500000 / 78
  agent: undefined
}
```

---

## Display Helpers

### Price Formatting
```typescript
import { formatPrice } from '@/types/property';

formatPrice(7500000, 'CZK')  // "Kč7,500,000"
formatPrice(285000, 'EUR')   // "€285,000"
```

### Disposition Display
```typescript
import { getDisposition } from '@/types/property';

getDisposition(property)  // "3+kk" or "2+1"
```

### Floor Display
```typescript
import { getFloorDisplay } from '@/types/property';

getFloorDisplay(0)   // "Ground"
getFloorDisplay(3)   // "3rd"
getFloorDisplay(12)  // "12th"
```

### Property Address
```typescript
import { getPropertyAddress } from '@/types/property';

getPropertyAddress(property)  // Uses title field
// "Prodej bytu 3+kk 78 m²" or falls back to city
```

---

## Common Czech Portal Features

### SReality
- Disposition in title
- Czech ownership types
- Panel vs. Brick buildings
- Energy class (A-G)
- Balcony/Loggia distinction
- Floor plans available
- Virtual tours

### Bezrealitky
- Similar to SReality
- More private listings
- Detailed heating info

### Reality.cz
- Comprehensive amenities
- Detailed construction info

### UlovDomov
- Focus on residential
- Good disposition coverage

---

## Frontend Usage

### Map View
```typescript
import { useGeoSearch } from '@/lib/api';

const { data } = useGeoSearch({
  latitude: 50.0755,
  longitude: 14.4378,
  radius_km: 5,
  filters: {
    property_category: 'apartment',
    price_max: 10000000, // CZK
    czech_disposition: '3+kk',
    has_balcony: true,
  },
});
```

### List View with Czech Filters
```typescript
const { data } = useSearch({
  filters: {
    city: 'Praha 2',
    property_category: 'apartment',
    price_min: 5000000,
    price_max: 10000000,
    czech_disposition: '3+kk',
    bedrooms_min: 2,
    has_elevator: true,
    construction_type: 'brick', // No panel buildings
  },
  sort_by: 'price_asc',
});
```

---

## Key Differences from Other Markets

| Field | Czech | UK | USA |
|-------|-------|-------|-----|
| Room Layout | Disposition (3+kk) | Bedrooms | Bedrooms |
| Ownership | Personal/Cooperative | Freehold/Leasehold | Deed |
| Building Type | Brick/Panel | - | - |
| Energy | A-G Class | EPC Rating | Energy Star |
| Heating | Central/Gas/Electric | Central/Gas | HVAC |
| Currency | CZK | GBP | USD |

---

## Summary

For a **Czech-only frontend**:

1. ✅ Use `czech_disposition` for room layout
2. ✅ Use `czech_ownership` for ownership type
3. ✅ Display `construction_type` (brick/panel is important!)
4. ✅ Show `has_loggia` separately from balcony
5. ✅ Format prices in CZK (Kč)
6. ✅ Use helper functions: `getDisposition()`, `getFloorDisplay()`, `formatPrice()`
7. ✅ Filter by disposition, construction_type, floor_location
8. ✅ Highlight panel vs brick buildings
9. ✅ Show energy class (A-G)
10. ✅ Display floor location context (ground/middle/top)
