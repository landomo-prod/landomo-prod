const { chromium } = require('playwright');
const fs = require('fs');

async function deepResearchRealitySk() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
  });

  const page = await context.newPage();

  const apiCalls = [];
  const graphqlCalls = [];

  // Capture all network requests
  page.on('request', request => {
    const url = request.url();
    const method = request.method();
    const resourceType = request.resourceType();

    // Focus on XHR and Fetch requests
    if (resourceType === 'xhr' || resourceType === 'fetch') {
      console.log(`[${method}] ${url}`);

      // Check for GraphQL
      if (url.includes('graphql') || request.postData()?.includes('query')) {
        console.log('  -> Possible GraphQL request');
      }
    }
  });

  // Capture responses
  page.on('response', async response => {
    const url = response.url();
    const status = response.status();
    const headers = response.headers();
    const resourceType = response.request().resourceType();

    if (resourceType === 'xhr' || resourceType === 'fetch') {
      try {
        const contentType = headers['content-type'] || '';
        let body = null;

        if (contentType.includes('application/json')) {
          body = await response.json();
        } else if (contentType.includes('text')) {
          body = await response.text();
        }

        const requestData = {
          url,
          method: response.request().method(),
          status,
          headers,
          requestHeaders: response.request().headers(),
          postData: response.request().postData(),
          responseBody: body,
          timestamp: new Date().toISOString()
        };

        apiCalls.push(requestData);

        // Check if this looks like a listing API
        if (body && typeof body === 'object') {
          const bodyStr = JSON.stringify(body).toLowerCase();
          if (bodyStr.includes('apartment') || bodyStr.includes('property') ||
              bodyStr.includes('listing') || bodyStr.includes('inzerat') ||
              bodyStr.includes('byt') || bodyStr.includes('nehnutelnost')) {
            console.log(`  *** FOUND LISTING DATA: [${status}] ${url}`);

            // Save this important response separately
            fs.writeFileSync(
              `/Users/samuelseidel/Development/landomo-world/listing_api_${Date.now()}.json`,
              JSON.stringify(requestData, null, 2)
            );
          }
        }

        console.log(`Response: [${status}] ${url.substring(0, 100)}...`);
      } catch (e) {
        console.log(`Error capturing response: ${url} - ${e.message}`);
      }
    }
  });

  console.log('\n=== Navigating directly to apartment search ===\n');

  // Try multiple URLs
  const urls = [
    'https://www.reality.sk/vysledky/predam-byt',
    'https://www.reality.sk/hladanie/predam-byt',
    'https://www.reality.sk/inzeraty/byty/predaj',
  ];

  for (const url of urls) {
    console.log(`\nTrying: ${url}`);
    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(5000);

      // Check if we have listings
      const pageContent = await page.content();
      if (pageContent.includes('byt') || pageContent.includes('inzerát')) {
        console.log('Found listings page!');
        break;
      }
    } catch (e) {
      console.log(`Failed to load: ${e.message}`);
    }
  }

  console.log('\n=== Scrolling to trigger more API calls ===\n');
  for (let i = 0; i < 5; i++) {
    await page.evaluate(() => window.scrollBy(0, 1000));
    await page.waitForTimeout(2000);
  }

  console.log('\n=== Looking for pagination or load more ===\n');
  try {
    // Try to find and click pagination
    const paginationButtons = await page.locator('button, a').evaluateAll(elements => {
      return elements
        .filter(el => {
          const text = el.textContent.toLowerCase();
          return text.includes('ďalšie') || text.includes('next') ||
                 text.includes('viac') || text.includes('more') ||
                 !isNaN(parseInt(text));
        })
        .map(el => el.textContent);
    });
    console.log('Found pagination elements:', paginationButtons);

    if (paginationButtons.length > 0) {
      const nextButton = await page.locator('button, a').filter({ hasText: /ďalšie|next|viac|more|2/i }).first();
      if (await nextButton.count() > 0) {
        await nextButton.click();
        await page.waitForTimeout(3000);
      }
    }
  } catch (e) {
    console.log('Pagination error:', e.message);
  }

  console.log('\n=== Trying to open listing detail ===\n');
  try {
    // Look for any link that might be a listing
    const links = await page.locator('a[href*="detail"], a[href*="inzerat"]').all();
    console.log(`Found ${links.length} potential listing links`);

    if (links.length > 0) {
      await links[0].click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(5000);
    }
  } catch (e) {
    console.log('Could not open listing detail:', e.message);
  }

  // Save all captured data
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

  fs.writeFileSync(
    `/Users/samuelseidel/Development/landomo-world/reality_sk_complete_capture_${timestamp}.json`,
    JSON.stringify(apiCalls, null, 2)
  );

  console.log('\n=== Summary ===');
  console.log(`Total API calls captured: ${apiCalls.length}`);

  console.log('\nUnique endpoints:');
  const uniqueEndpoints = [...new Set(apiCalls.map(call => {
    try {
      const url = new URL(call.url);
      return `${call.method} ${url.origin}${url.pathname}`;
    } catch {
      return `${call.method} ${call.url}`;
    }
  }))];

  uniqueEndpoints.forEach(endpoint => console.log(`  - ${endpoint}`));

  console.log('\n=== Analysis ===');

  // Analyze the APIs
  const realityApis = apiCalls.filter(call =>
    call.url.includes('reality.sk') && !call.url.includes('privacy')
  );

  console.log(`\nReality.sk specific APIs: ${realityApis.length}`);
  realityApis.forEach(api => {
    console.log(`  ${api.method} ${api.url}`);
    if (api.responseBody && typeof api.responseBody === 'object') {
      const keys = Object.keys(api.responseBody);
      console.log(`    Response keys: ${keys.slice(0, 10).join(', ')}`);
    }
  });

  await page.waitForTimeout(2000);
  await browser.close();

  return { apiCalls, uniqueEndpoints };
}

deepResearchRealitySk().catch(console.error);
