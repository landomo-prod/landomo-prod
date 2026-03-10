import { chromium } from 'playwright';
import * as fs from 'fs';

/**
 * Extract and analyze __UFRN_FETCHER__ data structure
 */
async function extractUfrnData() {
  console.log('\n🔬 Extracting __UFRN_FETCHER__ Data Structure\n');
  console.log('═══════════════════════════════════════════════\n');

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

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

    console.log('🌐 Loading page...\n');
    await page.goto('https://www.immowelt.de/suche/wohnungen/kaufen', {
      waitUntil: 'networkidle',
      timeout: 60000
    });

    await page.waitForTimeout(3000);

    // Extract full __UFRN_FETCHER__ data
    const ufrnFetcher = await page.evaluate(() => {
      return (window as any).__UFRN_FETCHER__;
    });

    // Extract __UFRN_LIFECYCLE_SERVERREQUEST__ data
    const ufrnLifecycle = await page.evaluate(() => {
      return (window as any).__UFRN_LIFECYCLE_SERVERREQUEST__;
    });

    // Save to files for analysis
    const timestamp = Date.now();
    const fetcherPath = `/tmp/immowelt-ufrn-fetcher-${timestamp}.json`;
    const lifecyclePath = `/tmp/immowelt-ufrn-lifecycle-${timestamp}.json`;

    fs.writeFileSync(fetcherPath, JSON.stringify(ufrnFetcher, null, 2));
    fs.writeFileSync(lifecyclePath, JSON.stringify(ufrnLifecycle, null, 2));

    console.log(`✓ Saved __UFRN_FETCHER__ to: ${fetcherPath}`);
    console.log(`✓ Saved __UFRN_LIFECYCLE_SERVERREQUEST__ to: ${lifecyclePath}\n`);

    // Analyze __UFRN_FETCHER__ structure
    console.log('📊 __UFRN_FETCHER__ Analysis:\n');

    if (ufrnFetcher?.data?.['classified-serp-init-data']) {
      const serpData = ufrnFetcher.data['classified-serp-init-data'];
      console.log('✓ Found classified-serp-init-data');
      console.log(`   Keys: ${Object.keys(serpData).join(', ')}\n`);

      // Check for classifieds/items
      if (serpData.items) {
        console.log(`✓ Found items array: ${serpData.items.length} items`);

        if (serpData.items.length > 0) {
          const sampleItem = serpData.items[0];
          console.log('\n📋 Sample Item Structure:');
          console.log(`   Keys: ${Object.keys(sampleItem).join(', ')}`);
          console.log('\n   Full Sample:');
          console.log(JSON.stringify(sampleItem, null, 2).substring(0, 2000));
        }
      } else if (serpData.classifieds) {
        console.log(`✓ Found classifieds array: ${serpData.classifieds.length} items`);

        if (serpData.classifieds.length > 0) {
          const sampleItem = serpData.classifieds[0];
          console.log('\n📋 Sample Classified Structure:');
          console.log(`   Keys: ${Object.keys(sampleItem).join(', ')}`);
          console.log('\n   Full Sample:');
          console.log(JSON.stringify(sampleItem, null, 2).substring(0, 2000));
        }
      } else if (serpData.results) {
        console.log(`✓ Found results array: ${serpData.results.length} items`);

        if (serpData.results.length > 0) {
          const sampleItem = serpData.results[0];
          console.log('\n📋 Sample Result Structure:');
          console.log(`   Keys: ${Object.keys(sampleItem).join(', ')}`);
          console.log('\n   Full Sample:');
          console.log(JSON.stringify(sampleItem, null, 2).substring(0, 2000));
        }
      } else {
        console.log('⚠️  No items/classifieds/results found in serpData');
        console.log(`   Available keys: ${Object.keys(serpData).join(', ')}`);
      }

      // Check for pagination info
      if (serpData.pagination) {
        console.log('\n📄 Pagination Info:');
        console.log(JSON.stringify(serpData.pagination, null, 2));
      }

      // Check for metadata
      if (serpData.metadata) {
        console.log('\n📊 Metadata:');
        console.log(JSON.stringify(serpData.metadata, null, 2));
      }

      // Check for totalCount
      if (serpData.totalCount || serpData.total || serpData.count) {
        console.log('\n📈 Total Count:');
        console.log(`   totalCount: ${serpData.totalCount}`);
        console.log(`   total: ${serpData.total}`);
        console.log(`   count: ${serpData.count}`);
      }
    } else {
      console.log('⚠️  No classified-serp-init-data found in __UFRN_FETCHER__');
      console.log(`   Available keys in data: ${Object.keys(ufrnFetcher?.data || {}).join(', ')}`);
    }

    await context.close();

  } catch (error: any) {
    console.error('❌ Extraction failed:', error.message);
  } finally {
    await browser.close();
  }

  console.log('\n═══════════════════════════════════════════════');
  console.log('✓ Extraction complete\n');
}

extractUfrnData();
