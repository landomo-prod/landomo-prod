# ImmoScout24 Austria - Quick Start Guide

Get up and running in 5 minutes.

## 1. Install Dependencies

```bash
cd /Users/samuelseidel/Development/landomo-world/scrapers/Austria/immobilienscout24-at
npm install
```

## 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` if needed (defaults work for development):

```env
PORT=8082
INGEST_API_URL=http://localhost:3004
INGEST_API_KEY_IMMOBILIENSCOUT24_AT=dev_key_austria_immoscout24
```

## 3. Build

```bash
npm run build
```

## 4. Test the API

```bash
# Quick API connectivity test
ts-node test-api.ts
```

Expected output:
```
🧪 Testing ImmoScout24 Austria API

1️⃣ Discovering API base URL...
   ✅ Base URL: https://api.is24.at

2️⃣ Testing search endpoint...
   ✅ Found 1250 total properties
   ✅ Returned 5 properties in this page

3️⃣ First property overview:
   ID: 123456
   Title: Beautiful apartment in Vienna
   Price: €250000
   City: Vienna
   Area: 65 m²
   Rooms: 2

✅ All tests passed!
```

## 5. Run the Scraper

### Development Mode

```bash
npm run dev
```

### Production Mode

```bash
npm start
```

The server will start on `http://localhost:8082`

## 6. Trigger a Scrape

### Quick Scrape (Recent Properties Only)

```bash
# Scrape properties from last 7 days
curl -X POST http://localhost:8082/scrape/recent \
  -H "Content-Type: application/json" \
  -d '{"days": 7}'
```

Response:
```json
{
  "status": "quick scraping started",
  "days": 7,
  "timestamp": "2026-02-07T10:30:00.000Z"
}
```

Watch the logs:
```
⚡ Starting quick scrape (last 7 days)...
🚀 Scraping properties from last 7 days...
   ✅ APARTMENT SALE: 45 new
   ✅ APARTMENT RENT: 32 new
   ✅ HOUSE SALE: 18 new
   ✅ HOUSE RENT: 12 new

✅ Found 107 recent properties
🔄 Transforming 107 recent listings...
✅ Successfully transformed 107 listings
📤 Sending 107 properties...
✅ Sent 107 properties to ingest API

✅ Quick scrape completed in 2.34s
   Total listings: 107
   Sent to ingest API: 107
```

### Full Scrape (All Properties)

```bash
curl -X POST http://localhost:8082/scrape
```

Response:
```json
{
  "status": "scraping started",
  "timestamp": "2026-02-07T10:30:00.000Z"
}
```

This will take 15-30 minutes and scrape ~10,000 properties.

## 7. Health Check

```bash
curl http://localhost:8082/health
```

Response:
```json
{
  "status": "healthy",
  "scraper": "immobilienscout24-at",
  "version": "1.0.0",
  "timestamp": "2026-02-07T10:30:00.000Z"
}
```

## Troubleshooting

### "Cannot find module '@landomo/core'"

The shared-components package needs to be built:

```bash
cd /Users/samuelseidel/Development/landomo-world/shared-components
npm install
npm run build
cd ../scrapers/Austria/immobilienscout24-at
npm install
```

### "API base URL not found"

Test the API manually:

```bash
curl -I https://api.is24.at/api/psa/is24/properties/search?profile=android&size=1
```

If this fails, the API might be temporarily down.

### Rate Limiting (429 Errors)

Increase the delays in `src/utils/fetchData.ts`:

```typescript
// Line 85: Increase delay between requests
await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second instead of 300-500ms
```

## Next Steps

- Read the full [README.md](README.md) for detailed documentation
- Check [IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md) for technical details
- Review [API Analysis](../../../GERMAN_AUSTRIAN_PORTALS_SCRAPING_GUIDE.md) for research notes

## Common Use Cases

### Scrape only apartments in Vienna

Edit `src/index.ts`, line 46:

```typescript
const scraper = new ListingsScraper({
  propertyTypes: ['APARTMENT'],
  transactionTypes: ['SALE'],
  locations: ['Vienna'],
  fetchDetails: true,
  maxPagesPerCategory: 10
});
```

### Scrape only expensive properties (€500k+)

```typescript
const scraper = new ListingsScraper({
  propertyTypes: ['APARTMENT', 'HOUSE'],
  transactionTypes: ['SALE'],
  priceRanges: [{ min: 500000, max: undefined }],
  fetchDetails: true
});
```

### Quick scrape without details

```typescript
const scraper = new ListingsScraper({
  fetchDetails: false, // Skip detail endpoint
  maxPagesPerCategory: 5
});
```

---

**Ready to scrape!** 🚀

For more information, see the [README.md](README.md).
