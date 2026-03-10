import { chromium } from 'playwright';

/**
 * Quick fix demonstration - extracting listing URLs from immowelt.de
 * Shows how to adapt to the new architecture
 */
async function quickFixTest() {
  console.log('\n🔧 Quick Fix Test - Alternative Data Extraction\n');
  console.log('═══════════════════════════════════════════════\n');

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled']
  });

  const startTime = Date.now();
  let totalListings = 0;

  try {
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1920, height: 1080 },
      locale: 'de-DE',
    });

    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    });

    const page = await context.newPage();

    // Test with apartments for sale
    console.log('🌐 Testing: Apartments for Sale');
    console.log('   URL: https://www.immowelt.de/suche/wohnungen/kaufen\n');

    const fetchStart = Date.now();
    await page.goto('https://www.immowelt.de/suche/wohnungen/kaufen', {
      waitUntil: 'networkidle',
      timeout: 60000
    });

    await page.waitForTimeout(3000);

    // Method 1: Extract window.__UFRN_FETCHER__
    console.log('📊 Method 1: Extracting __UFRN_FETCHER__ data...');
    const ufrnData = await page.evaluate(() => {
      const fetcher = (window as any).__UFRN_FETCHER__;
      if (fetcher) {
        return {
          exists: true,
          data: fetcher.data,
          errors: fetcher.errors
        };
      }
      return { exists: false };
    });

    if (ufrnData.exists) {
      console.log('✓ __UFRN_FETCHER__ found');
      console.log(`   Data keys: ${Object.keys(ufrnData.data || {}).join(', ')}`);
      console.log(`   Sample: ${JSON.stringify(ufrnData.data).substring(0, 200)}...\n`);
    } else {
      console.log('✗ __UFRN_FETCHER__ not found\n');
    }

    // Method 2: Extract listing URLs directly
    console.log('📊 Method 2: Extracting listing URLs from DOM...');
    const listings = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a[href*="/expose/"]'));

      return links.map(link => {
        const anchor = link as HTMLAnchorElement;
        const url = anchor.href;
        const id = url.match(/\/expose\/([^?]+)/)?.[1] || '';

        // Try to extract data from parent elements
        const parent = anchor.closest('article, [class*="EstateItem"], [class*="ListCard"]');

        let title = '';
        let price = '';
        let location = '';

        if (parent) {
          // Try to find title
          const titleEl = parent.querySelector('h2, h3, [class*="title"], [class*="Title"]');
          title = titleEl?.textContent?.trim() || '';

          // Try to find price
          const priceEl = parent.querySelector('[class*="price"], [class*="Price"]');
          price = priceEl?.textContent?.trim() || '';

          // Try to find location
          const locationEl = parent.querySelector('[class*="location"], [class*="Location"], [class*="address"]');
          location = locationEl?.textContent?.trim() || '';
        }

        return {
          id,
          url,
          title,
          price,
          location
        };
      });
    });

    const fetchTime = (Date.now() - fetchStart) / 1000;
    totalListings = listings.length;

    console.log(`✓ Found ${listings.length} listing URLs`);
    console.log(`   Fetch time: ${fetchTime.toFixed(2)}s`);
    console.log(`   Speed: ${(listings.length / fetchTime).toFixed(2)} listings/sec\n`);

    // Show sample listings
    if (listings.length > 0) {
      console.log('📋 Sample Listings (first 5):\n');
      listings.slice(0, 5).forEach((listing, i) => {
        console.log(`${i + 1}. ID: ${listing.id}`);
        console.log(`   Title: ${listing.title || 'N/A'}`);
        console.log(`   Price: ${listing.price || 'N/A'}`);
        console.log(`   Location: ${listing.location || 'N/A'}`);
        console.log(`   URL: ${listing.url}`);
        console.log();
      });
    }

    // Method 3: Check for API endpoints
    console.log('📊 Method 3: Monitoring for API calls...');
    const apiCalls: string[] = [];

    page.on('response', async (response) => {
      const url = response.url();
      if (
        (url.includes('api') || url.includes('graphql')) &&
        response.headers()['content-type']?.includes('json')
      ) {
        apiCalls.push(url);
      }
    });

    // Trigger potential API calls
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
    await page.waitForTimeout(2000);

    if (apiCalls.length > 0) {
      console.log(`✓ Found ${apiCalls.length} API endpoints:`);
      apiCalls.forEach(url => console.log(`   - ${url}`));
    } else {
      console.log('✗ No API calls detected (data may be server-side rendered)\n');
    }

    // Calculate overall metrics
    const totalTime = (Date.now() - startTime) / 1000;

    console.log('\n═══════════════════════════════════════════════');
    console.log('📈 QUICK FIX TEST RESULTS');
    console.log('═══════════════════════════════════════════════\n');

    console.log('✅ Success Metrics:');
    console.log(`   Total listings found: ${totalListings}`);
    console.log(`   Fetch time: ${fetchTime.toFixed(2)}s`);
    console.log(`   Total time: ${totalTime.toFixed(2)}s`);
    console.log(`   Speed: ${(totalListings / fetchTime).toFixed(2)} listings/sec\n`);

    console.log('🔧 Recommended Fix:');
    console.log('   1. Update extractListingsFromPage() to extract URLs from DOM');
    console.log('   2. Add parseListingFromUrl() to scrape individual listing pages');
    console.log('   3. Optional: Parse __UFRN_FETCHER__ for inline data if available');
    console.log('   4. Fix pagination selectors to find next page button\n');

    console.log('💡 Alternative Strategy:');
    console.log('   - Scrape search page for listing URLs (fast)');
    console.log('   - Then scrape each listing detail page individually (slower but reliable)');
    console.log('   - Implement parallel fetching with rate limiting\n');

    await context.close();

  } catch (error: any) {
    console.error('❌ Test failed:', error.message);
  } finally {
    await browser.close();
  }

  console.log('═══════════════════════════════════════════════');
  console.log('✓ Quick fix test complete\n');
}

quickFixTest();
