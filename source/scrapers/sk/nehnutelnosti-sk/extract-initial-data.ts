/**
 * Extract initial data from Nehnuteľnosti.sk page HTML
 */
import { chromium } from 'playwright';
import * as fs from 'fs';

async function extract() {
  console.log('🔍 Extracting initial data from page...\n');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1920, height: 1080 },
    locale: 'sk-SK',
    timezoneId: 'Europe/Bratislava'
  });

  const page = await context.newPage();

  try {
    const url = 'https://www.nehnutelnosti.sk/bratislavsky-kraj/byty/predaj/';
    console.log(`Navigating to: ${url}\n`);

    await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(5000);

    // Get full HTML
    const html = await page.content();

    // Look for Next.js data
    console.log('Looking for Next.js __NEXT_DATA__...');
    const nextData = await page.evaluate(() => {
      const scriptTag = document.getElementById('__NEXT_DATA__');
      if (scriptTag) {
        return scriptTag.textContent;
      }
      return null;
    });

    if (nextData) {
      const data = JSON.parse(nextData);
      fs.writeFileSync('nehnutelnosti-next-data.json', JSON.stringify(data, null, 2));
      console.log('✅ Found __NEXT_DATA__! Saved to nehnutelnosti-next-data.json');

      // Check if it contains listings
      const dataStr = JSON.stringify(data);
      if (dataStr.includes('byt') || dataStr.includes('inzer')) {
        console.log('✅ Data contains listings information!\n');

        // Try to find the listings array
        const findListings = (obj: any, path: string = ''): any => {
          if (Array.isArray(obj) && obj.length > 0) {
            const first = obj[0];
            if (first && (first.id || first.title || first.price)) {
              console.log(`Found potential listings array at: ${path}`);
              console.log(`Array length: ${obj.length}`);
              console.log(`First item keys: ${Object.keys(first).join(', ')}`);
              console.log(`Sample:`, JSON.stringify(first).substring(0, 200));
              return { path, data: obj };
            }
          }

          if (typeof obj === 'object' && obj !== null) {
            for (const key in obj) {
              const result = findListings(obj[key], path ? `${path}.${key}` : key);
              if (result) return result;
            }
          }
          return null;
        };

        const listings = findListings(data);
        if (listings) {
          console.log('\n✅ FOUND LISTINGS DATA!');
          fs.writeFileSync('nehnutelnosti-listings-sample.json', JSON.stringify(listings.data.slice(0, 3), null, 2));
          console.log('Sample saved to nehnutelnosti-listings-sample.json');
        }
      }
    } else {
      console.log('⚠️  No __NEXT_DATA__ found');
    }

    // Look for other script tags with JSON data
    console.log('\nLooking for other JSON data in script tags...');
    const scripts = await page.evaluate(() => {
      const scripts = Array.from(document.querySelectorAll('script'));
      return scripts
        .filter(s => s.textContent && (s.textContent.includes('{') || s.textContent.includes('[')))
        .map(s => ({
          id: s.id,
          type: s.type,
          content: s.textContent?.substring(0, 500)
        }));
    });

    const jsonScripts = scripts.filter(s =>
      s.content && (s.content.includes('inzerát') || s.content.includes('"id"') && s.content.includes('"price"'))
    );

    if (jsonScripts.length > 0) {
      console.log(`Found ${jsonScripts.length} script tags with potential data`);
      jsonScripts.forEach((script, idx) => {
        console.log(`\n${idx + 1}. Script (type: ${script.type}, id: ${script.id})`);
        console.log(script.content?.substring(0, 300));
      });
    }

  } catch (error: any) {
    console.error('❌ Error:', error.message);
  } finally {
    await browser.close();
  }
}

extract();
