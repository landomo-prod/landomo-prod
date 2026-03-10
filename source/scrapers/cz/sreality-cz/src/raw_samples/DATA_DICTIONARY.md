# Sreality -- Raw Data Dictionary

## Listing Page Response

### Endpoint
```
GET https://www.sreality.cz/api/cs/v2/estates?page={page}&per_page={per_page}&category_main_cb={category}&category_type_cb={type}&tms={timestamp}
```

### Query Parameters
| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| `page` | number | Page number (1-indexed) | `1` |
| `per_page` | number | Results per page | `5`, `60` |
| `category_main_cb` | number | Property category (1=apartment, 2=house, 3=land, 4=commercial, 5=other) | `1` |
| `category_type_cb` | number | Transaction type (1=sale, 2=rent, 3=auction) | `1` |
| `tms` | number | Cache-buster timestamp | `1740500000000` |

### Response Structure

#### Top-Level
- `meta_description` (string) -- SEO meta description, example: `"15158 realit v nabidce prodej bytu..."`
- `result_size` (number) -- Total number of results matching the query, example: `15158`
- `_embedded.estates` (array) -- Array of estate listing objects (see below)
- `_links.self.href` (string) -- Self link
- `_links.iterator.href` (string) -- Iterator link for estate browsing

#### Estate Object (List API) -- `_embedded.estates[n]`

##### Core Identity
- `hash_id` (number) -- Unique listing identifier, example: `3105043276`
- `name` (string) -- Listing title, example: `"Prodej bytu 3+kk 305 m2 (Loft)"`
- `locality` (string) -- Location string, example: `"Krizova, Praha - Praha 5"`
- `type` (number) -- Internal type code, example: `1`
- `category` (number) -- Category code (mirrors category_main_cb), example: `1`

##### Pricing
- `price` (number) -- Price in CZK, example: `45000000`
- `price_czk` (object) -- Structured price
  - `value_raw` (number) -- Raw numeric price, example: `45000000`
  - `unit` (string) -- Price unit (usually empty string for total price, or `"Kc/mesic"` for rent)
  - `name` (string) -- Price label, example: `"Celkova cena"`
- `auctionPrice` (number) -- Auction price if applicable, example: `0`

##### Location
- `gps` (object) -- GPS coordinates
  - `lat` (number) -- Latitude, example: `50.055019`
  - `lon` (number) -- Longitude, example: `14.404981`

##### SEO / Category Codes
- `seo` (object) -- SEO and category classification
  - `category_main_cb` (number) -- Main category: 1=apartment, 2=house, 3=land, 4=commercial, 5=other
  - `category_sub_cb` (number) -- Subcategory/disposition code: 2=1+kk, 3=1+1, 4=2+kk, 5=2+1, 6=3+kk, 7=3+1, 8=4+kk, 9=4+1, 10=5+kk, 11=5+1, 12=6+, 16=atypicky, 37=rodinny, 38=cinzovni, 39=chata, 43=vila, 46=chalupa, etc.
  - `category_type_cb` (number) -- Transaction type: 1=sale, 2=rent, 3=auction
  - `locality` (string) -- SEO-friendly locality slug, example: `"praha-praha-5-krizova"`

##### Labels and Features
- `labels` (string[]) -- Human-readable Czech labels for display, example: `["Novostavba", "Cihlova", "Vytah", "Bus 1 min. pesky", "Lekar 4 min. pesky"]`
- `labelsReleased` (string[][]) -- Two-group label arrays: [0]=feature tags, [1]=POI proximity tags
  - Example [0]: `["new_building", "brick", "elevator"]`
  - Example [1]: `["bus_public_transport", "medic"]`
- `labelsAll` (string[][]) -- Complete label arrays: [0]=all feature/amenity tags, [1]=all POI tags
  - Example [0]: `["new_building", "personal", "terrace", "brick", "elevator", "garage", "partly_furnished"]`
  - Known feature tags: `new_building`, `personal`, `terrace`, `brick`, `elevator`, `garage`, `parking_lots`, `cellar`, `balcony`, `loggia`, `furnished`, `partly_furnished`, `not_furnished`, `in_construction`
  - Known POI tags: `bus_public_transport`, `tram`, `metro`, `train`, `medic`, `school`, `kindergarten`, `restaurant`, `shop`, `drugstore`, `post_office`, `atm`, `sports`, `playground`, `sightseeing`, `natural_attraction`, `tavern`, `theater`, `movies`, `candy_shop`, `vet`, `small_shop`

##### Media Flags
- `has_panorama` (number) -- 360-degree panorama available: 0=no, 1=yes, example: `0`
- `has_floor_plan` (number) -- Floor plan available: 0=no, 1=yes, example: `1`
- `has_video` (boolean|number) -- Video available, example: `false` or `true`
- `has_matterport_url` (boolean) -- Matterport virtual tour available, example: `false`
- `advert_images_count` (number) -- Total image count, example: `42`

##### Marketing Flags
- `new` (boolean) -- New listing flag, example: `false`
- `is_auction` (boolean) -- Auction listing flag, example: `false`
- `region_tip` (number) -- Regional highlight flag: 0=no, 1=yes, example: `0`
- `exclusively_at_rk` (number) -- Exclusive with agency: 0=no, 1=yes, example: `1`
- `paid_logo` (number) -- Paid logo placement: 0=no, 1=yes, example: `0`
- `attractive_offer` (number) -- Attractive offer flag: 0=no, 1=yes, example: `0`
- `rus` (boolean) -- Russian language listing flag, example: `false`

##### Images (List API)
- `_links.images` (array) -- Array of pre-resolved 400x300 thumbnail URLs
  - `[n].href` (string) -- Thumbnail URL, example: `"https://d18-a.sdn.cz/d_18/c_img_of_A/.../d57a.jpeg?fl=res,400,300,3|shr,,20|jpg,90"`
- `_links.dynamicDown` (array) -- Template URLs for thumbnail generation (contains `{width}` and `{height}` placeholders)
  - `[n].href` (string) -- Template URL, example: `"https://d18-a.sdn.cz/.../d57a.jpeg?fl=res,{width},{height},3|shr,,20|jpg,90"`
- `_links.dynamicUp` (array) -- Template URLs for preview images (with watermark)
  - `[n].href` (string) -- Template URL, example: `"https://d18-a.sdn.cz/.../d57a.jpeg?fl=res,{width},{height},3|wrm,/watermark/sreality.png,10|shr,,20|jpg,90"`
- `_links.image_middle2` (array) -- Middle-size preview images (400x300)

##### Other Links
- `_links.self.href` (string) -- API self-link, example: `"/cs/v2/estates/3105043276"`
- `_links.iterator.href` (string) -- Iterator link for browsing, example: `"/cs/v2/estate-iterator/0?category_main_cb=1&..."`

##### Embedded (List API)
- `_embedded.favourite` (object) -- Favourite status
  - `is_favourite` (boolean) -- example: `false`
- `_embedded.note` (object) -- User notes
  - `has_note` (boolean) -- example: `false`
  - `note` (string) -- Note text

---

## Detail Page Response

### Endpoint
```
GET https://www.sreality.cz/api/cs/v2/estates/{hash_id}
```

### Response Structure

#### Top-Level Fields

##### Core Identity
- `name` (object) -- Title (NOTE: object in detail API, string in list API)
  - `name` (string) -- Field label, always `"Nazev"`
  - `value` (string) -- Title text, example: `"Prodej bytu 3+kk 305 m2 (Loft)"`
- `locality` (object|string) -- Location (object in detail, string in list)
- `locality_district_id` (number) -- District ID, example: `5005`

##### Description
- `text` (object) -- Property description
  - `name` (string) -- Always `"Popis"`
  - `value` (string) -- Full description text (can be very long, contains `\r\n` line breaks)

##### Pricing
- `price_czk` (object) -- Structured price
  - `value` (string) -- Formatted price string, example: `"45 000 000"` (note: uses non-breaking spaces)
  - `value_raw` (number) -- Raw numeric price, example: `45000000`
  - `unit` (string) -- Price unit, example: `""`
  - `name` (string) -- Price label, example: `"Celkova cena"`

##### Location
- `map` (object) -- Map coordinates (detail API specific)
  - `lat` (number) -- Latitude
  - `lon` (number) -- Longitude

##### SEO / Category Codes
- `seo` (object) -- Same structure as list API (see above)

##### Code Items (Numeric Classification Codes)
- `codeItems` (object) -- Machine-readable classification codes
  - `ownership` (number) -- Ownership type: 1=personal, 2=cooperative, 3=state
  - `building_type_search` (number) -- Building type: 1=wood, 2=brick, 3=stone, 4=prefab, 5=panel, 6=skeleton, 7=mixed, 8=modular
  - `something_more1` (number[]) -- Additional classification codes, example: `[3110]`
  - `something_more2` (number[]) -- Additional classification codes, example: `[3150]`
  - `something_more3` (number[]) -- Additional classification codes, example: `[3310]`

##### Items Array (Key-Value Property Attributes)
- `items` (array) -- Array of property attribute objects. Each item has:
  - `name` (string) -- Czech field name
  - `value` (any) -- Field value (string, number, boolean, or array)
  - `type` (string) -- Value type: `"string"`, `"boolean"`, `"area"`, `"count"`, `"integer"`, `"price_czk"`, `"edited"`, `"energy_efficiency_rating"`, `"set"`
  - `unit` (string, optional) -- Unit of measurement, example: `"m2"`
  - `currency` (string, optional) -- Currency for price items, example: `"Kc"`
  - `value_type` (string, optional) -- Sub-classification (used for energy rating), example: `"G"`
  - `negotiation` (boolean, optional) -- Price negotiation flag
  - `topped` (boolean, optional) -- Whether listing is topped/promoted
  - `notes` (array, optional) -- Additional notes

**Known `items[].name` Values:**

| Czech Name | English | Type | Example Value | Notes |
|-----------|---------|------|---------------|-------|
| `Celkova cena` | Total Price | price_czk | `"45 000 000"` | With currency `"Kc"` and unit `"za nemovitost"` |
| `Poznamka k cene` | Price Note | string | `"vcetne provize"` | Commission info |
| `ID zakazky` | Listing ID | string | `"00033"` | Agency's internal ID |
| `Aktualizace` | Updated | edited | `"Dnes"` | Last update date, `topped: true` if promoted |
| `Stavba` | Construction | string | `"Cihlova"` | Building material (Cihlova=brick, Panelova=panel, Drevostavba=wood, Smisena=mixed, Skeletova=skeleton) |
| `Stav objektu` | Condition | string | `"Novostavba"` | Property condition (Novostavba=new, Po rekonstrukci=after renovation, Dobry=good, Vyborny=excellent, K rekonstrukci=needs renovation, Ve vystavbe=under construction, Projekt=project) |
| `Vlastnictvi` | Ownership | string | `"Osobni"` | Ownership type (Osobni=personal, Druzstevni=cooperative, Statni=state) |
| `Podlazi` | Floor | string | `"6. podlazi z celkem 6"` | Floor info (format: "N. podlazi z celkem M" or "prizemi") |
| `Uzitna ploch` / `Uzitna plocha` | Living Area | area | `"305"` | Living area in m2 (name often truncated to "Uzitna ploch") |
| `Celkova plocha` | Total Area | area | `"150"` | Total area in m2 |
| `Plocha` | Area | area | `"52"` | Generic area in m2 |
| `Plocha pozemku` | Plot Area | area | `"800"` | Plot/land area in m2 |
| `Zastavena plocha` / `Plocha zastavena` | Built-up Area | area | `"120"` | Built-up area in m2 (word order varies) |
| `Terasa` | Terrace | boolean | `true` | Has terrace (true/false, or area value) |
| `Garaz` | Garage | count | `"1"` | Garage count (or boolean) |
| `Rok rekonstrukce` | Renovation Year | integer | `2009` | Year of last renovation |
| `Energeticka narocnost budovy` | Energy Rating | energy_efficiency_rating | `"Trida G - Mimoradne nehospodarna"` | Full energy text; `value_type` has letter: A-G |
| `Trida PENB` | PENB Class | string | `"G"` | Energy class letter directly |
| `Vybaveni` | Furnished | string | `"Castecne"` | Furnished status (Ano=yes, Castecne=partially, Ne=no) |
| `Vytah` | Elevator | boolean | `true` | Has elevator |
| `Typ bytu` | Apartment Type | string | `"Loft"` | Apartment subtype |
| `Dispozice` | Disposition | string | `"2+kk"` | Room layout (rare in API -- usually in title) |
| `Balkon` / `Balkón` | Balcony | boolean/area | `true` or `"3"` | Has balcony or balcony area |
| `Lodzie` | Loggia | boolean/area | `true` or `"5"` | Has loggia or loggia area |
| `Zahrada` / `Plocha zahrady` | Garden | boolean/area | `"150"` | Has garden or garden area |
| `Sklep` | Cellar | boolean/area | `true` or `"8"` | Has cellar or cellar area |
| `Suturen` | Basement | boolean | `true` | Has basement |
| `Parkovani` | Parking | boolean/count | `true` or `"2"` | Has parking or parking spaces |
| `Topeni` / `Vytapeni` / `Heating` | Heating | string | `"Ustredni"` | Heating type |
| `Voda` | Water | string | `"Vodovod"` | Water supply type |
| `Odpad` | Sewage | string | `"Kanalizace"` | Sewage type |
| `Elektrina` | Electricity | string | `"230V"` | Electricity supply |
| `Plyn` | Gas | string | `"Ano"` | Gas availability |
| `Pocet podlazi` / `Pocet pater` / `Pater v dome` | Total Floors | string | `"5"` | Number of floors in building |
| `Typ budovy` | Building Type | string | `"Panelova"` | Building type |
| `Druh pozemku` | Land Type | string | `"Stavebni parcela"` | Land zoning type |
| `Typ pozemku` | Land Subtype | string | `"Stavebni"` | Land classification |
| `Typ nemovitosti` | Commercial Type | string | `"Kancelare"` | Commercial property type |
| `Druh prostoru` | Space Type | string | `"Vyrobni prostor"` | Commercial space subtype |
| `Klimatizace` | Air Conditioning | boolean | `true` | Has AC |
| `Bezbarierovy` / `Bezbarierova` | Wheelchair Accessible | boolean | `true` | Barrier-free access |
| `Krb` | Fireplace | boolean | `true` | Has fireplace |
| `Bazen` | Pool | boolean | `true` | Has pool |
| `Podkrovi` / `Puda` | Attic | boolean | `true` | Has attic |
| `Typ strechy` / `Strecha` | Roof Type | string | `"Sedlova"` | Roof type (flat, gable, hip, mansard) |
| `Rok kolaudace` | Year Completed | integer | `2023` | Occupancy certificate year — **primary field the API actually returns** |
| `Rok postaveni` / `Rok vystavby` | Year Built | string | `"1990"` | Construction year — rarely seen in practice; `Rok kolaudace` is the common field |
| `Alarm` / `Zabezpecovaci system` | Security | boolean | `true` | Has security system |
| `Solarni panely` / `Fotovoltaika` | Solar Panels | boolean | `true` | Has solar panels |
| `Dan z nemovitosti` | Property Tax | string | `"5000 Kc/rok"` | Annual property tax |
| `Kauce` | Deposit | string | `"30000 Kc"` | Security deposit (rentals) |
| `Mesicni naklady na energie` | Utility Charges | string | `"5000 Kc"` | Monthly utility costs |
| `Mesicni naklady` | Service Charges | string | `"3000 Kc"` | Monthly service charges |
| `Dostupne od` | Available From | string | `"1.3.2026"` | Availability date (rentals) |
| `Cislo parcely` / `Parcelni cislo` / `Parcela` | Cadastral Number | string | `"1234/5"` | Czech cadastral reference |
| `Oploceni` | Fencing | boolean | `true` | Has fencing (land) |
| `Zavlazovani` | Irrigation | boolean | `true` | Has irrigation (land) |
| `Pristup` / `Pristupova cesta` | Road Access | string | `"Asfaltova"` | Road access type (land) |
| `Stavebni povoleni` | Building Permit | string | `"Ano"` | Has building permit (land) |
| `Teren` / `Svazitost` | Terrain | string | `"Rovinaty"` | Terrain type (land) |
| `Kvalita pudy` | Soil Quality | string | `"Dobra"` | Soil quality (land) |
| `Zastavitelnost` | Building Coverage | string | `"30 %"` | Max building coverage (land) |
| `Pocet koupelen` / `Koupelen` / `Koupelna` | Bathrooms | string | `"2"` | Bathroom count |

##### Marketing / Status
- `is_topped` (boolean) -- Listing is promoted/topped, example: `true`
- `is_topped_today` (boolean) -- Topped today flag
- `rus` (boolean) -- Russian language, example: `false`
- `logged_in` (boolean|object) -- User login status (used for inactive detection)
- `meta_description` (string) -- SEO meta description

##### Points of Interest (POI)
- `poi` (array) -- General nearby POI array with distance, rating, description, coordinates
- `poi_transport` (object) -- Transport POI (bus, tram, metro, train stops with line details)
  - `values` (array) -- Array of transport stops with `distance`, `walkDistance`, `time`, `lines[]`
  - Each line has: `line_label`, `type` (bus/tram/vlak), `terminus`, `departure_direction`
- `poi_doctors` (object) -- Nearby doctors with distance and ratings
- `poi_grocery` (object) -- Nearby grocery stores
- `poi_restaurant` (object) -- Nearby restaurants
- `poi_leisure_time` (object) -- Nearby leisure/entertainment
- `poi_school_kindergarten` (object) -- Nearby schools and kindergartens

##### Panorama
- `panorama` (any) -- 360-degree panorama data (null if not available)

##### Recommendations
- `recommendations_data` (any) -- Related listing recommendations

#### Embedded Data (Detail API) -- `_embedded`

##### Images
- `_embedded.images` (array) -- Full image array with multiple size variants
  - `[n].id` (number) -- Image ID, example: `965034745`
  - `[n].order` (number) -- Display order (1-indexed), example: `1`
  - `[n].kind` (number) -- Image kind/type, example: `2`
  - `[n]._links.self.href` (string) -- Full resolution (1920x1080, watermarked), example: `"https://d18-a.sdn.cz/.../d57a.jpeg?fl=res,1920,1080,1|wrm,/watermark/sreality.png,10|shr,,20|jpg,90"`
  - `[n]._links.self.title` (string) -- Image filename/title, example: `"StudioBARAK-3"`
  - `[n]._links.view.href` (string) -- Fixed 749x562 preview
  - `[n]._links.gallery.href` (string) -- Fixed 221x166 gallery thumbnail
  - `[n]._links.dynamicDown.href` (string) -- Template URL for custom thumbnail (replace `{width}`,`{height}`)
  - `[n]._links.dynamicUp.href` (string) -- Template URL for custom preview with watermark

##### Seller
- `_embedded.seller` (object) -- Agent/seller information
  - `user_name` (string) -- Agent name, example: `"Lenka Svarcova"`
  - `user_id` (number) -- Agent user ID, example: `313976`
  - `email` (string) -- Agent email (if provided)
  - `phones` (array) -- Phone numbers
    - `[n].code` (string) -- Country code, example: `"420"`
    - `[n].type` (string) -- Phone type: `"MOB"`, `"TEL"`
    - `[n].number` (string) -- Phone number, example: `"777483575"`
  - `image` (string) -- Agent photo URL
  - `image_dynamic` (string) -- Agent photo template URL (with `{width}`,`{height}`)
  - `active` (boolean) -- Agent is active
  - `specialization` (object) -- Agent specialization
    - `category` (array) -- Category specialization with counts
    - `type` (array) -- Transaction type specialization with counts
  - `broker_ico` (number) -- Broker registration number
  - `certificates` (array) -- Agent certificates
  - `offers` (array) -- Current offers
  - `ask` (any) -- Ask/inquiry settings
  - `in_banner_seller` (any) -- Banner seller flag
  - `_embedded.premise` (object) -- Agency information
    - `name` (string) -- Agency name (in `_links.self` or other fields)
    - `id` (number) -- Agency ID, example: `74339`
    - `ico` (number) -- Company registration number (ICO), example: `5870186`
    - `www` (string) -- Agency website, example: `"https://mahoon.cz/"`
    - `phones` (array) -- Agency phone numbers (same format as seller phones)
    - `logo` (string) -- Agency logo URL (140x140)
    - `logo_small` (string) -- Agency logo small (70x70)
    - `locality` (object) -- Agency location with lat/lon
    - `company_id` (number) -- Company ID
    - `company_subject_id` (number) -- Company subject ID
    - `allow_calculator` (number) -- Mortgage calculator allowed
    - `seznam_naplno` (number) -- Seznam Naplno membership
    - `retargeting_id` (number) -- Retargeting ID

##### Other Embedded
- `_embedded.favourite` (object) -- Favourite status
- `_embedded.calculator` (null|object) -- Mortgage calculator data
- `_embedded.matterport_url` (string|null) -- Matterport virtual tour URL
- `_embedded.note` (object) -- User notes

#### Links (Detail API) -- `_links`
- `_links.self.href` (string) -- Self-link, example: `"/cs/v2/estates/3105043276"`
- `_links.frontend_url.href` (string) -- Frontend URL for the listing
- `_links.dynamicUp` (array) -- Template URLs for preview images
- `_links.dynamicDown` (array) -- Template URLs for thumbnails

---

## Mapping Status

### Core Fields

| Raw Field | StandardProperty Target | Mapped? | Notes |
|-----------|------------------------|---------|-------|
| `hash_id` | `portal_id` (as `sreality-{hash_id}`) | YES | Unique identifier |
| `name` / `name.value` | `title` | YES | String in list, object in detail |
| `price` / `price_czk.value_raw` | `price` | YES | `value_raw` preferred (numeric) |
| `price_czk.unit` | -- | YES | Stored in portal_metadata |
| `price_czk.name` | -- | YES | Stored in portal_metadata as `price_note` |
| `seo.category_type_cb` | `transaction_type` | YES | 1=sale, 2=rent |
| `seo.category_main_cb` | `property_category` (via detection) | YES | Routes to transformer |
| `seo.category_sub_cb` | `czech_disposition` (apartments) | YES | Numeric code mapped to disposition string |
| `seo.locality` | `source_url` (slug component) | YES | Used to build SEO-friendly URL |
| `gps.lat` / `gps.lon` | `location.coordinates` | YES | Also checks `map.lat`/`map.lon` |
| `locality` / `locality.value` | `location.city` (via `extractCity`) | YES | Parsed to extract city name |
| `text.value` | `description` | YES | Full description from detail API |
| `_links.self.href` | `source_url` (fallback) | YES | Constructed from SEO data primarily |

### Items Array Fields

| Raw Field (`items[].name`) | StandardProperty / Country-Specific Target | Mapped? | Notes |
|---------------------------|-------------------------------------------|---------|-------|
| `Uzitna ploch` / `Uzitna plocha` | `sqm` (apartments), `sqm_living` (houses) | YES | Living area in m2 |
| `Celkova plocha` | `sqm_total` (houses/commercial) | YES | Total area |
| `Plocha` | `sqm` fallback | YES | Generic area |
| `Plocha pozemku` | `sqm_plot` (houses/land) | YES | Plot area |
| `Zastavena plocha` / `Plocha zastavena` | `sqm_total` fallback | YES | Built-up area |
| `Podlazi` | `floor`, `total_floors` | YES | Parsed "N. podlazi z celkem M" format |
| `Pocet podlazi` / `Pocet pater` / `Pater v dome` | `total_floors` | YES | Floors in building |
| `Stavba` | `construction_type` (country_specific) | YES | Cihlova=brick, Panelova=panel, etc. |
| `Stav objektu` | `condition` (country_specific) | YES | Novostavba=new, Dobry=good, etc. |
| `Vlastnictvi` | `czech_ownership` (country_specific) | YES | Osobni=personal, Druzstevni=cooperative |
| `Dispozice` | `czech_disposition` (country_specific) | YES | Rarely in items; usually from title/seo |
| `Topeni` / `Vytapeni` / `Heating` | `heating_type` (country_specific) | YES | Normalized to enum |
| `Trida PENB` / `Energeticka narocnost budovy` | `energy_class`, `energy_rating` (country_specific) | YES | Uses `value_type` letter (A-G) |
| `Vybaveni` | `furnished` (country_specific + Tier 1) | YES | Ano/Castecne/Ne mapped |
| `Vytah` | `has_elevator` | YES | Boolean |
| `Balkon` / `Balkón` | `has_balcony`, `balcony_area` | YES | Boolean or area value |
| `Lodzie` | `has_loggia`, `loggia_area` | YES | Boolean or area value |
| `Terasa` | `has_terrace`, `terrace_area` | YES | Boolean or area value |
| `Zahrada` / `Plocha zahrady` | `has_garden`, `garden_area` | YES | Boolean or area value |
| `Sklep` | `has_basement`, `cellar_area` | YES | Boolean or area value |
| `Suturen` | `has_basement` (fallback) | YES | Boolean |
| `Garaz` | `has_garage`, `garage_count` | YES | Count value |
| `Parkovani` | `has_parking`, `parking_spaces` | YES | Boolean or count |
| `Rok rekonstrukce` | `renovation_year` | YES | Integer year |
| `Rok kolaudace` | `year_built` | YES | Integer field — primary. `Rok postaveni`/`Rok vystavby` checked as fallback |
| `Rok postaveni` / `Rok vystavby` | `year_built` | YES | Fallback — rarely seen in practice; `Rok kolaudace` is the common field |
| `Voda` | `water_supply` (land) | YES | Land transformer only |
| `Odpad` | `sewage` (land) | YES | Land transformer only |
| `Elektrina` | `electricity` (land) | YES | Land transformer only |
| `Plyn` | `gas` (land) | YES | Land transformer only |
| `Druh pozemku` / `Typ pozemku` | `land_type`, `zoning`, `property_subtype` (land) | YES | Land classification |
| `Typ nemovitosti` | `property_subtype` (commercial) | YES | Commercial type detection |
| `Druh prostoru` | `property_subtype` (commercial) | YES | Commercial subtype |
| `Klimatizace` | `features[]` as "air_conditioning" | YES | Feature string |
| `Bezbarierovy` / `Bezbarierova` | `features[]` as "wheelchair_accessible" | YES | Feature string |
| `Krb` | `has_fireplace` (houses) | YES | Boolean |
| `Bazen` | `has_pool` (houses) | YES | Boolean |
| `Podkrovi` / `Puda` | `has_attic` (houses) | YES | Boolean |
| `Typ strechy` / `Strecha` | `roof_type` (houses) | YES | Parsed to enum |
| `Alarm` / `Zabezpecovaci system` | `features[]` as "security_system" | YES | Houses only |
| `Solarni panely` / `Fotovoltaika` | `features[]` as "solar_panels" | YES | Houses only |
| `Dan z nemovitosti` | `property_tax` (houses) | YES | Parsed to number |
| `Kauce` | `deposit` (houses) | YES | Parsed to number |
| `Mesicni naklady na energie` | `utility_charges` (houses) | YES | Parsed to number |
| `Mesicni naklady` | `service_charges` (houses) | YES | Parsed to number |
| `Dostupne od` | `available_from` (houses) | YES | Date string |
| `Cislo parcely` / `Parcelni cislo` | `cadastral_number` (land) | YES | Land only |
| `Oploceni` | `features[]` as "fenced" (land) | YES | Land only |
| `Zavlazovani` | `features[]` as "irrigation" (land) | YES | Land only |
| `Pristup` / `Pristupova cesta` | `road_access` (land) | YES | Land only |
| `Stavebni povoleni` | `building_permit` (land) | YES | Land only |
| `Teren` / `Svazitost` | `terrain` (land) | YES | Land only |
| `Kvalita pudy` | `soil_quality` (land) | YES | Land only |
| `Zastavitelnost` | `max_building_coverage` (land) | YES | Land only |
| `Pocet koupelen` / `Koupelen` / `Koupelna` | `bathrooms` | YES | Parsed to number |
| `Celkova cena` | `price` (redundant with `price_czk`) | YES | Already mapped via `price_czk.value_raw` |
| `Poznamka k cene` | -- | NO | Price note, could map to `portal_metadata` |
| `ID zakazky` | -- | NO | Agency internal ID, low value |
| `Aktualizace` | -- | NO | Update date. Could map to `published_date` but value is relative ("Dnes") |
| `Typ bytu` | -- | NO | Apartment subtype (Loft, Mezonet). Could map to `portal_metadata` |

### Code Items Fields

| Raw Field | Target | Mapped? | Notes |
|-----------|--------|---------|-------|
| `codeItems.ownership` | `czech_ownership` | YES | 1=personal, 2=cooperative, 3=state. Preferred over text |
| `codeItems.building_type_search` | `construction_type` | YES | 1=wood,...,5=panel,...,8=modular. Preferred over text |
| `codeItems.something_more1` | -- | NO | Unknown classification codes |
| `codeItems.something_more2` | -- | NO | Unknown classification codes |
| `codeItems.something_more3` | -- | NO | Unknown classification codes |

### Labels / Marketing Fields

| Raw Field | Target | Mapped? | Notes |
|-----------|--------|---------|-------|
| `labelsAll[0]` feature tags | Amenity booleans via `extractLabelsFeatures()` | YES | Supplements items[] data |
| `labelsAll[1]` POI tags | -- | NO | Nearby POI categories, not mapped |
| `labelsReleased` | -- | NO | Subset of labelsAll for display |
| `labels` | `portal_metadata.sreality.labels` | YES | Stored in portal metadata |
| `new` | `portal_metadata.sreality.new` | YES | Marketing flag |
| `region_tip` | `portal_metadata.sreality.region_tip` | YES | Marketing flag |
| `exclusively_at_rk` | `portal_metadata.sreality.exclusively_at_rk` | YES | Exclusivity flag |
| `is_auction` | `portal_metadata.sreality.is_auction` | YES | Auction flag |
| `auctionPrice` | `portal_metadata.sreality.auction_price` | YES | Only when is_auction=true |
| `paid_logo` | -- | NO | Ad payment flag, low value |
| `attractive_offer` | -- | NO | Marketing flag, low value |
| `rus` | -- | NO | Russian language flag |
| `is_topped` | -- | NO | Promoted listing flag |
| `is_topped_today` | -- | NO | Topped today flag |

### Media Fields

| Raw Field | Target | Mapped? | Notes |
|-----------|--------|---------|-------|
| `_embedded.images` | `media.images`, `images` | YES | Multiple size variants extracted |
| `_embedded.images[].order` | Image ordering | YES | Used for sort order |
| `_embedded.images[]._links.self.href` | Full-res image URL | YES | 1920x1080, preferred for `full` |
| `_embedded.images[]._links.self.title` | -- | NO | Original filename. Could map to `PropertyImage.filename` |
| `_embedded.images[].id` | -- | NO | Image ID. Could map to `PropertyImage.image_id` |
| `_embedded.images[].kind` | -- | NO | Image kind/type, unknown meaning |
| `advert_images_count` | `media.total_images` | YES | Total image count |
| `has_floor_plan` | `portal_metadata.sreality.has_floor_plan` | YES | Floor plan flag |
| `has_video` | `portal_metadata.sreality.has_video` | YES | Video flag |
| `has_panorama` | `portal_metadata.sreality.has_panorama` | YES | 360 panorama flag |
| `has_matterport_url` | -- | NO | Redundant with `_embedded.matterport_url` |
| `_embedded.matterport_url` | `media.virtual_tour_url` (via `extractVirtualTourUrl`) | YES | Matterport tour |
| `_embedded.video.url` | `videos[]` (via `extractVideoUrl`) | YES | Video URL |
| `_embedded.video.thumbnail` | -- | NO | Video thumbnail |

### Seller Fields

| Raw Field | Target | Mapped? | Notes |
|-----------|--------|---------|-------|
| `_embedded.seller.user_name` | `agent_name` / `agent.name` | YES | Agent's display name |
| `_embedded.seller.phones[0]` | `agent_phone` / `agent.phone` | YES | Formatted with country code prefix |
| `_embedded.seller.email` | `agent_email` / `agent.email` | YES | Agent email |
| `_embedded.seller._embedded.premise.name` | `agent_agency` / `agent.agency` | YES | Agency name from premise |
| `_embedded.seller.logo._links.self.href` | `agent.agency_logo` | YES | Agency logo |
| `_embedded.seller.user_id` | -- | NO | Internal user ID |
| `_embedded.seller.image` | -- | NO | Agent photo URL |
| `_embedded.seller.image_dynamic` | -- | NO | Agent photo template |
| `_embedded.seller.specialization` | -- | NO | Agent specialization stats |
| `_embedded.seller.rating` | -- | NO | Agent rating (not observed in sample) |
| `_embedded.seller.reviews` | -- | NO | Review count (not observed in sample) |
| `_embedded.seller.broker_ico` | -- | NO | Broker ICO number |
| `_embedded.seller.certificates` | -- | NO | Agent certificates |
| `_embedded.seller._embedded.premise.ico` | -- | NO | Company ICO (Czech business ID) |
| `_embedded.seller._embedded.premise.www` | -- | NO | Agency website URL |
| `_embedded.seller._embedded.premise.locality` | -- | NO | Agency location coordinates |

### POI Fields (Completely Unmapped)

| Raw Field | Target | Mapped? | Notes |
|-----------|--------|---------|-------|
| `poi[]` | -- | NO | General nearby POI (restaurants, shops, cinemas, etc.) |
| `poi_transport` | -- | NO | Nearby transport stops with lines, walk distances, times |
| `poi_doctors` | -- | NO | Nearby medical facilities with distances |
| `poi_grocery` | -- | NO | Nearby grocery/food stores |
| `poi_restaurant` | -- | NO | Nearby restaurants |
| `poi_leisure_time` | -- | NO | Nearby leisure facilities |
| `poi_school_kindergarten` | -- | NO | Nearby educational institutions |

Each POI entry contains: `distance` (meters), `walkDistance` (meters), `time` (seconds), `rating`, `description`, `name`, `lat`/`lon`, `url`, `source`, `lines[]` (for transport).

**Note:** POI data is rich (transport lines, walk distances, ratings) and could be valuable for search/filtering (e.g., "apartments within 5 min walk of metro") but is not currently mapped.

### Other Unmapped Fields

| Raw Field | Notes |
|-----------|-------|
| `panorama` | 360-degree panorama data object (null if absent) |
| `recommendations_data` | Related listing recommendations |
| `locality_district_id` | District ID number |
| `logged_in` | Authentication status (used for inactive detection) |
| `meta_description` | SEO text (redundant with title + price) |
| `_links.iterator` | Pagination iterator link |
| `_embedded.favourite` | User favourite status |
| `_embedded.calculator` | Mortgage calculator data |
| `_embedded.note` | User notes |
| `codeItems.something_more1/2/3` | Unknown numeric classification codes |
| `items[].Poznamka k cene` | Price commission note |
| `items[].ID zakazky` | Agency listing ID |
| `items[].Aktualizace` | Update timestamp (relative: "Dnes", "Pred 3 dny") |
| `items[].Typ bytu` | Apartment subtype (Loft, Mezonet, etc.) |
| `_embedded.images[].id` | Image ID -- could map to `PropertyImage.image_id` |
| `_embedded.images[]._links.self.title` | Original filename -- could map to `PropertyImage.filename` |
| `_embedded.images[].kind` | Image classification (meaning unknown) |
| `_embedded.video.thumbnail` | Video thumbnail URL |
| `_embedded.seller.image` | Agent photo URL |
| `_embedded.seller._embedded.premise.www` | Agency website |
| `_embedded.seller._embedded.premise.ico` | Agency business registration number |
