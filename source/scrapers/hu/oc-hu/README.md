# OC.hu (Otthon Centrum) Scraper

Scraper for **Otthon Centrum** (oc.hu), Hungary's #1 real estate portal by traffic with 30-35% market share.

## Overview

- **Portal**: Otthon Centrum (oc.hu)
- **Country**: Hungary
- **Market Position**: #1 by traffic (30-35% market share)
- **Port**: 8088
- **Ingest API**: ingest-hungary (port 3009)

## Features

- **DataLayer extraction** from server-rendered HTML (fast, reliable)
- CycleTLS + Cheerio for anti-bot bypass
- Support for apartments, houses, land, commercial properties
- Automatic transformation to standard schema
- Multi-page scraping with deduplication
- Hungarian value mapping (disposition, ownership, condition, etc.)
- ~12 properties per page extraction

## Installation

```bash
cd /Users/samuelseidel/Development/landomo-world/scrapers/Hungary/oc-hu
npm install
npm run build
```

## Usage

### Start the scraper service

```bash
npm start
```

### Health check

```bash
curl http://localhost:8088/health
```

### Trigger a scrape

```bash
# Scrape all regions, 5 pages each (default)
curl -X POST http://localhost:8088/scrape

# Scrape 3 regions, 2 pages each
curl -X POST http://localhost:8088/scrape \
  -H "Content-Type: application/json" \
  -d '{"maxRegions": 3, "maxPages": 2}'
```

## Architecture

```
src/
├── index.ts                    # Express server (port 8088)
├── scrapers/
│   └── listingsScraper.ts     # Web scraping logic
├── transformers/
│   └── ocTransformer.ts       # OC.hu → StandardProperty
├── adapters/
│   └── ingestAdapter.ts       # Send to ingest-hungary API
├── types/
│   └── ocTypes.ts             # OC.hu-specific types
├── utils/
│   └── userAgents.ts          # Random user agent rotation
└── shared/                     # Symlink to ../ingatlan-com/src/shared
    └── hungarian-value-mappings.ts
```

## Scraped Data (from DataLayer)

- ✅ Property ID (item_id)
- ✅ Title (item_name, defaults to ID)
- ✅ Price (price)
- ✅ Currency (currency)
- ✅ Location - City (location_city)
- ✅ Location - District (location_district)
- ✅ Street (location_street, when available)
- ✅ Property type (real_estate_type)
- ✅ Transaction type (type_of_sale)
- ✅ Area in m² (size)
- ❌ Room count (not in dataLayer)
- ❌ Images (not in dataLayer)
- ❌ Description (not in dataLayer)
- ❌ Agent information (not in dataLayer)

**Note:** For full property details, would need to scrape individual property pages.

## Hungarian-Specific Fields

Uses shared Hungarian value mappings from `ingatlan-com`:

- **Disposition**: 1-szobás, 2-szobás, garzonlakás, etc.
- **Ownership**: tulajdon, társasházi, szövetkezeti
- **Condition**: újépítésű, újszerű, felújított, etc.
- **Heating**: központi, gázfűtés, távfűtés, etc.
- **Construction**: panel, tégla, vasbeton, etc.

## Environment Variables

```bash
PORT=8088
INGEST_API_URL=http://localhost:3009
INGEST_API_KEY_OC_HU=dev_key_hu_1
```

## Docker

```bash
docker build -t landomo/scraper-oc-hu .
docker run -p 8088:8088 landomo/scraper-oc-hu
```

## Regions Scraped

Default regions (major Hungarian cities):
- Budapest
- Debrecen
- Szeged
- Miskolc
- Pécs
- Győr
- Nyíregyháza
- Kecskemét
- Székesfehérvár
- Szombathely

## Technical Approach

### DataLayer Extraction Method

OC.hu embeds property data in `window.dataLayer.push()` for Google Analytics:

```javascript
window.dataLayer.push({
  event: "view_item_list",
  ecommerce: {
    items: [
      {
        item_id: "H513456",
        real_estate_type: "lakás",
        type_of_sale: "használt eladó",
        size: 62,
        price: 85500000,
        currency: "HUF",
        location_city: "Budapest XVII. kerület",
        location_district: "Felső-Rákoshegy"
      },
      // ... 11 more items per page
    ]
  }
});
```

**Extraction Process:**
1. Fetch HTML with CycleTLS (bypasses anti-bot detection)
2. Parse HTML with Cheerio
3. Extract `<script>` tag containing `window.dataLayer.push()`
4. Parse JavaScript object to extract `ecommerce.items` array
5. Map to OcListing type

**Advantages:**
- Fast: ~2-3 seconds per page (vs 10+ seconds with Playwright)
- Reliable: Server-rendered data (not dependent on JavaScript execution)
- Complete: All listing data in structured format
- Scalable: Can scrape hundreds of pages efficiently

**Limitations:**
- Limited to basic listing data (12 properties × basic fields per page)
- No images, descriptions, or agent info in DataLayer
- Can't use region-specific URLs with CycleTLS (HTTP 0 error)
- For full details, would need to scrape individual property pages

**URL Compatibility:**
- ✅ Works: `https://oc.hu/ingatlanok/lista/ertekesites:elado`
- ✅ Works: `https://oc.hu/ingatlanok/lista/ertekesites:elado?page=2`
- ❌ Fails: `/ertekesites:elado/helyseg:budapest` (CycleTLS HTTP 0)
- ❌ Fails: `/ertekesites:elado/tipus:lakas/helyseg:budapest` (CycleTLS HTTP 0)

**Workaround:** Scrape all listings from basic URL, deduplicate by ID.

## Notes

- Property IDs follow pattern: H######, UZ######, DLK######, DTK######, etc.
- Extracts ~12 properties per page from dataLayer
- Respects rate limiting with 2-3 second delays between pages
- Uses CycleTLS with Chrome browser profile
- Deduplicates listings by unique ID

## Development

```bash
# Run in development mode
npm run dev

# Build TypeScript
npm run build

# Clean build artifacts
npm run clean
```
