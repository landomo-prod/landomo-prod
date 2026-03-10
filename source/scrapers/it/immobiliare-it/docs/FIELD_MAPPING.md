# Field Mapping — immobiliare.it

Complete source-to-schema field mapping for all four property categories.

## Source Data Paths

All source paths reference the `ImmobiliareResult` object. `prop` is a shorthand for `result.properties[0]`.

```
result.realEstate.*       → Portal and listing metadata
result.seo.*              → SEO URL (used for source_url)
result.properties[0].*   → Property attributes (referred to as prop.*)
prop.location.*           → Geographic data
prop.ga4features[]        → Feature flags (array of Italian strings)
prop.multimedia.photos[]  → Photo array
```

---

## Universal Fields (All Categories)

These fields are populated identically across all four transformers.

| Schema Field | DB Column | Source Path | Transformation | Notes |
|---|---|---|---|---|
| `portal_id` | `portal_id` | `realEstate.id` | `'immobiliare-it-' + id` | String prefix + numeric ID |
| `source_url` | `source_url` | `seo.url` | Prefix `https://www.immobiliare.it` | e.g. `.../annunci/12345678/` |
| `source_platform` | `source_platform` | — | Hardcoded `'immobiliare-it'` | |
| `status` | `status` | — | Hardcoded `'active'` | |
| `title` | `title` | `realEstate.title` \| `prop.caption` | Direct string; title preferred | |
| `price` | `price` | `prop.price.value` | Direct number | |
| `transaction_type` | `transaction_type` | Search config `contract` | `'sale'` or `'rent'` | Not from raw data |
| `location.city` | `city` | `prop.location.city.name` | Direct string | |
| `location.region` | `region` | `prop.location.region.name` | Direct string | Italian region name |
| `location.country` | `country` | — | Hardcoded `'Italy'` | |
| `location.coordinates.lat` | `latitude` | `prop.location.latitude` | Direct float | |
| `location.coordinates.lng` | `longitude` | `prop.location.longitude` | Direct float | |
| `images` | `images` | `prop.multimedia.photos[]` \| `prop.photo` | `large` URL preferred, `medium` fallback | Array of URL strings |
| `heating_type` | `heating_type` | `prop.ga4Heating` | Direct string | |
| `condition` | `condition` | `prop.condition` | Condition mapping (see below) | |
| `energy_class` | `energy_class` | `prop.energy.class` | Direct string | e.g. `"A"`, `"B"`, `"G"` |
| `country_specific.italy.province` | JSONB | `prop.location.province.abbreviation` | Direct string | e.g. `"RM"`, `"MI"` |
| `country_specific.italy.macrozone` | JSONB | `prop.location.macrozone.name` | Direct string | |
| `country_specific.italy.microzone` | JSONB | `prop.location.microzone.name` | Direct string | |
| `portal_metadata.immobiliare.agency` | JSONB | `realEstate.agency` \| `realEstate.advertiser.agency` | Object | Agency name and ID |
| `portal_metadata.immobiliare.isNew` | JSONB | `realEstate.isNew` | Direct boolean | |
| `portal_metadata.immobiliare.luxury` | JSONB | `realEstate.luxury` | Direct boolean | |
| `portal_metadata.immobiliare.typology` | JSONB | `realEstate.typology` | `{ id, name }` | Portal raw typology |

### Condition Mapping

| Italian value (substring, case-insensitive) | Mapped value |
|---|---|
| `nuovo` | `new` |
| `ottimo` | `excellent` |
| `buono` | `good` |
| `ristrutturato` | `after_renovation` |
| `da ristrutturare` | `requires_renovation` |
| *(no match / missing)* | `undefined` |

---

## Apartment Fields (`ApartmentPropertyTierI`)

| Schema Field | DB Column | Source Path | Transformation |
|---|---|---|---|
| `property_category` | `property_category` | — | Hardcoded `'apartment'` |
| `property_subtype` | `apt_property_subtype` | `prop.typologyGA4Translation` | See subtype table below |
| `sqm` | `apt_sqm` | `prop.surface_value` | `parseFloat` |
| `bedrooms` | `apt_bedrooms` | `prop.bedRoomsNumber` | `parseInt`; fallback: `parseInt(rooms) - 1` |
| `bathrooms` | `apt_bathrooms` | `prop.bathrooms` | `parseInt` |
| `rooms` | `apt_rooms` | `prop.rooms` | `parseInt` |
| `floor` | `apt_floor` | `prop.floor.value` | `'t'`/`'terra'`→`0`, `'s'`/`'seminterrato'`→`-1`, else `parseInt` |
| `total_floors` | `apt_total_floors` | `prop.floors` | `parseInt` |
| `has_elevator` | `apt_has_elevator` | `prop.hasElevators` | Direct boolean |
| `has_balcony` | `apt_has_balcony` | `prop.ga4features[]` | `'balcon'` substring match |
| `has_parking` | `apt_has_parking` | `prop.ga4Garage` | Truthy check |
| `has_basement` | `apt_has_basement` | `prop.ga4features[]` | `'cantina'` substring match |
| `has_loggia` | `apt_has_loggia` | `prop.ga4features[]` | `'loggia'` substring match |
| `has_terrace` | `apt_has_terrace` | `prop.ga4features[]` | `'terrazzo'` or `'terrazza'` match |
| `has_garage` | `apt_has_garage` | `prop.ga4Garage` | Contains `'garage'` (case-insensitive) |

### Apartment Subtype Mapping

| `typologyGA4Translation` (substring, lowercase) | `property_subtype` value |
|---|---|
| `attico` | `penthouse` |
| `loft` | `loft` |
| `mansarda` | `atelier` |
| `monolocale` | `studio` |
| *(no match)* | `standard` |

---

## House Fields (`HousePropertyTierI`)

| Schema Field | DB Column | Source Path | Transformation |
|---|---|---|---|
| `property_category` | `property_category` | — | Hardcoded `'house'` |
| `property_subtype` | `house_property_subtype` | `prop.typologyGA4Translation` | See subtype table below |
| `sqm_living` | `house_sqm_living` | `prop.surface_value` | `parseFloat` |
| `sqm_plot` | `house_sqm_plot` | — | Hardcoded `0` (not available in list data) |
| `bedrooms` | `house_bedrooms` | `prop.bedRoomsNumber` | `parseInt`; fallback: `parseInt(rooms) - 1` |
| `bathrooms` | `house_bathrooms` | `prop.bathrooms` | `parseInt` |
| `rooms` | `house_rooms` | `prop.rooms` | `parseInt` |
| `floor` | `house_floor` | `prop.floor.value` | Same floor parsing as apartments |
| `total_floors` | `house_total_floors` | `prop.floors` | `parseInt` |
| `has_elevator` | `house_has_elevator` | `prop.hasElevators` | Direct boolean |
| `has_garden` | `house_has_garden` | `prop.ga4features[]` | `'giardino'` or `'garden'` match |
| `has_garage` | `house_has_garage` | `prop.ga4Garage` | Contains `'garage'` (case-insensitive) |
| `has_parking` | `house_has_parking` | `prop.ga4Garage` | Truthy check |
| `has_basement` | `house_has_basement` | `prop.ga4features[]` | `'cantina'` substring match |
| `has_pool` | `house_has_pool` | `prop.ga4features[]` | `'piscina'` substring match |
| `has_terrace` | `house_has_terrace` | `prop.ga4features[]` | `'terrazzo'` or `'terrazza'` match |
| `has_balcony` | `house_has_balcony` | `prop.ga4features[]` | `'balcon'` substring match |

### House Subtype Mapping

| `typologyGA4Translation` (substring, lowercase) | `property_subtype` value |
|---|---|
| `villa singola` | `villa` |
| `schiera` | `terraced` |
| `villetta` | `semi_detached` |
| `rustico` or `casale` | `farmhouse` |
| `casa indipendente` | `detached` |
| *(no match)* | `detached` |

> **Known limitation:** `sqm_plot` is always `0`. The plot area is only available on individual listing detail pages. The three-phase orchestrator fetches detail pages for new/changed listings, but plot area extraction has not been implemented.

---

## Land Fields (`LandPropertyTierI`)

| Schema Field | DB Column | Source Path | Transformation |
|---|---|---|---|
| `property_category` | `property_category` | — | Hardcoded `'land'` |
| `area_plot_sqm` | `land_area_plot_sqm` | `prop.surface_value` | `parseFloat` |
| `price` | `price` | `prop.price.value` | Direct number |
| `transaction_type` | `transaction_type` | Search config | Always `'sale'` (land-rent combo is skipped) |

Land listings have minimal structured fields available. Only the core universal fields plus `area_plot_sqm` are reliably populated. Additional land-specific attributes (permitted use, buildability ratio, etc.) are not available from immobiliare.it search or detail pages in a structured form.

---

## Commercial Fields (`CommercialPropertyTierI`)

| Schema Field | DB Column | Source Path | Transformation |
|---|---|---|---|
| `property_category` | `property_category` | — | Hardcoded `'commercial'` |
| `property_subtype` | `comm_property_subtype` | `prop.typologyGA4Translation` | See subtype table below |
| `sqm_total` | `comm_sqm_total` | `prop.surface_value` | `parseFloat` |
| `has_elevator` | `comm_has_elevator` | `prop.hasElevators` | Direct boolean |
| `has_parking` | `comm_has_parking` | `prop.ga4Garage` | Truthy check |
| `has_bathrooms` | `comm_has_bathrooms` | `prop.bathrooms` | `parseInt(bathrooms) > 0` → boolean |
| `bathroom_count` | `comm_bathroom_count` | `prop.bathrooms` | `parseInt` |

### Commercial Subtype Mapping

| `typologyGA4Translation` (substring, lowercase) | `property_subtype` value |
|---|---|
| `ufficio` | `office` |
| `negozio`, `shop`, or `retail` | `retail` |
| `capannone` or `warehouse` | `warehouse` |
| `hotel` or `albergo` | `hotel` |
| `ristorante` | `restaurant` |
| `showroom` | `showroom` |
| *(no match)* | `office` |

---

## Checksum Fields

Used by `src/utils/checksumExtractor.ts` → `createImmobiliareChecksum()`.

Checksums are computed before Phase 2 and compared against the ingest API to determine which listings require a detail fetch.

| Field | Source Path | Notes |
|---|---|---|
| `price` | `prop.price.value` | Numeric; triggers `changed` on price update |
| `title` | `realEstate.title` | Triggers `changed` on title update |
| `description` | `prop.description` (first 100 chars) | Truncated to avoid noise from minor edits |
| `sqm` | `prop.surface_value` | Triggers `changed` on area correction |
| `disposition` | `prop.typologyGA4Translation` | Triggers `changed` on typology reclassification |
| `contract` | `realEstate.contract` | Triggers `changed` if sale↔rent changes |

---

## Feature Flag Source Values

`ga4features[]` contains Italian-language strings. The following are the canonical values recognized by the transformers:

| Italian string (examples) | Matched by | Mapped to |
|---|---|---|
| `"Balcone"`, `"Balconi"` | `'balcon'` substring | `has_balcony = true` |
| `"Cantina"` | `'cantina'` substring | `has_basement = true` |
| `"Loggia"` | `'loggia'` substring | `has_loggia = true` |
| `"Terrazzo"`, `"Terrazza"` | `'terrazzo'` or `'terrazza'` | `has_terrace = true` |
| `"Giardino"`, `"Garden"` | `'giardino'` or `'garden'` | `has_garden = true` (houses) |
| `"Piscina"` | `'piscina'` | `has_pool = true` (houses) |
| `"Ascensore"` | *(not from ga4features — uses `hasElevators` boolean directly)* | `has_elevator` |

`ga4Garage` values recognized:

| `ga4Garage` value | `has_parking` | `has_garage` |
|---|---|---|
| `"Box"` | `true` | `true` |
| `"Posto auto"` | `true` | `false` |
| `null` / `undefined` | `false` | `false` |

---

## Floor Value Reference

| Raw `floor.value` | Parsed output | Meaning |
|---|---|---|
| `"t"` or `"terra"` | `0` | Ground floor (piano terra) |
| `"s"` or `"seminterrato"` | `-1` | Semi-basement |
| `"1"`, `"2"`, ... | `1`, `2`, ... | Floor number (parseInt) |
| `"p"` (piano) | `NaN` / omitted | Non-standard; may be omitted |
| Missing / null | `undefined` | Not set |

---

## Fields Not Available from immobiliare.it

The following TierI fields have no equivalent source on immobiliare.it and are always omitted or defaulted:

| Field | Category | Reason |
|---|---|---|
| `sqm_plot` | house | Only on detail page; extraction not implemented → defaults to `0` |
| `furnished` | apartment, house | Not a structured field on immobiliare.it |
| `construction_type` | all | Not available in structured form |
| `renovation_year` | all | Not available in structured form |
| `available_from` | all | Not available in structured form |
| `published_date` | all | Not in `__NEXT_DATA__` payload |
| `deposit` | apartment, house | Not available for Italian portal |
| `parking_spaces` | all | `ga4Garage` is a string type, not a count |
