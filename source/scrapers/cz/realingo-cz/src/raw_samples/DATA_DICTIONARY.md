# Realingo — Raw Data Dictionary

Realingo.cz is a Czech real estate aggregator that exposes a public GraphQL API at `https://www.realingo.cz/graphql`. It aggregates listings from other Czech portals (ceskereality, sreality, etc.) and provides them through a unified GraphQL schema.

Two queries are used:
1. **`searchOffer`** — paginated listing discovery (Phase 1)
2. **`offer(id)`** — individual detail fetch, used via alias-batched queries (Phase 2.5)

---

## Listing Page Response (GraphQL `searchOffer`)

### Endpoint
```
POST https://www.realingo.cz/graphql
```

### Query
```graphql
query SearchOffer(
  $purpose: OfferPurpose,
  $property: PropertyType,
  $saved: Boolean,
  $categories: [OfferCategory!],
  $area: RangeInput,
  $plotArea: RangeInput,
  $price: RangeInput,
  $first: Int,
  $skip: Int
) {
  searchOffer(
    filter: {
      purpose: $purpose
      property: $property
      saved: $saved
      categories: $categories
      area: $area
      plotArea: $plotArea
      price: $price
    }
    first: $first
    skip: $skip
  ) {
    total
    items { ... }
  }
}
```

### Variables
- `purpose` (OfferPurpose enum) — `SELL` or `RENT`
- `property` (PropertyType enum) — `FLAT`, `HOUSE`, `LAND`, `COMMERCIAL`, `OTHERS`
- `saved` (Boolean) — filter saved offers (unused by scraper)
- `categories` ([OfferCategory!]) — fine-grained category filter (e.g. `["FLAT2_KK"]`)
- `area` (RangeInput: `{ min, max }`) — floor area filter in m2
- `plotArea` (RangeInput: `{ min, max }`) — plot area filter in m2
- `price` (RangeInput: `{ min, max }`) — price filter
- `first` (Int) — page size, default 100
- `skip` (Int) — offset for pagination

### Response Structure: `searchOffer`

- `total` (number) — total matching offers across all pages. Example: `10706`
- `items` (array of OfferItem) — listing objects for current page

### Response Structure: `items[]` (OfferItem)

- `id` (string) — unique offer ID. Example: `"24517158"`
- `adId` (string) — advertisement ID from source portal. Example: `"3852"`, `"234154"`, `"419-420"`
- `category` (string) — disposition/type category enum. Examples:
  - Apartments: `"FLAT1_KK"`, `"FLAT11"`, `"FLAT2_KK"`, `"FLAT21"`, `"FLAT3_KK"`, `"FLAT31"`, `"FLAT4_KK"`, `"FLAT41"`, `"FLAT5_KK"`, `"FLAT51"`, `"FLAT6_AND_MORE"`, `"OTHERS_FLAT"`
  - Houses: `"HOUSE_FAMILY"`, `"HOUSE_VILLA"`, `"HOUSE_FARMHOUSE"`, `"HOUSE_BUNGALOW"`, etc.
  - Land: `"LAND_BUILDING"`, `"LAND_AGRICULTURAL"`, etc.
  - Commercial/Others: various
- `url` (string) — relative URL path on realingo.cz. Example: `"/prodej/byt-2+1-druzstevni-pardubice/24517158"`
- `property` (string enum) — property type. Values: `"FLAT"`, `"HOUSE"`, `"LAND"`, `"COMMERCIAL"`, `"OTHERS"`
- `purpose` (string enum) — transaction type. Values: `"SELL"`, `"RENT"`
- `location` (object) — geographic data
  - `address` (string) — street/city. Example: `"Družstevní, Pardubice"`, `"Jurkovičova 961, Praha"`
  - `latitude` (number) — WGS84 latitude. Example: `50.052346666667`
  - `longitude` (number) — WGS84 longitude. Example: `15.762601388889`
- `price` (object) — pricing data
  - `total` (number|null) — price in minor-unit currency. Example: `5450000` (CZK)
  - `currency` (string) — ISO currency code. Example: `"CZK"`
  - `vat` (number|null) — VAT amount, usually `null`
- `area` (object) — area measurements in m2. All fields nullable.
  - `floor` (number|null) — floor/living area. Example: `58`, `32`
  - `plot` (number|null) — plot area. Example: `239`
  - `garden` (number|null) — garden area
  - `built` (number|null) — built-up area. Example: `239`
  - `cellar` (number|null) — cellar area
  - `balcony` (number|null) — balcony area
  - `terrace` (number|null) — terrace area
  - `loggia` (number|null) — loggia area. Example: `6`
- `photos` (object) — image references (not full URLs)
  - `main` (string) — main photo path. Example: `"offer/puh/puhnqs1ukw-1920x1280xb0b0b0"`
  - `list` (string[]) — gallery photo paths. Same format. Typically 10-27 items.
  - Note: Full URL = `https://www.realingo.cz/image/{path}`
- `updatedAt` (string) — ISO 8601 timestamp. Example: `"2026-02-26T19:02:02.871Z"`
- `createdAt` (string) — ISO 8601 timestamp. Example: `"2026-02-26T19:02:02.871Z"`

---

## Detail Page Response (GraphQL `offer(id)`)

### Endpoint
```
POST https://www.realingo.cz/graphql
```

### Query (alias-batched, up to 50 per request)
```graphql
{
  o0: offer(id: "24517158") {
    id
    detail { ... }
  }
  o1: offer(id: "24517154") {
    id
    detail { ... }
  }
  ...
}
```

### Response Structure: `offer(id).detail`

The `detail` sub-object is **only** available on the `offer(id)` query, NOT in `searchOffer` list items.

- `description` (string|null) — full listing description in Czech. Can be very long (1000+ chars). Example: `"Nabízím Vám ke koupi výjimečně situovaný byt o dispozici 2+1..."`
- `externalUrl` (string|null) — source portal URL. Example: `"https://vychodo.ceskereality.cz/prodej/byty/byty-2-1/pardubice/prodej-bytu-2-1-52-m2-druzstevni-3668813.html"`
- `buildingType` (string|null) — construction material enum. Known values: `"BRICK"`, `"PANEL"`, `"WOOD"`, `"PREFAB"`, `"STONE"`, `"MIXED"`, `"OTHER"`. Example: `"BRICK"`
- `buildingStatus` (string|null) — property condition enum. Known values: `"NEW"`, `"VERY_GOOD"`, `"GOOD"`, `"POOR"`, `"AFTER_RECONSTRUCTION"`, `"UNDER_CONSTRUCTION"`. Example: `"VERY_GOOD"`, `"AFTER_RECONSTRUCTION"`
- `buildingPosition` (string|null) — position in street/block. Known values: `"DETACHED"`, `"SEMI_DETACHED"`, `"TERRACED"`. Usually `null`.
- `houseType` (string|null) — house subtype. Known values: `"FAMILY"`, `"VILLA"`, `"FARMHOUSE"`, `"BUNGALOW"`. Usually `null` for flats.
- `ownership` (string|null) — ownership type enum. Known values: `"PRIVATE"`, `"COOPERATIVE"`, `"STATE"`, `"OTHER"`. Example: `"PRIVATE"`
- `furniture` (string|null) — furnished status enum. Known values: `"FURNISHED"`, `"PARTIALLY_FURNISHED"`, `"UNFURNISHED"`. Usually `null`.
- `floor` (number|null) — floor number (not area). Example: `3`
- `floorTotal` (number|null) — total floors in building. Usually `null`.
- `yearBuild` (number|null) — construction year. Usually `null`.
- `yearReconstructed` (number|null) — last reconstruction year. Usually `null`.
- `parking` (string|null) — parking type enum. Known values: `"GARAGE"`, `"GARAGE_PLACE"`, `"OUTDOOR"`. Usually `null`.
- `parkingPlaces` (number|null) — number of parking spots. Usually `null`.
- `garages` (number|null) — number of garages. Usually `null`.
- `energyPerformance` (string|null) — PENB energy class enum. Known values: `"A"`, `"B_VERY_EFFICIENT"`, `"C_EFFICIENT"`, `"D_LESS_EFFICIENT"`, `"E"`, `"F"`, `"G"`. Example: `"C_EFFICIENT"`, `"D_LESS_EFFICIENT"`
- `energyPerformanceValue` (number|null) — energy consumption in kWh/m2/year. Usually `null`.
- `heating` (string[]|null) — **array** of heating type enums. Known values: `"CENTRAL_DISTRICT"`, `"CENTRAL_NATURAL_GAS"`, `"GAS"`, `"ELECTRIC"`, `"HEAT_PUMP"`, `"SOLID"`, `"SOLAR"`, `"BIOMASS"`, `"GEOTHERMAL"`, `"OTHER"`. Example: `["CENTRAL_DISTRICT"]`, `["CENTRAL_NATURAL_GAS"]`
- `electricity` (string[]|null) — **array** of electricity type enums. Known values: `"VOLTAGE230"`, `"VOLTAGE400"`. Example: `["VOLTAGE230"]`, `["VOLTAGE230", "VOLTAGE400"]`
- `waterSupply` (string|null) — water supply type. Usually `null`.
- `gas` (boolean|null) — gas connection available. Example: `true`, `null`
- `balcony` (boolean|null) — has balcony. Example: `true`, `null`
- `loggia` (boolean|null) — has loggia. Usually `null`.
- `terrace` (boolean|null) — has terrace. Usually `null`.
- `lift` (boolean|null) — has elevator. Usually `null`.
- `cellar` (boolean|null) — has cellar/basement. Usually `null`.
- `isBarrierFree` (boolean|null) — wheelchair accessible. Usually `null`.
- `isAuction` (boolean|null) — listing is auction. Usually `null`.
- `roomCount` (number|null) — total room count. Usually `null`.
- `flatCount` (number|null) — number of flats in building. Usually `null`.
- `flatClass` (string|null) — flat classification. Usually `null`.
- `availableFromDate` (string|null) — availability date (ISO). Usually `null`.
- `ceilingHeight` (number|null) — ceiling height in meters. Usually `null`.

### Notes on Detail Data Quality
- Most detail fields are sparsely populated. `description`, `externalUrl`, `ownership`, and `buildingStatus` are the most consistently present.
- `heating` and `electricity` are **arrays** (not strings as typed in `realingoTypes.ts`). The current transformer calls `mapHeating()` which expects a string, so only the first enum value would map correctly if the array were handled.
- `energyPerformance` enum values include qualifiers (e.g. `"C_EFFICIENT"`, `"B_VERY_EFFICIENT"`, `"D_LESS_EFFICIENT"`) that differ from the simple A-G letters the `mapEnergyClass()` function expects. Values like `"C_EFFICIENT"` will not match the current map and fall through to the raw value.

---

## Mapping Status

### Listing-Level Fields (from `searchOffer`)

| Raw Field | StandardProperty / TierI Target | Notes |
|-----------|-------------------------------|-------|
| `id` | `portal_id` (as `"realingo-{id}"`) | Unique stable identifier |
| `adId` | `portal_metadata.realingo.ad_id` | Source portal's ad ID |
| `category` | `country_specific.czech_disposition` (via `parseDisposition()`) | e.g. `FLAT2_KK` -> `2+kk` |
| `url` | `source_url` (prefixed with `https://www.realingo.cz`) | Relative path in API |
| `property` | Routes to category transformer | `FLAT`->apartment, `HOUSE`->house, `LAND`->land, `COMMERCIAL`->commercial, `OTHERS`->other |
| `purpose` | `transaction_type` | `SELL`->`sale`, `RENT`->`rent` |
| `location.address` | `location.address`, `location.city` (last part after comma) | Comma-separated street, city |
| `location.latitude` | `location.coordinates.lat` | WGS84 |
| `location.longitude` | `location.coordinates.lon` | WGS84 |
| `price.total` | `price` | In CZK |
| `price.currency` | `currency` | Always `"CZK"` |
| `price.vat` | `portal_metadata.realingo.vat` | Rarely populated |
| `area.floor` | `sqm` (apartment), `sqm_living` (house), `area_plot_sqm` (land fallback) | Living/floor area in m2 |
| `area.plot` | `sqm_plot` (house), `area_plot_sqm` (land) | Plot area in m2 |
| `area.garden` | `has_garden` (house, derived: `> 0`) | Garden area in m2, boolean derived |
| `area.built` | `sqm` fallback (if `area.floor` is null) | Built-up area in m2 |
| `area.cellar` | `has_basement` (derived: `> 0`) | Cellar area in m2, boolean derived |
| `area.balcony` | `has_balcony` (derived: `> 0`) | Balcony area in m2, boolean derived |
| `area.terrace` | `has_terrace` (derived: `> 0`) | Terrace area in m2, boolean derived |
| `area.loggia` | `has_loggia` (derived: `> 0`) | Loggia area in m2, boolean derived |
| `photos.main` | `media.images[0]`, `media.main_image` | Prefixed with `https://www.realingo.cz/image/` |
| `photos.list` | `media.images[1..n]`, `images[]` | Prefixed with `https://www.realingo.cz/image/` |
| `updatedAt` | `portal_metadata.realingo.updated_at` | ISO 8601 timestamp |
| `createdAt` | `published_date` (date part only) | ISO 8601 timestamp, truncated to `YYYY-MM-DD` |

### Detail-Level Fields (from `offer(id).detail`)

| Raw Field | StandardProperty / TierI Target | Notes |
|-----------|-------------------------------|-------|
| `description` | `description` | Full Czech text |
| `externalUrl` | `portal_metadata.realingo.external_url` | Original portal URL |
| `buildingType` | `construction_type` (via `mapBuildingType()`) | `BRICK`->`brick`, `PANEL`->`panel`, etc. |
| `buildingStatus` | `condition` (via `mapCondition()`) | `VERY_GOOD`->`excellent`, `GOOD`->`good`, etc. |
| `buildingPosition` | `portal_metadata.realingo.building_position` (house only) | Usually null |
| `houseType` | `property_subtype` (house transformer, lowercased) | `FAMILY`->`family`, etc. |
| `ownership` | `country_specific.czech_ownership` (via `mapOwnership()`) | `PRIVATE`->`private`, etc. |
| `furniture` | `furnished` (via `mapFurnished()`) | `FURNISHED`->`furnished`, etc. |
| `floor` | `floor` (apartment) | Floor number, not area |
| `floorTotal` | `total_floors` (apartment), `stories` (house) | Total building floors |
| `yearBuild` | `year_built` | Construction year |
| `yearReconstructed` | `renovation_year` | Last renovation year |
| `parking` | `has_parking` (derived: `!= null`), `portal_metadata.realingo.parking_type` | Enum value stored in metadata |
| `parkingPlaces` | `portal_metadata.realingo.parking_places` | Not mapped to `details.parking_spaces` |
| `garages` | `has_garage` (house, derived: `> 0`) | Garage count |
| `energyPerformance` | `energy_class` (via `mapEnergyClass()`) | **BUG**: values like `C_EFFICIENT` not in map, fall through as raw string |
| `energyPerformanceValue` | `portal_metadata.realingo.energy_performance_value` | kWh/m2/year |
| `heating` | `heating_type` (via `mapHeating()`) | **BUG**: API returns array, transformer expects string |
| `electricity` | `electricity` (land, lowercased) | **BUG**: API returns array, transformer expects string |
| `waterSupply` | `water_supply` (land, lowercased) | String |
| `gas` | `gas` (land, lowercased) | **Note**: API returns boolean, not string |
| `balcony` | `has_balcony` (overrides area-derived value) | Boolean |
| `loggia` | `has_loggia` (overrides area-derived value) | Boolean |
| `terrace` | `has_terrace` (overrides area-derived value) | Boolean |
| `lift` | `has_elevator` | Boolean |
| `cellar` | `has_basement` (overrides area-derived value) | Boolean |
| `isBarrierFree` | `portal_metadata.realingo.is_barrier_free` | Not mapped to `amenities.is_barrier_free` |
| `isAuction` | `portal_metadata.realingo.is_auction` | Not mapped to any standard field |
| `roomCount` | `rooms` (apartment, fallback) | Total room count |
| `flatCount` | `portal_metadata.realingo.flat_count` (commercial only) | Flats in building |
| `flatClass` | Not mapped | Usually null |
| `availableFromDate` | `available_from` | ISO date string |
| `ceilingHeight` | `portal_metadata.realingo.ceiling_height` | Meters |

### Unmapped Area Fields (numeric m2 values available but only used as boolean derivations)

| Raw Field | Available Value | Current Mapping | Potential Target |
|-----------|----------------|-----------------|------------------|
| `area.garden` | m2 number | `has_garden` (bool) | `country_specific.area_garden` |
| `area.cellar` | m2 number | `has_basement` (bool) | `country_specific.area_cellar` |
| `area.balcony` | m2 number | `has_balcony` (bool) | `country_specific.area_balcony` |
| `area.terrace` | m2 number | `has_terrace` (bool) | `country_specific.area_terrace` |
| `area.loggia` | m2 number | `has_loggia` (bool) | `country_specific.area_loggia` |

### Known Transformer Bugs / Issues

1. **`heating` is an array, not a string**: The API returns `heating` as `string[]` (e.g. `["CENTRAL_DISTRICT"]`), but `RealingoDetail.heating` is typed as `string | null` and `mapHeating()` expects a single string. Only the first element would be processed if coerced; the rest are lost.

2. **`electricity` is an array, not a string**: Same issue. API returns `["VOLTAGE230", "VOLTAGE400"]` but typed/treated as string.

3. **`energyPerformance` enum mismatch**: API returns values like `"C_EFFICIENT"`, `"B_VERY_EFFICIENT"`, `"D_LESS_EFFICIENT"` which are not in the `mapEnergyClass()` lookup table. These fall through to the raw value instead of mapping to `"C"`, `"B"`, `"D"`.

4. **`gas` type mismatch (land transformer)**: `gas` is a boolean (`true`/`null`) in the API, but the land transformer tries to lowercase it as a string.

5. **`parkingPlaces` not mapped to standard field**: Available in API but only stored in `portal_metadata`, not mapped to `details.parking_spaces`.

6. **`isBarrierFree` not mapped to standard amenity**: Available in API but only in `portal_metadata`, not `amenities.is_barrier_free`.

7. **Area measurements lost**: Numeric area values (balcony m2, terrace m2, loggia m2, cellar m2, garden m2) are only used for boolean derivation (`> 0`), not stored as `country_specific.area_*` fields.

8. **`buildingStatus` new value**: `"AFTER_RECONSTRUCTION"` appears in live data but `mapCondition()` maps it to `"after_renovation"`. This mapping exists and works correctly.

9. **Default `bathrooms: 1`**: Apartment and house transformers hardcode `bathrooms: 1` since the API provides no bathroom count.

10. **Default `has_elevator: false`**: When `detail.lift` is null (unknown), apartment/commercial transformers default to `false` instead of `null`/`undefined`.
