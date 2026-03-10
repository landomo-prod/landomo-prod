const { chromium } = require('playwright');
const fs = require('fs');

async function researchRealitySk() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
  });

  const page = await context.newPage();

  const apiCalls = [];
  const allRequests = [];

  // Capture all network requests
  page.on('request', request => {
    const url = request.url();
    const method = request.method();
    const headers = request.headers();
    const resourceType = request.resourceType();

    allRequests.push({
      url,
      method,
      headers,
      resourceType,
      postData: request.postData()
    });

    // Focus on XHR and Fetch requests
    if (resourceType === 'xhr' || resourceType === 'fetch') {
      console.log(`[${method}] ${url}`);
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

        apiCalls.push({
          url,
          method: response.request().method(),
          status,
          headers,
          requestHeaders: response.request().headers(),
          postData: response.request().postData(),
          responseBody: body
        });

        console.log(`Response: [${status}] ${url}`);
      } catch (e) {
        console.log(`Error capturing response: ${url} - ${e.message}`);
      }
    }
  });

  console.log('\n=== Navigating to Reality.sk ===\n');
  await page.goto('https://www.reality.sk', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);

  console.log('\n=== Navigating to apartment listings ===\n');
  // Try to find and click on apartments listing
  try {
    // Look for apartment/flat listings link
    const apartmentLink = await page.locator('a[href*="byty"]').first();
    if (await apartmentLink.count() > 0) {
      await apartmentLink.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(3000);
    }
  } catch (e) {
    console.log('Could not navigate to apartments, trying direct URL');
    await page.goto('https://www.reality.sk/hladanie/predam-byt', { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);
  }

  console.log('\n=== Scrolling to load more listings ===\n');
  // Scroll to trigger lazy loading
  for (let i = 0; i < 3; i++) {
    await page.evaluate(() => window.scrollBy(0, 1000));
    await page.waitForTimeout(2000);
  }

  console.log('\n=== Clicking on a listing detail ===\n');
  // Try to click on first listing to see detail API
  try {
    const firstListing = await page.locator('a[href*="/vysledky/detail/"]').first();
    if (await firstListing.count() > 0) {
      await firstListing.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(3000);
    }
  } catch (e) {
    console.log('Could not open listing detail:', e.message);
  }

  // Save all captured data
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

  fs.writeFileSync(
    `/Users/samuelseidel/Development/landomo-world/reality_sk_api_calls_${timestamp}.json`,
    JSON.stringify(apiCalls, null, 2)
  );

  fs.writeFileSync(
    `/Users/samuelseidel/Development/landomo-world/reality_sk_all_requests_${timestamp}.json`,
    JSON.stringify(allRequests, null, 2)
  );

  console.log('\n=== Summary ===');
  console.log(`Total API calls captured: ${apiCalls.length}`);
  console.log(`Total requests captured: ${allRequests.length}`);
  console.log('\nAPI endpoints found:');

  const uniqueEndpoints = [...new Set(apiCalls.map(call => {
    const url = new URL(call.url);
    return `${call.method} ${url.origin}${url.pathname}`;
  }))];

  uniqueEndpoints.forEach(endpoint => console.log(`  - ${endpoint}`));

  await page.waitForTimeout(2000);
  await browser.close();

  return { apiCalls, allRequests, uniqueEndpoints };
}

researchRealitySk().catch(console.error);
