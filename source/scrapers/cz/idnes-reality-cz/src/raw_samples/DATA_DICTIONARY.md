# iDNES Reality -- Raw Data Dictionary

Portal: https://reality.idnes.cz
Scraper type: HTML (Cheerio) -- no API, all data parsed from rendered HTML
Source platform identifier: `idnes-reality`

---

## Listing Page Response

### Endpoint
```
https://reality.idnes.cz/s/{transaction}/{category}/
https://reality.idnes.cz/s/{transaction}/{category}/?page={N}
```

Transaction: `prodej` (sale), `pronajem` (rent)
Category: `byty` (apartments), `domy` (houses), `pozemky` (land), `komercni-nemovitosti` (commercial), `chaty-chalupy` (recreation)

### Scraping method
HTML parsed with Cheerio. Listing items found via selectors: `.c-products__item`, `.estate-item`, `[data-dot="hp_product"]`, `.property-item`.

### Response Structure (per listing item)

| Field | Type | Selector / Source | Description | Example |
|-------|------|-------------------|-------------|---------|
| `title` | string | `.c-products__title`, `h2`, `.title` | Listing title with disposition and area | `"prodej\nbytu 2+1 81 m\u00b2"` |
| `url` | string | `a.c-products__link`, `a[href*="/detail/"]` href | Detail page URL, relative or absolute | `"/detail/prodej/byt/praha-3-jezkova/69a095f280ba5811c5001969/"` |
| `price` | string | `.c-products__price`, `.price` | Price text with currency | `"10 900 000 Kc"` |
| `location` | string | `.c-products__info`, `.location` | Location text (city, district) | `"Jezkova, Praha 3 - Zizkov"` |
| `id` | string | URL path segment (24-char hex) or `data-id` attr | Portal listing ID (MongoDB ObjectId) | `"69a095f280ba5811c5001969"` |
| `area` | number (derived) | Regex from title: `(\d+)\s*m\u00b2` | Area in sqm, extracted from title | `81` |
| `image` | string | `img` src or `data-src` | Thumbnail image URL | `"https://sta-reality2.1gr.cz/..."` |

### Pagination
- Page parameter: `?page={N}` (1-indexed)
- Total count extracted from text matching: `(\d[\d\s]*)\s*(?:nabidek|nemovitosti|inzeratu|vysledku)`
- Termination: 3 consecutive empty pages (`MAX_CONSECUTIVE_EMPTY`)
- Sequential only (concurrent fetching causes pagination drift)

---

## Detail Page Response (HTML parsed)

### Endpoint
```
https://reality.idnes.cz/detail/{transaction}/{type}/{location-slug}/{id}/
```

Example: `https://reality.idnes.cz/detail/prodej/byt/praha-3-jezkova/69a095f280ba5811c5001969/`

### Data Sources on Detail Page

The detail page has **three distinct data sources**, each providing different fields:

#### 1. dataLayer (JavaScript object in `<script>` tag)

Extracted via regex from inline `<script>` blocks containing `dataLayer`. Most reliable source for numeric/location data.

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `listing_price` | number | Price in CZK (no formatting) | `10900000` |
| `listing_area` | number | Area in sqm | `81` |
| `listing_lat` | number | Latitude (WGS84) | `50.0822127` |
| `listing_lon` | number | Longitude (WGS84) | `14.4463223` |
| `listing_localityCity` | string | City name | `"Praha"` |
| `listing_localityDistrict` | string | District name | `"Praha 3"` |
| `listing_localityRegion` | string | Region name | `"Hlavni mesto Praha"` |
| `listing_localityCityArea` | string | City area/neighborhood | `"Zizkov"` |

#### 2. HTML Elements (DOM selectors)

| Field | Type | Selector | Description | Example |
|-------|------|----------|-------------|---------|
| `title` | string | `h1.b-detail__title span` or `h1` | Full listing title | `"Prodej bytu 2+1 81 m\u00b2"` |
| `priceText` | string | `p.b-detail__price strong` | Formatted price text | `"10 900 000 Kc"` |
| `description` | string | `.b-desc p` or `.b-desc` | Property description text | (free-form Czech text) |
| `images[]` | string[] | `a[data-fancybox="images"]` href | Full-resolution image URLs | `["https://sta-reality2.1gr.cz/..."]` |
| `_inactive` | boolean | `.b-intro--sold` presence | Sold/removed listing flag | `true` if element exists |

#### 3. Attribute Table (`.b-definition-columns dl dt/dd` pairs)

Key-value pairs from the property parameters table. Keys are Czech labels (lowercase after extraction). Values are plain text or boolean (`"ano"` when `dd` contains `.icon--check`).

**Observed attribute keys (Czech label -> description):**

| Czech Key | Type | Description | Example Value |
|-----------|------|-------------|---------------|
| `cislo zakazky` | string | Portal reference number | `"IDNES-994043"` |
| `cena` | string | Price (duplicates priceText, includes mortgage link text) | `"10 900 000 Kc\n...Spocitat hypoteku"` |
| `konstrukce budovy` | string | Building construction type | `"cihlova"` (brick), `"panelova"` (panel) |
| `stav bytu` | string | Apartment condition | `"velmi dobry stav"`, `"novostavba"` |
| `stav budovy` | string | Building condition (alternative key) | `"velmi dobry stav"` |
| `stav objektu` | string | Object condition (alternative key) | `"dobry stav"` |
| `vlastnictvi` | string | Ownership type | `"osobni"` (personal), `"druzstevni"` (cooperative) |
| `lokalita objektu` | string | Location character | `"klidna cast"` (quiet area) |
| `uzitna plocha` | string | Usable area | `"81 m2"` |
| `plocha pozemku` | string | Plot area (houses/land) | `"450 m2"` |
| `podlazi` | string | Floor number | `"prizemi (1. NP)"`, `"3. patro (4. NP)"` |
| `pocet podlazi budovy` | string | Total building floors | `"2 podlazi"`, `"4 podlazi"` |
| `vybaveni` | string | Furnished status | `"nezarizeny"`, `"castecne zarizeny"`, `"zarizeny"` |
| `penb` | string | Energy performance certificate (PENB) | `"G (vyhl. c. 264/2020 Sb.)"`, `"B (vyhl. c. 264/2020 Sb.)"` |
| `balkon` | string | Balcony area | `"4 m2"` |
| `parkovani` | string | Parking info | `"parkovaci misto"` |
| `internet` | string/bool | Internet availability | `"ano"` |
| `topne teleso` | string | Heating type (alternative key) | `"ustredni topeni"` |
| `vytapeni` | string | Heating type | `"plyn"`, `"elektrina"` |
| `typ stavby` | string | Building type (alternative key) | `"cihlova"` |
| `kauce` | string | Deposit (rentals) | `"30 000 Kc"` |
| `vratna kauce` | string | Refundable deposit (alternative) | `"25 000 Kc"` |
| `jistina` | string | Security deposit (alternative) | `"20 000 Kc"` |
| `rok rekonstrukce` | string | Renovation year | `"2019"` |
| `k nastehavani` | string | Move-in date | `"01.03.2026"` |
| `dostupne od` | string | Available from (alternative) | `"ihned"` |

#### 4. Coordinate Fallback: MapTiler GeoJSON

If dataLayer coordinates are missing, the scraper checks `<script data-maptiler-json>` for GeoJSON features:

```json
{
  "geojson": {
    "features": [
      {
        "geometry": { "coordinates": [14.4463, 50.0822] },
        "properties": { "isSimilar": false }
      }
    ]
  }
}
```

The feature with `isSimilar: false` is the main listing's location. Coordinates are `[lon, lat]` (GeoJSON order).

---

## Internal Scraper Types

### IdnesListing (after detail enrichment)

Defined in `src/types/idnesTypes.ts`. This is the normalized intermediate type after HTML parsing:

| Field | Type | Source | Description |
|-------|------|--------|-------------|
| `id` | string | URL path (24-char hex or numeric) | Portal listing ID |
| `title` | string | `h1` text | Full title |
| `url` | string | Detail page URL | Absolute URL |
| `price` | number | dataLayer `listing_price` or parsed from priceText | Price in CZK |
| `priceText` | string | `p.b-detail__price strong` | Formatted price |
| `location.city` | string | dataLayer `listing_localityCity` | City |
| `location.district` | string | dataLayer `listing_localityDistrict` | District |
| `location.address` | string | Derived: `city - cityArea` | Address string |
| `area` | number | dataLayer `listing_area` | Area in sqm |
| `plotArea` | number | Parsed from `plocha pozemku` attr | Plot area (houses/land) |
| `rooms` | string | Extracted from title | Disposition string |
| `floor` | number | Parsed from `podlazi` attr | Floor number |
| `propertyType` | string | Category config | `apartment`, `house`, `land`, `commercial`, `recreation` |
| `transactionType` | string | Category config | `sale` or `rent` |
| `description` | string | `.b-desc` text | Full description |
| `images` | string[] | `a[data-fancybox="images"]` hrefs | Full-res image URLs |
| `features` | string[] | Detail page features list | Feature strings |
| `ownership` | string | `vlastnictvi` attr | Ownership type |
| `condition` | string | `stav bytu` / `stav budovy` / `stav objektu` attr | Condition |
| `furnished` | string | `vybaveni` attr | Furnished status |
| `energyRating` | string | `penb` attr | PENB energy class |
| `heatingType` | string | `topne teleso` / `vytapeni` attr | Heating type |
| `constructionType` | string | `konstrukce budovy` / `typ stavby` attr | Construction type |
| `coordinates.lat` | number | dataLayer `listing_lat` or MapTiler | Latitude |
| `coordinates.lng` | number | dataLayer `listing_lon` or MapTiler | Longitude |
| `_attributes` | Record<string, string> | All dt/dd pairs from attribute table | Raw attributes dict |
| `metadata.published` | string | Not reliably available | Published date |
| `metadata.updated` | string | Not reliably available | Updated date |
| `realtor.name` | string | Not extracted in current scraper | Agent name |
| `realtor.phone` | string | Not extracted in current scraper | Agent phone |
| `realtor.email` | string | Not extracted in current scraper | Agent email |

---

## Categories Scraped

| Name | URL Path | Transaction | Property Type |
|------|----------|-------------|---------------|
| Flats for Sale | `/s/prodej/byty/` | sale | apartment |
| Flats for Rent | `/s/pronajem/byty/` | rent | apartment |
| Houses for Sale | `/s/prodej/domy/` | sale | house |
| Houses for Rent | `/s/pronajem/domy/` | rent | house |
| Land for Sale | `/s/prodej/pozemky/` | sale | land |
| Land for Rent | `/s/pronajem/pozemky/` | rent | land |
| Commercial for Sale | `/s/prodej/komercni-nemovitosti/` | sale | commercial |
| Commercial for Rent | `/s/pronajem/komercni-nemovitosti/` | rent | commercial |
| Recreation for Sale | `/s/prodej/chaty-chalupy/` | sale | recreation (mapped to house) |

---

## Mapping Status

### Listing Page Fields -> StandardProperty

| Raw Field | StandardProperty Target | Notes |
|-----------|------------------------|-------|
| `title` | `title` | Direct, includes disposition + area |
| `url` | `source_url` | Prefixed with domain if relative |
| `price` (text) | -- | Not used from listing page (detail page has numeric) |
| `location` (text) | -- | Not used from listing page (detail has structured) |
| `id` | `portal_id` | Prefixed as `idnes-{id}` |
| `area` (from title) | -- | Overridden by detail page `listing_area` |

### Detail Page Fields -> StandardProperty

| Raw Field | StandardProperty Target | Transformer | Notes |
|-----------|------------------------|-------------|-------|
| `title` (h1) | `title` | All | Direct |
| `listing_price` (dataLayer) | `price` | All | Numeric, fallback to parsed priceText |
| `listing_area` (dataLayer) | `details.sqm` (apartment), `sqm_living` (house), `sqm_total` (commercial), `area_plot_sqm` (land) | Per-category | Primary area metric |
| `listing_lat` (dataLayer) | `location.coordinates.lat` | All | WGS84 |
| `listing_lon` (dataLayer) | `location.coordinates.lon` | All | WGS84, note: stored as `lng` internally |
| `listing_localityCity` (dataLayer) | `location.city` | All | Direct |
| `listing_localityDistrict` (dataLayer) | `location.region` | All | Mapped to region field |
| `listing_localityRegion` (dataLayer) | -- | -- | **NOT MAPPED** (lost -- only district used for region) |
| `listing_localityCityArea` (dataLayer) | `location.address` | All | Combined as `city - cityArea` |
| `priceText` | -- | -- | Fallback for price parsing only |
| `description` | `description` | All | Direct |
| `images[]` | `media.images`, `images` | All | Direct, first image = main |
| `vlastnictvi` attr | `ownership` (land only) | Land | Other categories don't map it |
| `stav bytu/budovy/objektu` attr | `condition` | Apartment, House, Commercial | Via `normalizeCondition()` |
| `vybaveni` attr | `furnished` | Apartment, House | Via `normalizeFurnished()` |
| `penb` attr | `energy_class` | Apartment, House | Via `normalizeEnergyRating()` |
| `topne teleso/vytapeni` attr | `heating_type` | Apartment, House, Commercial | Via `normalizeHeatingType()` |
| `konstrukce budovy/typ stavby` attr | `construction_type` | Apartment, House | Via `normalizeConstructionType()` |
| `podlazi` attr | `floor` | Apartment | Parsed: `prizemi`=0, else first digit |
| `plocha pozemku` attr | `sqm_plot` | House | Parsed numeric from text |
| `uzitna plocha` attr | `sqm_living` (house fallback) | House | Fallback if `listing_area` missing |
| `pocet podlazi` attr | `stories` (house) | House | Via `extractAreaFromAttrs` |
| `kauce/vratna kauce/jistina` attr | `deposit` | Apartment, House | Parsed numeric |
| `rok rekonstrukce` attr | `renovation_year` | Apartment, House | Parsed 4-digit year |
| `k nastehavani/dostupne od/volne od` attr | `available_from` | Apartment, House, Land | Czech date DD.MM.YYYY -> ISO |
| `balkon` attr | -- | -- | **NOT MAPPED** (area value lost, only boolean from features) |
| `parkovani` attr | -- | -- | **NOT MAPPED** (text value lost, only boolean from features) |
| `internet` attr | -- | -- | **NOT MAPPED** |
| `lokalita objektu` attr | -- | -- | **NOT MAPPED** (quiet/busy street info) |
| `cislo zakazky` attr | -- | -- | **NOT MAPPED** (portal reference number) |
| `pocet podlazi budovy` attr | -- | -- | **NOT MAPPED** to apartment `total_floors` |
| `cena` attr | -- | -- | Duplicate of price, not used |
| `metadata.published` | `published_date` | All | Rarely available from HTML |
| `metadata.updated` | -- | -- | **NOT MAPPED** |
| `realtor.*` | -- | -- | **NOT MAPPED** (not extracted by scraper) |
| `features[]` | `features` | All | Direct pass-through, also parsed by `parseCzechFeatures()` for boolean amenities |
| Category (from URL) | `property_category` | Router | `detectPropertyCategory()` uses `propertyType` + title keywords |
| Transaction (from URL) | `transaction_type` | All | `sale` or `rent` |

### Checksum Fields

Fields used for change detection (re-fetch triggers):
- `price` -> `listing.price`
- `title` -> `listing.title`
- `description` -> `listing.description`
- `sqm` -> `listing.area`
- `disposition` -> `listing.rooms`
- `floor` -> `listing.floor`

### Unmapped Fields (data loss)

| Field | Available In | Why Lost | Potential Target |
|-------|-------------|----------|------------------|
| `listing_localityRegion` | dataLayer | Only `district` mapped to `location.region` | `location.region` (should be region, not district) |
| `pocet podlazi budovy` | Attributes | Not extracted for apartments | `details.total_floors` |
| `balkon` (area) | Attributes | Only boolean `has_balcony` from features | `country_specific.area_balcony` |
| `parkovani` (text) | Attributes | Only boolean `has_parking` from features | `details.parking_spaces` or `country_specific` |
| `internet` | Attributes | Not mapped | `country_specific` or `amenities` |
| `lokalita objektu` | Attributes | Not mapped | `country_specific.street_exposure` |
| `cislo zakazky` | Attributes | Not mapped | `portal_metadata` |
| `realtor` (name/phone/email) | Detail HTML | Not extracted by current scraper | `agent.name`, `agent.phone`, `agent.email` |
| `metadata.updated` | Detail HTML | Not extracted | `portal_metadata` |

### Hard-coded / Default Values

| Field | Value | Notes |
|-------|-------|-------|
| `currency` | `"CZK"` | Always CZK |
| `location.country` | `"Czech Republic"` | Always Czech Republic |
| `source_platform` | `"idnes-reality"` | Fixed |
| `status` | `"active"` | Always active on ingest |
| `bathrooms` | `1` | Hard-coded default (apartment, house) |
| `has_pool` | `false` | Hard-coded (house) |
| `has_fireplace` | `false` | Hard-coded (house) |
| `has_bathrooms` | `false` | Hard-coded (commercial) |
| `bedrooms` | `1` (fallback) | Default if rooms parsing fails |
| `price` | `0` (fallback) | Default if missing -- should be `null` |
| `sqm` / `sqm_living` / `sqm_total` / `area_plot_sqm` | `0` (fallback) | Default if missing -- should be `null` |
