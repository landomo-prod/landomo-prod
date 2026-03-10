import { chromium } from 'playwright';

/**
 * Deep diagnostic to find alternative data sources
 */
async function deepDiagnostic() {
  console.log('\n🔬 Deep Diagnostic for Immowelt.de Data Sources\n');
  console.log('═══════════════════════════════════════════════\n');

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled']
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

    console.log('🌐 Loading page...');
    await page.goto('https://www.immowelt.de/suche/wohnungen/kaufen', {
      waitUntil: 'networkidle',
      timeout: 60000
    });

    await page.waitForTimeout(5000);

    // 1. Check for JSON-LD data
    console.log('\n📊 Extracting JSON-LD data...');
    const jsonLdData = await page.evaluate(() => {
      const scripts = document.querySelectorAll('script[type="application/ld+json"]');
      const data: any[] = [];

      scripts.forEach(script => {
        try {
          const parsed = JSON.parse(script.textContent || '');
          data.push(parsed);
        } catch (e) {
          // Skip
        }
      });

      return data;
    });

    console.log(`Found ${jsonLdData.length} JSON-LD blocks:`);
    jsonLdData.forEach((data, i) => {
      console.log(`\n${i + 1}. Type: ${data['@type'] || 'Unknown'}`);
      console.log(JSON.stringify(data, null, 2).substring(0, 500) + '...');
    });

    // 2. Check for window variables
    console.log('\n\n🪟 Checking window variables...');
    const windowVars = await page.evaluate(() => {
      const vars: any = {};
      const keys = Object.keys(window as any);

      // Look for common data patterns
      const patterns = ['__', 'APP', 'INITIAL', 'STATE', 'DATA', 'PROPS', 'CONFIG', 'SEARCH'];

      patterns.forEach(pattern => {
        const matches = keys.filter(k => k.includes(pattern));
        matches.forEach(key => {
          try {
            const value = (window as any)[key];
            if (value && typeof value === 'object') {
              vars[key] = {
                type: typeof value,
                isArray: Array.isArray(value),
                keys: Object.keys(value).slice(0, 10),
                sample: JSON.stringify(value).substring(0, 200)
              };
            }
          } catch (e) {
            // Skip circular references
          }
        });
      });

      return vars;
    });

    console.log('Found window variables:');
    Object.entries(windowVars).forEach(([key, value]: [string, any]) => {
      console.log(`\n   ${key}:`);
      console.log(`   - Type: ${value.type}`);
      console.log(`   - Is Array: ${value.isArray}`);
      console.log(`   - Keys: ${value.keys.join(', ')}`);
      console.log(`   - Sample: ${value.sample}...`);
    });

    // 3. Check for API calls in network
    console.log('\n\n🌐 Monitoring network requests...');
    const apiCalls: any[] = [];

    page.on('response', async (response) => {
      const url = response.url();
      if (url.includes('api') || url.includes('json') || url.includes('search') || url.includes('graphql')) {
        try {
          const contentType = response.headers()['content-type'] || '';
          if (contentType.includes('json')) {
            const body = await response.text();
            apiCalls.push({
              url,
              status: response.status(),
              method: response.request().method(),
              bodyPreview: body.substring(0, 200)
            });
          }
        } catch (e) {
          // Skip
        }
      }
    });

    // Scroll to trigger any lazy loading
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight / 2);
    });

    await page.waitForTimeout(3000);

    console.log(`\nCaptured ${apiCalls.length} API calls:`);
    apiCalls.forEach((call, i) => {
      console.log(`\n${i + 1}. ${call.method} ${call.url}`);
      console.log(`   Status: ${call.status}`);
      console.log(`   Body preview: ${call.bodyPreview}...`);
    });

    // 4. Check for listing elements on page
    console.log('\n\n📋 Checking for listing elements...');
    const listingInfo = await page.evaluate(() => {
      // Common selectors for property listings
      const selectors = [
        'article',
        '[data-test*="listing"]',
        '[data-test*="estate"]',
        '[class*="ListCard"]',
        '[class*="EstateItem"]',
        '[class*="PropertyCard"]',
        '[class*="SearchResult"]',
        'a[href*="/expose/"]',
        'a[href*="/immobilie/"]'
      ];

      const results: any = {};

      selectors.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
          results[selector] = {
            count: elements.length,
            sample: elements[0]?.outerHTML?.substring(0, 300)
          };
        }
      });

      return results;
    });

    console.log('Found listing elements:');
    Object.entries(listingInfo).forEach(([selector, info]: [string, any]) => {
      console.log(`\n   ${selector}: ${info.count} elements`);
      console.log(`   Sample: ${info.sample}...`);
    });

    // 5. Check div IDs and classes for React/Next
    console.log('\n\n🔍 Checking for React/Next.js indicators...');
    const reactInfo = await page.evaluate(() => {
      return {
        hasNextRoot: document.querySelector('#__next') !== null,
        hasReactRoot: document.querySelector('#root') !== null,
        hasAppRoot: document.querySelector('#app') !== null,
        rootDivIds: Array.from(document.querySelectorAll('div[id]'))
          .map(el => el.id)
          .filter(id => id.includes('__') || id.includes('next') || id.includes('react'))
      };
    });

    console.log(`Next.js root: ${reactInfo.hasNextRoot}`);
    console.log(`React root: ${reactInfo.hasReactRoot}`);
    console.log(`App root: ${reactInfo.hasAppRoot}`);
    console.log(`Special div IDs: ${reactInfo.rootDivIds.join(', ')}`);

  } catch (error: any) {
    console.error('❌ Diagnostic failed:', error.message);
  } finally {
    await browser.close();
  }

  console.log('\n═══════════════════════════════════════════════');
  console.log('✓ Deep diagnostic complete\n');
}

deepDiagnostic();
