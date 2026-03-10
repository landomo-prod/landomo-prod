import { chromium } from 'playwright';
import * as fs from 'fs';
import * as zlib from 'zlib';

/**
 * Decode and extract __UFRN_FETCHER__ compressed data
 */
async function decodeUfrnData() {
  console.log('\n🔬 Decoding __UFRN_FETCHER__ Compressed Data\n');
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

    // Try to decode the data in the browser context (they might have a decoder function)
    const decodedData = await page.evaluate(() => {
      const ufrnFetcher = (window as any).__UFRN_FETCHER__;

      if (!ufrnFetcher?.data?.['classified-serp-init-data']) {
        return { error: 'No classified-serp-init-data found' };
      }

      const encodedData = ufrnFetcher.data['classified-serp-init-data'];

      // Try to find decoder function in window
      // Common patterns: decode, decompress, inflate, etc.
      const possibleDecoders = [
        (window as any).__UFRN_DECODE__,
        (window as any).__DECODE__,
        (window as any).decode,
        (window as any).decompress,
      ];

      for (const decoder of possibleDecoders) {
        if (typeof decoder === 'function') {
          try {
            const decoded = decoder(encodedData);
            return { success: true, data: decoded, method: 'window decoder' };
          } catch (e) {
            // Try next decoder
          }
        }
      }

      // If no decoder found, return raw data for external decoding
      return {
        success: false,
        encodedData: encodedData.substring(0, 100) + '...',
        fullLength: encodedData.length,
        needsExternalDecoding: true
      };
    });

    console.log('📊 Decoded Data Result:\n');
    console.log(JSON.stringify(decodedData, null, 2).substring(0, 5000));

    if (decodedData.success && decodedData.data) {
      console.log('\n✅ Successfully decoded data!');

      // Check structure
      if (Array.isArray(decodedData.data)) {
        console.log(`\n📋 Found ${decodedData.data.length} listings\n`);

        if (decodedData.data.length > 0) {
          console.log('Sample listing:');
          console.log(JSON.stringify(decodedData.data[0], null, 2).substring(0, 2000));

          // Save full data
          const outputPath = '/tmp/immowelt-decoded-listings.json';
          fs.writeFileSync(outputPath, JSON.stringify(decodedData.data, null, 2));
          console.log(`\n✓ Saved ${decodedData.data.length} listings to: ${outputPath}`);
        }
      } else if (typeof decodedData.data === 'object') {
        console.log('\n📦 Decoded to object with keys:', Object.keys(decodedData.data));

        // Look for listings in common locations
        const possibleListingKeys = ['items', 'classifieds', 'results', 'listings', 'properties'];
        for (const key of possibleListingKeys) {
          if (Array.isArray(decodedData.data[key])) {
            console.log(`\n✓ Found listings array at .${key}: ${decodedData.data[key].length} items`);

            if (decodedData.data[key].length > 0) {
              console.log('\nSample listing:');
              console.log(JSON.stringify(decodedData.data[key][0], null, 2).substring(0, 2000));
            }
            break;
          }
        }

        // Save full decoded object
        const outputPath = '/tmp/immowelt-decoded-data.json';
        fs.writeFileSync(outputPath, JSON.stringify(decodedData.data, null, 2));
        console.log(`\n✓ Saved decoded data to: ${outputPath}`);
      }
    } else {
      console.log('\n⚠️  Could not decode in browser. Trying external decoding...\n');

      // Get the encoded string
      const encodedString = await page.evaluate(() => {
        return (window as any).__UFRN_FETCHER__?.data?.['classified-serp-init-data'];
      });

      if (encodedString) {
        console.log(`📦 Encoded string length: ${encodedString.length}`);
        console.log(`📦 First 100 chars: ${encodedString.substring(0, 100)}\n`);

        // Try base64 decode + decompress
        try {
          const buffer = Buffer.from(encodedString, 'base64');
          console.log(`✓ Base64 decoded to ${buffer.length} bytes`);

          // Try different decompression methods
          const methods = [
            { name: 'gzip', fn: zlib.gunzipSync },
            { name: 'deflate', fn: zlib.inflateSync },
            { name: 'inflate-raw', fn: zlib.inflateRawSync },
            { name: 'brotli', fn: zlib.brotliDecompressSync },
          ];

          for (const method of methods) {
            try {
              const decompressed = method.fn(buffer);
              const jsonString = decompressed.toString('utf-8');
              const parsed = JSON.parse(jsonString);

              console.log(`\n✅ Successfully decoded with ${method.name}!`);
              console.log(`📋 Data type: ${Array.isArray(parsed) ? 'array' : 'object'}`);

              if (Array.isArray(parsed)) {
                console.log(`📋 Array length: ${parsed.length}`);
                if (parsed.length > 0) {
                  console.log('\nSample item:');
                  console.log(JSON.stringify(parsed[0], null, 2).substring(0, 2000));
                }
              } else {
                console.log(`📋 Object keys: ${Object.keys(parsed).join(', ')}`);
              }

              // Save
              const outputPath = `/tmp/immowelt-decoded-${method.name}.json`;
              fs.writeFileSync(outputPath, JSON.stringify(parsed, null, 2));
              console.log(`\n✓ Saved to: ${outputPath}`);

              break; // Stop after first successful decode
            } catch (e) {
              console.log(`   ✗ ${method.name} failed`);
            }
          }
        } catch (e: any) {
          console.error('❌ Base64 decode failed:', e.message);
        }
      }
    }

    await context.close();

  } catch (error: any) {
    console.error('❌ Extraction failed:', error.message);
  } finally {
    await browser.close();
  }

  console.log('\n═══════════════════════════════════════════════');
  console.log('✓ Decoding complete\n');
}

decodeUfrnData();
