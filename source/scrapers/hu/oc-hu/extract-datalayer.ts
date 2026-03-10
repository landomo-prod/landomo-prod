/**
 * Extract property data from OC.hu window.dataLayer
 */
import { chromium } from 'playwright';
import * as fs from 'fs';

async function extractDataLayer() {
  console.log('🔍 Extracting property data from OC.hu window.dataLayer...\n');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    locale: 'hu-HU'
  });

  const page = await context.newPage();

  try {
    console.log('🌐 Navigating to OC.hu listings page...\n');
    await page.goto('https://oc.hu/ingatlanok/lista/ertekesites:elado', {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    console.log('⏳ Waiting for dataLayer to populate...\n');
    await page.waitForTimeout(3000);

    // Extract window.dataLayer
    const dataLayer = await page.evaluate(() => {
      return (window as any).dataLayer || [];
    });

    console.log(`✅ Found ${dataLayer.length} entries in window.dataLayer\n`);

    // Find ecommerce data with items
    const ecommerceData = dataLayer.filter((entry: any) =>
      entry.ecommerce && entry.ecommerce.items
    );

    if (ecommerceData.length > 0) {
      console.log(`🏠 Found ${ecommerceData.length} ecommerce entry/entries with property items\n`);

      ecommerceData.forEach((entry: any, i: number) => {
        const items = entry.ecommerce.items;
        console.log(`Entry ${i + 1}: ${items.length} properties`);

        if (items.length > 0) {
          console.log('\n📊 Sample Properties:');
          items.slice(0, 3).forEach((item: any, j: number) => {
            console.log(`\n   ${j + 1}. ${item.item_name || item.item_id || 'Unknown'}`);
            console.log(`      Type: ${item.real_estate_type || 'N/A'}`);
            console.log(`      Sale Type: ${item.type_of_sale || 'N/A'}`);
            console.log(`      Size: ${item.size || 'N/A'} m²`);
            console.log(`      Price: ${item.price?.toLocaleString()} ${item.currency || 'HUF'}`);
            console.log(`      Location: ${item.location_city || 'N/A'}, ${item.location_district || ''}`);
            console.log(`      Street: ${item.location_street || 'N/A'}`);
            console.log(`      ID: ${item.item_id || 'N/A'}`);
            console.log(`      All keys: ${Object.keys(item).join(', ')}`);
          });

          console.log(`\n   ... and ${items.length - 3} more properties`);

          // Save full data
          const filename = '/tmp/oc-hu-datalayer.json';
          fs.writeFileSync(filename, JSON.stringify(entry, null, 2));
          console.log(`\n💾 Full ecommerce data saved to: ${filename}`);
        }
      });

      console.log('\n' + '='.repeat(80));
      console.log('✅ SUCCESS! OC.hu embeds property data in window.dataLayer!');
      console.log('='.repeat(80));
      console.log('\nApproach: Scrape HTML page and extract window.dataLayer');
      console.log('Data Location: window.dataLayer[].ecommerce.items[]');
      console.log('Properties per page: ~12-20 items');

    } else {
      console.log('⚠️  No ecommerce data found in window.dataLayer');

      // Show all dataLayer entries
      console.log('\nAll dataLayer entries:');
      dataLayer.forEach((entry: any, i: number) => {
        console.log(`\n${i + 1}. ${JSON.stringify(entry, null, 2).substring(0, 300)}`);
      });
    }

  } catch (error: any) {
    console.error(`\n❌ Error: ${error.message}`);
  } finally {
    await browser.close();
  }
}

extractDataLayer();
