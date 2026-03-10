# Ceske Reality — Raw Data Dictionary

Portal: https://www.ceskereality.cz
Scraper type: HTML (Cheerio) + JSON-LD
Source platform identifier: `ceskereality`

## Listing Page Response

### Endpoint
`https://www.ceskereality.cz/{transaction}/{category}/?strana={page}`

Transactions: `prodej` (sale), `pronajem` (rent)
Categories: `byty`, `rodinne-domy`, `pozemky`, `komercni-prostory`, `chaty-chalupy`, `ostatni`

Pagination via `?strana=N` query parameter (1-indexed). Empty page = no `article.i-estate` elements.

### Response Structure (HTML parsed)

Each listing card is an `<article class="i-estate">` element:

- `title` (string|null) — Listing title from `.i-estate__header-title a`, example: `"Prodej bytu 2+kk 43 m\u00b2 Praha Chodov, Valentova"`
- `link` (string|null) — Detail page URL from `a.i-estate__title-link` or first `a[href$=".html"]`, example: `"https://www.ceskereality.cz/prodej/byty/byty-2-kk/praha/prodej-bytu-2-kk-43-m2-valentova-3526161.html"`
- `price` (string|null) — Price text from `.i-estate__footer-price-value`, example: `"8 392 907 Kc"`, `"Cena na dotaz"`

The numeric portal ID is extracted from the URL suffix: `-(\d+)\.html$` -> `ceskereality-{id}`, e.g. `ceskereality-3526161`.

### Real Listing Page Sample (apartments for sale)

```json
[
  {
    "title": "Prodej bytu 2+kk 43 m\u00b2 Praha Chodov, Valentova",
    "link": "https://www.ceskereality.cz/prodej/byty/byty-2-kk/praha/prodej-bytu-2-kk-43-m2-valentova-3526161.html",
    "price": "8 392 907 Kc"
  },
  {
    "title": "Prodej bytu 2+kk 48 m\u00b2 Ceske Budejovice, K. Stecha",
    "link": "https://www.ceskereality.cz/prodej/byty/byty-2-kk/ceske-budejovice/prodej-bytu-2-kk-48-m2-k-stecha-3668815.html",
    "price": "Cena na dotaz"
  },
  {
    "title": "Prodej bytu 3+kk 66 m\u00b2 Olomouc, Okruzni",
    "link": "https://www.ceskereality.cz/prodej/byty/byty-3-kk/olomouc/prodej-bytu-3-kk-66-m2-okruzni-3668816.html",
    "price": "7 870 000 Kc"
  }
]
```

## Detail Page Response (HTML parsed + JSON-LD)

### Endpoint
`https://www.ceskereality.cz/{transaction}/{category}/{subcategory}/{city}/{slug}-{id}.html`

Example: `https://www.ceskereality.cz/prodej/byty/byty-2-kk/praha/prodej-bytu-2-kk-43-m2-valentova-3526161.html`

The detail page provides data from three sources:

### 1. JSON-LD (`<script type="application/ld+json">`)

- `@context` (string) — Always `"https://schema.org"`, example: `"https://schema.org"`
- `@type` (string) — Always `"individualProduct"`, example: `"individualProduct"`
- `additionalType` (string) — Property type, example: `"Apartment"`, `"House"`, `"Land"`, `"Commercial"`
- `name` (string) — Listing title, example: `"Prodej bytu 2+kk 43 m\u00b2"`
- `description` (string) — Full listing description (multi-paragraph Czech text), example: `"Stavba zahajena! Originalni loftove bydleni..."`
- `image` (string) — Primary image URL, example: `"https://img.ceskereality.cz/foto/26972/8a/8a764be854c5b9a2c865a2bce70d5f8c.jpg"`
- `offers` (object) — Offer details:
  - `@type` (string) — `"OfferForPurchase"` or `"OfferForRent"`, example: `"OfferForPurchase"`
  - `priceCurrency` (string) — Always `"CZK"`, example: `"CZK"`
  - `price` (number) — Price in CZK, example: `8392907`
  - `areaServed` (object) — Location:
    - `@type` (string) — `"Place"`
    - `address` (object):
      - `@type` (string) — `"PostalAddress"`
      - `addressLocality` (string) — City name, example: `"Praha"`, `"Teplice"`
      - `addressRegion` (string|undefined) — Region, example: `"Ustecky kraj"` (sometimes absent)
      - `streetAddress` (string|undefined) — Street address (sometimes absent, sometimes agent address)
      - `postalCode` (string|undefined) — Postal code (sometimes absent)
  - `offeredby` (object) — Agent/agency:
    - `@type` (string) — `"RealEstateAgent"`
    - `name` (string) — Agent or agency name, example: `" GARTAL Development"`, `" Martin Sedlacek"`
    - `address` (object) — Agent office address (not property address):
      - `addressLocality` (string) — example: `"Praha"`
      - `streetAddress` (string) — example: `"Kovarska 2537/5"`
    - `telephone` (string) — Agent phone, example: `"840400440"`, `"777440880"`
    - `logo` (string) — Agent/agency logo URL, example: `"https://img.ceskereality.cz/makleri/26972/82387.jpg"`
- `geo` (object|undefined) — Coordinates (rare, not always present):
  - `latitude` (string) — example: `"50.123"`
  - `longitude` (string) — example: `"14.456"`

### 2. Images (HTML gallery)

Extracted from `img[src*="img.ceskereality.cz/foto"]` elements, excluding logos/icons/agent photos. Query params stripped to get full-resolution URL.

- `images` (string[]) — Array of full-resolution image URLs, example: `["https://img.ceskereality.cz/foto/26972/8a/8a764be854c5b9a2c865a2bce70d5f8c.jpg", ...]`

Typically 5-20 images per listing.

### 3. Property Attributes (HTML `.i-info` table)

Each attribute is a label/value pair from `.i-info__title` / `.i-info__value` elements. Labels are in Czech. Not all attributes are present on every listing.

#### Observed Attribute Labels and Values

| Czech Label | Type | Description | Example Value |
|-------------|------|-------------|---------------|
| `Cena` | string | Price with currency (contains hypoteka link noise) | `"8 392 907 Kc\n Spocitat hypoteku"` |
| `Plocha uzitna` | string | Usable area | `"43 m\u00b2"`, `"73 m\u00b2"` |
| `Plocha obytna` | string | Living area | `"43 m\u00b2"` |
| `Plocha celkova` / `Plocha` | string | Total area | `"120 m\u00b2"` |
| `Plocha pozemku` / `Pozemek` | string | Plot area | `"2 510 m\u00b2"` |
| `Plocha zastavena` | string | Built-up area | `"85 m\u00b2"` |
| `Plocha balkonu` / `Balkon` / `Balkon` | string | Balcony area (may contain lodgie/terasa in value) | `"8 m\u00b2"` |
| `Plocha terasy` / `Terasa` | string | Terrace area | `"15 m\u00b2"` |
| `Plocha lodzie` / `Lodzie` / `Loggie` | string | Loggia area | `"6 m\u00b2"` |
| `Plocha sklepa` / `Sklep` | string | Cellar area | `"2 m\u00b2"` |
| `Patro` | string | Floor number | `"4."`, `"prizemni"`, `"sutren"` |
| `Pocet podlazi` / `Podlazi celkem` | string | Total floors in building | `"5"` |
| `Konstrukce` | string | Construction type | `"Skeletova"`, `"Zdena"`, `"Panelova"`, `"Cihlova"` |
| `Stav nemovitosti` | string | Property condition | `"Novostavba"`, `"Bezvadny"`, `"Po rekonstrukci"`, `"Dobry"`, `"K rekonstrukci"` |
| `Vlastnictvi` | string | Ownership type | `"soukrome"`, `"druzstevni"`, `"statni"` |
| `Energeticka narocnost` | string | Energy rating (PENB) | `"B - Velmi usporna"`, `"G - Mimoradne nehospodarna"` |
| `Zpusoby vytapeni` | string | Heating type | `"Ustredni - dalkove"`, `"Ustredni - plynove"`, `"Lokalni - elektricke"` |
| `Vytapeni podrobnosti` | string | Heating details | `"Podlahove vytapeni"` |
| `Elektrina` | string | Electricity type | `"230 V"`, `"400 V"` |
| `Zdroje vody` | string | Water source | `"Verejny vodovod"` |
| `Kanalizace` | string | Sewage type | `"Verejna kanalizace"`, `"Septic"` |
| `Plyn` | string | Gas supply | `"Ano"`, `"Ne"` |
| `Parkovani` | string | Parking description | `"Garaz, Parkovani na ulici"` |
| `Balkony` | string | Balcony types | `"Balkon, Lodzie"` |
| `Dopravni spojeni` | string | Transport connections | `"Metro, MHD, Silnice, Dalnice"` |
| `Inzenyrske site` | string | Utility networks | `"Internet, Plyn"`, `"Internet"` |
| `Prijezdy` | string | Road access type | `"Asfalt"` |
| `Druhy bytu` | string | Apartment subtype | `"Klasicky"`, `"Podkrovi"`, `"Mezonetovy"` |
| `ID nemovitosti` | string | Portal property ID | `"CLCH-503"`, `"00075-1"` |
| `Datum vlozeni` | string | Publication date | `"25. zari 2025"`, `"pred 56 minutami"` |
| `Rok vystavby` / `Rok kolaudace` | string | Year built | `"2019"`, `"1985"` |
| `Rok rekonstrukce` / `Rekonstrukce` | string | Renovation year | `"2020"` |
| `Pocet pokoju` / `Pokoje` | string | Number of rooms | `"3"` |
| `Koupelna` / `WC` / `Koupelen` | string | Bathroom count | `"1"`, `"2"` |
| `Garaz` / `Garage` | string | Garage info | `"1"`, `"2"` |
| `Pocet parkovacich mist` | string | Parking spaces count | `"2"` |
| `Vybaveni` / `Zarizeni` / `Vybaven` | string | Furnished status | `"Ano"`, `"Castecne"`, `"Ne"` |
| `Poplatek` / `Mesicni naklady` / `Sluzby` | string | Monthly fees/HOA | `"3 500 Kc"` |
| `Dostupne od` / `Nastěhování` / `Volne od` | string | Available from date | `"ihned"`, `"1.5.2026"` |
| `Kauce` / `Jistota` / `Depozit` | string | Security deposit | `"15 000 Kc"` |

### 4. Energy Rating (HTML element)

Extracted from `.s-estate-detail-intro__energy` element. Often `null` when energy info is in the attributes table instead.

- `energyRating` (string|null) — Energy class text, example: `null` (typically found in attributes as `Energeticka narocnost`)

### 5. Coordinates (multi-strategy extraction)

Coordinates are extracted via 4 fallback strategies in order:
1. `jsonLd.geo.latitude` / `jsonLd.geo.longitude` (rare)
2. `[data-lat]` / `[data-lng]` attributes on map elements
3. Google Maps iframe/link `?q=LAT,LON` parameter
4. Inline `<script>` variables matching `lat:` / `lng:` patterns

All validated against Czech Republic bounding box: lat 48.5-51.1, lon 12.0-18.9.

- `coordinates` (object|undefined) — `{ lat: number, lon: number }`, example: `{ lat: 50.053, lon: 14.489 }`

### Real Detail Page Sample

```json
{
  "jsonLd": {
    "@context": "https://schema.org",
    "@type": "individualProduct",
    "additionalType": "Apartment",
    "name": "Prodej bytu 3+kk 73 m\u00b2",
    "description": "V exkluzivnim zastoupeni klienta...",
    "image": "https://img.ceskereality.cz/foto/93932/a8/a869ccbcbd9568808b8497e28275c7c8.jpg",
    "offers": {
      "@type": "OfferForPurchase",
      "priceCurrency": "CZK",
      "price": 3790000,
      "areaServed": {
        "@type": "Place",
        "address": {
          "@type": "PostalAddress",
          "addressLocality": "Teplice"
        }
      },
      "offeredby": {
        "@type": "RealEstateAgent",
        "name": " Martin Sedlacek",
        "telephone": "777440880",
        "logo": "https://img-cache.ceskereality.cz/makleri208/5054209/110934.jpg"
      }
    }
  },
  "images": [
    "https://img.ceskereality.cz/foto/93932/a8/a869ccbcbd9568808b8497e28275c7c8.jpg",
    "https://img.ceskereality.cz/foto/93932/9b/9bb6dee73b8b0ca97466ccb24fff3139.jpg"
  ],
  "attributes": {
    "Dopravni spojeni": "Autobus, MHD, Silnice",
    "Zdroje vody": "Verejny vodovod",
    "Druhy bytu": "Podkrovi",
    "ID nemovitosti": "00075-1",
    "Vlastnictvi": "soukrome",
    "Patro": "4.",
    "Elektrina": "230 V",
    "Zpusoby vytapeni": "Ustredni - plynove",
    "Inzenyrske site": "Internet, Plyn",
    "Datum vlozeni": "pred 56 minutami",
    "Stav nemovitosti": "Bezvadny",
    "Energeticka narocnost": "G - Mimoradne nehospodarna",
    "Kanalizace": "Verejna kanalizace",
    "Konstrukce": "Zdena",
    "Prijezdy": "Asfalt",
    "Cena": "3 790 000 Kc",
    "Plocha uzitna": "73 m\u00b2"
  },
  "energyRating": null
}
```

## Mapping Status

### Listing Page Fields -> Usage

| Raw Field | Usage | Notes |
|-----------|-------|-------|
| `title` | Checksum input, not directly ingested | Title parsed from listing card |
| `link` | `DetailJob.url` | Used to queue detail page fetch |
| `price` | Checksum input (parsed to integer) | Parsed by removing spaces and "Kc" |

### JSON-LD Fields -> StandardProperty / TierI Target

| Raw Field | Target Field | Notes |
|-----------|-------------|-------|
| `name` | `title` | Also parsed for disposition (bedroom count) and sqm |
| `description` | `description` | Full Czech text; also keyword-scanned for amenities |
| `image` | `images` / `media.images` | Fallback if HTML gallery is empty |
| `offers.price` | `price` | Integer CZK |
| `offers.priceCurrency` | `currency` | Always `"CZK"` |
| `offers.@type` | (implicit via URL) | `OfferForPurchase` = sale, `OfferForRent` = rent; transformer uses URL path instead |
| `offers.areaServed.address.addressLocality` | `location.city` | City name |
| `offers.areaServed.address.addressRegion` | (not mapped) | Region - available but not currently mapped to `location.region` |
| `offers.areaServed.address.streetAddress` | `location.address` | Sometimes absent or is agent address |
| `offers.areaServed.address.postalCode` | `location.postal_code` | Sometimes absent |
| `offers.offeredby.name` | `agent_name`, `portal_metadata.agent_name` | Agent or agency name (has leading space) |
| `offers.offeredby.telephone` | `agent_phone`, `portal_metadata.agent_phone` | Phone number |
| `offers.offeredby.logo` | (not mapped) | Agent/agency logo URL |
| `offers.offeredby.address` | (not mapped) | Agent office address (not property) |
| `additionalType` | (not mapped) | `"Apartment"`, `"House"` etc. - category determined by URL path |
| `geo.latitude` / `geo.longitude` | `location.coordinates` | Rare; primary coordinate source |

### HTML Attribute Fields -> StandardProperty / TierI Target

| Raw Czech Label | Mapped Via (`propertyDetailsMapper`) | Target Field | Notes |
|-----------------|--------------------------------------|-------------|-------|
| `Plocha uzitna` | `sqmUsable` -> `sqm` | `sqm` (apartment), `sqm_living` (house), `sqm_total` (commercial) | Fallback area if no `Plocha celkova` |
| `Plocha obytna` | `sqmLiving` -> `sqm` | `sqm` (apartment) | Living area, secondary fallback |
| `Plocha celkova` / `Plocha` | `sqm` | `sqm` (apartment), `sqm_total` (commercial) | Primary area measurement |
| `Plocha pozemku` / `Pozemek` | `sqmPlot` | `sqm_plot` (house), `area_plot_sqm` (land) | Plot area |
| `Plocha zastavena` | `sqmBuilt` | (not mapped to TierI) | Built-up area, stored in mapper but unused |
| `Plocha balkonu` / `Balkon` | `balconyArea` | `balcony_area`, `has_balcony=true` | Sets flag even if no numeric area |
| `Plocha terasy` / `Terasa` | `terraceArea` | `terrace_area`, `has_terrace=true` | |
| `Plocha lodzie` / `Lodzie` / `Loggie` | `loggiaArea` | `loggia_area`, `has_loggia=true` | |
| `Plocha sklepa` / `Sklep` | `cellarArea` | `cellar_area`, `has_basement=true` | |
| `Patro` | `floor` | `floor` | Parsed: `prizemni`=0, `sutren`=-1, else integer |
| `Pocet podlazi` / `Podlazi celkem` | `totalFloors` | `total_floors` (apartment), `stories` (house) | |
| `Konstrukce` / `Typ stavby` / `Material` | `constructionType` | `construction_type` | Mapped: panel, cihla/zdena->brick, beton->concrete, smisena->mixed |
| `Stav nemovitosti` / `Stav` | `condition` | `condition` | Mapped: novostavba->new, bezvadny->excellent, dobry->good, po rekonstrukci->after_renovation, k rekonstrukci->requires_renovation |
| `Vlastnictvi` | `ownership` | `portal_metadata.ownership` | Raw Czech string, not normalized |
| `Energeticka narocnost` / `PENB` | `energyClass` | `energy_class` | Extracted letter A-G from value |
| `Zpusoby vytapeni` / `Topeni` / `Vytapeni` | `heating` | `heating_type` | Raw Czech string, not normalized to enum |
| `Vytapeni podrobnosti` | (not separately mapped) | (falls under heating match) | Additional heating detail |
| `Zdroje vody` / `Voda` | `water` | `portal_metadata.water` | Raw string |
| `Kanalizace` | `sewage` | `portal_metadata.sewage` | Raw string |
| `Elektrina` / `Proud` | `electricity` | `portal_metadata.electricity` | Raw string |
| `Plyn` | `gas` | `portal_metadata.gas` | Raw string |
| `Parkovani` / `Parkovaci` | `parking` | `has_parking=true`, `portal_metadata.parking_info` | Description-based boolean + raw string |
| `Pocet pokoju` / `Pokoje` | `rooms` | `rooms` | Integer |
| `Koupelna` / `WC` / `Koupelen` | `bathrooms` | `bathrooms` | Integer |
| `Garaz` / `Garage` | `garageCount` | `has_garage=true`, `garage_count` | |
| `Pocet parkovacich mist` | `parkingSpaces` | `parking_spaces` | Integer |
| `Rok vystavby` / `Rok kolaudace` | `yearBuilt` | `year_built` | 4-digit year, validated 1800-current+5 |
| `Rok rekonstrukce` / `Rekonstrukce` | `renovationYear` | `renovation_year` | 4-digit year |
| `Vybaveni` / `Zarizeni` / `Vybaven` | `furnished` | `furnished` | Mapped: ano->furnished, castecne->partially_furnished, ne->not_furnished |
| `Datum vlozeni` / `Datum zverejneni` | `publishedDate` | `published_date` | Raw Czech date string, not normalized to ISO |
| `Poplatek` / `Mesicni naklady` / `Sluzby` | `hoaFees` | `hoa_fees` | Parsed number |
| `Dostupne od` / `Nastehovani` / `Volne od` | `availableFrom` | `available_from` | Raw string |
| `Kauce` / `Jistota` / `Depozit` | `deposit` | `deposit` | Parsed number |
| `ID nemovitosti` / `Cislo nemovitosti` | `propertyId` | `portal_metadata.property_id` | Portal's internal property code |
| `Dopravni spojeni` | (not mapped) | -- | Transport connections, not extracted |
| `Balkony` | (not mapped) | -- | Balcony type list (overlaps with balcony area detection) |
| `Inzenyrske site` | (not mapped) | -- | Utility networks list |
| `Prijezdy` | (not mapped) | -- | Road access type |
| `Druhy bytu` | (not mapped) | -- | Apartment subtype (Klasicky, Podkrovi, Mezonetovy) |
| `Cena` (from attributes) | (not mapped) | -- | Redundant with JSON-LD `offers.price` |

### HTML-extracted Fields -> Target

| Raw Field | Target Field | Notes |
|-----------|-------------|-------|
| `images[]` | `images`, `media.images` | Full-resolution gallery images (preferred over JSON-LD single image) |
| `energyRating` (`.s-estate-detail-intro__energy`) | `energy_class` | Fallback if not found in attributes; letter A-G extracted |
| `coordinates` (multi-strategy) | `location.coordinates` | `{ lat, lon }` from JSON-LD geo, data attributes, Google Maps, or inline scripts |

### Description Keyword Extraction -> Target

| Keyword Pattern | Target Field | Category |
|----------------|-------------|----------|
| `vytah` / `elevator` | `has_elevator` | apartment, commercial |
| `balkon` / `balcony` / `terasa` / `terrace` | `has_balcony` | apartment |
| `parkovani` / `parking` / `garaz` / `garage` | `has_parking` | apartment, house, commercial |
| `sklep` / `basement` / `cellar` | `has_basement` | apartment, house |
| `zahrada` / `garden` | `has_garden` | house |
| `garaz` / `garage` | `has_garage` | house |
| `koupelna` / `wc` / `bathroom` / `toilet` | `has_bathrooms` | commercial |

### Disposition (Bedrooms) Extraction from Title

Pattern: `(\d+)\+(?:kk|\d)` in `jsonLd.name`
- `2+kk` -> bedrooms = 1 (rooms - 1)
- `3+1` -> bedrooms = 2 (rooms - 1)
- `1+kk` -> bedrooms = 0

### Unmapped Raw Fields (data loss)

| Raw Field | Potential Target | Status |
|-----------|-----------------|--------|
| `offers.areaServed.address.addressRegion` | `location.region` | NOT MAPPED - region data available but dropped |
| `offers.offeredby.logo` | `agent.agency_logo` | NOT MAPPED |
| `offers.offeredby.address` | -- | NOT MAPPED (agent address, not property) |
| `additionalType` | `portal_metadata` | NOT MAPPED (category from URL) |
| `Dopravni spojeni` | `portal_metadata.transport` or `features[]` | NOT MAPPED |
| `Balkony` | `portal_metadata.balcony_types` | NOT MAPPED (overlaps with area detection) |
| `Inzenyrske site` | `portal_metadata.utilities` | NOT MAPPED |
| `Prijezdy` | `portal_metadata.road_access` | NOT MAPPED |
| `Druhy bytu` | `portal_metadata.apartment_subtype` or `country_specific.building_type` | NOT MAPPED |
| `Plocha zastavena` (sqmBuilt) | `country_specific.area_total` | Parsed by mapper but not used by any transformer |
| `heating` (raw Czech) | `country_specific.heating_type` (normalized enum) | Stored as raw string, not normalized to CzechSpecificFields enum |
| `ownership` (raw Czech) | `country_specific.czech_ownership` (normalized enum) | Stored as raw string in portal_metadata, not normalized |
| `publishedDate` (raw Czech) | `published_date` (ISO format) | Stored as raw Czech text, not converted to ISO date |

### Category Routing

| URL Path | `property_category` | Transformer |
|----------|-------------------|-------------|
| `/prodej/byty/` or `/pronajem/byty/` | `apartment` | `ceskerealityApartmentTransformer` |
| `/prodej/rodinne-domy/` or `/pronajem/rodinne-domy/` | `house` | `ceskerealityHouseTransformer` |
| `/prodej/pozemky/` or `/pronajem/pozemky/` | `land` | `ceskerealityLandTransformer` |
| `/prodej/komercni-prostory/` or `/pronajem/komercni-prostory/` | `commercial` | `ceskerealityCommercialTransformer` |
| `/prodej/chaty-chalupy/` or `/pronajem/chaty-chalupy/` | `house` | `ceskerealityHouseTransformer` |
| `/prodej/ostatni/` or `/pronajem/ostatni/` | `commercial` | `ceskerealityCommercialTransformer` |

### Transaction Type Detection

Determined from URL path, not from JSON-LD `offers.@type`:
- URL contains `/pronajem/` -> `transaction_type: 'rent'`
- Otherwise -> `transaction_type: 'sale'`
