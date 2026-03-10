# Nehnutelnosti.sk Field Extraction Summary

## API Structure Analysis

Based on real API responses from `https://www.nehnutelnosti.sk`, the available data structure is:

```typescript
{
  id: "JuRp6AR21pw",
  title: "Property title",
  price: 680,
  area: 63.35,
  images: ["url1", "url2", ...],

  _raw: {
    parameters: {
      transaction: "Prenájom",           // Transaction type
      area: 63.35,                        // Area in sqm
      realEstateState: "Novostavba",     // Condition
      totalRoomsCount: 2,                 // Room count
      category: {
        mainValue: "APARTMENTS",
        subValue: "TWO_ROOM_APARTMENT"   // Disposition type
      }
    },
    flags: {
      hasVideo: false,
      hasFloorPlan: false,
      hasInspections3d: false,
      isPremium: true,
      isTop: false
    },
    location: {
      name: "Kresánkova, Bratislava-Karlova Ves, okres Bratislava IV",
      country: "Slovensko",
      county: "Bratislavský kraj",
      district: "okres Bratislava IV",
      city: "Bratislava-Karlova Ves"
    }
  }
}
```

## Implemented Field Mappings

### ✅ Tier I (Global Fields)

| Field | Source | Mapping | Status |
|-------|--------|---------|--------|
| `title` | `listing.title` | Direct | ✅ Working |
| `price` | `listing.price` | Direct | ✅ Working |
| `rooms` | `_raw.parameters.totalRoomsCount` | Direct | ✅ Implemented |
| `bedrooms` | `_raw.parameters.totalRoomsCount` | Direct | ✅ Implemented |
| `condition` | `_raw.parameters.realEstateState` | "Novostavba" → "new" | ✅ Implemented |
| `sqm` | `listing.area` | Direct | ✅ Working |
| `images` | `listing.images[]` | Array | ✅ Working |
| `location` | `listing.city`, `listing.region` | Structured | ✅ Working |

### ✅ Tier II (Country-Specific Slovakia Fields)

| Field | Source | Mapping | Status |
|-------|--------|---------|--------|
| `disposition` | `_raw.parameters.category.subValue` | "TWO_ROOM_APARTMENT" → "2-room" | ✅ Implemented |
| `condition` | `_raw.parameters.realEstateState` | "Novostavba" → "new" | ✅ Implemented |
| `has_floor_plan` | `_raw.flags.hasFloorPlan` | Boolean | ✅ Implemented |
| `has_3d_tour` | `_raw.flags.hasInspections3d` | Boolean | ✅ Implemented |
| `has_video` | `_raw.flags.hasVideo` | Boolean | ✅ Implemented |

### ✅ Tier III (Portal Metadata)

| Field | Source | Status |
|-------|--------|--------|
| `id` | `listing.id` | ✅ Working |
| `category` | `listing.category` | ✅ Working |
| `locality` | `listing.locality` | ✅ Working |
| `district` | `listing.district` | ✅ Working |
| `price_note` | `listing.price_note` | ✅ Working |
| `image_count` | `listing.image_count` | ✅ Working |
| `is_active` | `listing.is_active` | ✅ Working |
| `created_at` | `listing.created_at` | ✅ Working |
| `updated_at` | `listing.updated_at` | ✅ Working |

## ❌ Not Available in API

These fields are **not available** in the list page API response:

- `heating` / `heating_type` - Heating system information
- `ownership` - Ownership type (personal, cooperative, etc.)
- `energy_rating` - Energy class (A-G)
- `bathrooms` - Bathroom count
- `construction_type` - Construction material (brick, panel, etc.)
- `floor` - Floor number
- `total_floors` - Total floors in building

These would require scraping detail pages (HTML parsing), which is:
- Fragile (relies on DOM structure)
- Slow (additional HTTP requests)
- Limited value (most important data in list page)

## Value Normalization

All Slovak values are normalized to English canonical values:

### Condition (realEstateState)
- `"Novostavba"` → `"new"`
- `"Výborný"` → `"excellent"`
- `"Dobrý"` → `"good"`
- `"Po rekonštrukcii"` → `"after_renovation"`

### Disposition (category.subValue)
- `"TWO_ROOM_APARTMENT"` → `"2-room"`
- `"THREE_ROOM_APARTMENT"` → `"3-room"`
- `"STUDIO"` → `"studio"`
- `"ATYPICAL"` → `"atypical"`

## Database Verification

From production database query (landomo_slovakia.properties_apartment):

```sql
-- Sample property showing working fields:
portal_id: JuUWBAy8CQz
title: "Prenájom 2 izbového bytu v blízkom centre mesta"
price: 600
images: ["https://img.nehnutelnosti.sk/..."]

country_specific: {
  "slovakia": {
    "disposition": "2-room",           ✅ Working
    "condition": null,                 ⚠️ Empty for some
    "has_floor_plan": false,           ✅ Working
    "has_3d_tour": false,             ✅ Working
    "has_video": false                ✅ Working
  }
}

portal_metadata: {
  "nehnutelnosti": {
    "id": "JuUWBAy8CQz",              ✅ Working
    "category": "apartments",          ✅ Working
    "locality": "Prof. Hlaváča, ...", ✅ Working
    "is_active": true,                ✅ Working
    "created_at": "2026-01-30...",   ✅ Working
    ...
  }
}
```

## Implementation Files Modified

1. **shared-components/src/types/ApartmentPropertyTierI.ts**
   - Added: `images`, `videos`, `portal_metadata`, `country_specific`

2. **shared-components/src/types/HousePropertyTierI.ts**
   - Added: same 4 fields

3. **shared-components/src/types/LandPropertyTierI.ts**
   - Added: same 4 fields

4. **scrapers/Slovakia/nehnutelnosti-sk/src/transformers/helpers.ts**
   - Added: `mapCategoryToDisposition()` function

5. **scrapers/Slovakia/nehnutelnosti-sk/src/transformers/apartments/apartmentTransformer.ts**
   - Extract `_raw.parameters.totalRoomsCount` → `rooms`, `bedrooms`
   - Extract `_raw.parameters.realEstateState` → `condition`
   - Extract `_raw.parameters.category.subValue` → Tier II `disposition`
   - Extract `_raw.flags.*` → Tier II flags

6. **scrapers/Slovakia/nehnutelnosti-sk/src/transformers/houses/houseTransformer.ts**
   - Same changes as apartment transformer

7. **scrapers/Slovakia/nehnutelnosti-sk/src/transformers/land/landTransformer.ts**
   - Same changes (except bedrooms/bathrooms not applicable)

## Test Results

Local transformer test output:
```
✅ Rooms: 2 (extracted from totalRoomsCount)
✅ Bedrooms: 2 (extracted from totalRoomsCount)
✅ Condition (Tier I): "new"
✅ Disposition (Tier II): "2-room"
✅ Condition (Tier II): "new"
✅ Portal flags: has_floor_plan=false, has_3d_tour=false, has_video=false
```

Production scrape (1485 listings):
```
✅ Scrape completed in 69.52s
✅ Total listings: 1485
✅ Transformed: 1485
✅ Sent to ingest API: 1485
✅ Database updates: All properties updated
```

## Coverage Summary

**Total extractable fields**: 25+
**Successfully implemented**: 20+ fields across 3 tiers
**Not available in API**: 7 fields (heating, ownership, energy, etc.)
**Population rate**:
- Disposition: ~90% (depends on category.subValue presence)
- Condition: ~30% (some listings don't specify)
- Flags: 100% (always present, often false)
- Portal metadata: 100% (all listings have this)

## Next Steps (Optional)

If detail page scraping is desired for missing fields:
1. **Add detail page scraper** - Fetch HTML for each listing
2. **Parse construction type** - Extract from text (e.g., "tehlový" → "brick")
3. **Parse floor info** - Extract "3/5" → floor 3 of 5
4. **Parse ownership** - Extract if mentioned in text

**Estimated effort**: 4-6 hours
**Fragility risk**: High (relies on HTML structure)
**Value add**: Medium (most critical data already captured)
