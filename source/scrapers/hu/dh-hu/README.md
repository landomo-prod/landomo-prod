# Duna House (dh.hu) Scraper

Scraper for **dh.hu**, Hungary's #2 real estate portal by traffic (25-30% market share).

## Portal Information

- **Name**: Duna House
- **Website**: https://dh.hu
- **Country**: Hungary
- **Market Share**: 25-30%
- **Rank**: #2
- **Property Types**: Apartments, Houses, Commercial, Land
- **Transaction Types**: Sale, Rent

## Features

- Scrapes all major Hungarian cities and regions
- Extracts comprehensive property data including:
  - Basic info (price, location, size, rooms)
  - Hungarian-specific fields (disposition, ownership type)
  - Property features (balcony, parking, elevator, etc.)
  - Agent information
  - Multiple images
- Transforms to standardized Landomo format
- Sends to ingest-hungary API (port 3009)
- Handles both JSON data extraction and HTML fallback parsing

## Architecture

```
src/
├── index.ts                     # Express server (port 8089)
├── scrapers/
│   └── listingsScraper.ts      # Main scraping logic
├── transformers/
│   └── dhTransformer.ts        # Transform to StandardProperty
├── adapters/
│   └── ingestAdapter.ts        # Send to ingest API (port 3009)
├── types/
│   └── dhTypes.ts              # DH-specific type definitions
├── utils/
│   └── userAgents.ts           # User agent rotation
└── shared/
    └── hungarian-value-mappings.ts  # Canonical Hungarian mappings
```

## Usage

### Development
```bash
npm install
npm run dev
```

### Production
```bash
npm run build
npm start
```

### Docker
```bash
docker build -t landomo/scraper-dh-hu .
docker run -p 8089:8089 landomo/scraper-dh-hu
```

## API Endpoints

### Health Check
```bash
GET http://localhost:8089/health
```

### Trigger Scrape
```bash
POST http://localhost:8089/scrape
Content-Type: application/json

{
  "maxRegions": 3,    # Optional: limit number of regions (default: all)
  "maxPages": 2       # Optional: pages per region (default: 5)
}
```

Returns 202 Accepted immediately and starts scraping in background.

## Configuration

Environment variables:
- `PORT`: Server port (default: 8089)
- `INGEST_API_URL`: Ingest service URL (default: http://localhost:3009)
- `INGEST_API_KEY_DH_HU`: API key for ingest service

## Scraping Strategy

1. **URL Pattern**: `https://dh.hu/{elado|kiado}-ingatlan/lakas-haz/{region}?page={n}`
2. **Data Extraction**:
   - Primary: Extract from embedded JSON cache objects (propertiesCache)
   - Fallback: HTML parsing with Cheerio
3. **Rate Limiting**: 2-4 second delays between pages
4. **Regions Covered**: Top 10 Hungarian cities
5. **Property Types**: Apartments (lakás) and Houses (ház)

## Data Mapping

DH-specific fields are mapped to standardized formats:

- **Property Types**: Lakás → apartment, Ház → house, etc.
- **Transaction Types**: Eladó → sale, Kiadó → rent
- **Disposition**: Hungarian room layouts (1-szobás, 2-szobás, etc.)
- **Ownership**: Tulajdon, Társasházi, Szövetkezeti
- **Condition**: Újépítésű, Újszerű, Jó, Felújított, etc.

See `src/shared/hungarian-value-mappings.ts` for complete canonical mappings.

## Ingest Integration

Sends to **ingest-hungary** service on port **3009**:
```
POST http://localhost:3009/api/v1/properties/bulk-ingest
```

Payload format:
```json
{
  "portal": "dh-hu",
  "country": "hungary",
  "properties": [
    {
      "portal_id": "LK078159",
      "data": { /* StandardProperty */ },
      "raw_data": { /* Original DH data */ }
    }
  ]
}
```

## Testing

Test scrape with limited scope:
```bash
curl -X POST http://localhost:8089/scrape \
  -H "Content-Type: application/json" \
  -d '{"maxRegions": 1, "maxPages": 1}'
```

Check health:
```bash
curl http://localhost:8089/health
```

## Dependencies

- `express`: Web server
- `axios`: HTTP client
- `cheerio`: HTML parsing
- `@landomo/core`: Shared types (StandardProperty)
- TypeScript for type safety

## Notes

- DH uses client-side JSON caching for faster page loads
- Some listings may have government program eligibility (Otthon Start)
- Agent information defaults to "Duna House" if not specified
- Images are stored as CDN URLs
- Reference numbers (e.g., LK078159) are used as primary identifiers

## Market Context

Duna House is Hungary's second-largest real estate platform by traffic, commanding approximately 25-30% market share. It operates alongside Ingatlan.com (#1, 60-65%) and several smaller portals. DH specializes in both residential and commercial properties across all major Hungarian cities.
