# Kleinanzeigen.de Scraper - Quick Start Guide

## Installation

```bash
cd /Users/samuelseidel/Development/landomo-world/scrapers/Germany/kleinanzeigen-de
npm install
```

## Test the Scraper

### 1. Test API Connection

First, verify the API is accessible:

```bash
# Test apartments for rent (category 203)
curl -H "Authorization: Basic YW5kcm9pZDpUYVI2MHBFdHRZ" \
     -H "User-Agent: okhttp/4.10.0" \
     -H "Accept: application/json" \
     "https://api.kleinanzeigen.de/api/ads.json?categoryId=203&size=5&page=0"
```

Expected response: JSON with `ads` array containing listings.

### 2. Run in Development Mode

```bash
npm run dev
```

This starts the Express server on port 8082.

### 3. Trigger a Scrape

In another terminal:

```bash
# Check health
curl http://localhost:8082/health

# Trigger scraping
curl -X POST http://localhost:8082/scrape
```

The scraper will:
1. Fetch listings from 4 real estate categories
2. Transform to standardized format
3. Send to ingest API in batches

## Expected Output

```
🚀 Kleinanzeigen scraper running
   Port: 8082
   Health: http://localhost:8082/health
   Trigger: POST http://localhost:8082/scrape

Waiting for scrape triggers...

[2026-02-07T...] 🚀 Starting Kleinanzeigen scrape...
📡 Fetching listings from Kleinanzeigen API...
Fetched page 1: 41 listings (total: 41)
Fetched page 2: 41 listings (total: 82)
Category 203: 82 listings
Category 196: 45 listings
Category 205: 38 listings
Category 199: 29 listings
✅ Scraping complete: 194 total listings

🔄 Transforming 194 listings...
✅ Successfully transformed 194 listings

📤 Sending batch 1/2 (100 properties)...
✅ Sent 100 properties to ingest API
📤 Sending batch 2/2 (94 properties)...
✅ Sent 94 properties to ingest API

✅ Scrape completed in 78.45s
   Total listings: 194
   Transformed: 194
   Sent to ingest API: 194
```

## Configuration

Create `.env` file:

```bash
cp .env.example .env
```

Edit as needed:
```bash
PORT=8082
INGEST_API_URL=http://localhost:3004
INGEST_API_KEY_KLEINANZEIGEN=your_key_here
```

## Customize Categories

Edit `src/index.ts` to change which categories to scrape:

```typescript
const scraper = new ListingsScraper(
  [
    REAL_ESTATE_CATEGORIES.APARTMENTS_RENT,  // 203
    REAL_ESTATE_CATEGORIES.APARTMENTS_SALE,  // 196
    // Add or remove categories as needed
  ],
  undefined,  // Location ID (optional)
  false       // Detail enrichment (slower)
);
```

## Filter by Location

To scrape only Berlin listings:

```typescript
const BERLIN_LOCATION_ID = 10178;

const scraper = new ListingsScraper(
  categories,
  BERLIN_LOCATION_ID,  // Filter by Berlin
  false
);
```

### Find Location IDs

```bash
curl -H "Authorization: Basic YW5kcm9pZDpUYVI2MHBFdHRZ" \
     "https://api.kleinanzeigen.de/api/locations/top-locations.json?depth=0&q=Berlin"
```

## Search by Keyword

Modify the scraper to search instead of browsing categories:

```typescript
const listings = await scraper.scrapeByQuery("immobilien berlin");
```

## Production Build

```bash
npm run build
npm start
```

## Troubleshooting

### "401 Unauthorized"
- Verify the auth header is correct
- Check API URL is accessible

### "No listings found"
- Verify category IDs are correct
- Check if location ID is valid
- Try without location filter first

### "Rate limited"
- Increase delays in `fetchData.ts`
- Reduce concurrent requests
- Wait before retrying

### Transformation errors
- Check console for specific field errors
- Verify listing structure matches types
- Some optional fields may be missing

## Next Steps

1. Connect to your ingest API
2. Set up scheduled scraping (cron job)
3. Monitor logs for errors
4. Adjust rate limiting as needed
5. Add location/price filters

## API Reference

### Real Estate Categories

```typescript
APARTMENTS_RENT: 203   // Wohnungen zur Miete
APARTMENTS_SALE: 196   // Wohnungen zum Kauf
HOUSES_RENT: 205       // Häuser zur Miete
HOUSES_SALE: 199       // Häuser zum Kauf
ROOMS: 199             // WG-Zimmer
VACATION_RENTALS: 187  // Ferienwohnungen
COMMERCIAL: 195        // Gewerbeimmobilien
PLOTS: 98              // Grundstücke
```

### Common Location IDs

```
Berlin: 10178
Munich: 10209
Hamburg: 10195
Frankfurt: 10187
Cologne: 10202
```

## Support

See [README.md](./README.md) for full documentation.
