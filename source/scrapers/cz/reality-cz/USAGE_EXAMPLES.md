# Puppeteer Implementation - Usage Examples

## Quick Start

### 1. Basic Setup

```bash
# Install dependencies (includes Puppeteer)
cd "/Users/samuelseidel/Development/landomo-world/scrapers/Czech Republic/reality"
npm install

# Compile TypeScript
npm run build

# Run the scraper
npm start
```

### 2. Using the Scraper in Code

```typescript
import { ListingsScraper } from './scrapers/listingsScraper';

// Create scraper instance
const scraper = new ListingsScraper();

try {
  // Initialize browser pool
  await scraper.initialize();

  // Scrape sales listings
  const sales = await scraper.scrapeSales();
  console.log(`Found ${sales.length} sales listings`);

  // Scrape rental listings
  const rentals = await scraper.scrapeRentals();
  console.log(`Found ${rentals.length} rental listings`);

  // Process listings
  const allListings = [...sales, ...rentals];
  allListings.forEach(listing => {
    console.log(`${listing.title} - ${listing.price_text}`);
  });
} finally {
  // Always cleanup browser resources
  await scraper.shutdown();
}
```

## Browser Pool API

### Initialize Browser

```typescript
import { browserPool } from './utils/browserPool';

// Initialize browser instance
await browserPool.initialize();

// Check initialization status
const status = browserPool.getStatus();
console.log(status);
// Output:
// {
//   initialized: true,
//   activePages: 0,
//   totalPages: 0,
//   maxConcurrent: 2,
//   queueLength: 0
// }
```

### Get Page with Automatic Queuing

```typescript
import { browserPool } from './utils/browserPool';

// Get a page (waits if max concurrent pages reached)
const page = await browserPool.getPage();

try {
  // Use the page
  await page.goto('https://example.com');
} finally {
  // Release the page back to the pool
  await browserPool.releasePage(page);
}
```

### Navigate with Automatic Retry

```typescript
import { browserPool } from './utils/browserPool';

const page = await browserPool.getPage();

try {
  // Navigate with retry logic (max 3 attempts)
  await browserPool.navigateWithRetry(
    page,
    'https://www.reality.cz/prodej/byty/',
    3,                    // max retries
    'networkidle2'        // wait until network idle
  );

  // Get rendered content
  const html = await browserPool.getPageContent(page);
  console.log('HTML length:', html.length);
} finally {
  await browserPool.releasePage(page);
}
```

### Shutdown Browser

```typescript
import { browserPool } from './utils/browserPool';

// Close all pages and browser
await browserPool.shutdown();

// Verify shutdown
const status = browserPool.getStatus();
console.log('Initialized:', status.initialized); // false
```

## Scraper Methods

### Scrape Sales

```typescript
const scraper = new ListingsScraper();

try {
  await scraper.initialize();

  const sales = await scraper.scrapeSales();

  // sales is an array of RealityListing objects
  sales.forEach(listing => {
    console.log({
      id: listing.id,
      title: listing.title,
      price: listing.price,
      area: listing.area,
      location: listing.location?.city,
      url: listing.url
    });
  });
} finally {
  await scraper.shutdown();
}
```

### Scrape Rentals

```typescript
const scraper = new ListingsScraper();

try {
  await scraper.initialize();

  const rentals = await scraper.scrapeRentals();
  console.log(`Found ${rentals.length} rental listings`);
} finally {
  await scraper.shutdown();
}
```

### Scrape All (Sales + Rentals)

```typescript
const scraper = new ListingsScraper();

// scrapeAll() handles initialization and shutdown automatically
const allListings = await scraper.scrapeAll();
console.log(`Total: ${allListings.length} listings`);
```

### With Detail Page Enrichment

```typescript
const scraper = new ListingsScraper();

try {
  // Set FETCH_DETAILS=true in .env to enable detail page fetching
  await scraper.initialize();

  const listings = await scraper.scrapeSales();
  // Each listing will have additional fields from detail pages:
  // - ownership, condition, furnished, energyRating, etc.
} finally {
  await scraper.shutdown();
}
```

## Configuration Examples

### .env Configuration

```env
# Minimal configuration
PORT=8086
INGEST_API_URL=http://localhost:3004
INGEST_API_KEY_REALITY=dev_key

# Default Puppeteer settings
PUPPETEER_HEADLESS=true
BROWSER_TIMEOUT=30000
MAX_CONCURRENT_PAGES=2
FETCH_DETAILS=false
```

### Custom Configuration

```env
# For development/debugging (see browser window)
PUPPETEER_HEADLESS=false
BROWSER_TIMEOUT=60000           # Longer timeout for debugging
MAX_CONCURRENT_PAGES=1          # Single page for stability

# For production (high throughput)
PUPPETEER_HEADLESS=true
BROWSER_TIMEOUT=30000
MAX_CONCURRENT_PAGES=3          # More concurrent pages (needs more RAM)
FETCH_DETAILS=false             # Skip detail pages for speed

# For enriched data
PUPPETEER_HEADLESS=true
BROWSER_TIMEOUT=30000
MAX_CONCURRENT_PAGES=1
FETCH_DETAILS=true              # Fetch detail pages
```

## Error Handling Patterns

### Basic Error Handling

```typescript
import { ListingsScraper } from './scrapers/listingsScraper';

const scraper = new ListingsScraper();

try {
  await scraper.initialize();
  const listings = await scraper.scrapeSales();
  console.log(`Scraped ${listings.length} listings`);
} catch (error) {
  console.error('Scraping failed:', error.message);
  // Handle error appropriately
} finally {
  await scraper.shutdown();
}
```

### Retry Logic Example

```typescript
import { ListingsScraper } from './scrapers/listingsScraper';

async function scrapeWithRetry(maxAttempts = 3) {
  const scraper = new ListingsScraper();

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await scraper.initialize();
      const listings = await scraper.scrapeSales();

      if (listings.length > 0) {
        return listings;
      }

      console.warn(`Attempt ${attempt}: No listings found`);
    } catch (error: any) {
      console.error(`Attempt ${attempt} failed:`, error.message);

      if (attempt === maxAttempts) {
        throw error; // Give up after max attempts
      }

      // Wait before retry
      const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
      console.log(`Retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    } finally {
      await scraper.shutdown();
    }
  }
}

// Usage
try {
  const listings = await scrapeWithRetry(3);
  console.log('Success:', listings.length);
} catch (error) {
  console.error('All retries failed');
}
```

## Monitoring and Debugging

### Check Browser Pool Status

```typescript
import { browserPool } from './utils/browserPool';

async function monitorBrowserPool() {
  await browserPool.initialize();

  // Monitor concurrency
  setInterval(() => {
    const status = browserPool.getStatus();
    console.log('Browser Pool Status:');
    console.log(`  Active Pages: ${status.activePages}/${status.maxConcurrent}`);
    console.log(`  Queue Length: ${status.queueLength}`);
  }, 5000);
}
```

### Debug Single Page

```typescript
import { browserPool } from './utils/browserPool';

async function debugPage(url: string) {
  // Set PUPPETEER_HEADLESS=false in .env to see the browser

  await browserPool.initialize();

  const page = await browserPool.getPage();

  try {
    console.log(`Navigating to ${url}...`);
    await browserPool.navigateWithRetry(page, url, 1, 'networkidle2');

    console.log('Page title:', await page.title());

    // Capture screenshot
    await page.screenshot({ path: 'debug-screenshot.png' });
    console.log('Screenshot saved to debug-screenshot.png');

    // Get content
    const content = await browserPool.getPageContent(page);
    console.log('Content length:', content.length);

    // Save HTML for inspection
    const fs = require('fs').promises;
    await fs.writeFile('debug-page.html', content);
    console.log('HTML saved to debug-page.html');
  } finally {
    await browserPool.releasePage(page);
    await browserPool.shutdown();
  }
}

// Usage
debugPage('https://www.reality.cz/prodej/byty/');
```

## Performance Benchmarking

### Measure Scraping Speed

```typescript
import { ListingsScraper } from './scrapers/listingsScraper';

async function benchmarkScraper() {
  const scraper = new ListingsScraper();
  const startTime = Date.now();

  try {
    await scraper.initialize();
    const initTime = Date.now();
    console.log(`Browser init: ${initTime - startTime}ms`);

    const sales = await scraper.scrapeSales();
    const scrapeTime = Date.now() - initTime;

    console.log(`Scrape time: ${scrapeTime}ms`);
    console.log(`Listings: ${sales.length}`);
    console.log(`Avg per listing: ${(scrapeTime / sales.length).toFixed(0)}ms`);
    console.log(`Throughput: ${(sales.length / (scrapeTime / 1000)).toFixed(1)} listings/sec`);
  } finally {
    const totalTime = Date.now() - startTime;
    console.log(`Total time: ${totalTime}ms`);
    await scraper.shutdown();
  }
}

benchmarkScraper();
```

### Monitor Memory Usage

```typescript
import { ListingsScraper } from './scrapers/listingsScraper';

async function monitorMemory() {
  const scraper = new ListingsScraper();

  console.log('Initial memory:', formatBytes(process.memoryUsage().heapUsed));

  try {
    await scraper.initialize();
    console.log('After init:', formatBytes(process.memoryUsage().heapUsed));

    const listings = await scraper.scrapeSales();
    console.log('After scrape:', formatBytes(process.memoryUsage().heapUsed));
  } finally {
    await scraper.shutdown();
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
    console.log('After shutdown:', formatBytes(process.memoryUsage().heapUsed));
  }
}

function formatBytes(bytes: number): string {
  return (bytes / 1024 / 1024).toFixed(1) + ' MB';
}

// Run with: node --expose-gc dist/index.js
monitorMemory();
```

## Testing Examples

### Unit Test

```typescript
import { ListingsScraper } from '../src/scrapers/listingsScraper';

describe('ListingsScraper', () => {
  let scraper: ListingsScraper;

  beforeEach(() => {
    scraper = new ListingsScraper();
  });

  afterEach(async () => {
    await scraper.shutdown();
  });

  test('should initialize browser pool', async () => {
    await scraper.initialize();
    // Browser should be ready
  });

  test('should scrape listings', async () => {
    await scraper.initialize();
    const listings = await scraper.scrapeSales();

    expect(listings.length).toBeGreaterThan(0);
    expect(listings[0]).toHaveProperty('id');
    expect(listings[0]).toHaveProperty('title');
    expect(listings[0]).toHaveProperty('price');
  });

  test('should handle navigation errors', async () => {
    await scraper.initialize();

    expect(async () => {
      await scraper.scrapeSales();
    }).not.toThrow();
  });
});
```

## Integration with Express Server

### Express Route Handler

```typescript
import express, { Request, Response } from 'express';
import { ListingsScraper } from './scrapers/listingsScraper';

const app = express();
let scrapingInProgress = false;

// POST /scrape - Trigger scraping
app.post('/scrape', async (req: Request, res: Response) => {
  if (scrapingInProgress) {
    return res.status(429).json({
      error: 'Scraping already in progress'
    });
  }

  // Respond immediately
  res.status(202).json({
    status: 'scraping started',
    timestamp: new Date().toISOString()
  });

  // Run scraping asynchronously
  scrapingInProgress = true;
  const scraper = new ListingsScraper();

  try {
    await scraper.initialize();
    const listings = await scraper.scrapeAll();
    console.log(`Successfully scraped ${listings.length} listings`);
  } catch (error) {
    console.error('Scraping error:', error);
  } finally {
    await scraper.shutdown();
    scrapingInProgress = false;
  }
});

// GET /status - Check scraping status
app.get('/status', (req: Request, res: Response) => {
  res.json({
    scrapingInProgress,
    timestamp: new Date().toISOString()
  });
});

app.listen(8086, () => {
  console.log('Scraper API running on port 8086');
});
```

## Docker Deployment Example

### Dockerfile

```dockerfile
FROM node:18-alpine

# Install Puppeteer dependencies
RUN apk add --no-cache \
  chromium \
  ca-certificates \
  ttf-freefont

# Set Puppeteer to use installed Chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY dist ./dist

ENV PORT=8086
ENV PUPPETEER_HEADLESS=true
ENV NODE_ENV=production

EXPOSE 8086

CMD ["node", "dist/index.js"]
```

### Docker Compose

```yaml
version: '3.8'

services:
  reality-scraper:
    build: .
    ports:
      - "8086:8086"
    environment:
      PUPPETEER_HEADLESS: 'true'
      BROWSER_TIMEOUT: 30000
      MAX_CONCURRENT_PAGES: 2
      INGEST_API_URL: http://ingest-api:3004
      INGEST_API_KEY_REALITY: dev_key
    volumes:
      - ./logs:/app/logs
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8086/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
```

## Troubleshooting

### Listings Not Found

```typescript
// Check if page is actually loading
import { browserPool } from './utils/browserPool';

async function debug() {
  await browserPool.initialize();
  const page = await browserPool.getPage();

  try {
    await browserPool.navigateWithRetry(page, 'https://www.reality.cz/prodej/byty/', 1, 'networkidle2');

    // Check page content
    const content = await browserPool.getPageContent(page);
    console.log('Page length:', content.length);

    // Save for inspection
    require('fs').writeFileSync('page.html', content);

    // Check for selectors
    const cheerio = require('cheerio');
    const $ = cheerio.load(content);
    console.log('Found elements:', {
      'property-items': $('.property-item').length,
      'offers': $('[data-id]').length,
      'all links': $('a').length
    });
  } finally {
    await browserPool.releasePage(page);
    await browserPool.shutdown();
  }
}

debug();
```

## Production Checklist

```typescript
import { ListingsScraper } from './scrapers/listingsScraper';
import { browserPool } from './utils/browserPool';

async function productionCheck() {
  console.log('Production Readiness Check');
  console.log('=========================');

  // Check 1: Configuration
  console.log('\n1. Configuration:');
  console.log(`   PUPPETEER_HEADLESS: ${process.env.PUPPETEER_HEADLESS}`);
  console.log(`   BROWSER_TIMEOUT: ${process.env.BROWSER_TIMEOUT}`);
  console.log(`   MAX_CONCURRENT_PAGES: ${process.env.MAX_CONCURRENT_PAGES}`);

  // Check 2: Memory
  const mem = process.memoryUsage();
  console.log('\n2. Memory Available:');
  console.log(`   Heap Used: ${(mem.heapUsed / 1024 / 1024).toFixed(1)} MB`);
  console.log(`   Heap Total: ${(mem.heapTotal / 1024 / 1024).toFixed(1)} MB`);

  // Check 3: Browser initialization
  console.log('\n3. Browser Initialization:');
  try {
    await browserPool.initialize();
    const status = browserPool.getStatus();
    console.log(`   Status: ✓ ${JSON.stringify(status)}`);
    await browserPool.shutdown();
  } catch (error) {
    console.log(`   Status: ✗ ${error}`);
  }

  // Check 4: Scraper functionality
  console.log('\n4. Scraper Functionality:');
  try {
    const scraper = new ListingsScraper();
    await scraper.initialize();
    const listings = await scraper.scrapeSales();
    console.log(`   Status: ✓ Found ${listings.length} listings`);
    await scraper.shutdown();
  } catch (error: any) {
    console.log(`   Status: ✗ ${error.message}`);
  }

  console.log('\n=========================');
  console.log('Check complete');
}

productionCheck();
```
