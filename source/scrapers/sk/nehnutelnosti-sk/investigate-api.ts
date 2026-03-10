/**
 * Investigate Nehnuteľnosti.sk API format
 */
import { chromium } from 'playwright';
import * as fs from 'fs';

async function investigate() {
  console.log('🔍 Investigating Nehnuteľnosti.sk API...\n');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1920, height: 1080 },
    locale: 'sk-SK',
    timezoneId: 'Europe/Bratislava'
  });

  const page = await context.newPage();

  const apiCalls: any[] = [];

  // Intercept all API requests
  page.on('request', request => {
    const url = request.url();
    if (url.includes('/api/v2/')) {
      const postData = request.postData();
      apiCalls.push({
        method: request.method(),
        url: url,
        headers: request.headers(),
        body: postData ? JSON.parse(postData) : null
      });
    }
  });

  // Intercept responses
  page.on('response', async response => {
    const url = response.url();
    if (url.includes('/api/v2/')) {
      try {
        const data = await response.json();
        const call = apiCalls.find(c => c.url === url && !c.response);
        if (call) {
          call.response = data;
          call.status = response.status();
        }
      } catch (e) {
        // Not JSON
      }
    }
  });

  try {
    const url = 'https://www.nehnutelnosti.sk/bratislavsky-kraj/byty/predaj/';
    console.log(`Navigating to: ${url}\n`);

    await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(5000);

    // Try to scroll to trigger more listings
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(3000);

    console.log('='.repeat(60));
    console.log(`API Calls Intercepted: ${apiCalls.length}`);
    console.log('='.repeat(60));

    // Save all API calls
    fs.writeFileSync('nehnutelnosti-api-calls.json', JSON.stringify(apiCalls, null, 2));
    console.log('\n📄 API calls saved to nehnutelnosti-api-calls.json\n');

    // Display summary
    apiCalls.forEach((call, idx) => {
      console.log(`\n${idx + 1}. ${call.method} ${call.url.split('?')[0]}`);
      if (call.body) {
        console.log('   Request:', JSON.stringify(call.body).substring(0, 200));
      }
      if (call.response) {
        console.log(`   Response (${call.status}):`, JSON.stringify(call.response).substring(0, 200));
      }
    });

    // Look for listing data specifically
    console.log('\n' + '='.repeat(60));
    console.log('LOOKING FOR LISTINGS DATA...');
    console.log('='.repeat(60));

    const listingsCall = apiCalls.find(c =>
      c.response &&
      JSON.stringify(c.response).toLowerCase().includes('byt')
    );

    if (listingsCall) {
      console.log('\n✅ FOUND LISTINGS API CALL:');
      console.log('URL:', listingsCall.url);
      console.log('Method:', listingsCall.method);
      console.log('Request Body:', JSON.stringify(listingsCall.body, null, 2));
      console.log('Response Sample:', JSON.stringify(listingsCall.response).substring(0, 500));
    } else {
      console.log('\n⚠️  No obvious listings data found in API calls');
      console.log('The data might be loaded differently or requires interaction');
    }

  } catch (error: any) {
    console.error('❌ Error:', error.message);
  } finally {
    await browser.close();
  }
}

investigate();
