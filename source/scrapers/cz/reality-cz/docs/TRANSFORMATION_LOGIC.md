# Reality.cz - Transformation Logic

## Overview

Transforms raw `RealityListing` (normalized from API detail response) into category-specific TierI types:
- `ApartmentPropertyTierI`
- `HousePropertyTierI`
- `LandPropertyTierI`
- `CommercialPropertyTierI`

## Category Detection

### Detection Logic
File: `src/transformers/realityTransformer.ts` - `detectPropertyCategory()`

**Primary**: Uses the API `type` field (lowercase match):

| API Type Value | TierI Category |
|---|---|
| `flat` | apartment |
| `house` | house |
| `land` | land |
| `cottage`, `recreation`, `rekreace` | house |
| Contains `kancelar`/`office` | commercial |
| Contains `sklad`/`warehouse` | commercial |
| Contains `obchod`/`retail` | commercial |
| Contains `prumysl`/`industrial` | commercial |
| Contains `hotel`/`restaurant` | commercial |

**Fallback**: If API type is unmapped, falls back to title-based detection using Czech keywords:
- `kancelar`, `sklad`, `vyrob`, `obchod`, `restaurace`, `hotel` -> commercial
- `pozemek`, `parcela` -> land
- `dum`, `rodinny` -> house
- `byt`, digit+kk/+1 pattern -> apartment
- **Default**: apartment (most common in Czech Republic)

### Edge Cases
- `cottage` and `recreation` properties are mapped to house category
- Commercial detection is broad: any property with office/warehouse/retail/industrial keywords
- The default to apartment means truly unclassifiable listings will be treated as apartments

## Transformation Flow

```
RealityListing
    |
    v
detectPropertyCategory(api_type, title)
    |
    +-- 'apartment' --> transformRealityApartment()
    +-- 'house'     --> transformRealityHouse()
    +-- 'land'      --> transformRealityLand()
    +-- 'commercial' --> transformRealityCommercial()
```

### Common Pattern (All Transformers)
Each transformer follows the same structure:
1. Build info map from `information[]` array: `{ key: value }` lookup
2. Extract core fields (title, price, currency, transaction_type)
3. Build location from `place` string + GPS coordinates
4. Extract category-specific fields from info map
5. Parse boolean amenities ("Ano"/"Ne")
6. Normalize Czech values via shared `czech-value-mappings`
7. Assemble TierI object with portal_metadata and country_specific

## Apartment Transformer

**File**: `src/transformers/apartments/apartmentTransformer.ts`

**Required Fields**:
- `bedrooms`: From `Dispozice` (e.g., "2+kk" -> 2), defaults to 1
- `sqm`: From `Plocha` / `Uzitna plocha` / `Podlahova plocha`, defaults to 0
- `has_elevator`: From `Vytah` ("Ano" -> true)
- `has_balcony`: From `Balkon`
- `has_parking`: From `Parkovani` / `Parkovaci stani`
- `has_basement`: From `Sklep`

**Additional Fields**:
- `floor`: From `Podlazi` / `Patro`
- `total_floors`: From `Pocet podlazi`
- `rooms`: Calculated from disposition ("2+1" -> 3, "2+kk" -> 2)
- `has_loggia`, `has_terrace`, `has_garage`: Boolean info fields
- `condition`: Via `normalizeCondition()` + local mapping
- `heating_type`: Via `normalizeHeatingType()`
- `construction_type`: Via `normalizeConstructionType()`
- `energy_class`: Via `normalizeEnergyRating()`
- `furnished`: Via `normalizeFurnished()`
- `deposit`: Parsed from `Kauce` / `Vratna kauce` / `Jistina`
- `available_from`: Parsed from `K nastehavani` / `Dostupne od`
- `year_built`, `renovation_year`: Parsed year from respective info keys

## House Transformer

**File**: `src/transformers/houses/houseTransformer.ts`

**Required Fields**:
- `bedrooms`: From disposition, defaults to 1
- `sqm_living`: From `Plocha` / `Uzitna plocha` / `Obytna plocha`, defaults to 0
- `sqm_plot`: From `Plocha pozemku` / `Pozemek` / `Plocha parcely`, defaults to 0
- `has_garden`: From `Zahrada`
- `has_garage`: From `Garaz`
- `has_parking`: From `Parkovani`
- `has_basement`: From `Sklep`

**Additional Fields**:
- `has_pool`: From `Bazen`
- `has_fireplace`: From `Krb`
- `has_terrace`, `has_balcony`: Boolean info
- `stories`: From `Pocet podlazi`
- `garden_area`: From `Plocha zahrady`
- Same building/condition/energy fields as apartment

## Land Transformer

**File**: `src/transformers/land/landTransformer.ts`

**Required Fields**:
- `area_plot_sqm`: From `Plocha` / `Plocha pozemku` / `Plocha parcely`, defaults to 0

**Additional Fields**:
- `water_supply`: `Voda` "Ano" -> `'mains'`
- `sewage`: `Kanalizace` "Ano" -> `'mains'`
- `electricity`: `Elektrina` "Ano" -> `'connected'`
- `gas`: `Plyn` "Ano" -> `'connected'`
- `road_access`: `Prijezdova cesta` "Ano" -> `'paved'`
- `building_permit`: From `Stavebni povoleni`
- `cadastral_number`: From `Katastralni cislo`
- `zoning`: Mapped from `Vyuziti` / `Typ pozemku` via `mapZoning()`
- `ownership_type`: Via `normalizeOwnership()`

### Zoning Mapping
| Czech Value (contains) | Zoning |
|---|---|
| `bydl`, `obyt`, `rezidencni` | residential |
| `komercni`, `obchod` | commercial |
| `prumysl`, `vyrob` | industrial |
| `zemedelsky`, `orna` | agricultural |
| `rekrea`, `zahrad` | recreational |
| `smisen` | mixed |

## Commercial Transformer

**File**: `src/transformers/commercial/commercialTransformer.ts`

**Required Fields**:
- `sqm_total`: From `Plocha` / `Celkova plocha` / `Uzitna plocha`, defaults to 0
- `has_elevator`: From `Vytah`
- `has_parking`: From `Parkovani`
- `has_bathrooms`: From `WC` / `Socialni zarizeni`, defaults to true

**Additional Fields**:
- `sqm_usable`, `sqm_office`, `sqm_retail`, `sqm_storage`, `sqm_plot`: Area breakdowns
- `property_subtype`: Detected from `Typ` / `Druh` / title
- `office_rooms`, `ceiling_height`: Commercial-specific
- `has_loading_dock`, `has_hvac`, `has_air_conditioning`, `has_security_system`
- `has_reception`, `has_kitchen`, `has_disabled_access`, `has_fiber_internet`
- `monthly_rent`: Price when transaction_type is rent
- `operating_costs`, `service_charges`: From info keys

### Commercial Subtype Detection
| Value (contains) | Subtype |
|---|---|
| `kancelar`, `office` | office |
| `prodej`, `obchod`, `retail` | retail |
| `sklad`, `warehouse` | warehouse |
| `vyrob`, `prumysl`, `industrial` | industrial |
| `hotel` | hotel |
| `restaurace`, `restaurant` | restaurant |
| `ordinace`, `medical`, `zdravotni` | medical |
| `showroom`, `vystavni` | showroom |
| `smisen`, `mixed` | mixed_use |

## Field Transformations

### Price Normalization
```typescript
// Price extracted from structured API price object
const priceObj = transactionType === 'sale' ? detail.price.sale : detail.price.rent;
const price = priceObj?.price; // Already numeric
const currency = priceObj?.unit === 'Kc' || priceObj?.unit === 'Kc' ? 'CZK' : (priceObj?.unit || 'CZK');
```

### Area Parsing
```typescript
// "75 m2" -> 75, "1 200,5 m2" -> 1200.5
function parseArea(str?: string): number | undefined {
  const match = str.match(/([\d.,]+)/);
  return match ? parseFloat(match[1].replace(',', '.')) : undefined;
}
```

### Boolean Parsing (Czech)
```typescript
// "Ano" -> true, "Ne" -> false, undefined -> false
function parseBooleanInfo(value?: string): boolean {
  const v = value.toLowerCase().trim();
  return v === 'ano' || v === 'yes' || v === '1' || v === 'true';
}
```

### Bedroom Extraction from Disposition
```typescript
// "2+kk" -> 2, "3+1" -> 3, "1+kk" -> 1
function extractBedrooms(disposition?: string): number | undefined {
  const match = disposition.match(/^(\d)/);
  return match ? parseInt(match[1]) : undefined;
}
```

### Room Calculation from Disposition
```typescript
// "2+kk" -> 2, "3+1" -> 4, "2+1" -> 3
function extractRooms(disposition?: string): number | undefined {
  const match = disposition.match(/^(\d)\+(\d|kk)/i);
  const baseRooms = parseInt(match[1]);
  const additional = match[2].toLowerCase() === 'kk' ? 0 : 1;
  return baseRooms + additional;
}
```

### Date Parsing (Czech)
```typescript
// "01.03.2026" -> "2026-03-01"
function parseDate(dateStr?: string): string | undefined {
  const czechMatch = dateStr.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (czechMatch) {
    const [, day, month, year] = czechMatch;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
}
```

### Condition Mapping
```typescript
// normalizeCondition() output -> TierI condition
function mapConditionToTierI(normalized?: string) {
  if (normalized === 'very_good') return 'excellent';
  if (normalized === 'before_renovation') return 'requires_renovation';
  if (normalized === 'project' || normalized === 'under_construction') return 'new';
  return normalized; // good, new, excellent, requires_renovation pass through
}
```

### Value Normalization (Shared)
Uses `scrapers/Czech Republic/shared/czech-value-mappings.js`:
- `normalizeDisposition()` - "2+kk" format normalization
- `normalizeOwnership()` - "Osobni" -> "personal", "Druzstevni" -> "cooperative"
- `normalizeCondition()` - "Velmi dobry" -> "very_good", "Novostavba" -> "new"
- `normalizeFurnished()` - "Castecne" -> "partially", "Ano" -> "fully"
- `normalizeHeatingType()` - "Ustredni" -> "central", "Plynove" -> "gas"
- `normalizeConstructionType()` - "Panel" -> "panel", "Cihla" -> "brick"
- `normalizeEnergyRating()` - Energy class letters A-G

## Checksum Generation

**File**: `src/utils/checksumExtractor.ts`

**Fields Used**:
```typescript
{
  price: listing.price ?? null,
  title: listing.title ?? null,
  description: listing.description ?? null,
  sqm: parseFloat(info['Plocha']) ?? null,
  disposition: info['Dispozice'] ?? null,
  floor: parseInt(info['Podlazi']) ?? null,
}
```

Only these 6 fields trigger a re-fetch when changed. Other fields (images, agent info, metadata) are not included in the checksum.

## Validation

### Required Field Defaults
- `bedrooms`: Defaults to 1 if disposition is missing/unparseable
- `sqm` / `sqm_living` / `sqm_total` / `area_plot_sqm`: Default to 0
- `bathrooms`: Default to 1
- `has_bathrooms` (commercial): Default to true
- Boolean amenities: Default to false

### Error Handling
- Individual listing transformation failures are caught and logged in `index.ts`
- Failed listings return `null` and are filtered from the batch
- No explicit validation beyond TypeScript type checking
