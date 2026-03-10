# iDNES Reality - Portal Data Format

## Data Source

**Type**: HTML scraping (fetch + Cheerio)

### Discovery Pages
```
GET https://reality.idnes.cz/s/prodej/byty/       (Flats for sale)
GET https://reality.idnes.cz/s/pronajem/byty/      (Flats for rent)
GET https://reality.idnes.cz/s/prodej/domy/         (Houses for sale)
GET https://reality.idnes.cz/s/pronajem/domy/       (Houses for rent)
GET https://reality.idnes.cz/s/prodej/pozemky/      (Land for sale)
GET https://reality.idnes.cz/s/prodej/komercni/     (Commercial for sale)
GET https://reality.idnes.cz/s/pronajem/komercni/   (Commercial for rent)
GET https://reality.idnes.cz/s/prodej/rekreacni/    (Recreation for sale)
```

### Detail Pages
```
GET https://reality.idnes.cz/detail/{id}/
```

## HTML Structure

### Listing Page Selectors
The scraper tries multiple selectors for listing items:
- `.c-products__item`
- `.estate-item`
- `[data-dot="hp_product"]`
- `.property-item`

### Fields Extracted from List Page

| Element | Selector | Extracted Field | Notes |
|---------|----------|-----------------|-------|
| Title | `.c-products__title, h2, .title` | `title` | First match |
| Link | `a.c-products__link, a[href*="/detail/"]` | `url` | Absolute URL constructed |
| Price | `.c-products__price, .price` | `priceText`, `price` | Price parsed from text |
| Location | `.c-products__info, .location` | `location.city` | Raw text |
| Image | `img` (first) | `images[0]` | `src` or `data-src` |
| Area | Title regex `(\d+)\s*m2` | `area` | Parsed from title text |
| ID | URL regex `/([a-f0-9]{24})` or `data-id` attr | `id` | 24-char hex or numeric |

### Detail Page Selectors

| Element | Selector | Extracted Field |
|---------|----------|-----------------|
| Title | `h1, .detail-title` | `title` |
| Price | `.price, .detail-price, .c-detail__price` | `priceText` |
| Description | `.description, .detail-description, .c-detail__description` | `description` |
| Features | `.features li, .detail-features li, [data-test="amenity"]` | `features[]` |
| Images | `.gallery img, .detail-gallery img, [data-test="image"], .c-gallery img` | `images[]` |
| Attributes | `[data-test="parameter-row"], .parameter, .property-params tr, .c-detail__params tr` | `_attributes{}` |

### Coordinate Extraction (Detail Pages)

Coordinates are extracted from multiple sources in priority order:
1. **Script tags**: Regex for `lat`/`lng` variable assignments or object notation
2. **Data attributes**: `[data-latitude]`, `[data-lat]` on map elements
3. **Meta tags**: `og:latitude`/`og:longitude` or `geo:latitude`/`geo:longitude`

## Internal Type: `IdnesListing`

```typescript
interface IdnesListing {
  id: string;
  title: string;
  url: string;
  price?: number;
  priceText?: string;
  location?: { city?: string; district?: string; address?: string };
  area?: number;
  plotArea?: number;
  rooms?: string;
  floor?: number;
  propertyType?: string;    // Set by scraper: 'apartment'|'house'|'land'|'commercial'|'recreation'
  transactionType?: string; // Set by scraper: 'sale'|'rent'
  description?: string;
  images?: string[];
  features?: string[];
  ownership?: string;       // From detail page attributes
  condition?: string;       // From detail page attributes
  furnished?: string;       // From detail page attributes
  energyRating?: string;    // From detail page attributes
  heatingType?: string;     // From detail page attributes
  constructionType?: string;// From detail page attributes
  coordinates?: { lat: number; lng: number };
  realtor?: { name?: string; phone?: string; email?: string };
  metadata?: { views?: number; published?: string; updated?: string };
  _attributes?: Record<string, string>; // Raw key-value pairs from detail page
}
```

## Data Peculiarities

### Missing Data Patterns
- `area` is parsed from the title text, not a dedicated field -- may be missing if title lacks "X m2"
- `plotArea` is rarely available from list pages
- `rooms` is not reliably extracted from list pages
- `coordinates` only available from detail pages (requires `FETCH_DETAILS=true`)
- `ownership`, `condition`, `furnished`, `heatingType`, `constructionType` only from detail pages

### Format Inconsistencies
- Prices may include "Kc" suffix or use space-separated thousands
- Floor text varies: "prizemni" (ground floor), "3. podlazi", "3. patro"
- IDs can be 24-char hex strings or numeric strings depending on listing age

### Attribute Key Variations
The same property attribute may appear under different Czech labels:
- Floor: `podlazi` or `patro` or `floor`
- Ownership: `vlastnictvi` or `typ vlastnictvi`
- Condition: `stav objektu` or `stav`
- Furnished: `vybaveni` or `vybaveno`
- Energy: `penb` or `trida penb` or `energeticka trida`
- Heating: `vytapeni` or `topeni`
- Construction: `typ stavby` or `stavba`
