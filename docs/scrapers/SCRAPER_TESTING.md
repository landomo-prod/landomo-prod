# Scraper Testing Guide

Testing guidelines for Landomo scrapers.

## Testing in Docker (Required for macOS)

macOS Puppeteer is broken. **ALWAYS test scrapers in Docker**.

```bash
# Build and run
cd scrapers/Czech\ Republic/sreality
docker build -t scraper-sreality .
docker run --rm scraper-sreality npm start
```

## Manual Testing

```typescript
// test-single.ts
import { scrapeDetailPage } from './scrapers/detailScraper';
import { transformApartment } from './transformers/apartmentTransformer';

async function testSingleListing() {
  const url = 'https://portal.com/property/12345';
  
  const raw = await scrapeDetailPage(url);
  console.log('Raw:', JSON.stringify(raw, null, 2));
  
  const transformed = transformApartment(raw);
  console.log('Transformed:', JSON.stringify(transformed, null, 2));
  
  // Validate
  console.assert(transformed.property_category === 'apartment');
  console.assert(typeof transformed.bedrooms === 'number');
  console.assert(typeof transformed.has_elevator === 'boolean');
}
```

## Validation Checklist

- [ ] `property_category` set correctly
- [ ] All required TierI fields present
- [ ] `bedrooms` calculated correctly
- [ ] Booleans are `boolean`, not strings
- [ ] Numbers parsed (not strings)
- [ ] `status` is `'active'`
- [ ] `source_url` and `portal_id` set

## Integration Testing

```bash
# Test ingestion
curl -X POST http://localhost:3000/bulk-ingest \
  -H "Authorization: Bearer dev_key_1" \
  -H "Content-Type: application/json" \
  -d @test-payload.json

# Verify in database
psql -U landomo -d landomo_czech_republic -c "
  SELECT * FROM properties_apartment
  WHERE portal = 'sreality' AND portal_id = '12345';
"
```

---

**Last Updated**: 2026-02-16
