# Tier I Schema Quick Reference

**Last Updated**: 2026-02-10
**For**: Transformer developers updating scrapers

---

## New Fields by Schema

### ApartmentPropertyTierI (+12 fields)

```typescript
// Classification
property_subtype?: 'standard' | 'penthouse' | 'loft' | 'atelier' | 'maisonette' | 'studio'

// Amenity areas (NEW - polymorphic with booleans)
balcony_area?: number        // sqm (when available)
terrace_area?: number        // sqm
loggia_area?: number         // sqm
cellar_area?: number         // sqm

// Amenity booleans (NEW)
has_terrace?: boolean        // Previously missing
has_garage?: boolean         // Previously missing

// Counts (NEW)
parking_spaces?: number      // Number of parking spots
garage_count?: number        // Number of garages

// Rental-specific (NEW)
available_from?: string      // ISO date: "2026-03-01"
min_rent_days?: number       // Minimum rental period
max_rent_days?: number       // Maximum rental period

// Financial (NEW)
utility_charges?: number     // Monthly utilities (water, heating)
service_charges?: number     // Monthly services (maintenance, cleaning)
```

---

### HousePropertyTierI (+11 fields)

```typescript
// Classification
property_subtype?: 'detached' | 'semi_detached' | 'terraced' | 'villa' | 'cottage' | 'farmhouse' | 'townhouse' | 'bungalow'

// Area (NEW)
sqm_total?: number           // Total built area (including walls, structures)

// Amenity areas (NEW)
garden_area?: number         // sqm
terrace_area?: number        // sqm
cellar_area?: number         // sqm
balcony_area?: number        // sqm (rare but possible)

// Amenity booleans (NEW)
has_balcony?: boolean        // Previously missing

// Counts (NEW)
parking_spaces?: number      // Number of parking spots
garage_count?: number        // Number of garages

// Rental-specific (NEW)
available_from?: string      // ISO date: "2026-03-01"
min_rent_days?: number       // Minimum rental period
max_rent_days?: number       // Maximum rental period

// Financial (NEW)
utility_charges?: number     // Monthly utilities
service_charges?: number     // Monthly services
```

---

### LandPropertyTierI (+6 fields)

```typescript
// Classification
property_subtype?: 'building_plot' | 'agricultural' | 'forest' | 'vineyard' | 'orchard' | 'recreational' | 'industrial'

// Infrastructure (ENHANCED - now enums instead of booleans)
water_supply?: 'mains' | 'well' | 'connection_available' | 'none'
sewage?: 'mains' | 'septic' | 'connection_available' | 'none'
electricity?: 'connected' | 'connection_available' | 'none'
gas?: 'connected' | 'connection_available' | 'none'

// Rental-specific (NEW)
available_from?: string      // Rare but possible for land rentals

// Transaction type (UPDATED - now allows rent)
transaction_type: 'sale' | 'rent'  // Was: 'sale' only
```

---

## Portal Mapping Guide

### SReality → Tier I

**Apartments/Houses:**

```typescript
// Property sub-type (infer from category)
if (seo.category_main_cb === 1) {
  property_subtype = inferApartmentType(items);  // Check for "atelier", "podkroví" (loft), etc.
}

// Amenity areas (parse from items array)
const balkonItem = items.find(i => i.name === 'Balkón');
if (balkonItem) {
  has_balcony = true;
  balcony_area = parseArea(balkonItem.value);  // Extract sqm from "13 m²"
}

// Total built area (houses only)
const totalAreaItem = items.find(i => i.name === 'Celková plocha');
if (totalAreaItem) {
  sqm_total = parseNumber(totalAreaItem.value);
}

// Utility charges (combine from service charges)
const chargesItem = items.find(i => i.name === 'Poplatky');
if (chargesItem) {
  utility_charges = parseNumber(chargesItem.value);
}

// Garage/parking counts (infer from text)
const parkingItem = items.find(i => i.name === 'Parkování');
if (parkingItem && parkingItem.value.includes('garáž')) {
  has_garage = true;
  garage_count = extractCount(parkingItem.value);  // Look for numbers
}
```

**Land:**

```typescript
// Property sub-type (infer from items)
const typeItem = items.find(i => i.name === 'Typ pozemku');
if (typeItem) {
  property_subtype = mapLandType(typeItem.value);
  // "Stavební pozemek" → "building_plot"
  // "Orná půda" → "agricultural"
  // "Les" → "forest"
}

// Infrastructure (map to enums)
const waterItem = items.find(i => i.name === 'Voda');
if (waterItem) {
  water_supply = mapWaterType(waterItem.value);
  // "Veřejný vodovod" → "mains"
  // "Studna" → "well"
  // "Možnost připojení" → "connection_available"
}
```

---

### Bezrealitky → Tier I

**Apartments/Houses:**

```typescript
// Property sub-type (direct mapping)
property_subtype = listing.disposition === 'ATELIER' ? 'atelier' :
                  listing.disposition === 'PENTHOUSE' ? 'penthouse' :
                  listing.houseType === 'DETACHED' ? 'detached' :
                  listing.houseType === 'TERRACED' ? 'terraced' :
                  'standard';

// Amenity areas (direct mapping)
balcony_area = listing.balconySurface;
terrace_area = listing.terraceSurface;
loggia_area = listing.loggiaSurface;
cellar_area = listing.cellarSurface;
garden_area = listing.surfaceLand;  // For houses

// Booleans (direct mapping)
has_balcony = listing.balcony ?? false;
has_terrace = listing.terrace ?? false;
has_garage = listing.garage ?? false;

// Rental fields (direct mapping)
available_from = listing.availableFrom;  // ISO date
min_rent_days = listing.minRentDays;
max_rent_days = listing.maxRentDays;

// Charges (direct mapping)
utility_charges = listing.utilityCharges;
service_charges = listing.serviceCharges;

// Counts (infer from booleans + metadata)
garage_count = listing.garage ? 1 : undefined;  // Default to 1 if has garage
parking_spaces = listing.parking ? 1 : undefined;
```

**Land:**

```typescript
// Property sub-type (direct mapping)
property_subtype = listing.landType === 'STAVEBNI_POZEMEK' ? 'building_plot' :
                  listing.landType === 'ORNÁ_PŮDA' ? 'agricultural' :
                  listing.landType === 'LES' ? 'forest' :
                  listing.landType === 'VINICE' ? 'vineyard' :
                  'agricultural';

// Infrastructure (map from strings)
water_supply = listing.water === 'VEŘEJNÝ_VODOVOD' ? 'mains' :
              listing.water === 'STUDNA' ? 'well' :
              listing.water === 'MOŽNOST_PŘIPOJENÍ' ? 'connection_available' :
              'none';

sewage = listing.sewage === 'VEŘEJNÁ_KANALIZACE' ? 'mains' :
        listing.sewage === 'SEPTIK' ? 'septic' :
        listing.sewage === 'MOŽNOST_PŘIPOJENÍ' ? 'connection_available' :
        'none';
```

---

## Helper Functions

### parseArea (SReality)

```typescript
function parseArea(value: string): number | undefined {
  // "13 m²" → 13
  // "Ano" → undefined (boolean, not area)
  const match = value.match(/(\d+(?:\.\d+)?)\s*m²?/);
  return match ? parseFloat(match[1]) : undefined;
}
```

### extractCount

```typescript
function extractCount(text: string): number | undefined {
  // "2 garážová stání" → 2
  // "garáž" → 1 (default)
  const match = text.match(/^(\d+)/);
  return match ? parseInt(match[1]) : 1;
}
```

### mapLandType (SReality Czech → Tier I)

```typescript
function mapLandType(czechType: string): string {
  const mapping: Record<string, string> = {
    'Stavební pozemek': 'building_plot',
    'Orná půda': 'agricultural',
    'Les': 'forest',
    'Vinice': 'vineyard',
    'Sad': 'orchard',
    'Louka': 'agricultural',
    'Pastvina': 'agricultural'
  };
  return mapping[czechType] || 'agricultural';
}
```

### mapWaterType (SReality Czech → Tier I)

```typescript
function mapWaterType(czechWater: string): string {
  if (czechWater.includes('vodovod') || czechWater.includes('Veřejný')) return 'mains';
  if (czechWater.includes('Studna') || czechWater.includes('studna')) return 'well';
  if (czechWater.includes('Možnost') || czechWater.includes('připojení')) return 'connection_available';
  return 'none';
}
```

---

## Common Patterns

### Pattern 1: Polymorphic Amenities

```typescript
// ALWAYS populate boolean first
has_balcony = Boolean(balconyValue);

// THEN try to extract area
if (balconyValue && typeof balconyValue === 'string') {
  const area = parseArea(balconyValue);
  if (area) {
    balcony_area = area;
  }
}
```

### Pattern 2: Separate Charges

```typescript
// Bezrealitky provides them separately
utility_charges = listing.utilityCharges;
service_charges = listing.serviceCharges;

// SReality combines them - best effort split
if (charges) {
  // If contains "služby" → service_charges
  // If contains "voda" or "plyn" → utility_charges
  // Otherwise → utility_charges (default)
}
```

### Pattern 3: Property Sub-Type Inference

```typescript
// Check multiple sources in priority order
property_subtype =
  // 1. Explicit field (Bezrealitky)
  listing.houseType ||
  // 2. Disposition hint (Czech "atelier" → loft)
  inferFromDisposition(listing.disposition) ||
  // 3. Title keywords ("penthouse", "vila")
  inferFromTitle(listing.title) ||
  // 4. Default
  'standard';
```

---

## Validation Rules

### Required Boolean + Optional Area

```typescript
// ✅ VALID
{ has_balcony: true, balcony_area: 13 }
{ has_balcony: true, balcony_area: undefined }
{ has_balcony: false, balcony_area: undefined }

// ❌ INVALID
{ has_balcony: false, balcony_area: 13 }  // Cannot have area without balcony
{ has_balcony: undefined, balcony_area: 13 }  // Boolean required
```

### Infrastructure Enums (Land)

```typescript
// ✅ VALID
{ water_supply: 'mains' }
{ water_supply: 'connection_available' }
{ water_supply: undefined }  // Optional field

// ❌ INVALID
{ water_supply: 'yes' }  // Must use enum values
{ water_supply: true }  // Not a boolean anymore
```

### Rental Fields

```typescript
// ✅ VALID (short-term rental)
{
  transaction_type: 'rent',
  available_from: '2026-03-01',
  min_rent_days: 7,
  max_rent_days: 90
}

// ✅ VALID (long-term rental)
{
  transaction_type: 'rent',
  available_from: '2026-03-01',
  min_rent_days: undefined,  // No restriction
  max_rent_days: undefined
}

// ❌ INVALID
{
  min_rent_days: 30,  // Cannot have rental fields without transaction_type: 'rent'
}
```

---

## Testing Checklist

When updating transformers, verify:

- ✅ Boolean amenity fields still populated (backward compat)
- ✅ Area fields only populated when numeric value available
- ✅ property_subtype uses English enums (not Czech terms)
- ✅ Infrastructure uses enum values (not booleans) for land
- ✅ Rental fields only for transaction_type: 'rent'
- ✅ Counts are numeric or undefined (not 0 for "none")
- ✅ ISO date format for available_from ("YYYY-MM-DD")
- ✅ Charges separated when possible (utility vs service)

---

## Migration Path

### Phase 1: Update Type Definitions ✅

**Status**: COMPLETE
**Files**: ApartmentPropertyTierI.ts, HousePropertyTierI.ts, LandPropertyTierI.ts

---

### Phase 2: Update Transformers (Current)

**SReality Transformer**:
1. Add property_subtype inference
2. Add area extraction from items array
3. Add charge mapping
4. Add count inference
5. Test with 10 sample listings

**Bezrealitky Transformer**:
1. Add property_subtype direct mapping
2. Add area field mapping
3. Add rental field mapping
4. Add charge separation
5. Test with 10 sample listings

---

### Phase 3: Database Schema (Next)

**Migration SQL**:
```sql
-- Add new columns to properties table
ALTER TABLE properties ADD COLUMN property_subtype VARCHAR(50);
ALTER TABLE properties ADD COLUMN balcony_area DECIMAL(10,2);
ALTER TABLE properties ADD COLUMN available_from DATE;
-- ... etc

-- Add indexes
CREATE INDEX idx_properties_subtype ON properties(property_subtype);
CREATE INDEX idx_properties_available_from ON properties(available_from);
```

---

## FAQ

### Q: Why separate has_balcony and balcony_area?

**A**: Handles three cases:
1. No balcony: `has_balcony: false, balcony_area: undefined`
2. Has balcony, area unknown: `has_balcony: true, balcony_area: undefined`
3. Has balcony with area: `has_balcony: true, balcony_area: 13`

Filtering on "has balcony" works without requiring area data.

---

### Q: Why is property_subtype in Tier I, not Tier II?

**A**: Property sub-types are universal concepts (detached house exists globally). Only the local terminology varies. Tier I uses English enums; Tier II can preserve Czech terms.

---

### Q: What about Czech-specific fields like disposition?

**A**: Disposition stays in Tier II (country_specific). We standardize to bedrooms in Tier I, but preserve "2+kk" format in Tier II for Czech users.

---

### Q: Can I populate both old and new infrastructure fields?

**A**: Yes! For land properties, both are valid during transition:

```typescript
// Deprecated but still works
has_water_connection: true

// New preferred format
water_supply: 'mains'
```

Transformers can populate both during migration period.

---

### Q: What if SReality doesn't provide explicit sub-types?

**A**: Use inference:
- Check title for keywords ("penthouse", "vila", "chalupa")
- Check items array for hints
- Check property characteristics (top floor + terrace = likely penthouse)
- Default to 'standard' if unclear

---

## Contact

**Schema Documentation**: `/Users/samuelseidel/Development/landomo-world/shared-components/docs/`
- Design rationale: `TIER_I_DESIGN_RATIONALE.md`
- Field coverage: `TIER_I_FIELD_COVERAGE_REPORT.md`
- Implementation: `TIER_I_IMPLEMENTATION_SUMMARY.md`

**Questions**: Contact team-lead or refer to design rationale document.

---

**Version**: 1.0
**Last Updated**: 2026-02-10
