# Transformers — immobiliare.it

## Overview

Transformation is split across five files:

| File | Role |
|---|---|
| `src/transformers/immobiliareTransformer.ts` | Category router — dispatches to the correct category transformer |
| `src/transformers/apartments/apartmentTransformer.ts` | Produces `ApartmentPropertyTierI` |
| `src/transformers/houses/houseTransformer.ts` | Produces `HousePropertyTierI` |
| `src/transformers/land/landTransformer.ts` | Produces `LandPropertyTierI` |
| `src/transformers/commercial/commercialTransformer.ts` | Produces `CommercialPropertyTierI` |

All transformers receive an `ImmobiliareResult` (search or detail data) and a search config object that carries `category` and `contract` metadata.

## Category Router

**File:** `src/transformers/immobiliareTransformer.ts`

The router first checks `config.category` (authoritative, derived from the search URL slug). If that is unavailable, it falls back to heuristic detection from the raw data.

### Fallback Detection Logic

```typescript
const type = result.realEstate?.type?.toLowerCase() ?? '';
const typology = result.properties?.[0]?.typologyGA4Translation?.toLowerCase() ?? '';
```

| Matched keyword | Assigned category |
|---|---|
| `terreno`, `terreni` | `land` |
| `ufficio`, `negozio`, `capannone`, `commerciale`, `locale` | `commercial` |
| `villa`, `casa`, `villetta`, `rustico`, `casale`, `indipendente` | `house` |
| *(no match)* | `apartment` (default) |

Detection is applied to both `realEstate.type` and `typologyGA4Translation` (lowercased). The first matching rule wins.

## Common Input Structure

All transformers operate on the same `ImmobiliareResult` type:

```typescript
interface ImmobiliareResult {
  realEstate: {
    id: number;
    title?: string;
    contract?: string;       // "Vendita" | "Affitto"
    isNew?: boolean;
    luxury?: boolean;
    type?: string;
    typology?: { id?: number; name?: string };
    agency?: { displayName?: string; id?: number };
    advertiser?: {
      agency?: { displayName?: string };
      supervisor?: { displayName?: string };
    };
    uri?: string;
  };
  seo?: { anchor?: string; url?: string };
  properties?: [{
    price?: { value?: number; formattedValue?: string; priceRange?: string };
    surface_value?: string;          // sqm as string
    rooms?: string;
    bedRoomsNumber?: string;
    bathrooms?: string;
    floor?: { value?: string; abbreviation?: string; ga4Value?: string };
    floors?: string;                 // total floors in building
    hasElevators?: boolean;
    ga4features?: string[];          // ["Balcone", "Cantina", "Ascensore", ...]
    ga4Garage?: string;              // "Box" | "Posto auto" | null
    condition?: string;
    ga4Heating?: string;
    energy?: { class?: string; value?: string };
    location?: {
      address?: string;
      latitude?: number;
      longitude?: number;
      city?: { name?: string; id?: number };
      province?: { name?: string; abbreviation?: string };
      region?: { name?: string };
      macrozone?: { name?: string };
      microzone?: { name?: string };
    };
    description?: string;
    photo?: { urls?: { small?: string; medium?: string; large?: string } };
    multimedia?: {
      photos?: Array<{ urls?: { small?: string; medium?: string; large?: string } }>;
    };
    typologyGA4Translation?: string;
    caption?: string;
  }];
}
```

The transformers always read from `result.properties[0]` (first property block). The `prop` shorthand below refers to `result.properties[0]`.

## Shared Field Transformations

These helpers are used across multiple transformers:

### `source_url`

```typescript
source_url = 'https://www.immobiliare.it' + result.seo?.url;
// e.g. https://www.immobiliare.it/annunci/12345678/
```

### `portal_id`

```typescript
portal_id = `immobiliare-it-${result.realEstate.id}`;
```

### `transaction_type`

```typescript
transaction_type = contract === 'rent' ? 'rent' : 'sale';
// contract param comes from search config, not from raw data
```

### Floor parsing

```typescript
// Special floor values from immobiliare.it
't' | 'terra'   → 0   (ground floor)
's' | 'seminterrato' → -1  (basement/semi-basement)
// All other values → parseInt(value)
```

### Image assembly

```typescript
// Priority: large > medium (from multimedia.photos[] array)
// Fallback to prop.photo.urls if multimedia not present
images = prop.multimedia?.photos?.map(p => p.urls?.large ?? p.urls?.medium)
      ?? [prop.photo?.urls?.large ?? prop.photo?.urls?.medium]
```

### Condition mapping

| Italian value (substring match) | Mapped value |
|---|---|
| `nuovo` | `new` |
| `ottimo` | `excellent` |
| `buono` | `good` |
| `ristrutturato` | `after_renovation` |
| `da ristrutturare` | `requires_renovation` |

### Feature detection from `ga4features[]`

All comparisons are case-insensitive substring matches against the array values:

| Feature check | Field |
|---|---|
| `'balcon'` in ga4features | `has_balcony` |
| `'cantina'` in ga4features | `has_basement` |
| `'loggia'` in ga4features | `has_loggia` |
| `'terrazzo'` or `'terrazza'` in ga4features | `has_terrace` |
| `ga4Garage` is truthy | `has_parking` |
| `ga4Garage` includes `'garage'` (case-insensitive) | `has_garage` |
| `'piscina'` in ga4features | `has_pool` (houses only) |
| `'giardino'` or `'garden'` in ga4features | `has_garden` (houses only) |

---

## Apartment Transformer

**File:** `src/transformers/apartments/apartmentTransformer.ts`
**Output type:** `ApartmentPropertyTierI`

### Property Subtype Mapping

| `typologyGA4Translation` (lowercase) | `property_subtype` |
|---|---|
| contains `attico` | `penthouse` |
| contains `loft` | `loft` |
| contains `mansarda` | `atelier` |
| contains `monolocale` | `studio` |
| *(no match)* | `standard` |

### Field Transformation Table

| Target Field | Source Path | Transformation |
|---|---|---|
| `title` | `realEstate.title` \| `prop.caption` | Direct string |
| `price` | `prop.price.value` | Direct number |
| `transaction_type` | search config `contract` | `'sale'` or `'rent'` |
| `property_category` | — | Hardcoded `'apartment'` |
| `property_subtype` | `prop.typologyGA4Translation` | Subtype mapping (see above) |
| `sqm` | `prop.surface_value` | `parseFloat` |
| `bedrooms` | `prop.bedRoomsNumber` | `parseInt`; fallback: `parseInt(rooms) - 1` |
| `bathrooms` | `prop.bathrooms` | `parseInt` |
| `rooms` | `prop.rooms` | `parseInt` |
| `floor` | `prop.floor.value` | Floor parsing (t→0, s→-1, else parseInt) |
| `total_floors` | `prop.floors` | `parseInt` |
| `has_elevator` | `prop.hasElevators` | Direct boolean |
| `has_balcony` | `prop.ga4features` | `'balcon'` substring match |
| `has_parking` | `prop.ga4Garage` | Truthy check |
| `has_basement` | `prop.ga4features` | `'cantina'` substring match |
| `has_loggia` | `prop.ga4features` | `'loggia'` substring match |
| `has_terrace` | `prop.ga4features` | `'terrazzo'` or `'terrazza'` match |
| `has_garage` | `prop.ga4Garage` | Contains `'garage'` (case-insensitive) |
| `condition` | `prop.condition` | Condition mapping table |
| `heating_type` | `prop.ga4Heating` | Direct string |
| `energy_class` | `prop.energy.class` | Direct string |
| `images` | `prop.photo` + `prop.multimedia.photos` | Image assembly (large > medium) |
| `source_url` | `seo.url` | Prefix `https://www.immobiliare.it` |
| `source_platform` | — | Hardcoded `'immobiliare-it'` |
| `portal_id` | `realEstate.id` | `'immobiliare-it-{id}'` |
| `status` | — | Hardcoded `'active'` |
| `location.city` | `prop.location.city.name` | Direct string |
| `location.region` | `prop.location.region.name` | Direct string |
| `location.country` | — | Hardcoded `'Italy'` |
| `location.coordinates` | `prop.location.latitude/longitude` | `{ lat, lng }` object |
| `country_specific.italy.province` | `prop.location.province.abbreviation` | Direct string |
| `country_specific.italy.macrozone` | `prop.location.macrozone.name` | Direct string |
| `country_specific.italy.microzone` | `prop.location.microzone.name` | Direct string |
| `portal_metadata.immobiliare.agency` | `realEstate.agency` \| `realEstate.advertiser` | Agency object |
| `portal_metadata.immobiliare.isNew` | `realEstate.isNew` | Direct boolean |
| `portal_metadata.immobiliare.luxury` | `realEstate.luxury` | Direct boolean |
| `portal_metadata.immobiliare.typology` | `realEstate.typology` | `{ id, name }` object |

---

## House Transformer

**File:** `src/transformers/houses/houseTransformer.ts`
**Output type:** `HousePropertyTierI`

### Property Subtype Mapping

| `typologyGA4Translation` (lowercase) | `property_subtype` |
|---|---|
| contains `villa singola` | `villa` |
| contains `schiera` | `terraced` |
| contains `villetta` | `semi_detached` |
| contains `rustico` or `casale` | `farmhouse` |
| contains `casa indipendente` | `detached` |
| *(no match)* | `detached` (default) |

### Field Transformation Table

Houses share all base fields with apartments plus the following house-specific fields:

| Target Field | Source Path | Transformation | Notes |
|---|---|---|---|
| `property_category` | — | Hardcoded `'house'` | |
| `sqm_living` | `prop.surface_value` | `parseFloat` | Living area (same source as `sqm` in apartments) |
| `sqm_plot` | — | Hardcoded `0` | Plot area not available in list data; only present on detail pages |
| `has_garden` | `prop.ga4features` | `'giardino'` or `'garden'` match | |
| `has_garage` | `prop.ga4Garage` | Contains `'garage'` (case-insensitive) | |
| `has_parking` | `prop.ga4Garage` | Truthy check | |
| `has_basement` | `prop.ga4features` | `'cantina'` match | |
| `has_pool` | `prop.ga4features` | `'piscina'` match | |
| `has_terrace` | `prop.ga4features` | `'terrazzo'` or `'terrazza'` match | |
| `has_balcony` | `prop.ga4features` | `'balcon'` match | |

> **Note on `sqm_plot`:** The plot area field (`sqm_plot`) is hardcoded to `0` because search result pages do not include plot area data. This value is only available on individual listing detail pages. The three-phase orchestrator fetches detail pages for new/changed listings, but `sqm_plot` extraction from detail page data has not been implemented — the field defaults to `0` in all cases.

---

## Land Transformer

**File:** `src/transformers/land/landTransformer.ts`
**Output type:** `LandPropertyTierI`

Land listings on immobiliare.it carry minimal structured data. Most fields beyond location and price are absent or unreliable.

### Field Transformation Table

| Target Field | Source Path | Transformation |
|---|---|---|
| `property_category` | — | Hardcoded `'land'` |
| `area_plot_sqm` | `prop.surface_value` | `parseFloat` |
| `price` | `prop.price.value` | Direct number |
| `transaction_type` | search config `contract` | `'sale'` (land-rent is skipped) |
| `title` | `realEstate.title` \| `prop.caption` | Direct string |
| `source_url` | `seo.url` | Prefix `https://www.immobiliare.it` |
| `source_platform` | — | Hardcoded `'immobiliare-it'` |
| `portal_id` | `realEstate.id` | `'immobiliare-it-{id}'` |
| `status` | — | Hardcoded `'active'` |
| `location.*` | `prop.location.*` | Same as apartment transformer |
| `country_specific.italy.*` | `prop.location.*` | Province, macrozone, microzone |
| `portal_metadata.immobiliare.*` | `realEstate.*` | Agency, isNew, luxury, typology |

---

## Commercial Transformer

**File:** `src/transformers/commercial/commercialTransformer.ts`
**Output type:** `CommercialPropertyTierI`

### Property Subtype Mapping

| `typologyGA4Translation` (lowercase) | `property_subtype` |
|---|---|
| contains `ufficio` | `office` |
| contains `negozio`, `shop`, or `retail` | `retail` |
| contains `capannone` or `warehouse` | `warehouse` |
| contains `hotel` or `albergo` | `hotel` |
| contains `ristorante` | `restaurant` |
| contains `showroom` | `showroom` |
| *(no match)* | `office` (default) |

### Field Transformation Table

| Target Field | Source Path | Transformation |
|---|---|---|
| `property_category` | — | Hardcoded `'commercial'` |
| `property_subtype` | `prop.typologyGA4Translation` | Subtype mapping (see above) |
| `sqm_total` | `prop.surface_value` | `parseFloat` |
| `has_elevator` | `prop.hasElevators` | Direct boolean |
| `has_parking` | `prop.ga4Garage` | Truthy check |
| `has_bathrooms` | `prop.bathrooms` | `parseInt(bathrooms) > 0` |
| `bathroom_count` | `prop.bathrooms` | `parseInt` |
| `price` | `prop.price.value` | Direct number |
| `transaction_type` | search config `contract` | `'sale'` or `'rent'` |
| `title` | `realEstate.title` \| `prop.caption` | Direct string |
| `source_url` | `seo.url` | Prefix `https://www.immobiliare.it` |
| `source_platform` | — | Hardcoded `'immobiliare-it'` |
| `portal_id` | `realEstate.id` | `'immobiliare-it-{id}'` |
| `status` | — | Hardcoded `'active'` |
| `location.*` | `prop.location.*` | Same as apartment transformer |
| `country_specific.italy.*` | `prop.location.*` | Province, macrozone, microzone |
| `portal_metadata.immobiliare.*` | `realEstate.*` | Agency, isNew, luxury, typology |

---

## JSONB Storage

### `country_specific.italy`

Fields stored in the Italy-specific JSONB column:

| Field | Source | Type |
|---|---|---|
| `province` | `prop.location.province.abbreviation` | `string` (e.g. `"RM"`, `"MI"`) |
| `macrozone` | `prop.location.macrozone.name` | `string` |
| `microzone` | `prop.location.microzone.name` | `string` |

### `portal_metadata.immobiliare`

Fields stored in the portal-specific JSONB column:

| Field | Source | Type | Notes |
|---|---|---|---|
| `agency` | `realEstate.agency` or `realEstate.advertiser.agency` | `object` | Agency display name and ID |
| `isNew` | `realEstate.isNew` | `boolean` | Recently listed flag |
| `luxury` | `realEstate.luxury` | `boolean` | Luxury property flag |
| `typology` | `realEstate.typology` | `{ id, name }` | Raw typology from portal |
