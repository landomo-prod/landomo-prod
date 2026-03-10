/**
 * Find Nehnuteľnosti.sk API endpoints by monitoring network requests
 */
import { chromium } from 'playwright';

async function findAPI() {
  console.log('🔍 Looking for Nehnuteľnosti.sk API endpoints...\n');

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1920, height: 1080 },
    locale: 'sk-SK',
    timezoneId: 'Europe/Bratislava'
  });

  const page = await context.newPage();

  const apiCalls: any[] = [];

  // Intercept all requests
  page.on('request', request => {
    const url = request.url();
    if (url.includes('api') || url.includes('graphql') || url.includes('ajax') || url.includes('json')) {
      console.log(`📡 API Call: ${request.method()} ${url}`);
      apiCalls.push({
        method: request.method(),
        url: url,
        headers: request.headers()
      });
    }
  });

  // Intercept responses
  page.on('response', async response => {
    const url = response.url();
    if (url.includes('api') || url.includes('graphql') || url.includes('json')) {
      try {
        const contentType = response.headers()['content-type'] || '';
        if (contentType.includes('json')) {
          const data = await response.json();
          console.log(`📥 Response from: ${url}`);
          console.log(`   Status: ${response.status()}`);
          console.log(`   Data keys: ${Object.keys(data).join(', ')}`);

          // Check if it contains listings
          if (JSON.stringify(data).includes('byt') || JSON.stringify(data).includes('cena')) {
            console.log(`   ✅ LIKELY CONTAINS LISTINGS!`);
            console.log(`   Sample: ${JSON.stringify(data).substring(0, 200)}...`);
          }
        }
      } catch (e) {
        // Not JSON or error parsing
      }
    }
  });

  try {
    const url = 'https://www.nehnutelnosti.sk/bratislavsky-kraj/byty/predaj/';
    console.log(`Navigating to: ${url}\n`);

    await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });

    console.log('\n✅ Page loaded. Waiting 10 seconds for all requests...');
    await page.waitForTimeout(10000);

    console.log('\n' + '='.repeat(60));
    console.log(`Total API calls intercepted: ${apiCalls.length}`);
    console.log('='.repeat(60));

    if (apiCalls.length > 0) {
      console.log('\nAll API calls:');
      apiCalls.forEach((call, idx) => {
        console.log(`${idx + 1}. ${call.method} ${call.url}`);
      });
    }

    console.log('\nKeeping browser open for manual inspection...');
    await page.waitForTimeout(30000);

  } catch (error: any) {
    console.error('❌ Error:', error.message);
  } finally {
    await browser.close();
  }
}

findAPI();
