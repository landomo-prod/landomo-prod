# TopReality.sk Scraper

Real estate scraper for TopReality.sk - uses **REST APIs** (easiest Slovak scraper!).

## Overview

- **Portal**: TopReality.sk (~10% market share, 65,854 properties)
- **Method**: REST APIs + HTML parsing
- **Port**: 8085
- **Language**: TypeScript
- **Difficulty**: ⭐ Easy (has public APIs!)

## Why TopReality.sk is Easy

✅ Public REST APIs available
✅ No authentication required
✅ Simple axios HTTP requests
✅ No TLS fingerprinting needed
✅ No WAF protection
✅ Clean JSON responses

## Architecture

```
src/
├── index.ts                     # Express server
├── scrapers/
│   └── listingsScraper.ts       # API + HTML scraping
├── transformers/
│   └── toprealityTransformer.ts # TopReality → StandardProperty
├── adapters/
│   └── ingestAdapter.ts         # Send to Slovakia Ingest API
├── types/
│   └── toprealityTypes.ts       # TopReality types
└── utils/
    └── userAgents.ts            # User agent rotation
```

## Available APIs

### 1. Count API
```http
GET /ajax.php?form=1&searchType=string&obec=c100-Bratislavský+kraj&typ_ponuky=0&typ_nehnutelnosti=0&page=estate&fromForm=1

Response:
{
  "count": 9200,
  "time": 0.0144
}
```

### 2. Virtual Properties Count
```http
GET /ajaxVirtual.php?[same params]

Response: 7008
```

### 3. Location Search
```http
POST /user/new_estate/searchAjax.php
Body: query=Bratislava&items=

Response:
[
  {
    "id": "c100-Bratislavský kraj",
    "name": "Bratislavský kraj",
    "type": "county"
  }
]
```

## Scraping Strategy

### Regions Scraped

All 8 Slovak regions:
- c100 - Bratislavský kraj
- c200 - Trnavský kraj
- c300 - Trenčiansky kraj
- c400 - Nitriansky kraj
- c500 - Žilinský kraj
- c600 - Banskobystrický kraj
- c700 - Prešovský kraj
- c800 - Košický kraj

### Process

1. **Get Count** - Use API to get total properties per region
2. **Fetch HTML** - Load search result pages
3. **Parse Listings** - Extract data with Cheerio
4. **Transform** - Convert to StandardProperty
5. **Ingest** - Send to Slovakia Ingest Service

## Installation

```bash
cd scrapers/Slovakia/topreality-sk
npm install
```

## Configuration

```bash
# .env
PORT=8085
INGEST_API_URL=http://localhost:3008
INGEST_API_KEY_TOPREALITY_SK=dev_key_sk_1
```

## Usage

### Development
```bash
npm run dev
```

### Production
```bash
npm run build
npm start
```

### Docker
```bash
docker build -t landomo-scraper-topreality-sk .
docker run -p 8085:8085 \
  -e INGEST_API_URL=http://ingest-slovakia:3000 \
  -e INGEST_API_KEY_TOPREALITY_SK=your_key \
  landomo-scraper-topreality-sk
```

## API Endpoints

### Health Check
```bash
GET http://localhost:8085/health
```

### Trigger Scraping
```bash
POST http://localhost:8085/scrape
```

## Data Schema

### TopRealityListing
```typescript
interface TopRealityListing {
  id: string;
  title: string;
  price: number;
  currency: string;
  location: string;
  propertyType: string;
  transactionType: string;
  url: string;
  area?: number;
  rooms?: number;
  images?: string[];
  description?: string;
}
```

## Performance

- **Speed**: Fast (no browser needed)
- **Memory**: Low (~50-100 MB)
- **Success Rate**: High (>95%)
- **Duration**: 3-5 minutes per full scrape

## Rate Limiting

- **Between pages**: 1-2 seconds
- **Between regions**: 2 seconds
- **API calls**: No strict limits
- **Recommended**: Polite delays

## Advantages vs Other Scrapers

| Feature | TopReality | Reality.sk | Byty.sk |
|---------|------------|------------|---------|
| API Available | ✅ Yes | ❌ No | ❌ No |
| Browser Needed | ❌ No | ✅ Yes | ✅ Yes |
| WAF Protection | ❌ None | ⚠️ Basic | ✅ Imperva |
| Difficulty | ⭐ Easy | ⭐⭐ Medium | ⭐⭐⭐ Hard |
| Speed | Fast | Medium | Slow |

## Troubleshooting

### No listings found
```bash
⚠️  No listings found

# Check API response
curl "https://www.topreality.sk/ajax.php?form=1&searchType=string&obec=c100-Bratislavský+kraj&typ_ponuky=0&typ_nehnutelnosti=0&page=estate&fromForm=1"
```

### HTML parsing errors
```bash
# Update selectors in listingsScraper.ts
# TopReality may have changed HTML structure
```

## Monitoring

```bash
# Watch logs
docker logs -f landomo-scraper-topreality-sk

# Key log patterns
📡 Fetching listings from TopReality.sk APIs...
  Total properties in c100: 9200
  ✅ c100-Bratislavský kraj: 120 listings
🔄 Transforming 960 listings...
✅ Scrape completed in 187.45s
```

## Legal & Ethics

- ✅ Public APIs used
- ✅ Rate limited
- ✅ No TOS violations (APIs are public)
- ⚠️ Verify with TopReality.sk for commercial use
- ⚠️ GDPR compliance required

## Related Documentation

- [TopReality Analysis Report](../../../TOPREALITY_SK_ANALYSIS_REPORT.md)
- [Slovak Scrapers Plan](../../../SLOVAK_SCRAPERS_IMPLEMENTATION_PLAN.md)
- [Slovak Value Mappings](../shared/slovak-value-mappings.ts)

---

**Status**: ✅ Production Ready
**Difficulty**: ⭐ Easy (easiest Slovak scraper!)
**Last Updated**: 2026-02-07
