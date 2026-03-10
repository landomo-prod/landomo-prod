# WG-Gesucht Scraper - Usage Examples

This document provides practical examples for using the WG-Gesucht scraper.

## Basic Usage

### 1. Simple Scrape (All Default Cities)

```typescript
import { ListingsScraper } from './src/scrapers/listingsScraper';
import { transformWGGesuchtToStandard } from './src/transformers/wgGesuchtTransformer';

async function scrapeWGGesucht() {
  const scraper = new ListingsScraper();

  // Authenticate
  await scraper.authenticate(
    process.env.WG_GESUCHT_USERNAME!,
    process.env.WG_GESUCHT_PASSWORD!
  );

  // Scrape all configured cities
  const listings = await scraper.scrapeAll();

  console.log(`Found ${listings.length} listings`);
}
```

### 2. Single City Scrape

```typescript
import { CITY_IDS, CATEGORY_TYPES } from './src/types/wgGesuchtTypes';

async function scrapeBerlin() {
  const scraper = new ListingsScraper({
    cities: [CITY_IDS.BERLIN],
    categories: [CATEGORY_TYPES.WG_ROOM],
    fetchDetails: true
  });

  await scraper.authenticate(username, password);
  const listings = await scraper.scrapeAll();

  console.log(`Berlin WG rooms: ${listings.length}`);
}
```

### 3. Custom Search Parameters

```typescript
import { ListingsScraper } from './src/scrapers/listingsScraper';
import { CITY_IDS, CATEGORY_TYPES } from './src/types/wgGesuchtTypes';

async function scrapeCustom() {
  const scraper = new ListingsScraper();
  await scraper.authenticate(username, password);

  // Berlin, max rent €600, min size 15m²
  const listings = await scraper.scrapeCustom(
    CITY_IDS.BERLIN,
    [CATEGORY_TYPES.WG_ROOM],
    {
      maxRent: 600,
      minSize: 15,
      fetchDetails: true
    }
  );

  console.log(`Found ${listings.length} affordable rooms`);
}
```

## Advanced Usage

### 4. Multiple Cities with Different Criteria

```typescript
async function scrapeMultipleCities() {
  const scraper = new ListingsScraper();
  await scraper.authenticate(username, password);

  const cities = [
    { id: CITY_IDS.BERLIN, name: 'Berlin', maxRent: 600 },
    { id: CITY_IDS.MUNICH, name: 'Munich', maxRent: 800 },
    { id: CITY_IDS.HAMBURG, name: 'Hamburg', maxRent: 550 }
  ];

  for (const city of cities) {
    console.log(`\nScraping ${city.name}...`);

    const listings = await scraper.scrapeCustom(
      city.id,
      [CATEGORY_TYPES.WG_ROOM, CATEGORY_TYPES.ONE_ROOM],
      { maxRent: city.maxRent, fetchDetails: false }
    );

    console.log(`${city.name}: ${listings.length} listings under €${city.maxRent}`);
  }
}
```

### 5. Filter and Transform

```typescript
import { transformWGGesuchtToStandard } from './src/transformers/wgGesuchtTransformer';

async function filterAndTransform() {
  const scraper = new ListingsScraper();
  await scraper.authenticate(username, password);

  const listings = await scraper.scrapeAll();

  // Filter: only furnished rooms under €500
  const filteredListings = listings.filter(listing =>
    listing.furniture === 'furnished' &&
    listing.rent && listing.rent <= 500
  );

  console.log(`Filtered: ${filteredListings.length} furnished rooms under €500`);

  // Transform to standard format
  const properties = filteredListings.map(listing => ({
    portalId: String(listing.id),
    data: transformWGGesuchtToStandard(listing),
    rawData: listing
  }));

  return properties;
}
```

### 6. Export to JSON

```typescript
import fs from 'fs/promises';

async function exportToJSON() {
  const scraper = new ListingsScraper({
    cities: [CITY_IDS.BERLIN],
    categories: [CATEGORY_TYPES.WG_ROOM],
    fetchDetails: true
  });

  await scraper.authenticate(username, password);
  const listings = await scraper.scrapeAll();

  // Transform
  const properties = listings.map(listing => ({
    portalId: String(listing.id),
    data: transformWGGesuchtToStandard(listing),
    rawData: listing
  }));

  // Export
  await fs.writeFile(
    'wg-gesucht-berlin.json',
    JSON.stringify(properties, null, 2)
  );

  console.log(`✅ Exported ${properties.length} properties to wg-gesucht-berlin.json`);
}
```

### 7. Statistics and Analysis

```typescript
async function analyzeListings() {
  const scraper = new ListingsScraper();
  await scraper.authenticate(username, password);

  const listings = await scraper.scrapeAll();

  // Calculate statistics
  const stats = {
    total: listings.length,
    byCity: {} as Record<string, number>,
    avgRent: 0,
    avgSize: 0,
    furnished: 0,
    withBalcony: 0
  };

  let totalRent = 0;
  let totalSize = 0;

  listings.forEach(listing => {
    // By city
    const city = listing.city || 'Unknown';
    stats.byCity[city] = (stats.byCity[city] || 0) + 1;

    // Averages
    if (listing.rent) totalRent += listing.rent;
    if (listing.size) totalSize += listing.size;

    // Features
    if (listing.furnished) stats.furnished++;
    if (listing.balcony) stats.withBalcony++;
  });

  stats.avgRent = Math.round(totalRent / listings.length);
  stats.avgSize = Math.round(totalSize / listings.length);

  console.log('\n📊 Statistics:');
  console.log(`   Total listings: ${stats.total}`);
  console.log(`   Average rent: €${stats.avgRent}`);
  console.log(`   Average size: ${stats.avgSize}m²`);
  console.log(`   Furnished: ${stats.furnished} (${Math.round(stats.furnished / stats.total * 100)}%)`);
  console.log(`   With balcony: ${stats.withBalcony} (${Math.round(stats.withBalcony / stats.total * 100)}%)`);
  console.log(`\n   By city:`);
  Object.entries(stats.byCity).forEach(([city, count]) => {
    console.log(`   - ${city}: ${count}`);
  });
}
```

## Incremental Scraping

### 8. Only Scrape New Listings

```typescript
import fs from 'fs/promises';

async function incrementalScrape() {
  // Load previous listing IDs
  let previousIds = new Set<string>();
  try {
    const data = await fs.readFile('previous-ids.json', 'utf-8');
    previousIds = new Set(JSON.parse(data));
  } catch {
    console.log('No previous IDs found, doing full scrape');
  }

  // Scrape
  const scraper = new ListingsScraper();
  await scraper.authenticate(username, password);
  const listings = await scraper.scrapeAll();

  // Filter new listings
  const newListings = listings.filter(listing =>
    !previousIds.has(String(listing.id))
  );

  console.log(`Total listings: ${listings.length}`);
  console.log(`New listings: ${newListings.length}`);

  // Save current IDs
  const currentIds = listings.map(l => String(l.id));
  await fs.writeFile('previous-ids.json', JSON.stringify(currentIds, null, 2));

  return newListings;
}
```

### 9. Track Price Changes

```typescript
interface ListingHistory {
  [id: string]: {
    price: number;
    lastUpdated: string;
  };
}

async function trackPriceChanges() {
  // Load history
  let history: ListingHistory = {};
  try {
    const data = await fs.readFile('price-history.json', 'utf-8');
    history = JSON.parse(data);
  } catch {}

  // Scrape
  const scraper = new ListingsScraper();
  await scraper.authenticate(username, password);
  const listings = await scraper.scrapeAll();

  // Check for changes
  const changes = [];

  for (const listing of listings) {
    const id = String(listing.id);
    const currentPrice = listing.rent || 0;

    if (history[id]) {
      const oldPrice = history[id].price;
      if (currentPrice !== oldPrice) {
        changes.push({
          id,
          oldPrice,
          newPrice: currentPrice,
          change: currentPrice - oldPrice
        });
      }
    }

    // Update history
    history[id] = {
      price: currentPrice,
      lastUpdated: new Date().toISOString()
    };
  }

  // Save history
  await fs.writeFile('price-history.json', JSON.stringify(history, null, 2));

  console.log(`\n💰 Price changes: ${changes.length}`);
  changes.forEach(change => {
    const direction = change.change > 0 ? '📈' : '📉';
    console.log(`   ${direction} Listing ${change.id}: €${change.oldPrice} → €${change.newPrice}`);
  });
}
```

## Error Handling

### 10. Robust Error Handling

```typescript
async function robustScrape() {
  const scraper = new ListingsScraper();

  try {
    // Authenticate with retry
    let authAttempts = 0;
    while (authAttempts < 3) {
      try {
        await scraper.authenticate(username, password);
        console.log('✅ Authentication successful');
        break;
      } catch (error) {
        authAttempts++;
        console.error(`❌ Auth attempt ${authAttempts} failed:`, error.message);
        if (authAttempts >= 3) throw error;
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }

    // Scrape with error handling
    const listings = await scraper.scrapeAll();

    if (listings.length === 0) {
      console.warn('⚠️  No listings found - might be rate limited');
      return [];
    }

    console.log(`✅ Successfully scraped ${listings.length} listings`);
    return listings;

  } catch (error: any) {
    console.error('❌ Scraping failed:', error.message);

    // Send alert (email, Slack, etc.)
    // await sendAlert(`WG-Gesucht scraper failed: ${error.message}`);

    throw error;
  }
}
```

## Testing

### 11. Dry Run (No API calls)

```typescript
import { transformWGGesuchtToStandard } from './src/transformers/wgGesuchtTransformer';

// Mock data for testing
const mockListing = {
  id: '12345678',
  title: 'Test WG Room',
  city: 'Berlin',
  district: 'Kreuzberg',
  rent: 450,
  size: 18,
  furnished: true,
  balcony: true,
  flatmates: {
    total: 2,
    male: 1,
    female: 1
  }
};

function testTransformation() {
  const transformed = transformWGGesuchtToStandard(mockListing);

  console.log('🧪 Testing transformation...');
  console.log(`   Title: ${transformed.title}`);
  console.log(`   Price: ${transformed.price} ${transformed.currency}`);
  console.log(`   Type: ${transformed.property_type}`);
  console.log(`   City: ${transformed.location.city}`);
  console.log(`   Size: ${transformed.details.sqm}m²`);
  console.log(`   Furnished: ${transformed.amenities?.is_furnished}`);
  console.log('✅ Transformation test passed');
}
```

## Command Line Interface

### 12. CLI Script

Create `scripts/scrape.ts`:

```typescript
#!/usr/bin/env ts-node

import { ListingsScraper } from '../src/scrapers/listingsScraper';
import { CITY_IDS, CATEGORY_TYPES } from '../src/types/wgGesuchtTypes';

// Parse command line arguments
const args = process.argv.slice(2);
const city = args[0] || 'berlin';
const category = args[1] || 'wg-room';

const cityMap: Record<string, number> = {
  'berlin': CITY_IDS.BERLIN,
  'munich': CITY_IDS.MUNICH,
  'hamburg': CITY_IDS.HAMBURG,
  'cologne': CITY_IDS.COLOGNE,
  'frankfurt': CITY_IDS.FRANKFURT
};

const categoryMap: Record<string, string> = {
  'wg-room': CATEGORY_TYPES.WG_ROOM,
  'one-room': CATEGORY_TYPES.ONE_ROOM,
  'two-room': CATEGORY_TYPES.TWO_ROOM
};

async function main() {
  const cityId = cityMap[city.toLowerCase()];
  const categoryType = categoryMap[category.toLowerCase()];

  if (!cityId) {
    console.error(`Unknown city: ${city}`);
    console.log(`Available: ${Object.keys(cityMap).join(', ')}`);
    process.exit(1);
  }

  console.log(`🚀 Scraping ${city} - ${category}...`);

  const scraper = new ListingsScraper({
    cities: [cityId],
    categories: [categoryType],
    fetchDetails: true
  });

  await scraper.authenticate(
    process.env.WG_GESUCHT_USERNAME!,
    process.env.WG_GESUCHT_PASSWORD!
  );

  const listings = await scraper.scrapeAll();
  console.log(`✅ Found ${listings.length} listings`);
}

main().catch(console.error);
```

Usage:
```bash
# Scrape Berlin WG rooms
ts-node scripts/scrape.ts berlin wg-room

# Scrape Munich studios
ts-node scripts/scrape.ts munich one-room

# Default (Berlin WG rooms)
ts-node scripts/scrape.ts
```

## Integration with Ingest API

### 13. Full Pipeline

```typescript
import { ListingsScraper } from './src/scrapers/listingsScraper';
import { IngestAdapter } from './src/adapters/ingestAdapter';
import { transformWGGesuchtToStandard } from './src/transformers/wgGesuchtTransformer';

async function fullPipeline() {
  const startTime = Date.now();

  // 1. Initialize
  const scraper = new ListingsScraper();
  const adapter = new IngestAdapter('wg-gesucht');

  // 2. Authenticate
  await scraper.authenticate(username, password);

  // 3. Scrape
  const listings = await scraper.scrapeAll();
  console.log(`📡 Scraped ${listings.length} listings`);

  // 4. Transform
  const properties = listings.map(listing => ({
    portalId: String(listing.id),
    data: transformWGGesuchtToStandard(listing),
    rawData: listing
  }));
  console.log(`🔄 Transformed ${properties.length} properties`);

  // 5. Send to ingest API in batches
  const batchSize = 100;
  for (let i = 0; i < properties.length; i += batchSize) {
    const batch = properties.slice(i, i + batchSize);
    await adapter.sendProperties(batch);
    console.log(`📤 Sent batch ${i / batchSize + 1}/${Math.ceil(properties.length / batchSize)}`);
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`\n✅ Pipeline completed in ${duration}s`);
}
```

---

## Tips

1. **Always use rate limiting** - WG-Gesucht triggers reCAPTCHA on rapid requests
2. **Authenticate once** - Reuse the scraper instance for multiple cities
3. **Handle errors gracefully** - Network issues are common
4. **Cache results** - Don't re-scrape unchanged listings
5. **Monitor performance** - Track request times and success rates

## Next Steps

- Read [README.md](./README.md) for setup instructions
- Check [GERMAN_AUSTRIAN_PORTALS_SCRAPING_GUIDE.md](/GERMAN_AUSTRIAN_PORTALS_SCRAPING_GUIDE.md) for API details
- Explore GitHub projects for alternative approaches:
  - [Zero3141/WgGesuchtAPI](https://github.com/Zero3141/WgGesuchtAPI)
  - [grantwilliams/wg-gesucht-crawler-cli](https://github.com/grantwilliams/wg-gesucht-crawler-cli)
