# Hungarian Value Mappings - Complete Reference

This document provides a comprehensive reference for all Hungarian real estate value mappings used in the ingatlan.com scraper.

## Overview

The scraper handles Hungarian-specific real estate terminology by:
1. **Normalizing** varied inputs to canonical Hungarian values
2. **Storing** both Hungarian originals and English translations
3. **Validating** values against accepted standards

---

## 1. Disposition (Room Layout)

### Canonical Values
```typescript
'1-szobás'      // 1 room apartment
'2-szobás'      // 2 room apartment
'3-szobás'      // 3 room apartment
'4-szobás'      // 4 room apartment
'5-szobás'      // 5 room apartment
'6-szobás'      // 6 room apartment
'több-szobás'   // More than 6 rooms
'garzonlakás'   // Studio apartment
'félszobás'     // Half-room
'atipikus'      // Non-standard layout
```

### Mapping Examples
| Input | Normalized | Notes |
|-------|-----------|-------|
| "1 szobás" | "1-szobás" | Space variant |
| "1-szobás" | "1-szobás" | Already canonical |
| "1szob" | "1-szobás" | Abbreviated |
| "2 szobás lakás" | "2-szobás" | Extra words ignored |
| "7 szobás" | "több-szobás" | 7+ rooms |
| "garzon" | "garzonlakás" | Studio short form |
| "studio" | "garzonlakás" | English variant |
| "fél szobás" | "félszobás" | Half-room with space |
| "atipikus elrendezés" | "atipikus" | Atypical layout |

### Code Usage
```typescript
import { normalizeDisposition } from './src/shared/hungarian-value-mappings';

normalizeDisposition('2 szobás');      // "2-szobás"
normalizeDisposition('garzon');        // "garzonlakás"
normalizeDisposition('10 szobás');     // "több-szobás"
```

---

## 2. Ownership Type

### Canonical Values
```typescript
'tulajdon'      // Full ownership (Teljes tulajdon)
'társasházi'    // Condominium (Társasházi tulajdon)
'szövetkezeti'  // Cooperative (Szövetkezeti lakás)
'állami'        // State/municipal (Állami/Önkormányzati)
'egyéb'         // Other
```

### Mapping Examples
| Input | Normalized | English |
|-------|-----------|---------|
| "tulajdon" | "tulajdon" | Full ownership |
| "teljes tulajdon" | "tulajdon" | Full ownership |
| "full ownership" | "tulajdon" | English variant |
| "társasházi" | "társasházi" | Condominium |
| "társasház" | "társasházi" | Short form |
| "szövetkezeti" | "szövetkezeti" | Cooperative |
| "állami" | "állami" | State-owned |
| "önkormányzati" | "állami" | Municipal |
| "unknown" | "egyéb" | Default |

### Code Usage
```typescript
import { normalizeOwnership } from './src/shared/hungarian-value-mappings';

normalizeOwnership('társasházi');    // "társasházi"
normalizeOwnership('cooperative');   // "szövetkezeti"
normalizeOwnership(undefined);       // "egyéb"
```

---

## 3. Property Condition

### Canonical Values
```typescript
'újépítésű'     // New construction
'újszerű'       // New-like condition
'kiváló'        // Excellent
'jó'            // Good condition
'felújított'    // Renovated
'felújítandó'   // Requires renovation
'közepes'       // Average
'romos'         // Dilapidated
'építés_alatt'  // Under construction
```

### Mapping Examples
| Input | Normalized | English Canonical |
|-------|-----------|------------------|
| "újépítésű" | "újépítésű" | "new" |
| "new construction" | "újépítésű" | "new" |
| "újszerű" | "újszerű" | "excellent" |
| "kiváló állapotú" | "kiváló" | "excellent" |
| "jó állapotú" | "jó" | "good" |
| "felújított" | "felújított" | "after_renovation" |
| "felújítandó" | "felújítandó" | "requires_renovation" |
| "közepes állapot" | "közepes" | "good" |
| "romos" | "romos" | "requires_renovation" |
| "építés alatt" | "építés_alatt" | "under_construction" |

### Code Usage
```typescript
import { normalizeCondition } from './src/shared/hungarian-value-mappings';

normalizeCondition('felújított');         // "felújított"
normalizeCondition('renovated');          // "felújított"
normalizeCondition('requires renovation'); // "felújítandó"
```

---

## 4. Furnished Status

### Canonical Values
```typescript
'bútorozott'           // Fully furnished
'részben_bútorozott'   // Partially furnished
'bútorozatlan'         // Not furnished
```

### Mapping Examples
| Input | Type | Normalized | English |
|-------|------|-----------|---------|
| "bútorozott" | string | "bútorozott" | "furnished" |
| "butorozott" | string | "bútorozott" | "furnished" |
| "furnished" | string | "bútorozott" | "furnished" |
| "yes" | string | "bútorozott" | "furnished" |
| "igen" | string | "bútorozott" | "furnished" |
| true | boolean | "bútorozott" | "furnished" |
| "részben" | string | "részben_bútorozott" | "partially_furnished" |
| "partial" | string | "részben_bútorozott" | "partially_furnished" |
| "bútorozatlan" | string | "bútorozatlan" | "unfurnished" |
| "no" | string | "bútorozatlan" | "unfurnished" |
| false | boolean | "bútorozatlan" | "unfurnished" |

### Code Usage
```typescript
import { normalizeFurnished } from './src/shared/hungarian-value-mappings';

normalizeFurnished('bútorozott');       // "bútorozott"
normalizeFurnished(true);               // "bútorozott"
normalizeFurnished('részben');          // "részben_bútorozott"
normalizeFurnished(false);              // "bútorozatlan"
```

---

## 5. Heating Type

### Canonical Values
```typescript
'központi'      // Central heating
'gázfűtés'      // Gas heating
'elektromos'    // Electric heating
'távfűtés'      // District heating
'házközponti'   // House-central heating
'egyedi'        // Individual heating
'gázkonvektor'  // Gas convector
'fan_coil'      // Fan coil
'geotermikus'   // Geothermal
'napkollektor'  // Solar panels
'egyéb'         // Other
```

### Mapping Examples
| Input | Normalized | English |
|-------|-----------|---------|
| "központi fűtés" | "központi" | "central_heating" |
| "central heating" | "központi" | "central_heating" |
| "távfűtés" | "távfűtés" | "district_heating" |
| "district heating" | "távfűtés" | "district_heating" |
| "gázfűtés" | "gázfűtés" | "gas_heating" |
| "gáz" | "gázfűtés" | "gas_heating" |
| "gázkonvektor" | "gázkonvektor" | "gas_heating" |
| "elektromos" | "elektromos" | "electric_heating" |
| "házközponti" | "házközponti" | "central_heating" |
| "egyedi fűtés" | "egyedi" | "individual_heating" |
| "fan coil" | "fan_coil" | "heat_pump" |
| "geotermikus" | "geotermikus" | "heat_pump" |
| "napkollektor" | "napkollektor" | "other" |

### Code Usage
```typescript
import { normalizeHeatingType } from './src/shared/hungarian-value-mappings';

normalizeHeatingType('központi fűtés');  // "központi"
normalizeHeatingType('district heating'); // "távfűtés"
normalizeHeatingType('gázkonvektor');    // "gázkonvektor"
```

---

## 6. Energy Rating

### Canonical Values
```typescript
'a++'  // Most efficient
'a+'
'a'
'b'
'c'
'd'
'e'
'f'
'g'
'h'
'i'
'j'   // Least efficient
```

### Mapping Examples
| Input | Normalized | English Canonical |
|-------|-----------|------------------|
| "A++" | "a++" | "a" |
| "a++" | "a++" | "a" |
| "A+" | "a+" | "a" |
| "A" | "a" | "a" |
| "B" | "b" | "b" |
| "C" | "c" | "c" |
| "H" | "h" | "g" (mapped down) |
| "I" | "i" | "g" (mapped down) |
| "J" | "j" | "g" (mapped down) |

### Code Usage
```typescript
import { normalizeEnergyRating } from './src/shared/hungarian-value-mappings';

normalizeEnergyRating('A++');  // "a++"
normalizeEnergyRating('B');    // "b"
normalizeEnergyRating('J');    // "j"
```

---

## 7. Construction Type

### Canonical Values
```typescript
'panel'             // Panel building (Panelház)
'tégla'             // Brick (Tégla)
'vasbeton'          // Reinforced concrete (Vasbeton)
'vályog'            // Adobe (Vályog)
'fa'                // Wood (Fa)
'könnyűszerkezet'   // Lightweight structure
'vegyesfalazat'     // Mixed masonry
'egyéb'             // Other
```

### Mapping Examples
| Input | Normalized | English |
|-------|-----------|---------|
| "panel" | "panel" | "panel" |
| "panelház" | "panel" | "panel" |
| "tégla" | "tégla" | "brick" |
| "brick" | "tégla" | "brick" |
| "vasbeton" | "vasbeton" | "concrete" |
| "beton" | "vasbeton" | "concrete" |
| "concrete" | "vasbeton" | "concrete" |
| "vályog" | "vályog" | "masonry" |
| "adobe" | "vályog" | "masonry" |
| "fa" | "fa" | "wood" |
| "fából készült" | "fa" | "wood" |
| "könnyűszerkezet" | "könnyűszerkezet" | "steel" |
| "vegyes falazat" | "vegyesfalazat" | "mixed" |

### Code Usage
```typescript
import { normalizeConstructionType } from './src/shared/hungarian-value-mappings';

normalizeConstructionType('panel');      // "panel"
normalizeConstructionType('brick');      // "tégla"
normalizeConstructionType('vasbeton');   // "vasbeton"
```

---

## Complete Example

### Input (from ingatlan.com)
```typescript
const listing: IngatlanListing = {
  id: 'abc123',
  title: '2-szobás lakás Budapest belvárosában',
  price: 45000000,
  currency: 'HUF',
  location: 'Budapest, V. kerület',
  propertyType: 'lakás',
  transactionType: 'eladó',
  url: 'https://ingatlan.com/abc123',
  area: 65,
  rooms: 2,
  disposition: '2 szobás',           // Will be normalized
  condition: 'felújított',           // Already canonical
  ownership: 'tulajdon',             // Already canonical
  furnished: 'igen',                 // Will be normalized
  heating: 'központi fűtés',         // Will be normalized
  constructionType: 'tégla',         // Already canonical
  energyRating: 'B'                  // Will be normalized
};
```

### Output (StandardProperty)
```typescript
{
  // ... standard fields ...

  country_specific: {
    // Hungarian canonical values (stored for database)
    hungarian_disposition: '2-szobás',        // ✅ Normalized
    hungarian_ownership: 'tulajdon',          // ✅ Already canonical

    // English canonical values (for API/international use)
    condition: 'after_renovation',            // ✅ Mapped from 'felújított'
    furnished: 'furnished',                   // ✅ Mapped from 'igen'
    heating_type: 'central_heating',          // ✅ Mapped from 'központi fűtés'
    construction_type: 'brick',               // ✅ Mapped from 'tégla'
    energy_rating: 'b'                        // ✅ Normalized
  }
}
```

---

## Validation Functions

### Check if value is valid
```typescript
import {
  isValidDisposition,
  isValidOwnership,
  isValidCondition,
  isValidFurnished,
  isValidHeatingType,
  isValidEnergyRating,
  isValidConstructionType
} from './src/shared/hungarian-value-mappings';

isValidDisposition('2-szobás');        // true
isValidDisposition('invalid');         // false

isValidOwnership('tulajdon');          // true
isValidCondition('felújított');        // true
isValidFurnished('bútorozott');        // true
isValidHeatingType('központi');        // true
isValidEnergyRating('a++');            // true
isValidConstructionType('tégla');      // true
```

---

## Best Practices

1. **Always normalize before storing**: Use normalizers before saving to database
2. **Store both values**: Keep Hungarian original + English canonical
3. **Handle nulls gracefully**: All normalizers return `undefined` for invalid input
4. **Case-insensitive matching**: All normalizers handle mixed case
5. **Support variants**: Each normalizer accepts multiple input formats

---

## Testing

Run the comprehensive test suite to verify all mappings:

```bash
npx ts-node test-scraper.ts
```

This tests:
- 7 disposition variants
- 5 ownership types
- 9 condition states
- 3 furnished states
- 7 heating types
- Energy ratings A++ to J
- 4 construction types
- Edge cases and validation

**Expected**: 48/48 tests pass ✅

---

## Files Reference

- **Mappings**: `/src/shared/hungarian-value-mappings.ts` (516 lines)
- **Types**: `/src/types/ingatlanTypes.ts` (132 lines)
- **Transformer**: `/src/transformers/ingatlanTransformer.ts` (300 lines)
- **Tests**: `/test-scraper.ts` (350+ lines)
