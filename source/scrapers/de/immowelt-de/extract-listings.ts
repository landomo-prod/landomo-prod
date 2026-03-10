import { chromium } from 'playwright';
import * as LZString from 'lz-string';
import * as fs from 'fs';

/**
 * Extract listings from __UFRN_FETCHER__ data
 */
async function extractListings() {
  console.log('\n🔬 Extracting Listings from __UFRN_FETCHER__\n');
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

    console.log('🌐 Loading search page...\n');
    await page.goto('https://www.immowelt.de/suche/wohnungen/kaufen', {
      waitUntil: 'networkidle',
      timeout: 60000
    });

    await page.waitForTimeout(3000);

    // Get and decode data
    const encodedString = await page.evaluate(() => {
      return (window as any).__UFRN_FETCHER__?.data?.['classified-serp-init-data'];
    });

    if (!encodedString) {
      console.error('❌ No encoded data found');
      return;
    }

    console.log(`📦 Decoding ${encodedString.length} chars...\n`);

    const decompressed = LZString.decompressFromBase64(encodedString);
    if (!decompressed) {
      console.error('❌ Decompression failed');
      return;
    }

    const data = JSON.parse(decompressed);
    console.log(`✅ Decoded successfully!`);
    console.log(`   Top-level keys: ${Object.keys(data).join(', ')}\n`);

    // Navigate through the structure to find listings
    function findListings(obj: any, path: string = ''): any {
      if (Array.isArray(obj) && obj.length > 0 && obj[0]?.id) {
        // Found array of objects with IDs - likely listings
        return { path, data: obj };
      }

      if (typeof obj === 'object' && obj !== null) {
        for (const key in obj) {
          const result = findListings(obj[key], path ? `${path}.${key}` : key);
          if (result) return result;
        }
      }

      return null;
    }

    const listingsLocation = findListings(data);

    if (listingsLocation) {
      console.log(`✅ Found listings at: ${listingsLocation.path}`);
      console.log(`   Count: ${listingsLocation.data.length}\n`);

      if (listingsLocation.data.length > 0) {
        const sample = listingsLocation.data[0];
        console.log('📋 Sample Listing Keys:');
        console.log(`   ${Object.keys(sample).join(', ')}\n`);

        console.log('📋 Sample Listing (first 3000 chars):');
        console.log(JSON.stringify(sample, null, 2).substring(0, 3000));
        console.log('\n...\n');

        // Save all listings
        const outputPath = '/tmp/immowelt-extracted-listings.json';
        fs.writeFileSync(outputPath, JSON.stringify(listingsLocation.data, null, 2));
        console.log(`✓ Saved ${listingsLocation.data.length} listings to: ${outputPath}\n`);

        // Also save full structure for reference
        const fullPath = '/tmp/immowelt-full-structure.json';
        fs.writeFileSync(fullPath, JSON.stringify(data, null, 2));
        console.log(`✓ Saved full structure to: ${fullPath}\n`);

        // Extract key fields from first few listings
        console.log('📊 Field Analysis (first 3 listings):\n');
        for (let i = 0; i < Math.min(3, listingsLocation.data.length); i++) {
          const listing = listingsLocation.data[i];
          console.log(`Listing ${i + 1}:`);
          console.log(`  ID: ${listing.id || listing.EstateId || listing.onlineId}`);
          console.log(`  Title: ${listing.title || listing.headline}`);
          console.log(`  Price: ${listing.price?.value || listing.price} ${listing.price?.currency || ''}`);
          console.log(`  Location: ${listing.location?.address?.city || listing.generalData?.city}`);
          console.log(`  Area: ${listing.areas?.livingArea || listing.equipmentAreas?.livingArea?.value} m²`);
          console.log(`  Rooms: ${listing.equipmentAreas?.numberOfRooms?.value || listing.rooms}`);
          console.log(`  URL: ${listing.onlineId ? `https://www.immowelt.de/expose/${listing.onlineId}` : 'N/A'}`);
          console.log();
        }
      }
    } else {
      console.log('⚠️  Could not find listings array automatically');
      console.log('   Saving full structure for manual inspection...\n');

      const fullPath = '/tmp/immowelt-full-structure.json';
      fs.writeFileSync(fullPath, JSON.stringify(data, null, 2));
      console.log(`✓ Saved full structure to: ${fullPath}`);
      console.log(`   Inspect this file to find the listings path\n`);
    }

    await context.close();

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await browser.close();
  }

  console.log('═══════════════════════════════════════════════');
  console.log('✓ Complete\n');
}

extractListings();
