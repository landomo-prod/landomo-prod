# Reality.cz Transformers

## Architecture

The main router `realityTransformer.ts` detects the property category via `detectPropertyCategory()` and delegates to the appropriate category transformer.

### Category Detection

**Primary:** `listing.api_type` field (from API `type` field)

| API Type | Category |
|----------|----------|
| `flat` | `apartment` |
| `house` | `house` |
| `land` | `land` |
| `cottage`, `recreation`, `rekreace` | `house` |
| `kancelar`, `office`, `sklad`, `warehouse`, `obchod`, `retail`, `prumysl`, `hotel`, `restaurant` | `commercial` |

**Fallback:** Title keyword matching (Czech):
- `kancelar`, `sklad`, `vyrob`, `obchod`, `restaurace`, `hotel` -> `commercial`
- `pozemek`, `parcela` -> `land`
- `dum`, `rodinny` -> `house`
- `byt`, `\d+kk`, `\d+1` -> `apartment`
- Default: `apartment`

### Data Structure

Reality.cz API provides structured `information[]` arrays with `{key, value}` pairs. All transformers convert this to a `Record<string, string>` lookup map via `buildInfoMap()`.

### Czech Value Normalization

All transformers use shared normalizers from `scrapers/Czech Republic/shared/czech-value-mappings.ts`.

---

## Apartment Transformer

File: `src/transformers/apartments/apartmentTransformer.ts`
Output: `ApartmentPropertyTierI`

### Core Field Mapping

| Source (`information[]` key) | Target (TierI) | Conversion |
|------------------------------|-----------------|------------|
| `listing.title` | `title` | Direct (fallback from `api_type`) |
| `listing.price` | `price` | Direct number |
| `listing.transaction_type` | `transaction_type` | `'sale'` or `'rent'` |
| `listing.place` | `location.city` | `extractCity()`: split on ` - `, take first |
| `listing.place` | `location.region` | Split on ` - `, take last |
| `listing.gps.lat/lng` | `location.coordinates` | Direct (note: API uses `lng` not `lon`) |

### Apartment-Specific Fields

| Info Key | Target | Conversion |
|----------|--------|------------|
| `Dispozice` | `bedrooms` | First digit of disposition |
| `Dispozice` | `rooms` | `N+kk` -> N, `N+1` -> N+1 |
| `Plocha` / `Uzitna plocha` / `Podlahova plocha` | `sqm` | `parseArea()`: extract number, replace `,` with `.` |
| `Podlazi` / `Patro` | `floor` | First number in string |
| `Pocet podlazi` / `Celkem podlazi` | `total_floors` | First number |
| `Vytah` | `has_elevator` | `Ano`->true, else false |
| `Balkon` | `has_balcony` | Boolean |
| `Sklep` | `has_basement` | Boolean |
| `Parkovani` / `Parkovaci stani` | `has_parking` | Boolean OR |
| `Lodzzie` | `has_loggia` | Boolean |
| `Terasa` | `has_terrace` | Boolean |
| `Garaz` | `has_garage` | Boolean |
| `Stav` / `Stav objektu` | `condition` | `normalizeCondition()` -> `mapConditionToTierI()` |
| `Topeni` / `Vytapeni` | `heating_type` | `normalizeHeatingType()` |
| `Stavba` / `Typ budovy` / `Konstrukce` | `construction_type` | `normalizeConstructionType()` |
| `Energeticka trida` / `PENB` | `energy_class` | `normalizeEnergyRating()` |
| `Vlastnictvi` | czech.`ownership` | `normalizeOwnership()` |
| `Dispozice` | czech.`disposition` | `normalizeDisposition()` |
| `Vybaveni` / `Zarizeni` | `furnished` | `normalizeFurnished()` |
| `Rok vystavby` / `Rok kolaudace` | `year_built` | Year regex `(1[8-9]\d{2}|20\d{2})` |
| `Rok rekonstrukce` | `renovation_year` | Year regex |
| `Kauce` / `Vratna kauce` / `Jistina` | `deposit` | Strip non-digits, parseInt |
| `K nastEhovani` / `Dostupne od` | `available_from` | Czech date `DD.MM.YYYY` -> ISO |
| `Koupelna` / `Koupelny` | `bathrooms` | First number, default 1 |
| `listing.created_at` | `published_date` | Direct |
| floor number | `floor_location` | 0->`ground_floor`, else `middle_floor` |

### Media
- Images from `listing.images[]` (pre-constructed URLs: `https://api.reality.cz{photo.name}`)
- Virtual tour from `listing.virtual_tours[0].url`

### Portal Metadata (Tier III)
Preserved under `portal_metadata.reality`: `id`, `custom_id`, `api_type`, `price_note`, `previous_price`, `has_commission`, `created_at`, `modified_at`, `scraped_at`, `outdated`, `contact` (company + broker names)

### Country-Specific (Tier II)
Under `country_specific.czech`: `disposition`, `ownership`, `condition`, `heating_type`, `construction_type`, `energy_rating`, `furnished`, `floor_number`, `is_barrier_free`, `has_ac`

### Features
Extracted from info keys: `Balkon`, `Terasa`, `Sklep`, `Vytah`, `Lodzzie`, `Garaz`, `Parkovani`, `Klimatizace`, `Bezbarierovy`

---

## House Transformer

File: `src/transformers/houses/houseTransformer.ts`
Output: `HousePropertyTierI`

### House-Specific Fields

| Info Key | Target | Conversion |
|----------|--------|------------|
| `Plocha` / `Uzitna plocha` / `Podlahova plocha` / `Obytna plocha` | `sqm_living` | Area parser |
| `Plocha pozemku` / `Pozemek` / `Plocha parcely` | `sqm_plot` | Area parser |
| `Pocet podlazi` / `Podlazi` | `stories` | Number extraction |
| `Zahrada` | `has_garden` | Boolean |
| `Plocha zahrady` | `garden_area` | Area parser |
| `Garaz` | `has_garage`, `garage_count` (1 if true) | Boolean |
| `Parkovani` / `Parkovaci stani` | `has_parking`, `parking_spaces` (1 if true) | Boolean |
| `Sklep` | `has_basement` | Boolean |
| `Terasa` | `has_terrace` | Boolean |
| `Balkon` | `has_balcony` | Boolean |
| `Bazen` | `has_pool` | Boolean |
| `Krb` | `has_fireplace` | Boolean |

### Features
`Balkon`, `Terasa`, `Sklep`, `Garaz`, `Parkovani`, `Zahrada`, `Bazen`, `Krb`

### Country-Specific (Tier II)
Under `country_specific.czech`: `disposition`, `ownership`, `condition`, `heating_type`, `construction_type`, `energy_rating`, `furnished`, `renovation_year`, `has_garden`

---

## Land Transformer

File: `src/transformers/land/landTransformer.ts`
Output: `LandPropertyTierI`

### Land-Specific Fields

| Info Key | Target | Conversion |
|----------|--------|------------|
| `Plocha` / `Plocha pozemku` / `Plocha parcely` | `area_plot_sqm` | Area parser |
| `Voda` | `water_supply` | `Ano` -> `'mains'`, else undefined |
| `Kanalizace` | `sewage` | `Ano` -> `'mains'`, else undefined |
| `Elektrina` / `Elektrika` | `electricity` | `Ano` -> `'connected'`, else undefined |
| `Plyn` | `gas` | `Ano` -> `'connected'`, else undefined |
| `Prijezdova cesta` / `Komunikace` | `road_access` | `Ano` -> `'paved'`, else undefined |
| `Stavebni povoleni` | `building_permit` | Boolean |
| `Katastralni cislo` | `cadastral_number` | Direct string |
| `Vlastnictvi` | `ownership_type` | `normalizeOwnership()` |
| `Vyuziti` / `Typ pozemku` | `zoning` | `mapZoning()` |
| `Dostupne od` / `Volne od` | `available_from` | Czech date parser |

### Zoning Detection

| Czech Term | Zoning |
|------------|--------|
| bydl/obyt/rezidencni | `residential` |
| komercni/obchod | `commercial` |
| prumysl/vyrob | `industrial` |
| zemedel/orna | `agricultural` |
| rekrea/zahrad | `recreational` |
| smisen | `mixed` |

### Features
`Voda`, `Kanalizace`, `Elektrina`, `Elektrika`, `Plyn`, `Prijezdova cesta`, `Komunikace`

### Country-Specific (Tier II)
Under `country_specific.czech`: `ownership`, `zoning`, `water_supply`, `sewage`, `electricity`, `gas`, `road_access`

---

## Commercial Transformer

File: `src/transformers/commercial/commercialTransformer.ts`
Output: `CommercialPropertyTierI`

### Commercial-Specific Fields

| Info Key | Target | Conversion |
|----------|--------|------------|
| `Plocha` / `Celkova plocha` / `Uzitna plocha` | `sqm_total` | Area parser |
| `Uzitna plocha` | `sqm_usable` | Area parser |
| `Kancelarska plocha` / `Plocha kancelari` | `sqm_office` | Area parser |
| `Prodejni plocha` | `sqm_retail` | Area parser |
| `Skladova plocha` / `Sklad` | `sqm_storage` | Area parser |
| `Plocha pozemku` / `Pozemek` | `sqm_plot` | Area parser |
| `Podlazi` / `Patro` | `floor` | Number |
| `Pocet podlazi` / `Celkem podlazi` | `total_floors` | Number |
| `Vytah` | `has_elevator` | Boolean |
| `Parkovani` / `Parkovaci stani` | `has_parking` | Boolean |
| `Pocet parkovacich mist` | `parking_spaces` | Number |
| `WC` / `Socialni zarizeni` | `has_bathrooms` | Boolean (default true) |
| `Rampa` / `Nakladaci rampa` | `has_loading_dock` | Boolean |
| `Klimatizace` / `Vzduchotechnika` | `has_hvac`, `has_air_conditioning` | Boolean |
| `Bezpecnostni system` / `Alarm` | `has_security_system` | Boolean |
| `Recepce` | `has_reception` | Boolean |
| `Kuchynka` / `Kuchyn` | `has_kitchen` | Boolean |
| `Bezbarierovy` | `has_disabled_access` | Boolean |
| `Opticky internet` / `Internet` | `has_fiber_internet` | Boolean |
| `Pocet mistnosti` / `Pocet kancelari` | `office_rooms` | Number |
| `Svetla vyska` / `Vyska stropu` | `ceiling_height` | Decimal parser |
| `Typ` / `Druh` / title | `property_subtype` | `detectCommercialSubtype()` |
| `Vyuziti` / `Urceni` | czech.`zoning` | `detectZoning()` |
| `Provozni naklady` | `operating_costs` | Price parser |
| `Poplatky za sluzby` | `service_charges` | Price parser |

### Floor Location Detection
- Floor 0 -> `ground_floor`
- Floor < 0 -> `basement`
- Floor == total_floors -> `top_floor`
- Otherwise -> `middle_floor`

### Commercial Subtype Detection

| Czech Keyword | Subtype |
|---------------|---------|
| kancelar/office | `office` |
| prodej/obchod/retail | `retail` |
| sklad/warehouse | `warehouse` |
| vyrob/prumysl/industrial | `industrial` |
| hotel | `hotel` |
| restaurace/restaurant | `restaurant` |
| ordinace/medical/zdravotni | `medical` |
| showroom/vystavni | `showroom` |
| smisen/mixed | `mixed_use` |

### Features
`Parkovani`, `Vytah`, `Klimatizace`, `Recepce`, `Bezbarierovy`, `Rampa`, `Internet`

### Country-Specific (Tier II)
Under `country_specific.czech`: `condition`, `heating_type`, `construction_type`, `energy_rating`, `furnished`, `zoning`
