#!/usr/bin/env ts-node

/**
 * Verify the correct URLs for house listings
 */

import { chromium } from 'playwright';

async function testUrl(url: string): Promise<void> {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    locale: 'de-AT',
    viewport: { width: 1920, height: 1080 }
  });

  const page = await context.newPage();

  try {
    console.log(`\nTesting: ${url}`);

    await page.goto(url, {
      waitUntil: 'networkidle',
      timeout: 60000
    });
    await page.waitForTimeout(2000);

    // Check HTTP status
    const response = await page.goto(url, { waitUntil: 'networkidle' });
    console.log(`  Status: ${response?.status()}`);

    // Get total hits
    const totalHits = await page.evaluate(() => {
      const state = (window as any).__INITIAL_STATE__;
      if (state && state.properties && state.properties.totalHits) {
        return state.properties.totalHits;
      }
      return 0;
    });
    console.log(`  Total hits: ${totalHits.toLocaleString()}`);

    // Get page title
    const title = await page.title();
    console.log(`  Title: ${title}`);

    // Check for error messages
    const errorMessage = await page.evaluate(() => {
      const notFound = document.querySelector('h1, .error-message, .not-found');
      return notFound?.textContent?.trim() || '';
    });
    if (errorMessage) {
      console.log(`  Error message: ${errorMessage}`);
    }

  } catch (error: any) {
    console.log(`  ❌ Error: ${error.message}`);
  } finally {
    await page.close();
  }

  await context.close();
  await browser.close();
}

async function main() {
  console.log('='.repeat(80));
  console.log('VERIFY HOUSE URLs');
  console.log('='.repeat(80));

  const urlsToTest = [
    'https://www.immodirekt.at/miethauser/oesterreich',
    'https://www.immodirekt.at/hauser/oesterreich',
    'https://www.immodirekt.at/haeuser-mieten/oesterreich',
    'https://www.immodirekt.at/haeuser-kaufen/oesterreich',
    'https://www.immodirekt.at/hauser-mieten/oesterreich',
    'https://www.immodirekt.at/hauser-kaufen/oesterreich'
  ];

  for (const url of urlsToTest) {
    await testUrl(url);
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log('\n' + '='.repeat(80));
}

main()
  .then(() => {
    console.log('\n✅ Verification complete\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Verification failed:', error.message);
    process.exit(1);
  });
