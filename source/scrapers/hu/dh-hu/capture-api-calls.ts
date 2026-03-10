/**
 * Use Playwright to capture DH.hu API calls
 */
import { chromium } from 'playwright';

async function captureApiCalls() {
  console.log('🔍 Launching browser to capture DH.hu API calls...\n');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    locale: 'hu-HU'
  });

  const page = await context.newPage();

  // Capture API calls
  const apiCalls: any[] = [];

  page.on('request', request => {
    const url = request.url();
    if (url.includes('newdhapi') || url.includes('/api/')) {
      const method = request.method();
      const postData = request.postData();

      apiCalls.push({
        url,
        method,
        postData: postData || null,
        headers: request.headers()
      });

      console.log(`📡 API Call: ${method} ${url}`);
      if (postData) {
        console.log(`   POST Data: ${postData.substring(0, 300)}`);
      }
    }
  });

  page.on('response', async response => {
    const url = response.url();
    if (url.includes('newdhapi') || url.includes('/api/search')) {
      console.log(`📥 API Response: ${response.status()} ${url}`);

      try {
        const body = await response.text();
        if (body.length < 1000) {
          console.log(`   Response: ${body}`);
        } else {
          console.log(`   Response size: ${body.length} chars`);
          // Try to parse as JSON
          try {
            const json = JSON.parse(body);
            if (json.result && Array.isArray(json.result)) {
              console.log(`   ✅ Found ${json.result.length} properties!`);
              if (json.result[0]) {
                console.log(`   First property keys: ${Object.keys(json.result[0]).join(', ')}`);
              }
            }
          } catch {}
        }
      } catch (error: any) {
        console.log(`   Could not read response: ${error.message}`);
      }
    }
  });

  try {
    console.log('🌐 Navigating to DH.hu Budapest listings...\n');
    await page.goto('https://dh.hu/elado-ingatlan/lakas-haz/budapest', {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    console.log('\n⏳ Waiting for properties to load...\n');
    await page.waitForTimeout(5000);

    console.log(`\n📊 Captured ${apiCalls.length} API calls\n`);

    if (apiCalls.length > 0) {
      console.log('='.repeat(80));
      console.log('API CALL DETAILS:');
      console.log('='.repeat(80));

      apiCalls.forEach((call, i) => {
        console.log(`\n${i + 1}. ${call.method} ${call.url}`);
        if (call.postData) {
          console.log(`   POST Data:`);
          console.log(JSON.stringify(call.postData, null, 2));
        }
      });
    }

  } catch (error: any) {
    console.error(`\n❌ Error: ${error.message}`);
  } finally {
    await browser.close();
  }
}

captureApiCalls();
