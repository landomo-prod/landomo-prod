# Scraper Development Guide

Complete guide for building Landomo property scrapers.

## Scraper Pattern

```
scrapers/{Country}/{portal}/
├── src/
│   ├── index.ts                    # Express server
│   ├── scrapers/listingsScraper.ts # Fetch logic
│   ├── transformers/               # Raw → TierI types
│   │   ├── apartmentTransformer.ts
│   │   ├── houseTransformer.ts
│   │   └── landTransformer.ts
│   └── adapters/ingestAdapter.ts   # POST to ingest service
├── package.json
└── Dockerfile
```

## Transformer Template

```typescript
import { ApartmentPropertyTierI } from '@landomo/core';

export function transformApartment(raw: any): ApartmentPropertyTierI {
  return {
    property_category: 'apartment', // REQUIRED

    title: raw.title,
    price: parseFloat(raw.price),
    currency: 'CZK',
    transaction_type: raw.type === 'prodej' ? 'sale' : 'rent',

    location: {
      city: raw.location.city,
      country: 'Czech Republic',
      coordinates: {
        lat: raw.gps_lat,
        lon: raw.gps_lon
      }
    },

    bedrooms: calculateBedrooms(raw.disposition),
    sqm: parseFloat(raw.area),
    has_elevator: raw.elevator === 'ano',
    has_balcony: raw.features.includes('balkon'),
    has_parking: raw.features.includes('parkování'),
    has_basement: raw.features.includes('sklep'),

    source_url: raw.url,
    source_platform: 'portal-name',
    portal_id: raw.id.toString(),
    status: 'active'
  };
}

function calculateBedrooms(disposition: string): number {
  // 2+kk → 1, 3+kk → 2, 2+1 → 2
  const match = disposition.match(/(\d+)/);
  if (!match) return 0;
  const rooms = parseInt(match[1]);
  return disposition.includes('+kk') ? rooms - 1 : rooms;
}
```

## Best Practices

1. **Test in Docker**: macOS Puppeteer is broken
2. **Use ScrapeRunTracker**: Track runs for monitoring
3. **Implement retries**: Exponential backoff for failures
4. **Rate limiting**: 1-2s delays between requests
5. **Error handling**: Log errors, don't crash

## Related Documentation

- **Scraper Patterns**: `/docs/scrapers/SCRAPER_PATTERNS.md`
- **Scraper Testing**: `/docs/scrapers/SCRAPER_TESTING.md`
- **Data Model**: `/docs/DATA_MODEL.md`

---

**Last Updated**: 2026-02-16
