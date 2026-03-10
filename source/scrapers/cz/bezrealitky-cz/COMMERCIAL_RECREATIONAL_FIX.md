# Bezrealitky Commercial & Recreational Properties Fix

## Problem
Commercial and recreational properties threw error "Category not yet implemented" and failed transformation entirely, causing listings to be **SKIPPED**.

## Estate Types Affected
- **GARAZ** (garage) - Commercial
- **KANCELAR** (office) - Commercial
- **NEBYTOVY_PROSTOR** (non-residential space) - Commercial
- **REKREACNI_OBJEKT** (recreational object/cottage) - Recreational

## Solution Implemented

### 1. Category Mapping Strategy
**All commercial and recreational properties map to 'house' partition:**

- **Commercial properties** (garages, offices, warehouses) are buildings with land/plot → house schema
- **Recreational properties** (cottages, cabins) are buildings with land → house schema

This is the correct mapping because:
- All have `sqm_living` (building area)
- All have `sqm_plot` (land/plot area)
- House schema accommodates diverse building types via `property_subtype`

### 2. Code Changes

#### `/src/transformers/index.ts`
**Before:**
```typescript
case 'commercial':
case 'recreational':
  // Use fallback for unsupported categories (for now)
  throw new Error(`Category "${category}" not yet implemented`);
```

**After:**
```typescript
case 'commercial':
case 'recreational':
  // Commercial (garages, offices, non-residential) and recreational (cottages, cabins)
  // are buildings with land, so map to house partition
  // The property_subtype will be set based on houseType field
  return transformBezrealitkyHouse(listing);
```

#### `/src/transformers/houses/houseTransformer.ts`
Enhanced `detectHouseSubtype()` to explicitly handle recreational objects:

```typescript
// Recreational objects (REKREACNI_OBJEKT) → cottage
// These are cabins, cottages, summer houses
if (estateType === 'REKREACNI_OBJEKT') {
  return 'cottage';
}
```

### 3. Property Subtype Mapping
- **GARAZ** → `detached` (default house subtype)
- **KANCELAR** → `detached` (default house subtype)
- **NEBYTOVY_PROSTOR** → `detached` (default house subtype)
- **REKREACNI_OBJEKT** → `cottage` (explicit mapping)

### 4. Verification

#### Test Results
Created test: `src/transformers/test-commercial-recreational.ts`

```
Testing: GARAZ - Garáž v centru Prahy
✓ Success! Category: house, Subtype: detached, 20m² living, 25m² plot

Testing: KANCELAR - Kancelářské prostory Brno
✓ Success! Category: house, Subtype: detached, 80m² living, 100m² plot

Testing: NEBYTOVY_PROSTOR - Nebytový prostor - sklad
✓ Success! Category: house, Subtype: detached, 150m² living, 200m² plot

Testing: REKREACNI_OBJEKT - Rekreační chalupa v Šumavě
✓ Success! Category: house, Subtype: cottage, 60m² living, 800m² plot

Results: 4 successful, 0 failed
```

#### Type Safety
- All TypeScript compilation passes (`npx tsc --noEmit`)
- No type errors introduced

## Impact
- **Before:** Commercial/recreational properties → Error → SKIPPED
- **After:** Commercial/recreational properties → Successfully transformed → INGESTED

## Data Model
These properties are stored in the **house partition** with:
- `property_category: 'house'`
- `property_subtype: 'cottage' | 'detached' | undefined`
- All standard house fields (sqm_living, sqm_plot, amenities, etc.)

## Testing
Run test:
```bash
cd "scrapers/Czech Republic/bezrealitky"
npx tsx src/transformers/test-commercial-recreational.ts
```

## Deployment
No special deployment steps needed. Changes are backward-compatible.
Existing apartment/house/land transformations unchanged.
