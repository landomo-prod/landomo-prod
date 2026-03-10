# SReality Transformers

## Architecture

The main router `srealityTransformer.ts` detects the property category via `detectCategoryFromSreality()` and delegates to the appropriate category transformer.

### Category Detection (`src/utils/categoryDetection.ts`)

**Primary:** `listing.seo.category_main_cb`

| ID | Category |
|----|----------|
| 1 | `apartment` |
| 2 | `house` |
| 3 | `land` |
| 4 | `commercial` |
| 5 | `other` |

**Fallback:** Title keyword matching (Czech):
- `pozemek`, `parcela` -> `land`
- `dum`, `rd`, `vila` -> `house`
- `byt`, `\d+kk`, `\d+1` -> `apartment`

### Items Parser (`src/utils/itemsParser.ts`)

All transformers use `SRealityItemsParser` for type-safe, O(n) single-pass access to the `items[]` array from the API. Field names are defined as constants in `FIELD_NAMES` (Czech strings).

### Czech Value Normalization

All transformers use shared normalizers from `scrapers/Czech Republic/shared/czech-value-mappings.ts`:
- `normalizeDisposition()` - Czech disposition (2+kk, 3+1)
- `normalizeOwnership()` - Ownership type
- `normalizeCondition()` - Property condition
- `normalizeHeatingType()` - Heating type
- `normalizeEnergyRating()` - Energy class A-G
- `normalizeFurnished()` - Furnished status
- `normalizeConstructionType()` - Construction material

---

## Apartment Transformer

File: `src/transformers/apartments/apartmentTransformer.ts`
Output: `ApartmentPropertyTierI`

### Core Field Mapping

| Source (SReality API) | Target (TierI) | Conversion |
|-----------------------|-----------------|------------|
| `listing.name` | `title` | `getStringOrValue()` (handles string or `{value}` object) |
| `listing.price_czk.value_raw` or `listing.price` | `price` | Direct number, fallback chain |
| `listing.seo.category_type_cb` | `transaction_type` | `1` -> `'sale'`, `2` -> `'rent'` |
| `listing.locality` | `location.city` | `extractCity()` strips district/suffix |
| `listing.gps.lat/lon` or `listing.map.lat/lon` | `location.coordinates` | Fallback chain |

### Apartment-Specific Fields

| Source | Target | Conversion |
|--------|--------|------------|
| Title pattern `\d+kk\|\d+1` | `bedrooms` | `bedroomsFromDisposition()`: rooms - 1 |
| Items `Uzitna plocha` / `Celkova plocha` / title `\d+ m2` | `sqm` | `parser.getAreaOr()` with title fallback |
| Items `Podlazi` | `floor`, `total_floors` | `extractFloorInfo()`: parses `3/5`, `prizemi`, `3. podlazi` |
| Items `Vytah` | `has_elevator` | `parser.getBoolean()` (Czech `Ano`/`Ne`) |
| Items `Balkon`/`Balkon` | `has_balcony` | `parser.getBooleanOr()` |
| Items `Lodzzie` | `has_loggia` | Boolean |
| Items `Sklep`/`Sut ren` | `has_basement` | Boolean |
| Items `Parkovani` | `has_parking` | Boolean |
| Items `Terasa` | `has_terrace` | Boolean |
| Items `Garaz` | `has_garage` | Boolean |
| Items `Typ budovy`/`Stavba` | `construction_type` | Maps: `panel`->`panel`, `cihla`->`brick`, `beton`->`concrete` |
| Items `Stav objektu` | `condition` | Maps: `novostavba`->`new`, `vyborny`->`excellent`, `dobry`->`good` |
| Items `Rok postaveni` | `year_built` | Regex `\b(1[8-9]\d{2}|20\d{2})\b` |
| Items `Vlastnictvi` | `ownership` (Tier II) | `mapOwnership()`: `osobni`->`personal`, `druzstevni`->`cooperative` |
| Items `Vytapeni` | `heating_type` | Passthrough to normalizer |
| Items `Trida PENB` | `energy_class` | Passthrough to normalizer |
| Items `Vybaveni` | `furnished` | `normalizeFurnished()` |
| Disposition string | `rooms` | `N+kk` -> N, `N+1` -> N+1 |
| Floor + total_floors | `floor_location` | `ground_floor`/`middle_floor`/`top_floor` |

### Bathroom Extraction
Searches items for: `Pocet koupelen`, `Koupelen`, `Bathrooms`, `Koupelna`. Extracts first digit. Defaults to 1.

### Media
- Images from `listing._embedded.images` (detail) or `listing._links.dynamicUp/dynamicDown` (list)
- Three sizes: thumbnail (400x300), preview (800x600), full (gallery)
- Virtual tour from `_embedded.matterport_url` or `has_panorama` flag
- Video from `_embedded.video.url`

### Portal Metadata (Tier III)
Preserved under `portal_metadata.sreality`: `hash_id`, `category_main_cb`, `category_sub_cb`, `category_type_cb`, `labels`, `new`, `region_tip`, `exclusively_at_rk`, `has_floor_plan`, `has_video`, `has_panorama`, `is_auction`, `auction_price`, `virtual_tour_url`, `video_url`

### Source URL Construction
`extractSourceUrl()` builds SEO-friendly URLs: `https://www.sreality.cz/detail/{transaction}/{type}/{subtype}/{locality}/{hash_id}`

---

## House Transformer

File: `src/transformers/houses/houseTransformer.ts`
Output: `HousePropertyTierI`

### House-Specific Fields

| Source | Target | Conversion |
|--------|--------|------------|
| Items `Uzitna plocha` / title area | `sqm_living` | Area parser with title fallback |
| Items `Celkova plocha`/`Zastavena plocha` | `sqm_total` | Area parser |
| Items `Plocha pozemku` | `sqm_plot` | Area parser (CRITICAL for houses) |
| Items `Pocet podlazi` | `stories` | Number extraction (NOT floor number) |
| Items `Zahrada`/`Plocha zahrady` | `has_garden`, `garden_area` | Area value implies true |
| Items `Garaz` | `has_garage`, `garage_count` | Boolean + count extraction |
| Items `Parkovani` | `has_parking`, `parking_spaces` | Boolean + count extraction |
| Items `Sklep`/`Sut ren` | `has_basement`, `cellar_area` | Area value implies true |
| Items `Bazen` | `has_pool` | Boolean |
| Items `Krb` | `has_fireplace` | Boolean |
| Items `Terasa` | `has_terrace`, `terrace_area` | Area value implies true |
| Items `Podkrovi`/`Puda` | `has_attic` | Boolean |
| Items `Typ strechy`/`Strecha` | `roof_type` | Maps: `plocha`->`flat`, `sedlova`->`gable`, `valbova`->`hip`, `mansardova`->`mansard` |
| `listing.seo.category_sub_cb` | `property_subtype` | `mapSubType()`: 7->`detached`, 11->`terraced`, 8->`semi_detached`, 47->`villa` |

### Financial Fields
Extracted from items: `Dan z nemovitosti` -> `property_tax`, `Kauce` -> `deposit`, `Mesicni naklady na energie` -> `utility_charges`, `Mesicni naklady` -> `service_charges`

### Construction Type Mapping (Houses)
Differs from apartments: includes `wood` (`drev`) and `stone` (`kamen`) types.

### Additional Features Detection
- `Klimatizace` -> `air_conditioning`
- `Bezbarierovy`/`Bezbarierova` -> `wheelchair_accessible`
- `Alarm`/`Zabezpecovaci system` -> `security_system`
- `Solarni panely`/`Fotovoltaika` -> `solar_panels`

---

## Land Transformer

File: `src/transformers/land/landTransformer.ts`
Output: `LandPropertyTierI`

### Land-Specific Fields

| Source | Target | Conversion |
|--------|--------|------------|
| Items `Plocha pozemku`/`Plocha` / title area | `area_plot_sqm` | Area parser (CRITICAL) |
| Items `Druh pozemku`/`Typ pozemku` | `land_type`, `zoning`, `property_subtype` | `extractLandTypeAndZoning()` |
| Items `Voda` | `water_supply` | Maps: `vodovod`->`mains`, `studna`->`well`, `pripojka`->`connection_available` |
| Items `Odpad` | `sewage` | Maps: `kanalizace`->`mains`, `septik`->`septic`, `pripojka`->`connection_available` |
| Items `Elektrina` | `electricity` | Maps: voltage patterns or `ano`->`connected`, `pripojka`->`connection_available` |
| Items `Plyn` | `gas` | Maps: `ano`/`plyn`->`connected`, `pripojka`->`connection_available` |
| Items `Pristup`/`Pristupova cesta` | `road_access` | Maps: `asfalt`->`paved`, `sterk`->`gravel`, `polni`->`dirt` |
| Items `Stavebni povoleni` | `building_permit` | Boolean (`ano`->true, `ne`->false) |
| Items `Teren`/`Svazitost` | `terrain` | Maps: `rovinaty`->`flat`, `svazity`->`sloped`, `kopcovity`->`hilly` |
| Items `Kvalita pudy` | `soil_quality` | Maps: `vynikajici`->`excellent`, `dobra`->`good`, `prumerna`->`fair` |
| Items `Zastavitelnost` | `max_building_coverage` | Percentage extraction |
| Items `Cislo parcely`/`Parcelni cislo` | `cadastral_number` | Direct string |

### Land Type Detection

| Czech Term | `land_type` | `zoning` | `property_subtype` |
|------------|-------------|----------|---------------------|
| stavebni | `building_plot` | `residential` | `building_plot` |
| zemedelsky/orna | `arable` | `agricultural` | `agricultural` |
| lesni/les | `forest` | `agricultural` | `forest` |
| vinice/vinohrad | `vineyard` | `agricultural` | `vineyard` |
| sad/ovocny | `orchard` | `agricultural` | `orchard` |
| louka/pastvina | `meadow` | `agricultural` | `agricultural` |
| komercni | `building_plot` | `commercial` | `building_plot` |
| prumyslovy | `building_plot` | `industrial` | `industrial` |
| rekreacni | `building_plot` | `recreational` | `recreational` |

### Utility Boolean Flags
`has_water`, `has_sewage`, `has_electricity`, `has_gas` are derived from the enum values (true if not `none` or `undefined`).

---

## Commercial Transformer

File: `src/transformers/commercial/commercialTransformer.ts`
Output: `CommercialPropertyTierI`

### Commercial-Specific Fields

| Source | Target | Conversion |
|--------|--------|------------|
| Items `Celkova plocha`/`Uzitna plocha`/`Plocha` / title | `sqm_total` | Area parser priority chain |
| Items `Uzitna plocha` | `sqm_usable` | Area parser |
| Items `Plocha pozemku` | `sqm_plot` | Area parser |
| Items `Podlazi` | `floor`, `total_floors` | `extractFloorInfo()` |
| Items `Vytah` | `has_elevator` | Boolean |
| Items `Parkovani`/`Garaz` | `has_parking` | Boolean OR |
| Items `Parkovani` | `parking_spaces` | Number extraction from string |
| Title + `Typ nemovitosti` + `Druh prostoru` | `property_subtype` | `detectCommercialSubtype()` |

### Commercial Subtype Detection

| Czech Keyword | Subtype |
|---------------|---------|
| kancelar/office | `office` |
| obchod/prodejna/retail | `retail` |
| sklad/warehouse/hala | `warehouse` |
| prumysl/vyrob/industrial | `industrial` |
| hotel/penzion | `hotel` |
| restaurace/kavarna | `restaurant` |
| ordinace/lekarsk | `medical` |
| showroom/vystavni | `showroom` |
| polyfunkcni/mixed | `mixed_use` |
| prostor (generic) | `office` (default) |

### Condition/Construction Mapping
Uses intermediate mapping to commercial-specific enums:
- Condition: `very_good`->`excellent`, `before_renovation`->`fair`, `project`->`new`
- Construction: `panel`->`prefab`, `stone`->`brick`, `wood`->`mixed`

---

## Other Transformer

File: `src/transformers/other/otherTransformer.ts`
Output: `OtherPropertyTierI`

### Subcategory Detection

| `category_sub_cb` | Subtype | Description |
|--------------------|---------|-------------|
| 34 | `garage` | Garaze |
| 52 | `parking_space` | Garazova stani |
| 53 | `mobile_home` | Mobilheimy |
| (title fallback) | `storage` | Sklad/storage in title |
| (default) | `other` | Unclassified |

### Other-Specific Fields

| Source | Target | Conversion |
|--------|--------|------------|
| Various area items / title | `sqm_total` | Area parser |
| Items `Elektrina` | `has_electricity` | Boolean or positive string check |
| Subtype or items | `has_parking` | True for garage/parking_space subtypes |
| Items `Voda` | `has_water_connection` | Boolean |
| Items `Vytapeni` | `has_heating` | Boolean or positive string check |
| Items `Parkovani` | `parking_spaces` | Number extraction |

### Garage-Specific Features
- `Automaticka vrata` -> `automatic_door`
- `Montazni jama`/`Jama` -> `pit`
- Security items (`Alarm`, `kamera`) -> `alarm`, `camera`

---

## Common Helpers (`src/utils/srealityHelpers.ts`)

| Function | Purpose |
|----------|---------|
| `bedroomsFromDisposition(str)` | `"2+kk"` -> 1, `"3+1"` -> 2 (rooms - 1) |
| `extractDispositionFromTitle(str)` | Extracts `\d+kk\|\d+1` from title |
| `extractFloorInfo(str)` | Parses `"3/5"`, `"prizemi"`, `"3. podlazi"` |
| `extractCity(str)` | `"Praha 6 - Dejvice"` -> `"Praha"` |
| `extractAreaFromTitle(str)` | `"42 m2"` -> 42 (fallback for ~50% of listings) |
| `extractSourceUrl(listing, hashId)` | Builds SEO-friendly sreality.cz URL |
| `mapOwnership(str)` | Czech ownership to enum |
| `mapSubType(id)` | Subcategory ID to house subtype |
| `parseArea(str)` | `"150,5 m2"` -> 150.5 |
| `isPositiveValue(val)` | Handles `Ano`/`Ne`, numbers > 0, strings |
| `ensureBoolean(val)` | `boolean\|undefined` -> `boolean` |
| `extractImages(listing)` | Extracts thumbnail/preview/full from multiple locations |
| `extractVirtualTourUrl(listing)` | Matterport URL or panorama flag |
| `extractVideoUrl(listing)` | Video URL from `_embedded.video` |
| `extractHashIdFromUrl(url)` | `/estates/12345` -> 12345 |
| `getStringOrValue(field)` | Handles string or `{value: string}` API format |
