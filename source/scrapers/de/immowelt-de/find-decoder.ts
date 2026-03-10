import { chromium } from 'playwright';

/**
 * Find the decoder function used by the page
 */
async function findDecoder() {
  console.log('\n🔍 Finding Decoder Function\n');
  console.log('═══════════════════════════════════════════════\n');

  const browser = await chromium.launch({
    headless: false, // Use visible browser to debug
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

    await page.waitForTimeout(5000); // Wait for page to fully load and execute JS

    // Search for decoder/decompressor in window object
    const decoderInfo = await page.evaluate(() => {
      const results: any = {
        windowKeys: [],
        possibleDecoders: [],
        ufrnRelated: [],
        compressionLibs: [],
      };

      // Check all window properties
      for (const key in window) {
        if (key.includes('UFRN') || key.includes('decode') || key.includes('decompress')) {
          results.windowKeys.push(key);
        }

        // Check for UFRN-related
        if (key.toUpperCase().includes('UFRN')) {
          results.ufrnRelated.push({
            key,
            type: typeof (window as any)[key],
            value: (window as any)[key]?.constructor?.name,
          });
        }

        // Check for compression libraries
        if (key.toLowerCase().includes('lz') ||
            key.toLowerCase().includes('compress') ||
            key.toLowerCase().includes('pako') ||
            key.toLowerCase().includes('inflate')) {
          results.compressionLibs.push(key);
        }
      }

      // Check if there's a React hydration/dehydration system
      const reactKeys = Object.keys(window).filter(k =>
        k.includes('react') || k.includes('React') || k.includes('REACT')
      );
      results.reactKeys = reactKeys;

      // Try to find the actual function that processes __UFRN_FETCHER__
      const scripts = Array.from(document.querySelectorAll('script[src]'));
      results.scriptSources = scripts.map(s => (s as HTMLScriptElement).src).filter(src =>
        src.includes('chunk') || src.includes('main') || src.includes('app')
      );

      return results;
    });

    console.log('📦 Window Keys Related to Decoding:');
    console.log(JSON.stringify(decoderInfo, null, 2));

    // Try to intercept network requests to see if data is fetched via API
    console.log('\n🌐 Monitoring Network Requests...\n');

    const apiCalls: any[] = [];

    page.on('response', async (response) => {
      const url = response.url();
      if (url.includes('api') || url.includes('classified') || url.includes('serp')) {
        try {
          const json = await response.json();
          apiCalls.push({
            url,
            status: response.status(),
            hasItems: !!(json.items || json.classifieds || json.results),
          });
          console.log(`✓ API Call: ${url.substring(0, 80)}...`);
        } catch (e) {
          // Not JSON
        }
      }
    });

    // Scroll to trigger more content
    await page.evaluate(() => {
      window.scrollTo(0, 1000);
    });

    await page.waitForTimeout(3000);

    console.log('\n📊 API Calls Found:', apiCalls.length);
    if (apiCalls.length > 0) {
      console.log(JSON.stringify(apiCalls, null, 2));
    }

    console.log('\n💡 Hint: Check browser console in the visible window for more clues');
    console.log('   Press Ctrl+C when done inspecting\n');

    // Keep browser open for manual inspection
    await page.waitForTimeout(60000);

    await context.close();

  } catch (error: any) {
    console.error('❌ Error:', error.message);
  } finally {
    await browser.close();
  }
}

findDecoder();
