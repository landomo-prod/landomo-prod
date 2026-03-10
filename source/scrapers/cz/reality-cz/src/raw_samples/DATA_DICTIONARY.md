# Reality.cz — Raw Data Dictionary

Portal: reality.cz
API Base: `https://api.reality.cz`
Auth: Reverse-engineered mobile API (APK v3.1.4). Guest login via POST `/moje-reality/prihlasit2/` with `Authorization: Token 5c858f9578fc6f0a12ec9f367b1807b3` and `User-Agent: Android Mobile Client 3.1.4b47`. Returns `sid` session cookie.

---

## Listing Page Response (Search)

### Endpoint
```
GET https://api.reality.cz/{offer_type}/{property_type}/{region}/?skip={offset}&take={count}
```
- `offer_type`: `prodej` (sale) or `pronajem` (rent)
- `property_type`: `byty`, `domy`, `pozemky`, `komercni`
- `region`: e.g. `Praha`, `Stredocesky-kraj`, `Jihomoravsky-kraj` (14 Czech regions used to bypass 1001-result API cap)
- `skip`: pagination offset (0-based)
- `take`: items per page (default 100)

Example: `GET https://api.reality.cz/prodej/byty/Praha/?skip=0&take=5`

### Response Structure (`RealityApiSearchResponse`)

- `count` (number) — total results matching query, example: `381`
- `location` (string) — human-readable location name, example: `"hlavni mesto Praha"`
- `location_gps` (object) — center point of search area
  - `lat` (number) — latitude, example: `50.06156`
  - `lng` (number) — longitude, example: `14.464331`
- `description` (string) — search description, example: `"Prodej hlavni mesto Praha"`
- `topped` (string) — ID of topped/featured listing, example: `"48873623"`
- `skip` (number) — current offset, example: `0`
- `take` (number) — requested page size, example: `5`
- `viewport` (object) — map bounding box for results
  - `zoom` (number) — suggested zoom level, example: `10`
  - `southwest` (object) — SW corner: `{ lat: 49.966017, lng: 14.282856 }`
  - `northeast` (object) — NE corner: `{ lat: 50.157103, lng: 14.645806 }`
- `locations` (array) — location breadcrumbs
  - `[].url` (string) — URL slug, example: `"hlavni-mesto-Praha"`
  - `[].name` (string) — display name, example: `"hlavni mesto Praha"`
- `advertisements` (array) — listing items (see below)
- `ok` (string, optional) — present on success responses
- `err` (string, optional) — present on error responses

### Advertisement List Item (`RealityApiListItem`)

Each item in the `advertisements` array:

- `id` (string) — portal listing ID, example: `"BNB-001068"`, `"B51-655380"`, `"AP7-N12574"`
- `type` (string) — descriptive type string with disposition, area, construction, ownership, example: `"byt 3+kk, 88 m2, osobni"`, `"byt 2+kk, 52 m2, cihla, osobni"`
- `place` (string) — address/location, example: `"Krizeneckeho namesti, Praha 5 - Hlubocepy"`
- `offer_type` (number) — 1 = sale, 2 = rent, example: `1`
- `gps` (object) — coordinates
  - `lat` (number) — latitude, example: `50.031381`
  - `lng` (number) — longitude, example: `14.391758`
- `price` (object) — structured price info
  - `sale` (object|null) — sale price
    - `price` (number) — amount, example: `11890000`
    - `unit` (string) — currency symbol, example: `"Kc"`
  - `rent` (object|null) — rental price (same structure)
- `photos` (array of strings) — photo path list, example: `["/photo/1771833826/bnb001068_0.jpg", ...]`
- `photo_id` (string) — main photo path, example: `"/photo/1771833826/bnb001068_0.jpg"`
- `featured` (string) — featured flag, example: `"N"`
- `featured_text` (string) — featured label, example: `"NOVINKA 23.2.2026"`
- `badge` (object|null) — listing badge
  - `text` (string) — badge label, example: `"TOP"`, `"Novinka"`
  - `color` (string) — hex color, example: `"#FBC723"`, `"#81BE19"`

---

## Detail Page Response

### Endpoint
```
GET https://api.reality.cz/{advertisement_id}/
```
Example: `GET https://api.reality.cz/BNB-001068/`

### Response Structure (`RealityApiDetailResponse`)

- `id` (string) — listing ID, example: `"BNB-001068"`
- `custom_id` (string, optional) — agency internal ID, example: `"1068"`
- `type` (string) — descriptive type (same as listing), example: `"byt 3+kk, 88 m2, osobni"`
- `title` (string) — listing title (often empty in search, populated in detail), example: `"Byt k prodeji 3+kk/L+ garazove stani + sklep, OV, 93 m2, Praha 5 - Hlubocepy, ul. Krizeneckeho nam."`
- `place` (string) — location, example: `"Krizeneckeho namesti, Hlubocepy"`
- `description` (string, optional) — full HTML-free description text, example: `"Exkluzivne Vam nabizime k prodeji slunny byt s dispozici 3+kk s balkonem..."`
- `offer_type` (number) — 1 = sale, 2 = rent, example: `1`
- `price` (object) — structured price info (`RealityApiPriceInfo`)
  - `sale` (object|null) — sale price
    - `price` (number) — amount, example: `11890000`
    - `unit` (string) — currency, example: `"Kc"`
  - `rent` (object|null) — rental price (same structure)
  - `advance` (object|null) — advance/deposit price
  - `commission` (boolean) — whether commission applies, example: `true`
  - `note` (string, optional) — price note, example: `"garazove stani a sklep v cene"`
  - `previous_price` (string|null) — previous price if changed
  - `previous` (number|null) — previous price numeric
  - `discount` (number|null) — discount amount
  - `auction` (unknown|null) — auction info
- `location` (object, optional) — GPS and map data
  - `gps` (object) — coordinates
    - `lat` (number) — latitude, example: `50.031381`
    - `lng` (number) — longitude, example: `14.391758`
  - `show_location` (boolean) — whether to show on map, example: `true`
  - `street` (array, optional) — street line geometry as arrays of GPS points
- `information` (array) — key-value property attributes (`RealityApiInformationEntry[]`)
  - `[].key` (string) — attribute label (Czech, with trailing colon), example: `"Velikost bytu:"`
  - `[].value` (string) — attribute value, example: `"3+kk"`
- `photos` (array) — photo objects (`RealityApiPhoto[]`)
  - `[].name` (string) — photo path, example: `"/photo/1771833826/bnb001068_0.jpg"`
  - `[].title` (string) — photo caption (often empty)
- `badges` (array, optional) — all badges
  - `[].text` (string) — badge label, example: `"novinka"`
  - `[].color` (string) — hex color, example: `"#81BE19"`
- `badge` (object|null) — primary badge (same structure as badges item)
- `contact` (object, optional) — contact information (`RealityApiContact`)
  - `advertiser` (object, optional) — direct advertiser
    - `name` (string) — name
    - `company` (string) — company name
    - `email` (string) — email
    - `title` (string) — title/role
    - `phones` (string[]) — phone numbers
    - `has_name` (boolean) — whether name is real
  - `broker` (object, optional) — real estate broker
    - `name` (string) — broker name
    - `email` (string) — email
    - `phones` (string[]) — phone numbers
    - `photo` (string) — photo path
    - `title` (string) — title
    - `url` (string, optional) — profile URL
    - `gender` (number) — gender code
  - `real_estate` (object, optional) — agency info
    - `name` (string) — agency name, example: `"ASTONE Reality"`
    - `address` (string) — agency address, example: `"Jinolicka 864\n190 12 Praha 9"`
    - `email` (string) — email, example: `"astonereality@seznam.cz"`
    - `phones` (string[]) — phones, example: `["+420 608 333 876"]`
    - `logo` (string) — logo path, example: `"/photo/logo/BNB.png"`
    - `title` (string) — label, example: `"Realitni kancelar"`
- `created_at` (string, optional) — listing creation date, example: `"2026-02-23"`
- `modified_at` (string, optional) — last modification date, example: `"2026-02-23"`
- `featured` (string) — featured flag, example: `"N"`
- `featured_text` (string) — featured label, example: `"NOVINKA 23.2.2026"`
- `ok` (string, optional) — success indicator
- `err` (string, optional) — error message

### Known `information[]` Keys

The `information` array contains key-value pairs. Keys have trailing colons (stripped by transformer). Observed keys:

| Key (Czech) | English | Example Value | Category |
|-------------|---------|---------------|----------|
| `Velikost bytu:` | Apartment size | `"3+kk"` | Disposition |
| `Dispozice:` | Disposition | `"2+1"` | Disposition |
| `Typ objektu:` | Object type | `"3+kk"` | Type |
| `Plocha bytu:` | Apartment area | `"88 m2"` | Area |
| `Plocha:` | Area | `"75 m2"` | Area |
| `Uzitna plocha:` | Usable area | `"62 m2"` | Area |
| `Podlahova plocha:` | Floor area | `"68 m2"` | Area |
| `Obytna plocha:` | Living area | `"55 m2"` | Area |
| `Plocha pozemku:` | Plot area | `"680 m2"` | Area |
| `Pozemek:` | Plot | `"1 200 m2"` | Area |
| `Plocha parcely:` | Parcel area | `"500 m2"` | Area |
| `Pozemek celkem:` | Total plot | `"10.137 m2"` | Area |
| `Plocha zahrady:` | Garden area | `"350 m2"` | Area |
| `Celkova plocha:` | Total area | `"200 m2"` | Area |
| `Kancelarska plocha:` | Office area | `"120 m2"` | Area |
| `Plocha kancelari:` | Office area | `"80 m2"` | Area |
| `Prodejni plocha:` | Retail area | `"150 m2"` | Area |
| `Skladova plocha:` | Storage area | `"300 m2"` | Area |
| `Sklad:` | Storage | `"50 m2"` | Area |
| `Patro:` | Floor | `"2. podlazi"` | Building |
| `Podlazi:` | Story | `"3"` | Building |
| `Pocet podlazi:` | Number of floors | `"5"` | Building |
| `Celkem podlazi:` | Total floors | `"8"` | Building |
| `Pocet NP:` | Number of above-ground floors | `"3"` | Building |
| `Forma vlastnictvi:` | Ownership type | `"osobni"` | Ownership |
| `Vlastnictvi:` | Ownership | `"druzstevni"` | Ownership |
| `Stav:` | Condition | `"velmi dobry"` | Condition |
| `Stav objektu:` | Object condition | `"po rekonstrukci"` | Condition |
| `Stavba:` | Construction | `"panel"`, `"cihla"` | Construction |
| `Druh budovy:` | Building type | `"cihlova"` | Construction |
| `Konstrukce:` | Construction | `"panel"` | Construction |
| `Typ budovy:` | Building type | `"panelovy dum"` | Construction |
| `Topeni:` | Heating | `"ustredni"` | Infrastructure |
| `Vytapeni:` | Heating | `"plynove"` | Infrastructure |
| `Energeticka trida:` | Energy class | `"C"` | Energy |
| `PENB:` | Energy certificate | `"B"` | Energy |
| `Energeticky stitek:` | Energy label | `"D"` | Energy |
| `Energet. narocnost:` | Energy demand | `"E"` | Energy |
| `Vybaveni:` | Equipment/Furnishing | `"castecne"` | Furnishing |
| `Zarizeni:` | Furnishing | `"nezarizeny"` | Furnishing |
| `Vybavenost:` | Amenities/Equipment | `"230V, Internet, Telefon, Plyn, Voda, pitna, Kanalizace..."` | Amenities |
| `Zarizeni nabytkem:` | Furniture | `"ano"` | Furnishing |
| `Vytah:` | Elevator | `"ano"`, `"ne"` | Amenities |
| `Balkon:` | Balcony | `"ano"` | Amenities |
| `Balkon, terasa:` | Balcony/terrace | `"ano, 5 m2"` | Amenities |
| `Terasa:` | Terrace | `"ano"` | Amenities |
| `Lodzie:` | Loggia | `"ano"` | Amenities |
| `Sklep:` | Basement/cellar | `"ano"` | Amenities |
| `Parkovani:` | Parking | `"ano"`, `"parkovaci misto 1x"` | Amenities |
| `Parkovaci stani:` | Parking space | `"ano"` | Amenities |
| `Garaz:` | Garage | `"ano"` | Amenities |
| `Zahrada:` | Garden | `"ano"` | Amenities |
| `Bazen:` | Pool | `"ano"` | Amenities |
| `Krb:` | Fireplace | `"ano"` | Amenities |
| `Klimatizace:` | Air conditioning | `"ano"` | Amenities |
| `Bezbarierovy:` | Barrier-free | `"ano"` | Amenities |
| `Koupelna:` | Bathroom | `"1"` | Rooms |
| `Koupelny:` | Bathrooms | `"2"` | Rooms |
| `WC:` | Toilet | `"ano"` | Rooms |
| `Socialni zarizeni:` | Sanitary facilities | `"ano"` | Rooms |
| `Rok vystavby:` | Year built | `"1990"` | Temporal |
| `Rok kolaudace:` | Year of occupancy permit | `"2005"` | Temporal |
| `Rok rekonstrukce:` | Renovation year | `"2020"` | Temporal |
| `Rekonstrukce rok:` | Renovation year (alt) | `"2018"` | Temporal |
| `K nastehovani:` | Move-in date | `"1.3.2026"` | Availability |
| `Dostupne od:` | Available from | `"ihned"` | Availability |
| `Volne od:` | Free from | `"1.4.2026"` | Availability |
| `Kauce:` | Deposit | `"30 000 Kc"` | Financial |
| `Vratna kauce:` | Refundable deposit | `"50 000 Kc"` | Financial |
| `Jistina:` | Security deposit | `"25 000 Kc"` | Financial |
| `Provozni naklady:` | Operating costs | `"5 000 Kc"` | Financial |
| `Poplatky za sluzby:` | Service charges | `"3 500 Kc"` | Financial |
| `Voda:` | Water | `"ano"` | Utilities (land) |
| `Kanalizace:` | Sewage | `"ano"` | Utilities (land) |
| `Elektrina:` / `Elektrika:` | Electricity | `"ano"` | Utilities (land) |
| `Plyn:` | Gas | `"ano"` | Utilities (land) |
| `Prijezdova cesta:` / `Komunikace:` | Road access | `"ano"` | Utilities (land) |
| `Stavebni povoleni:` | Building permit | `"ano"` | Land |
| `Katastralni cislo:` | Cadastral number | `"1234/5"` | Land |
| `Vyuziti:` / `Typ pozemku:` / `Ucel pozemku:` | Zoning/land use | `"bydleni"`, `"komercni"` | Land |
| `Typ:` / `Druh:` | Type/kind | `"kancelar"` | Commercial |
| `Pocet mistnosti:` / `Pocet kancelari:` | Number of rooms/offices | `"5"` | Commercial |
| `Svetla vyska:` / `Vyska stropu:` | Ceiling height | `"3,2 m"` | Commercial |
| `Pocet parkovacich mist:` | Parking spaces count | `"3"` | Commercial |
| `Rampa:` / `Nakladaci rampa:` | Loading dock | `"ano"` | Commercial |
| `Vzduchotechnika:` | HVAC | `"ano"` | Commercial |
| `Bezpecnostni system:` / `Alarm:` | Security system | `"ano"` | Commercial |
| `Recepce:` | Reception | `"ano"` | Commercial |
| `Kuchynka:` / `Kuchyn:` | Kitchen | `"ano"` | Commercial |
| `Opticky internet:` / `Internet:` | Fiber internet | `"ano"` | Commercial |
| `Urceni:` | Designation/zoning | `"komercni"` | Commercial |
| `Pocet stani:` | Number of spaces | `"1"` | Parking |

---

## Photo URL Construction

Listing page returns photo paths as strings: `/photo/{id}/{filename}.jpg`
Detail page returns photo objects: `{ name: "/photo/{id}/{filename}.jpg" }`

Full URL: `https://api.reality.cz{path}`
Example: `https://api.reality.cz/photo/1771833826/bnb001068_0.jpg`

Agency logos: `https://api.reality.cz{logo_path}`
Example: `https://api.reality.cz/photo/logo/BNB.png`

---

## Mapping Status

### Listing Page Fields -> Transformer

| Raw Field | StandardProperty / TierI Target | Notes |
|-----------|-------------------------------|-------|
| `id` | `portal_id` (prefixed `reality-`) | Stable unique ID like `"BNB-001068"` |
| `type` | `api_type` in RealityListing; used for category detection + sqm fallback | Descriptive: `"byt 3+kk, 88 m2, osobni"` |
| `place` | `location.address`, `location.city`, `location.region` | Split on ` - ` |
| `offer_type` | `transaction_type` | 1=sale, 2=rent |
| `gps.lat` | `location.coordinates.lat` | Direct mapping |
| `gps.lng` | `location.coordinates.lon` | Note: `lng` -> `lon` |
| `price.sale.price` | `price` | Numeric, no formatting |
| `price.sale.unit` | `currency` | `"Kc"` / `"Kc"` -> `"CZK"` |
| `price.rent.price` | `price` | Used when offer_type=2 |
| `photos[]` | Not used from listing (detail has richer data) | Only paths, no titles |
| `photo_id` | Not mapped | Main photo shortcut |
| `featured` | Not mapped | `"N"` or `"Y"` |
| `featured_text` | Not mapped | e.g. `"NOVINKA 23.2.2026"` |
| `badge.text` | Not mapped | e.g. `"TOP"`, `"Novinka"` |
| `badge.color` | Not mapped | Hex color |

### Detail Page Fields -> Transformer

| Raw Field | StandardProperty / TierI Target | Notes |
|-----------|-------------------------------|-------|
| `id` | `portal_id` (as `reality-{id}`), `portal_metadata.reality.id` | |
| `custom_id` | `portal_metadata.reality.custom_id` | Agency internal ref |
| `type` | `portal_metadata.reality.api_type`; category detection input | |
| `title` | `title` | Falls back to `type` then `place` if empty |
| `place` | `location.address`, `.city`, `.region` | |
| `description` | `description` | Full text, no HTML |
| `offer_type` | `transaction_type` | 1=sale, 2=rent |
| `price.sale.price` | `price` | |
| `price.sale.unit` | `currency` | |
| `price.rent.price` | `price` (for rentals) | |
| `price.commission` | `portal_metadata.reality.has_commission` | |
| `price.note` | `portal_metadata.reality.price_note` | e.g. `"garazove stani a sklep v cene"` |
| `price.previous_price` | `portal_metadata.reality.previous_price` | String or null |
| `price.previous` | Not mapped | Numeric previous price |
| `price.discount` | Not mapped | Discount amount |
| `price.auction` | Not mapped | Auction data |
| `price.advance` | Not mapped | Advance payment |
| `location.gps.lat` | `location.coordinates.lat` | |
| `location.gps.lng` | `location.coordinates.lon` | |
| `location.show_location` | Not mapped | Map display flag |
| `location.street` | Not mapped | Street line geometry |
| `information[]` | Multiple fields (see information mapping below) | Key-value pairs |
| `photos[].name` | `media.images[]`, `images[]` | Prefixed with `https://api.reality.cz` |
| `photos[].title` | Not mapped | Photo captions (usually empty) |
| `badges[]` | Not mapped | |
| `badge` | Not mapped | |
| `contact.advertiser.*` | Not mapped | Direct advertiser info |
| `contact.broker.name` | `portal_metadata.reality.contact.broker` | |
| `contact.real_estate.name` | `portal_metadata.reality.contact.company` | Agency name |
| `contact.real_estate.email` | Not mapped | |
| `contact.real_estate.phones` | Not mapped | |
| `contact.real_estate.logo` | Not mapped | |
| `contact.real_estate.address` | Not mapped | |
| `created_at` | `published_date`, `portal_metadata.reality.created_at` | ISO date `"2026-02-23"` |
| `modified_at` | `portal_metadata.reality.modified_at` | |
| `featured` | Not mapped | |
| `featured_text` | Not mapped | |

### information[] Key -> Transformer Target

| information key | TierI Target | Category | Notes |
|----------------|-------------|----------|-------|
| `Velikost bytu` / `Dispozice` | `bedrooms`, `rooms`, `country_specific.czech.disposition` | Apartment | Parsed: `"3+kk"` -> bedrooms=3, rooms=3 |
| `Plocha bytu` / `Plocha` / `Uzitna plocha` / `Podlahova plocha` | `sqm` (apartment), `sqm_living` (house), `sqm_total` (commercial) | All | Parsed: `"88 m2"` -> 88 |
| `Obytna plocha` | `sqm_living` | House | |
| `Plocha pozemku` / `Pozemek` / `Plocha parcely` / `Pozemek celkem` | `sqm_plot` (house), `area_plot_sqm` (land), `sqm_plot` (commercial) | House/Land/Commercial | Czech thousands: `"10.137 m2"` -> 10137 |
| `Plocha zahrady` | `garden_area` | House | |
| `Celkova plocha` | `sqm_total` | Commercial | |
| `Kancelarska plocha` / `Plocha kancelari` | `sqm_office` | Commercial | |
| `Prodejni plocha` | `sqm_retail` | Commercial | |
| `Skladova plocha` / `Sklad` | `sqm_storage` | Commercial | |
| `Patro` / `Podlazi` | `floor`, `country_specific.czech.floor_number` | Apartment/Commercial | Parsed: `"2. podlazi"` -> 2 |
| `Pocet podlazi` / `Celkem podlazi` / `Pocet NP` | `total_floors`, `stories` (house) | All | |
| `Forma vlastnictvi` / `Vlastnictvi` | `country_specific.czech.ownership` | Apartment/House/Land | Normalized: `"osobni"` -> `"personal"` |
| `Stav` / `Stav objektu` | `condition`, `country_specific.czech.condition` | Apartment/House/Commercial | Normalized via `normalizeCondition()` |
| `Stavba` / `Druh budovy` / `Konstrukce` / `Typ budovy` | `construction_type`, `country_specific.czech.construction_type` | Apartment/House/Commercial | Normalized: `"panel"` -> `"panel"`, `"cihla"` -> `"brick"` |
| `Topeni` / `Vytapeni` | `heating_type`, `country_specific.czech.heating_type` | Apartment/House/Commercial | Normalized via `normalizeHeatingType()` |
| `Energeticka trida` / `PENB` / `Energeticky stitek` / `Energet. narocnost` | `energy_class`, `country_specific.czech.energy_rating` | Apartment/House/Commercial | Normalized: `"C"` -> `"c"` |
| `Vybaveni` / `Zarizeni` / `Zarizeni nabytkem` | `furnished`, `country_specific.czech.furnished` | Apartment/House/Commercial | Normalized via `normalizeFurnished()` |
| `Vybavenost` | `furnished` (if furnishing-related) | Apartment | Also checked for furnishing; often contains utility list |
| `Vytah` | `has_elevator` | Apartment/Commercial | Boolean: `"ano"` -> true |
| `Balkon` / `Balkon, terasa` | `has_balcony` | Apartment/House | Boolean |
| `Terasa` | `has_terrace` | Apartment/House/Commercial | Boolean |
| `Lodzie` | `has_loggia` | Apartment | Boolean |
| `Sklep` | `has_basement` | Apartment/House | Boolean |
| `Parkovani` / `Parkovaci stani` | `has_parking` | All | Boolean or descriptive |
| `Garaz` | `has_garage` | Apartment/House | Boolean |
| `Zahrada` | `has_garden` | House | Boolean |
| `Bazen` | `has_pool` | House | Boolean |
| `Krb` | `has_fireplace` | House | Boolean |
| `Klimatizace` | `has_air_conditioning` (commercial), `country_specific.czech.has_ac` (apartment) | Apartment/Commercial | Boolean |
| `Bezbarierovy` | `has_disabled_access` (commercial), `country_specific.czech.is_barrier_free` (apartment) | Apartment/Commercial | Boolean |
| `Koupelna` / `Koupelny` | `bathrooms` | Apartment/House | Parsed as number, default 1 |
| `WC` / `Socialni zarizeni` | `has_bathrooms` | Commercial | Boolean, defaults true |
| `Rok vystavby` / `Rok kolaudace` | `year_built` | Apartment/House/Commercial | Parsed: `"1990"` -> 1990 |
| `Rok rekonstrukce` / `Rekonstrukce rok` | `renovation_year` | Apartment/House/Commercial | |
| `K nastehovani` / `Dostupne od` / `Volne od` | `available_from` | All | Date parsed DD.MM.YYYY -> ISO |
| `Kauce` / `Vratna kauce` / `Jistina` | `deposit` | Apartment/House/Commercial | Price parsed |
| `Provozni naklady` | `operating_costs` | Commercial | |
| `Poplatky za sluzby` | `service_charges` | Commercial | |
| `Voda` | `water_supply` -> `"mains"` | Land | Boolean -> enum |
| `Kanalizace` | `sewage` -> `"mains"` | Land | Boolean -> enum |
| `Elektrina` / `Elektrika` | `electricity` -> `"connected"` | Land | Boolean -> enum |
| `Plyn` | `gas` -> `"connected"` | Land | Boolean -> enum |
| `Prijezdova cesta` / `Komunikace` | `road_access` -> `"paved"` | Land | Boolean -> enum |
| `Stavebni povoleni` | `building_permit` | Land | Boolean |
| `Katastralni cislo` | `cadastral_number` | Land | String passthrough |
| `Vyuziti` / `Typ pozemku` / `Ucel pozemku` | `zoning` | Land | Mapped: `"bydleni"` -> `"residential"` etc. |
| `Typ` / `Druh` | `property_subtype` | Commercial | Detected: `"kancelar"` -> `"office"` etc. |
| `Pocet mistnosti` / `Pocet kancelari` | `office_rooms` | Commercial | |
| `Svetla vyska` / `Vyska stropu` | `ceiling_height` | Commercial | Decimal parsed |
| `Pocet parkovacich mist` | `parking_spaces` | Commercial | |
| `Rampa` / `Nakladaci rampa` | `has_loading_dock` | Commercial | Boolean |
| `Vzduchotechnika` | `has_hvac` | Commercial | Boolean |
| `Bezpecnostni system` / `Alarm` | `has_security_system` | Commercial | Boolean |
| `Recepce` | `has_reception` | Commercial | Boolean |
| `Kuchynka` / `Kuchyn` | `has_kitchen` | Commercial | Boolean |
| `Opticky internet` / `Internet` | `has_fiber_internet` | Commercial | Boolean |
| `Urceni` | `country_specific.czech.zoning` | Commercial | |

### Unmapped Fields (present in raw data but not transformed)

| Raw Field | Reason |
|-----------|--------|
| `price.previous` (numeric) | Only `previous_price` (string) is stored |
| `price.discount` | Not in any TierI type |
| `price.auction` | Not in any TierI type |
| `price.advance` | Not in any TierI type |
| `location.show_location` | Display hint, not property data |
| `location.street` | Street geometry, not needed |
| `photos[].title` | Photo captions rarely populated |
| `badges[]` / `badge` | UI display hints |
| `featured` / `featured_text` | Portal promotion status |
| `contact.advertiser.*` | Only agency name + broker name stored |
| `contact.real_estate.email` | Not mapped to any field |
| `contact.real_estate.phones` | Not mapped to any field |
| `contact.real_estate.address` | Not mapped to any field |
| `contact.real_estate.logo` | Not mapped to any field |
| `contact.broker.email` | Not mapped to any field |
| `contact.broker.phones` | Not mapped to any field |
| `contact.broker.photo` | Not mapped to any field |
| `contact.broker.gender` | Not mapped to any field |
| `Typ objektu` (info key) | Redundant with `Velikost bytu` / `Dispozice` |
| `Pocet stani` (info key) | Not mapped; `parking_spaces` only from `Pocet parkovacich mist` |
| Search `viewport` | Map display hint |
| Search `topped` | Featured listing pointer |
| Search `locations[]` | Breadcrumb navigation |

### Category Detection

Category is detected from the `type` field (descriptive string) in `realityTransformer.ts`:

| Pattern in `type` | Detected Category |
|-------------------|-------------------|
| Contains `byt` or starts with `\d+(?:kk\|\d)` | `apartment` |
| Contains `dum`, `rodinny`, `chalupa`, `chata`, `vila`, `venkovsk`, `rekreace` | `house` |
| Contains `pozemek`, `parcela` | `land` |
| Contains `kancelar`, `sklad`, `prumysl`, `hotel`, `restaurace`, `obchod`, `bytovy dum` | `commercial` |
| No match | `apartment` (default) |

### Scraping Strategy

- API hard caps at 1001 results per query
- Bypassed by iterating 14 Czech regions per category (8 combos: 4 property types x 2 offer types)
- Pagination: `skip` + `take` (100 per page)
- Rate limit: 500ms between requests
- Auth: guest session via mobile API token
- Total yield: ~6,100 listings
