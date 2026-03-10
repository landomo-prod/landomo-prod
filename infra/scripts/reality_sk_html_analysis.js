const { chromium } = require('playwright');
const fs = require('fs');

async function analyzeRealitySkHTML() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
  });

  const page = await context.newPage();

  console.log('\n=== Navigating to Reality.sk apartment listings ===\n');

  await page.goto('https://www.reality.sk/hladanie/predam-byt', { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(5000);

  // Extract all script tags that might contain data
  const scripts = await page.evaluate(() => {
    const allScripts = Array.from(document.querySelectorAll('script'));
    return allScripts.map(script => ({
      type: script.type,
      src: script.src,
      content: script.textContent.substring(0, 1000) // First 1000 chars
    }));
  });

  console.log('Found scripts:', scripts.length);

  // Look for JSON data in scripts
  const dataScripts = scripts.filter(s =>
    s.content.includes('window.__INITIAL_STATE__') ||
    s.content.includes('window.__DATA__') ||
    s.content.includes('window.__PRELOADED_STATE__') ||
    s.content.includes('{"@context"') ||
    s.type === 'application/ld+json' ||
    s.type === 'application/json'
  );

  console.log('\nData-containing scripts:', dataScripts.length);

  // Try to extract the full initial state
  const initialState = await page.evaluate(() => {
    // Check various common patterns
    if (window.__INITIAL_STATE__) return { source: '__INITIAL_STATE__', data: window.__INITIAL_STATE__ };
    if (window.__DATA__) return { source: '__DATA__', data: window.__DATA__ };
    if (window.__PRELOADED_STATE__) return { source: '__PRELOADED_STATE__', data: window.__PRELOADED_STATE__ };
    if (window.NEXT_DATA) return { source: 'NEXT_DATA', data: window.NEXT_DATA };

    // Try to find it in script content
    const scripts = Array.from(document.querySelectorAll('script:not([src])'));
    for (const script of scripts) {
      const content = script.textContent;

      // Try various patterns
      const patterns = [
        /window\.__INITIAL_STATE__\s*=\s*({.+?});/s,
        /window\.__DATA__\s*=\s*({.+?});/s,
        /__NEXT_DATA__\s*=\s*({.+?})/s,
        /"props":\s*({.+?})/s,
      ];

      for (const pattern of patterns) {
        const match = content.match(pattern);
        if (match) {
          try {
            return { source: 'regex', data: JSON.parse(match[1]) };
          } catch (e) {
            console.log('Failed to parse match:', e.message);
          }
        }
      }
    }

    return null;
  });

  if (initialState) {
    console.log(`\n=== Found initial state in: ${initialState.source} ===`);
    fs.writeFileSync(
      '/Users/samuelseidel/Development/landomo-world/reality_sk_initial_state.json',
      JSON.stringify(initialState, null, 2)
    );
  } else {
    console.log('\n=== No initial state found ===');
  }

  // Extract listing data from DOM
  const listings = await page.evaluate(() => {
    const results = [];

    // Try multiple selectors
    const selectors = [
      '.result-item',
      '.listing-item',
      'article',
      '[data-id]',
      '.property-item',
      '[class*="listing"]',
      '[class*="result"]'
    ];

    for (const selector of selectors) {
      const items = document.querySelectorAll(selector);
      if (items.length > 0) {
        console.log(`Found ${items.length} items with selector: ${selector}`);

        items.forEach((item, index) => {
          if (index < 5) { // Only first 5
            const data = {
              selector,
              html: item.outerHTML.substring(0, 500),
              text: item.textContent.substring(0, 200),
              attributes: {}
            };

            // Get all data attributes
            for (const attr of item.attributes) {
              if (attr.name.startsWith('data-')) {
                data.attributes[attr.name] = attr.value;
              }
            }

            results.push(data);
          }
        });
      }
    }

    return results;
  });

  console.log(`\n=== Extracted ${listings.length} listings from DOM ===`);
  if (listings.length > 0) {
    fs.writeFileSync(
      '/Users/samuelseidel/Development/landomo-world/reality_sk_dom_listings.json',
      JSON.stringify(listings, null, 2)
    );
  }

  // Get the full page HTML
  const html = await page.content();
  fs.writeFileSync(
    '/Users/samuelseidel/Development/landomo-world/reality_sk_page.html',
    html
  );
  console.log('\n=== Saved full HTML ===');

  // Check for any API endpoints in the page source
  const apiEndpoints = await page.evaluate(() => {
    const html = document.documentElement.outerHTML;
    const patterns = [
      /https?:\/\/[^"'\s]+api[^"'\s]*/gi,
      /https?:\/\/[^"'\s]+graphql[^"'\s]*/gi,
      /"endpoint":\s*"([^"]+)"/gi,
      /"apiUrl":\s*"([^"]+)"/gi,
    ];

    const found = new Set();
    for (const pattern of patterns) {
      const matches = html.matchAll(pattern);
      for (const match of matches) {
        found.add(match[0].replace(/["',]/g, ''));
      }
    }

    return Array.from(found);
  });

  console.log('\n=== API endpoints found in HTML ===');
  apiEndpoints.forEach(endpoint => console.log(`  - ${endpoint}`));

  await page.waitForTimeout(2000);
  await browser.close();

  return { initialState, listings, apiEndpoints };
}

analyzeRealitySkHTML().catch(console.error);
