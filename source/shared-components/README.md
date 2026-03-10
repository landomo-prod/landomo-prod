# @landomo/core

Shared utilities and type definitions for the Landomo scraper ecosystem.

## Philosophy

**This is NOT a framework!** @landomo/core provides optional utilities that you can use or ignore. Scrapers are free to:

- ✅ Use any scraping library (playwright, puppeteer, axios, fetch, etc.)
- ✅ Implement any architecture (single file, classes, functions, etc.)
- ✅ Use or ignore @landomo/core utilities
- ✅ Choose scraping strategy (two-phase, single-phase, API, etc.)

**Only Requirement**: Send standardized data to Core Service API

## Installation

```bash
npm install @landomo/core
```

## What's Included

### 1. Type Definitions (TypeScript)

```typescript
import { StandardProperty, IngestionPayload, PropertyLocation } from '@landomo/core';
```

Use these for type safety, but they're not required.

### 2. Core Service Client (Optional)

```typescript
import { sendToCoreService } from '@landomo/core';

await sendToCoreService({
  portal: 'domain',
  portal_id: listing.id,
  country: 'australia',
  data: standardizedProperty,
  raw_data: rawListing
});
```

Or use axios directly if you prefer.

### 3. Utility Functions (Optional Helpers)

```typescript
import { parsePrice, normalizePropertyType, detectChanges } from '@landomo/core';

// Use if convenient
const price = parsePrice('$950,000');
const type = normalizePropertyType('flat'); // 'apartment'

// Or write your own
```

## Minimal Example

```typescript
import axios from 'axios';

async function scrape() {
  // 1. Get data (however you want)
  const response = await axios.get('https://portal.com/api/listings');

  // 2. Transform to standard format
  for (const listing of response.data) {
    const standardized = {
      title: listing.name,
      price: listing.price,
      bedrooms: listing.rooms,
      location: { city: listing.city, country: 'australia' },
      // ... other fields
    };

    // 3. Send to Core Service (only requirement!)
    await axios.post('https://core.landomo.com/api/v1/properties/ingest', {
      portal: 'example',
      portal_id: listing.id,
      country: 'australia',
      data: standardized,
      raw_data: listing
    });
  }
}
```

## Using Utilities Example

```typescript
import {
  sendToCoreService,
  parsePrice,
  normalizePropertyType,
  StandardProperty
} from '@landomo/core';

async function scrape() {
  const listings = await scrapePortal();

  for (const listing of listings) {
    // Use helper functions if convenient
    const price = parsePrice(listing.price_text);
    const propertyType = normalizePropertyType(listing.type);

    const standardized: StandardProperty = {
      title: listing.title,
      price: price,
      property_type: propertyType,
      currency: 'AUD',
      transaction_type: 'sale',
      location: {
        city: listing.city,
        country: 'australia'
      },
      details: {
        bedrooms: listing.bedrooms,
        bathrooms: listing.bathrooms
      }
    };

    // Use Core Service client (handles retries)
    await sendToCoreService({
      portal: 'example',
      portal_id: listing.id,
      country: 'australia',
      data: standardized,
      raw_data: listing
    });
  }
}
```

## Database Schema Templates

Located in `src/database/`:
- `schema-template-scraper.sql` - Scraper DB schema (Tier 1)
- `schema-template-core.sql` - Core DB schema (Tier 2)

## License

MIT
