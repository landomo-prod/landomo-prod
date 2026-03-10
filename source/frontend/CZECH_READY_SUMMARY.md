# Czech Market Frontend - Ready Summary

**Market**: Czech Republic 🇨🇿
**Currency**: CZK (Czech Koruna)
**Scrapers**: sreality, bezrealitky, reality, idnes, ulovdomov, bazos, realingo

---

## ✅ Czech-Specific Features Implemented

### 1. **Disposition Support** (Czech Room Layout)
```typescript
import { getDisposition } from '@/types/property';

// Display: "3+kk", "2+1", "4+kk"
<Badge>{getDisposition(property)}</Badge>

// Extract bedrooms: "3+kk" → 3 bedrooms
const bedrooms = getBedroomsFromDisposition(property.czech_disposition);
```

**Examples**:
- `1+kk` - 1 room + kitchenette (studio)
- `2+kk` - 2 rooms + kitchenette
- `3+1` - 3 rooms + separate kitchen
- `4+kk` - 4 rooms + kitchenette

### 2. **Czech Ownership Types**
```typescript
import { getOwnershipDisplay } from '@/types/property';

// "Personal", "Cooperative", "State"
<div>{getOwnershipDisplay(property.czech_ownership)}</div>
```

### 3. **Construction Type** (Important in Czech market!)
```typescript
import { getConstructionTypeDisplay } from '@/types/property';

// "Brick", "Panel", "Stone"
<Badge>{getConstructionTypeDisplay(property.construction_type)}</Badge>
```

**Why it matters**:
- **Brick** (Cihlová) - Preferred, higher quality, better insulation
- **Panel** (Panelová) - Communist-era prefab, cheaper, less desirable

### 4. **Condition Display**
```typescript
import { getConditionDisplay } from '@/types/property';

// "After Reconstruction", "Original State", "Very Good"
<div>{getConditionDisplay(property.condition)}</div>
```

### 5. **Furnished Status**
```typescript
import { getFurnishedDisplay } from '@/types/property';

// "Furnished", "Partially Furnished", "Unfurnished"
<div>{getFurnishedDisplay(property.furnished)}</div>
```

### 6. **Floor Location** (Czech-specific)
```typescript
import { getFloorLocationDisplay } from '@/types/property';

// "Ground Floor", "Middle Floors", "Top Floor"
<div>{getFloorLocationDisplay(property.floor_location)}</div>
```

### 7. **Czech Amenities**
```typescript
{
  has_elevator: boolean,    // Výtah
  has_balcony: boolean,     // Balkón
  has_loggia: boolean,      // Lodžie (Czech-specific!)
  has_basement: boolean,    // Sklep
  has_parking: boolean,     // Parkování
  has_terrace: boolean,     // Terasa
  has_garage: boolean,      // Garáž
}
```

**Loggia** is Czech-specific - different from balcony!

### 8. **CZK Price Formatting**
```typescript
import { formatPrice } from '@/types/property';

formatPrice(7500000, 'CZK')  // "Kč7,500,000"
formatPrice(property.price, property.currency)  // Auto-detect
```

### 9. **Czech Energy Class**
```typescript
// Display: A, B, C, D, E, F, G
<div>Energy Rating: {property.energy_class}</div>
```

### 10. **Building Context**
```typescript
{
  year_built: 1928,              // Rok stavby
  renovation_year: 2020,         // Rok rekonstrukce
  construction_type: 'brick',    // Cihlová/Panelová
  heating_type: 'central',       // Ústřední/Plynové/Elektrické
  total_floors: 5,               // Floors in building
}
```

---

## 🎨 UI Components Updated

### MapScreen.tsx
- ✅ Shows disposition badge (e.g., "3+kk")
- ✅ Shows sqm (not "area")
- ✅ Formats CZK prices
- ✅ Uses Czech property title

### PropertyCard.tsx
- ✅ Disposition badge
- ✅ Area in m²
- ✅ CZK price formatting
- ✅ Conditional rendering for optional fields

### DetailScreen.tsx
- ✅ Disposition stat
- ✅ Floor display (Ground, 3rd, etc.)
- ✅ Construction type (Brick/Panel)
- ✅ Czech ownership type
- ✅ Heating type
- ✅ Furnished status
- ✅ Energy class
- ✅ Renovation year

---

## 🔍 Czech-Specific Filters

```typescript
import { useSearch } from '@/lib/api';

const { data } = useSearch({
  filters: {
    // Location
    city: 'Praha 2',

    // Category
    property_category: 'apartment',

    // Price (in CZK)
    price_min: 5000000,  // 5M CZK
    price_max: 10000000, // 10M CZK

    // Czech-specific
    czech_disposition: '3+kk',           // or '2+1', '4+kk'
    czech_ownership: 'personal',          // not 'cooperative'
    construction_type: 'brick',           // no panel buildings!

    // Standard
    bedrooms_min: 2,
    sqm_min: 60,

    // Amenities
    has_elevator: true,
    has_balcony: true,
    has_parking: true,
  },
  sort_by: 'price_asc',
});
```

---

## 📊 Czech Market Data Examples

### Typical Prague Apartment
```json
{
  "title": "Prodej bytu 3+kk 78 m²",
  "price": 7500000,
  "currency": "CZK",
  "property_category": "apartment",
  "transaction_type": "sale",

  "city": "Praha 2",
  "czech_disposition": "3+kk",
  "bedrooms": 3,
  "sqm": 78,
  "floor": 3,
  "total_floors": 5,

  "construction_type": "brick",
  "czech_ownership": "personal",
  "condition": "after_reconstruction",
  "heating_type": "central",
  "energy_class": "B",
  "year_built": 1928,
  "renovation_year": 2020,

  "has_elevator": false,
  "has_balcony": true,
  "has_basement": true,
  "has_parking": true,
  "has_loggia": false,

  "pricePerSqm": 96154
}
```

### Typical Panel Building Apartment (Less Desirable)
```json
{
  "title": "Prodej bytu 2+1 55 m²",
  "price": 4200000,
  "currency": "CZK",
  "czech_disposition": "2+1",
  "construction_type": "panel",  // Communist-era prefab
  "year_built": 1978,
  "has_elevator": true,
  "has_loggia": true,            // Panels often have lodžie
  "floor_location": "middle"
}
```

---

## 🎯 Key Differences from Generic Schema

| Field | Generic | Czech |
|-------|---------|-------|
| Room Layout | `bedrooms: 3` | `czech_disposition: "3+kk"` |
| Address | Full address | `title` with disposition + city |
| Building | - | `construction_type: "brick"/"panel"` |
| Ownership | - | `czech_ownership: "personal"/"cooperative"` |
| Balcony | `has_balcony` | `has_balcony` + `has_loggia` (separate!) |
| Floor | `floor: 3` | `floor: 3` + `floor_location: "middle"` |
| Currency | Mixed | Always CZK |

---

## 🚀 Next Steps for Czech Frontend

### 1. Add Czech-Specific Filters UI
```typescript
// Disposition selector
<Select value={disposition}>
  <option value="1+kk">1+kk</option>
  <option value="2+kk">2+kk</option>
  <option value="3+kk">3+kk</option>
  <option value="3+1">3+1</option>
  <option value="4+kk">4+kk</option>
</Select>

// Construction type selector (important!)
<RadioGroup value={constructionType}>
  <Radio value="brick">Brick (Cihlová)</Radio>
  <Radio value="panel">Panel (Panelová)</Radio>
  <Radio value="any">Any</Radio>
</RadioGroup>
```

### 2. Highlight Panel Buildings
```typescript
// Show warning for panel buildings
{property.construction_type === 'panel' && (
  <Badge variant="warning">Panel Building</Badge>
)}
```

### 3. Show Energy Class
```typescript
// Color-code energy ratings
const energyColors = {
  A: 'green', B: 'lime', C: 'yellow',
  D: 'orange', E: 'orange', F: 'red', G: 'red'
};

<Badge color={energyColors[property.energy_class]}>
  Energy: {property.energy_class}
</Badge>
```

### 4. Czech Price Ranges
```typescript
// Typical Prague price ranges (2026)
const pragueRanges = {
  'Praha 1': { min: 8000000, max: 20000000 },  // City center
  'Praha 2': { min: 6000000, max: 15000000 },  // Vinohrady
  'Praha 3': { min: 5000000, max: 12000000 },  // Žižkov
  'Praha 5': { min: 4000000, max: 10000000 },  // Residential
};
```

---

## ✅ Czech Market Checklist

- [x] Disposition display (3+kk, 2+1)
- [x] CZK currency formatting
- [x] Construction type (brick/panel)
- [x] Czech ownership types
- [x] Loggia vs Balcony
- [x] Floor location context
- [x] Energy class display
- [x] Heating type
- [x] Furnished status
- [x] Helper functions for Czech data
- [x] Components updated for Czech fields

### To Do:
- [ ] Add disposition filter UI
- [ ] Add construction type filter (highlight panel)
- [ ] Add energy class filter
- [ ] Add floor location filter
- [ ] Czech price range presets
- [ ] Map polygon search for Prague districts
- [ ] Czech-language UI (optional)

---

## 🎉 Result

The frontend is now **Czech market-ready** with:
- ✅ All Czech-specific fields supported
- ✅ Proper disposition display
- ✅ CZK price formatting
- ✅ Construction type awareness (brick/panel)
- ✅ Helper functions for Czech data
- ✅ Components using Czech schema
- ✅ No backward compatibility overhead
- ✅ Type-safe Czech property types

**Ready to connect to Czech scrapers** (sreality, bezrealitky, reality, idnes, ulovdomov) via search-service API! 🚀
