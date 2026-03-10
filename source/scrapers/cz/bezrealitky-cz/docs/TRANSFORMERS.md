# BezRealitky Transformers

The main entry point `transformBezRealitkyToStandard()` in `transformers/index.ts` routes to category-specific transformers based on `estateType` via `detectCategory()`.

## Shared Helpers (`utils/bezrealitkyHelpers.ts`)

| Helper | Input | Output | Logic |
|---|---|---|---|
| `bedroomsFromDisposition(disposition)` | `"2+kk"`, `"3+1"` | `1`, `2` | `rooms - 1`, except `1+kk` = 0 |
| `parseFloor(floor)` | `"přízemí"`, `"3. patro"` | `0`, `3` | Ground floor variants = 0, extract number |
| `normalizeOwnership(ownership)` | `"osobni"`, `"druzstevni"` | `"personal"`, `"cooperative"` | Czech string matching |
| `mapBuildingType(construction)` | `"panel"`, `"cihla"` | `"panel"`, `"brick"` | Czech string matching |
| `extractFloorLocation(floor, totalFloors)` | `"přízemí"`, `"podkroví"` | `"ground_floor"`, `"top_floor"` | Maps Czech floor terms |
| `parseRenovationYear(reconstruction)` | `"2018"`, `"2015-2018"`, `"před 5 lety"` | `2018`, `2018`, `2021` | Year extraction, range max, years-ago calc |

## Shared Czech Value Mappings

All transformers import normalizers from `shared/czech-value-mappings`:
- `normalizeDisposition()` -- Czech disposition to standard format
- `normalizeCondition()` -- Property condition
- `normalizeFurnished()` -- Furnished status
- `normalizeEnergyRating()` -- PENB energy rating
- `normalizeHeatingType()` -- Heating type
- `normalizeConstructionType()` -- Construction type

---

## Apartment Transformer

**File:** `transformers/apartments/apartmentTransformer.ts`
**Input:** `BezRealitkyListingItem` where `estateType === 'BYT'`
**Output:** `ApartmentPropertyTierI`

### Field Mapping

| TierI Field | Source | Transformation |
|---|---|---|
| `property_category` | -- | `'apartment'` (constant) |
| `title` | `listing.title` | Default: `'Unknown'` |
| `price` | `listing.price` | Default: `0` |
| `currency` | `listing.currency` | Default: `'CZK'` |
| `transaction_type` | `listing.offerType` | `'PRODEJ'` -> `'sale'`, else `'rent'` |
| `location.address` | `listing.address` or `street + houseNumber` | Fallback to concatenation |
| `location.city` | `listing.city` | Default: `'Unknown'` |
| `location.region` | `listing.region?.name` | Optional |
| `location.country` | -- | `'Czech Republic'` (constant) |
| `location.postal_code` | `listing.zip` | Direct |
| `location.coordinates.lat` | `listing.gps.lat` | Optional |
| `location.coordinates.lon` | `listing.gps.lng` | Note: `lng` -> `lon` |
| `bedrooms` | `listing.disposition` | `bedroomsFromDisposition()`: rooms - 1 |
| `bathrooms` | -- | `1` (hardcoded, not provided by API) |
| `sqm` | `listing.surface` | Default: `0` |
| `floor` | `listing.floor` | `parseFloor()` |
| `total_floors` | `listing.totalFloors` | Direct |
| `rooms` | `listing.disposition` | `extractRooms()`: N+kk=N, N+1=N+1 |
| `has_elevator` | `listing.lift` | `=== true` |
| `has_balcony` | `listing.balcony` | `=== true` |
| `has_parking` | `listing.parking` | `=== true` |
| `has_basement` | `listing.cellar` | `=== true` |
| `has_loggia` | `listing.loggia` | `=== true` |
| `has_terrace` | `listing.terrace` | `=== true` |
| `has_garage` | `listing.garage` | `=== true` |
| `balcony_area` | `listing.balconySurface` | Direct |
| `loggia_area` | `listing.loggiaSurface` | Direct |
| `cellar_area` | `listing.cellarSurface` | Direct |
| `terrace_area` | `listing.terraceSurface` | Direct |
| `parking_spaces` | `has_parking` | `1` if true, else `undefined` |
| `garage_count` | `has_garage` | `1` if true, else `undefined` |
| `year_built` | `listing.age` | `currentYear - age` |
| `construction_type` | `listing.construction` | `normalizeConstructionType()`, maps `other`/`stone`/`wood` -> `undefined` |
| `condition` | `listing.condition` | `normalizeCondition()`, maps `very_good`/`before_renovation`/`project`/`under_construction` -> `'good'` |
| `heating_type` | `listing.heating` | `normalizeHeatingType()` |
| `energy_class` | `listing.penb` | `normalizeEnergyRating()` |
| `floor_location` | `listing.floor, listing.totalFloors` | `extractFloorLocation()`, maps `semi_basement` -> `'ground_floor'` |
| `furnished` | `listing.equipped` | `normalizeFurnished()` |
| `renovation_year` | `listing.reconstruction` | `parseRenovationYear()` |
| `published_date` | `listing.timeActivated` | Unix timestamp (seconds) -> ISO 8601 |
| `hoa_fees` | `listing.serviceCharges` | Direct |
| `deposit` | `listing.deposit` | Direct |
| `utility_charges` | `listing.utilityCharges` | Direct |
| `service_charges` | `listing.serviceCharges` | Direct |
| `available_from` | `listing.availableFrom` | Unix timestamp (seconds) -> ISO 8601 |
| `min_rent_days` | `listing.minRentDays` | Direct |
| `max_rent_days` | `listing.maxRentDays` | Direct |
| `media.images` | `listing.publicImages` | `.map(img => img.url)` |
| `media.main_image` | `listing.publicImages` | `.find(img => img.main)?.url` |
| `media.tour_360_url` | `listing.tour360` | Direct |
| `property_subtype` | title, description, disposition | `detectPropertySubtype()` |
| `country_specific.czech_disposition` | `listing.disposition` | `normalizeDisposition()` |
| `country_specific.czech_ownership` | `listing.ownership` | `normalizeOwnership()` |
| `features` | Multiple boolean fields | `extractFeatures()`: balcony, terrace, loggia, cellar, parking, garage, elevator, new_building, low_energy, pet_friendly, barrier_free, furnished, virtual_tour, short_term_rental |
| `description` | `listing.description` | Direct |
| `source_url` | `listing.uri` | `https://www.bezrealitky.cz${uri}` |
| `source_platform` | -- | `'bezrealitky'` |
| `portal_id` | `listing.id` | `bezrealitky-${id}` |
| `status` | `listing.active` | `true` -> `'active'`, else `'removed'` |

### Property Subtype Detection

| Condition | Subtype |
|---|---|
| `disposition === '1+kk'` or `'1+0'` | `studio` |
| Title/description contains `penthouse`, or top floor + price > 10M CZK | `penthouse` |
| Title/description contains `loft` | `loft` |
| Title/description contains `atelier`/`ateliér` | `atelier` |
| Title/description contains `maisonette` | `maisonette` |
| Default | `standard` |

---

## House Transformer

**File:** `transformers/houses/houseTransformer.ts`
**Input:** `BezRealitkyListingItem` where `estateType === 'DUM'` or `'REKREACNI_OBJEKT'`
**Output:** `HousePropertyTierI`

### Field Mapping

| TierI Field | Source | Transformation |
|---|---|---|
| `property_category` | -- | `'house'` (constant) |
| `title` | `listing.title` | Default: `'Unknown'` |
| `price` | `listing.price` | Default: `0` |
| `currency` | `listing.currency` | Default: `'CZK'` |
| `transaction_type` | `listing.offerType` | `'PRODEJ'` -> `'sale'`, else `'rent'` |
| `location` | Same as apartment | Same address/city/region/country/zip/coordinates |
| `bedrooms` | `listing.disposition` | `bedroomsFromDisposition()` |
| `bathrooms` | -- | `1` (hardcoded) |
| `sqm_living` | `listing.surface` | Default: `0` |
| `sqm_plot` | `listing.surfaceLand` | Default: `0` (critical for houses) |
| `sqm_total` | -- | `undefined` (not provided) |
| `rooms` | `listing.disposition` | `extractRooms()` |
| `stories` | `listing.totalFloors` | Direct |
| `has_garden` | `listing.frontGarden` or `sqm_plot > sqm_living` | Boolean OR |
| `garden_area` | `sqm_plot - sqm_living` | Only if `frontGarden` is true |
| `has_garage` | `listing.garage` | `=== true` |
| `has_parking` | `listing.parking` | `=== true` |
| `has_basement` | `listing.cellar` or `cellarSurface > 0` | Boolean OR |
| `has_pool` | -- | `false` (not in API) |
| `has_fireplace` | -- | `false` (not in API) |
| `has_terrace` | `listing.terrace` or `terraceSurface > 0` | Boolean OR |
| `has_balcony` | `listing.balcony` | `=== true` |
| `year_built` | `listing.age` | `currentYear - age` |
| `construction_type` | `listing.construction` | `normalizeConstructionType()`, maps `panel`/`other` -> `undefined` |
| `condition` | `listing.condition` | Same mapping as apartment |
| `property_subtype` | `listing.houseType`, `estateType`, title, description | `detectHouseSubtype()` |
| `country_specific` | Same as apartment | `czech_disposition`, `czech_ownership` |
| `features` | Multiple fields | terrace, balcony, cellar, parking, garage, garden, new_building, low_energy, pet_friendly, barrier_free, furnished, virtual_tour, short_term_rental, water_connection, sewage_connection |

### House Subtype Detection

| Condition | Subtype |
|---|---|
| `estateType === 'REKREACNI_OBJEKT'` | `cottage` |
| `houseType`/title contains `vila`/`villa` | `villa` |
| `houseType`/title contains `chalupa` | `cottage` |
| `houseType`/title contains `statek`/`grunt` | `farmhouse` |
| `houseType`/title contains `řadový`/`radovy` | `terraced` |
| `houseType`/title contains `dvojdomek` | `semi_detached` |
| `houseType`/title contains `bungalov`, or 1 floor + >100sqm | `bungalow` |
| Default | `detached` |

---

## Land Transformer

**File:** `transformers/land/landTransformer.ts`
**Input:** `BezRealitkyListingItem` where `estateType === 'POZEMEK'`
**Output:** `LandPropertyTierI`

### Field Mapping

| TierI Field | Source | Transformation |
|---|---|---|
| `property_category` | -- | `'land'` (constant) |
| `area_plot_sqm` | `listing.surfaceLand` | Default: `0` (main metric) |
| `property_subtype` | `listing.landType` | Czech string matching (see below) |
| `land_type` | `listing.landType` | More granular classification |
| `zoning` | `listing.landType` | Regulatory classification |
| `water_supply` | `listing.water` | Czech string matching: `vodovod` -> `mains`, `studna` -> `well` |
| `sewage` | `listing.sewage` | Czech string matching: `kanalizace` -> `mains`, `septik` -> `septic` |
| `electricity` | `listing.electricity` (if present) | Boolean or string matching |
| `gas` | `listing.gas` (if present) | Boolean or string matching |
| `road_access` | -- | `undefined` (not in API) |
| `cadastral_number` | `listing.cadastralNumber` or `cadastralArea` | Direct (if present) |
| `ownership_type` | `listing.ownership` | Czech string matching: `osobni` -> `personal`, etc. |
| `country_specific` | Same as apartment | `czech_disposition`, `czech_ownership` |
| `features` | Multiple fields + title/description | low_energy, water/sewage/electricity/gas_available, virtual_tour, cadastral_registered, fenced, fruit_trees, well |

### Land Type Classification

| Czech `landType` contains | `property_subtype` | `land_type` | `zoning` |
|---|---|---|---|
| `stavebni`, `building`, `iza` | `building_plot` | `building_plot` | `residential` |
| `zemedelska`, `agricultural`, `pole` | `agricultural` | `arable` | `agricultural` |
| `lesni`, `forest`, `les` | `forest` | `forest` | `agricultural` |
| `vinice`, `vineyard` | `vineyard` | `vineyard` | `agricultural` |
| `sad`, `orchard` | `orchard` | `orchard` | `agricultural` |
| `rekreacni`, `recreational`, `zahrada` | `recreational` | `meadow` | `recreational` |
| `louka`, `meadow` | `agricultural` | `grassland` | `agricultural` |
| `pastvina`, `pasture` | `agricultural` | `pasture` | `agricultural` |

### Water Supply Mapping

| Czech string | Position | Result |
|---|---|---|
| `vodovod`/`mains` | `in_plot` | `mains` |
| `vodovod`/`mains` | `in_front_of_plot`/`in_street` | `connection_available` |
| `vodovod`/`mains` | unknown | `mains` (default) |
| `studna`/`well` | -- | `well` |
| `pramen`/`spring` | -- | `well` |
| `zadna`/`none` | -- | `none` |

---

## Commercial Transformer

**File:** `transformers/commercial/commercialTransformer.ts`
**Input:** `BezRealitkyListingItem` where `estateType` is `'GARAZ'`, `'KANCELAR'`, or `'NEBYTOVY_PROSTOR'`
**Output:** `CommercialPropertyTierI`

### Field Mapping

| TierI Field | Source | Transformation |
|---|---|---|
| `property_category` | -- | `'commercial'` (constant) |
| `title` | `listing.title` | Default: `'Untitled Commercial Property'` |
| `sqm_total` | `listing.surface` | Default: `0` |
| `sqm_usable` | `listing.surface` | Same as `sqm_total` |
| `sqm_plot` | `listing.surfaceLand` | Direct |
| `total_floors` | `listing.totalFloors` | Direct |
| `floor` | `listing.floor` | `parseInt()` |
| `has_elevator` | `listing.lift` | `Boolean()` |
| `has_parking` | `listing.parking` or `listing.garage` | `Boolean(parking || garage)` |
| `has_bathrooms` | -- | `true` (assumed) |
| `has_hvac` | `listing.heating` | `Boolean()` |
| `has_disabled_access` | `listing.barrierFree` | `Boolean()` |
| `monthly_rent` | `listing.price` | Only if `transaction_type === 'rent'` |
| `price_per_sqm` | `price / sqm_total` | Calculated, rounded |
| `service_charges` | `listing.serviceCharges` | Direct |
| `deposit` | `listing.deposit` | Direct |
| `condition` | `listing.condition` | `normalizeCondition()` -> `mapConditionToCommercial()` |
| `construction_type` | `listing.construction` | `normalizeConstructionType()` -> `mapConstructionTypeToCommercial()` |
| `property_subtype` | `estateType`, title, description | `detectCommercialSubtype()` |
| `portal_metadata.bezrealitky` | Multiple fields | `id`, `estate_type`, `offer_type`, `active`, `highlighted`, `is_new`, `visit_count`, `conversation_count` |
| `portal_id` | `listing.id` | Direct (no prefix) |
| `status` | -- | `'active'` (always) |

### Condition Mapping (Commercial-Specific)

| Input (normalized) | Commercial Output |
|---|---|
| `new` | `new` |
| `excellent`, `very_good` | `excellent` |
| `good`, `after_renovation` | `good` |
| `before_renovation` | `fair` |
| `requires_renovation` | `requires_renovation` |
| `project`, `under_construction` | `undefined` |

### Construction Type Mapping (Commercial-Specific)

| Input (normalized) | Commercial Output |
|---|---|
| `panel` | `prefab` |
| `brick`, `stone` | `brick` |
| `concrete` | `concrete` |
| `mixed` | `mixed` |
| `wood`, `other` | `undefined` |

### Commercial Subtype Detection

| estateType | Title/Description Keywords | Subtype |
|---|---|---|
| `GARAZ` | `sklad` | `warehouse` |
| `GARAZ` | (default) | `industrial` |
| `KANCELAR` | `obchod`/`retail` | `retail` |
| `KANCELAR` | `hotel` | `hotel` |
| `KANCELAR` | `restaurace`/`restaurant` | `restaurant` |
| `KANCELAR` | (default) | `office` |
| `NEBYTOVY_PROSTOR` | `obchod`/`prodejna`/`retail` | `retail` |
| `NEBYTOVY_PROSTOR` | `sklad`/`warehouse` | `warehouse` |
| `NEBYTOVY_PROSTOR` | `výroba`/`dílna`/`hala`/`industrial` | `industrial` |
| `NEBYTOVY_PROSTOR` | `restaurace`/`hospoda`/`bar` | `restaurant` |
| `NEBYTOVY_PROSTOR` | `hotel` | `hotel` |
| `NEBYTOVY_PROSTOR` | `ordinace`/`zdravotní`/`medical` | `medical` |
| `NEBYTOVY_PROSTOR` | `showroom`/`výstavní` | `showroom` |
| `NEBYTOVY_PROSTOR` | `kancelář`/`office` | `office` |
| `NEBYTOVY_PROSTOR` | `smíšen`/`mixed` | `mixed_use` |
| `NEBYTOVY_PROSTOR` | (default) | `industrial` |
