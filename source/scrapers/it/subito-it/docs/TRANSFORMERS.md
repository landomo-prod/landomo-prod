# Subito.it Transformers

## Architecture

File: `src/transformers/index.ts`

The transformer router receives a `SubitoMinimalListing` (which carries the full `SubitoItem` in its `item` field) and a `ScrapeConfig` (containing `category` and `contract`). It delegates to the appropriate category transformer based on `config.category`.

### Category Routing

| `config.category` | Transformer | Output Type |
|-------------------|-------------|-------------|
| `'appartamenti'` | `apartmentTransformer.ts` | `ApartmentPropertyTierI` |
| `'case-ville'` | `houseTransformer.ts` | `HousePropertyTierI` |

No fallback is needed. The Hades API always returns listings pre-segmented by category.

### Feature Extraction Pattern

All transformers use `getFeatureValueByUri(features, uri)` and label-based lookup from `src/utils/subitoHelpers.ts` to extract values from the `features[]` array:

```typescript
// URI-based lookup (preferred for structured fields)
const price = getFeatureValueByUri(item.features, '/price');
// -> returns the first value string from the matching feature, e.g. "28000 €"

// Label-based lookup (for boolean amenities)
const hasElevator = item.features.some(
  f => f.label === 'Ascensore' && f.values[0]?.value === 'Sì'
);
```

### Italian Value Normalization

All transformers use shared normalizer functions from `src/utils/subitoHelpers.ts`:

| Function | Purpose | Example |
|----------|---------|---------|
| `parseNumeric(str)` | Strips currency/unit symbols, parses float | `"28000 €"` -> `28000` |
| `parseFloor(str)` | Maps Italian floor strings to integers | `"3° piano"` -> `3` |
| `mapTransactionType(contract)` | Contract key to enum | `"s"` -> `"sale"` |
| `mapCondition(str)` | Italian condition to enum | `"Buone condizioni"` -> `"good"` |
| `extractIdFromUrn(urn)` | Parses last URN segment | `"id:ad:608241847:list:636897239"` -> `"636897239"` |
| `buildSourceUrl(item)` | Returns `item.urls.default` | Direct passthrough |

---

## Apartment Transformer

File: `src/transformers/apartments/apartmentTransformer.ts`
Output: `ApartmentPropertyTierI`

### Core Fields

| Source | Target Field | Transformation |
|--------|-------------|----------------|
| `item.subject` | `title` | Direct string |
| `getFeatureValueByUri(features, '/price')` | `price` | `parseNumeric("28000 €" -> 28000)` |
| `config.contract` | `transaction_type` | `mapTransactionType`: `'s'` -> `'sale'`, `'k'` -> `'rent'` |
| `item.geo.city.value` | `location.city` | Direct string |
| `item.geo.region.value` | `location.region` | Direct string |
| `item.geo.coordinates.latitude` | `location.coordinates.lat` | Direct number |
| `item.geo.coordinates.longitude` | `location.coordinates.lon` | Direct number |
| `item.urls.default` | `source_url` | Direct string |
| `extractIdFromUrn(item.urn)` | `portal_id` | `'subito-it-{id}'` e.g. `'subito-it-636897239'` |
| `'active'` | `status` | Hardcoded |
| `'apartment'` | `property_category` | Hardcoded |
| `'subito-it'` | `source_platform` | Hardcoded |

### Apartment-Specific Fields

| Source | Target Field | Transformation |
|--------|-------------|----------------|
| `getFeatureValueByUri(features, '/rooms')` | `rooms` | `parseInt("3 locali" -> 3)` |
| `rooms - 1` | `bedrooms` | `Math.max(0, rooms - 1)` |
| `getFeatureValueByUri(features, '/bathrooms')` | `bathrooms` | `parseNumeric("1 bagno" -> 1)` |
| `getFeatureValueByUri(features, '/size')` | `sqm` | `parseNumeric("74 mq" -> 74)` |
| `getFeatureValueByUri(features, '/floor')` | `floor` | `parseFloor` (see floor table below) |

### Boolean Amenity Fields

Amenities are detected by matching `feature.label` and checking `feature.values[0].value === 'Sì'`:

| Feature Label | Target Field | Notes |
|---------------|-------------|-------|
| `Ascensore` | `has_elevator` | `'Sì'` -> `true` |
| `Balcone` | `has_balcony` | `'Sì'` -> `true` |
| `Box/Posto auto` | `has_parking` | `'Sì'` -> `true` |
| `Cantina` | `has_basement` | `'Sì'` -> `true` |
| `Loggia` | `has_loggia` | `'Sì'` -> `true` |
| `Terrazzo` | `has_terrace` | `'Sì'` -> `true` |
| `Box auto` | `has_garage` | `'Sì'` -> `true` |

### Condition Mapping

Feature URI: `/condition`

| Italian Value | Enum Value |
|---------------|------------|
| `Nuovo` / `Nuova costruzione` | `new` |
| `Ristrutturato` | `after_renovation` |
| `Buone condizioni` / `Buono` | `good` |
| `Da ristrutturare` | `requires_renovation` |

### Heating Type

Extracted from feature URI `/heating` or label `Riscaldamento`. Value is passed through as-is (Italian string). Examples: `"Autonomo"`, `"Centralizzato"`, `"Teleriscaldamento"`.

### Property Subtype Detection

Detected from `item.category.name` (case-insensitive keyword matching):

| Category Name Keyword | `property_subtype` |
|-----------------------|-------------------|
| `attico` | `penthouse` |
| `loft` | `loft` |
| `mansarda` | `atelier` |
| `monolocale` | `studio` |
| `maisonette` | `maisonette` |
| `duplex` | `duplex` |
| (no match) | `undefined` |

### Images

Extracted from `item.images[]`:

1. For each image object, find the largest entry in `scale[]` by `size` string
2. Construct URL as `cdn_base_url + scale[].uri`
3. Result: array of image URL strings

### Country-Specific Fields (Tier II)

Stored under `country_specific.italy`:

| Field | Source | Notes |
|-------|--------|-------|
| `province` | `item.geo.town.value` | Italian province name, if available |

### Portal Metadata (Tier III)

Stored under `portal_metadata.subito`:

| Field | Source |
|-------|--------|
| `urn` | `item.urn` |
| `date_display` | `item.dates.display_iso8601` or `item.dates.display` |
| `advertiser_name` | `item.advertiser.name` |

---

## House Transformer

File: `src/transformers/houses/houseTransformer.ts`
Output: `HousePropertyTierI`

Inherits all core field extraction logic from the apartment transformer. The following fields differ or are house-specific.

### House-Specific Area Fields

| Source | Target Field | Transformation |
|--------|-------------|----------------|
| `getFeatureValueByUri(features, '/size')` | `sqm_living` | `parseNumeric("120 mq" -> 120)` |
| Feature label `Superficie terreno` | `sqm_plot` | `parseNumeric` |

### House Boolean Amenity Fields

| Feature Label | Target Field | Notes |
|---------------|-------------|-------|
| `Giardino` | `has_garden` | `'Sì'` -> `true` |
| `Garage/Box` | `has_garage` | `'Sì'` -> `true` |
| `Posto auto` | `has_parking` | `'Sì'` -> `true` |
| `Cantina` | `has_basement` | `'Sì'` -> `true` |
| `Piscina` | `has_pool` | `'Sì'` -> `true` |
| `Terrazzo` | `has_terrace` | `'Sì'` -> `true` |
| `Balcone` | `has_balcony` | `'Sì'` -> `true` |

### House Property Subtype Detection

Detected from `item.category.name` or `item.subject` (title) via keyword matching:

| Keyword | `property_subtype` |
|---------|-------------------|
| `villa singola` | `villa` |
| `schiera` / `villetta a schiera` | `terraced` |
| `bifamiliare` | `semi_detached` |
| `rustico` / `casale` | `farmhouse` |
| (no match) | `undefined` |

---

## parseFloor Function

File: `src/utils/subitoHelpers.ts`

Converts Italian floor strings to integers:

| Italian Input | Parsed Value | Notes |
|--------------|-------------|-------|
| `Piano terra` / `Pianoterra` | `0` | Ground floor |
| `Seminterrato` | `-1` | Basement level |
| `Attico` | `99` | Penthouse sentinel value |
| `1° piano`, `2° piano`, etc. | `1`, `2`, ... | Ordinal digit extraction |
| `Primo` / `Secondo` / ... | `1` / `2` / ... | Italian ordinal word mapping |
| (unparseable) | `undefined` | No floor set |

---

## Common Helpers

File: `src/utils/subitoHelpers.ts`

| Function | Signature | Purpose |
|----------|-----------|---------|
| `extractIdFromUrn` | `(urn: string) => string` | Parses `"id:ad:608241847:list:636897239"` -> `"636897239"` (last colon segment) |
| `getFeatureValueByUri` | `(features, uri) => string \| undefined` | Finds feature by URI, returns first value string |
| `parseNumeric` | `(str: string) => number \| undefined` | Strips `€`, `mq`, spaces; parses float |
| `parseFloor` | `(str: string) => number \| undefined` | Italian floor string to integer (see table above) |
| `buildSourceUrl` | `(item: SubitoItem) => string` | Returns `item.urls.default` |
| `mapTransactionType` | `(contract: string) => 'sale' \| 'rent'` | `'s'` -> `'sale'`, `'k'` -> `'rent'` |
| `mapCondition` | `(str: string) => ConditionEnum \| undefined` | Italian condition string to enum value |

---

## Portal ID Format

| Component | Value | Example |
|-----------|-------|---------|
| Prefix | `subito-it-` | fixed |
| ID | Last segment of URN after final colon | `636897239` |
| Full `portal_id` | `subito-it-{id}` | `subito-it-636897239` |

URN format: `"id:ad:{adGroupId}:list:{listingId}"` — the `listingId` (last segment) is used as the unique identifier.
