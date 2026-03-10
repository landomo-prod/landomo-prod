# CeskeReality - Portal Data Format

## Data Source

**Type**: Hybrid (JSON-LD structured data + HTML scraping)

### Discovery (Listing Pages)

Category-specific listing URLs with query-param pagination:

| Category | URL |
|----------|-----|
| Apartments | `https://www.ceskereality.cz/prodej/byty/` |
| Houses | `https://www.ceskereality.cz/prodej/rodinne-domy/` |
| Land | `https://www.ceskereality.cz/prodej/pozemky/` |
| Commercial | `https://www.ceskereality.cz/prodej/komercni/` |

Pagination: `?strana={page_number}` (page 1 has no param)

Listing links are found via CSS selector: `a[href*="/prodej/"][href$=".html"]`

### Detail Pages

Each listing has a detail page URL ending in `.html`. Data is extracted from two sources:

1. **JSON-LD** (`<script type="application/ld+json">`) - primary structured data
2. **HTML elements** - supplementary property details

## JSON-LD Structure

```json
{
  "@context": "https://schema.org",
  "@type": "Product",
  "additionalType": "...",
  "name": "Prodej bytu 2+kk 46 m2, Praha 5",
  "description": "Nabizime k prodeji byt 2+kk o celkove plose 46 m2...",
  "image": "https://img.ceskereality.cz/foto/12345/main.jpg",
  "offers": {
    "@type": "Offer",
    "price": 3500000,
    "priceCurrency": "CZK",
    "areaServed": {
      "address": {
        "addressLocality": "Praha 5",
        "addressRegion": "Hlavni mesto Praha",
        "streetAddress": "Radlicka 123",
        "postalCode": "15000"
      }
    },
    "offeredby": {
      "name": "RE/MAX Reality",
      "telephone": "+420 123 456 789"
    }
  }
}
```

### JSON-LD Fields

| Field | Type | Always Present | Example | Notes |
|-------|------|----------------|---------|-------|
| `name` | string | Usually | `"Prodej bytu 2+kk 46 m2"` | Contains disposition and area |
| `description` | string | Usually | Full Czech text | Contains feature keywords |
| `image` | string | Sometimes | URL | Single image only |
| `offers.price` | number | Usually | `3500000` | Numeric, no formatting |
| `offers.priceCurrency` | string | Usually | `"CZK"` | Always CZK |
| `offers.areaServed.address.addressLocality` | string | Usually | `"Praha 5"` | City/district |
| `offers.areaServed.address.addressRegion` | string | Sometimes | `"Hlavni mesto Praha"` | Region |
| `offers.areaServed.address.streetAddress` | string | Sometimes | `"Radlicka 123"` | Street |
| `offers.areaServed.address.postalCode` | string | Sometimes | `"15000"` | Postal code |
| `offers.offeredby.name` | string | Sometimes | `"RE/MAX Reality"` | Agent/agency name |
| `offers.offeredby.telephone` | string | Sometimes | `"+420 123 456 789"` | Agent phone |

## HTML Data Sources

### Property Details Table

Extracted from `.i-info` elements with `.i-info__title` (label) and `.i-info__value` (value).

Common Czech labels and their meanings:

| Czech Label | Meaning | Example Value |
|-------------|---------|---------------|
| Patro / Podlazi | Floor | `"2."`, `"prizemni"` |
| Pocet podlazi | Total floors | `"5"` |
| Celkova plocha / Plocha | Total area | `"46 m2"`, `"2 510 m2"` |
| Plocha obytna | Living area | `"38 m2"` |
| Plocha uzitna | Usable area | `"42 m2"` |
| Plocha pozemku / Pozemek | Plot area | `"850 m2"` |
| Balkon / Balkon | Balcony area | `"5 m2"` |
| Sklep | Cellar area | `"3 m2"` |
| Terasa | Terrace area | `"12 m2"` |
| Lodzie / Loggie | Loggia area | `"4 m2"` |
| Konstrukce / Typ stavby | Construction type | `"panel"`, `"cihla"`, `"zdena"` |
| Stav | Condition | `"novostavba"`, `"po rekonstrukci"` |
| Rok vystavby | Year built | `"1985"` |
| Energeticka trida / PENB | Energy class | `"C"` |
| Vlastnictvi | Ownership | `"osobni"`, `"druzstevni"` |
| ID nemovitosti | Property ID | `"CR-12345"` |
| Topeni / Vytapeni | Heating | `"ustredni"`, `"plynove"` |
| Voda | Water | `"verejny vodovod"` |
| Kanalizace | Sewage | `"verejna kanalizace"` |
| Elektrina | Electricity | `"230V"` |
| Plyn | Gas | `"ano"` |
| Parkovani | Parking | `"vlastni parkovaci stani"` |
| Pocet pokoju | Number of rooms | `"3"` |
| Koupelna / WC | Bathrooms | `"1"` |
| Garaz | Garage | `"1"` |
| Vybaveni / Zarizeni | Furnished | `"ano"`, `"castecne"` |
| Datum vlozeni | Published date | `"15.1.2025"` |
| Poplatek / Mesicni naklady | HOA / monthly fees | `"3 500 Kc"` |
| Dostupne od / Volne od | Available from | `"ihned"`, `"1.3.2025"` |
| Kauce / Jistota | Deposit | `"70 000 Kc"` |

### Images

Extracted via CSS selector: `img[src*="img.ceskereality.cz/foto"]`

- Filters out logos, icons, and agent photos (`logo`, `icon`, `makleri`)
- Strips query parameters to get full-resolution URLs
- Deduplicates by URL

### Energy Rating

Extracted from `.s-estate-detail-intro__energy` element. Parsed for letter grade A-G.

## Data Peculiarities

### Missing Data Patterns
- JSON-LD `name` field encodes disposition and area (e.g., `"Prodej bytu 2+kk 46 m2"`) - must be regex-parsed
- JSON-LD only provides a single image; HTML gallery has the full set
- Some listings lack JSON-LD entirely and are skipped
- Property details table labels vary in wording across listings

### Format Inconsistencies
- Areas use both `m2` and `m²` notation, sometimes with spaces in numbers (`"2 510 m²"`)
- Floor values may be `"prizemni"` (ground floor), `"sutere"` (basement), or numeric
- Condition values have many Czech synonyms for the same state
- Construction type labels vary (`"cihla"`, `"cihlova"`, `"zdena"` all mean brick)

### Edge Cases
- The `offeredby` field in JSON-LD uses lowercase `b` (not `offeredBy`)
- Price may be 0 or missing for "price on request" listings
- Plot size for houses may be in description text rather than structured data
