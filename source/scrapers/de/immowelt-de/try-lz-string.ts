import { chromium } from 'playwright';
import * as LZString from 'lz-string';
import * as fs from 'fs';

/**
 * Try decoding with LZ-String compression
 */
async function tryLZString() {
  console.log('\n🔬 Trying LZ-String Decompression\n');
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

    // Get encoded string
    const encodedString = await page.evaluate(() => {
      return (window as any).__UFRN_FETCHER__?.data?.['classified-serp-init-data'];
    });

    if (!encodedString) {
      console.error('❌ No encoded data found');
      return;
    }

    console.log(`📦 Encoded string length: ${encodedString.length}\n`);

    // Try different LZ-String methods
    const methods = [
      { name: 'decompressFromBase64', fn: LZString.decompressFromBase64 },
      { name: 'decompressFromUTF16', fn: LZString.decompressFromUTF16 },
      { name: 'decompressFromEncodedURIComponent', fn: LZString.decompressFromEncodedURIComponent },
      { name: 'decompress', fn: LZString.decompress },
    ];

    for (const method of methods) {
      try {
        console.log(`Testing ${method.name}...`);
        const decompressed = method.fn(encodedString);

        if (decompressed) {
          console.log(`✅ ${method.name} succeeded!`);
          console.log(`   Decompressed length: ${decompressed.length} chars\n`);

          // Try to parse as JSON
          try {
            const parsed = JSON.parse(decompressed);
            console.log(`✅ Successfully parsed JSON!`);
            console.log(`   Type: ${Array.isArray(parsed) ? 'array' : 'object'}`);

            if (Array.isArray(parsed)) {
              console.log(`   Items: ${parsed.length}\n`);

              if (parsed.length > 0) {
                console.log('📋 Sample Item (first 2000 chars):');
                console.log(JSON.stringify(parsed[0], null, 2).substring(0, 2000));
                console.log('\n...\n');

                // Save to file
                const outputPath = '/tmp/immowelt-decoded-listings.json';
                fs.writeFileSync(outputPath, JSON.stringify(parsed, null, 2));
                console.log(`\n✓ Saved ${parsed.length} listings to: ${outputPath}\n`);
              }
            } else {
              console.log(`   Keys: ${Object.keys(parsed).slice(0, 10).join(', ')}\n`);

              // Look for listings
              const possibleKeys = ['items', 'classifieds', 'results', 'listings', 'properties', 'data'];
              for (const key of possibleKeys) {
                if (parsed[key] && Array.isArray(parsed[key])) {
                  console.log(`✓ Found listings at .${key}: ${parsed[key].length} items`);

                  if (parsed[key].length > 0) {
                    console.log('\n📋 Sample Item:');
                    console.log(JSON.stringify(parsed[key][0], null, 2).substring(0, 2000));
                  }

                  // Save to file
                  const outputPath = '/tmp/immowelt-decoded-listings.json';
                  fs.writeFileSync(outputPath, JSON.stringify(parsed[key], null, 2));
                  console.log(`\n✓ Saved ${parsed[key].length} listings to: ${outputPath}\n`);
                  break;
                }
              }
            }

            break; // Success, stop trying other methods
          } catch (e) {
            console.log(`   ⚠️  Not valid JSON\n`);
          }
        }
      } catch (e) {
        console.log(`   ✗ ${method.name} failed\n`);
      }
    }

    await context.close();

  } catch (error: any) {
    console.error('❌ Error:', error.message);
  } finally {
    await browser.close();
  }

  console.log('═══════════════════════════════════════════════');
  console.log('✓ Complete\n');
}

tryLZString();
