# Scraper Patterns & Solutions

Common scraper challenges and solutions.

## API-Based Scrapers

```typescript
async function scrapeListings(): Promise<any[]> {
  const response = await axios.get('https://portal.com/api/properties', {
    params: {
      transaction_type: 'sale',
      property_type: 'apartment',
      page_size: 100
    },
    headers: {
      'Accept': 'application/json',
      'User-Agent': 'Mozilla/5.0 ...'
    }
  });

  return response.data.results;
}
```

## Browser-Based Scrapers

```typescript
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

const browser = await puppeteer.launch({
  headless: true,
  args: ['--no-sandbox']
});
```

## Rate Limiting & Retries

```typescript
async function fetchWithRetry(url: string, maxRetries: number = 5): Promise<any> {
  let delay = 1000;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await axios.get(url);
    } catch (error: any) {
      if (error.response?.status === 429) {
        await sleep(delay);
        delay *= 2; // Exponential backoff
      } else {
        throw error;
      }
    }
  }
}
```

## Czech Disposition Parsing

```typescript
function parseDisposition(disposition: string): { bedrooms: number; rooms: number } {
  // "2+kk" → 1 bedroom, 2 rooms
  // "2+1" → 2 bedrooms, 3 rooms
  
  const match = disposition.match(/(\d+)\+(kk|\d+)/);
  if (!match) return { bedrooms: 0, rooms: 0 };

  const firstNum = parseInt(match[1]);
  const secondPart = match[2];

  if (secondPart === 'kk') {
    return { bedrooms: firstNum - 1, rooms: firstNum };
  } else {
    return {
      bedrooms: firstNum + parseInt(secondPart),
      rooms: firstNum + parseInt(secondPart)
    };
  }
}
```

## Related Documentation

- **Scraper Guide**: `/docs/scrapers/SCRAPER_GUIDE.md`
- **Troubleshooting**: `/docs/TROUBLESHOOTING.md`

---

**Last Updated**: 2026-02-16
