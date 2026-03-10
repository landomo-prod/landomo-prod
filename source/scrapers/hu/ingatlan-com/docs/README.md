# Ingatlan.com Scraper

## Overview
- **Portal**: Ingatlan.com
- **URL**: https://ingatlan.com
- **Country**: Hungary
- **Categories**: Apartment, House, Land, Commercial
- **Data Source**: HTML with JSON-LD structured data
- **Anti-bot**: CycleTLS (browser TLS fingerprinting)

## Quick Stats
- **Active Listings**: ~50,000+ (estimated)
- **Scrape Frequency**: Configurable via maxRegions/maxPages
- **Technology**: TypeScript/Express with Cheerio HTML parsing
- **Regional Concurrency**: 10 regions in parallel

## Data Flow
Portal → HTML Parsing (Cheerio) → Listing Extraction → Transformation → Ingestion API

## Key Features
- **All-in-One Discovery**: All property data available on listing pages; no separate detail endpoint needed
- **CycleTLS Protection Bypass**: Browser TLS fingerprinting to handle Cloudflare anti-bot
- **Parallel Region Scanning**: 10 regions processed simultaneously for efficiency
- **Comprehensive Regional Coverage**: 34+ regions including all major cities and counties

## Key Files
- `src/index.ts` - Express server and orchestrator
- `src/scrapers/listingsScraper.ts` - HTML parsing and listing extraction
- `src/transformers/ingatlanTransformer.ts` - Portal format to StandardProperty conversion
- `src/adapters/ingestAdapter.ts` - Ingest API communication

## Technical Details

### Discovery Method
- Searches for sale listings via URL: `https://ingatlan.com/lista/elado+lakas+{location}`
- Uses Cheerio to parse HTML and extract listing cards
- Multiple CSS selectors tried to account for page structure variations
- Pagination detection via next page links

### Regions Covered
- **Major Cities (10)**: Budapest, Debrecen, Szeged, Miskolc, Pécs, Győr, Nyíregyháza, Kecskemét, Székesfehérvár, Szombathely
- **Regional Capitals (14)**: Eger, Veszprém, Tatabánya, Sopron, Kaposvár, Zalaegerszeg, Szolnok, Érd, Dunaújváros, Hódmezővásárhely, Szekszárd, Salgótarján, Nagykanizsa, Békéscsaba
- **County Regions (10)**: Pest, Bács-Kiskun, Baranya, Borsod-Abaúj-Zemplén, Csongrád-Csanád, Fejér, Győr-Moson-Sopron, Hajdú-Bihar, Heves, Jász-Nagykun-Szolnok, Komárom-Esztergom, Nógrád, Somogy, Szabolcs-Szatmár-Bereg, Tolna, Vas, Veszprém, Zala

### Extraction Method
- Parses HTML with Cheerio
- Searches for standard listing card selectors (.listing, .listing-card, .results__item, etc.)
- Extracts price, location, property type, area, rooms from card elements
- Falls back to multiple selector strategies if primary fails

### Transaction Types
- Primary focus: Sale (elado) listings
- Extensible to rental (kiado) via URL parameter modification

## Configuration
```bash
# Port (default 8086)
PORT=8086

# Region concurrency (default 10)
REGION_CONCURRENCY=10

# Ingest API (shared config)
INGEST_API_URL=http://localhost:3004
INGEST_API_KEY_INGATLAN_COM=dev_key_hu_1
```

## API Endpoints
- `GET /health` - Health check with scraper info
- `POST /scrape` - Start scraping (optional: `maxRegions`, `maxPages`)
  ```json
  {
    "maxRegions": 10,
    "maxPages": 5
  }
  ```

## Known Limitations
- HTML structure may change frequently; selector robustness is critical
- Limited detailed property information from listing cards (no amenities, condition, heating)
- Agent/company information not always available on listing pages
- Images limited to what's displayed on listing card
- No separate detail pages accessible via standard HTML scraping (API responses required for full data)

## Performance Notes
- Estimated 20-30 minutes for full Hungary scrape (all regions, multiple pages per region)
- Regional parallelization (10 at a time) provides good throughput
- Cheerio parsing is fast; HTTP requests are the bottleneck
- CycleTLS adds minor overhead but is necessary for Cloudflare bypass

## Notes
- Ingatlan.com frequently updates page structure; CSS selectors may need periodic adjustment
- Portal enforces rate limiting; 1-2 second delays between pages help manage requests
- No checksum support currently implemented (optimization opportunity)
- Listing data completeness varies by region and agent
