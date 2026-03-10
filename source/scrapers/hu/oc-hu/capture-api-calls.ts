/**
 * Use Playwright to capture OC.hu API calls
 */
import { chromium } from 'playwright';
import * as fs from 'fs';

async function captureApiCalls() {
  console.log('🔍 Launching browser to capture OC.hu API calls...\n');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    locale: 'hu-HU'
  });

  const page = await context.newPage();

  // Capture API calls
  const apiCalls: any[] = [];
  const responses: Map<string, any> = new Map();

  page.on('request', request => {
    const url = request.url();
    const lowerUrl = url.toLowerCase();

    // Look for API patterns
    if (lowerUrl.includes('/api/') ||
        lowerUrl.includes('graphql') ||
        lowerUrl.includes('properties') ||
        lowerUrl.includes('listings') ||
        lowerUrl.includes('search') ||
        lowerUrl.includes('ingatlan')) {

      const method = request.method();
      const postData = request.postData();
      const headers = request.headers();

      apiCalls.push({
        url,
        method,
        postData: postData || null,
        headers
      });

      console.log(`📡 API Call: ${method} ${url}`);
      if (postData) {
        const preview = postData.length > 300 ? postData.substring(0, 300) + '...' : postData;
        console.log(`   POST Data: ${preview}`);
      }

      // Log interesting headers
      if (headers['content-type']) {
        console.log(`   Content-Type: ${headers['content-type']}`);
      }
    }
  });

  page.on('response', async response => {
    const url = response.url();
    const lowerUrl = url.toLowerCase();

    if (lowerUrl.includes('/api/') ||
        lowerUrl.includes('graphql') ||
        lowerUrl.includes('properties') ||
        lowerUrl.includes('listings') ||
        lowerUrl.includes('search') ||
        lowerUrl.includes('ingatlan')) {

      console.log(`📥 API Response: ${response.status()} ${url}`);

      try {
        const contentType = response.headers()['content-type'] || '';

        if (contentType.includes('application/json')) {
          const body = await response.text();
          console.log(`   Response size: ${body.length} chars (${Math.round(body.length / 1024)}KB)`);

          // Try to parse as JSON
          try {
            const json = JSON.parse(body);

            // Look for property arrays
            const possibleArrays = Object.keys(json).filter(key =>
              Array.isArray(json[key]) && json[key].length > 0
            );

            if (possibleArrays.length > 0) {
              console.log(`   ✅ Found arrays: ${possibleArrays.join(', ')}`);

              possibleArrays.forEach(key => {
                const arr = json[key];
                console.log(`   - ${key}: ${arr.length} items`);
                if (arr[0]) {
                  console.log(`     Keys: ${Object.keys(arr[0]).slice(0, 10).join(', ')}...`);
                }
              });

              // Save the response for analysis
              const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
              const filename = `/tmp/oc-hu-response-${timestamp}.json`;
              fs.writeFileSync(filename, JSON.stringify(json, null, 2));
              console.log(`   💾 Saved response to: ${filename}`);

              responses.set(url, json);
            } else if (Object.keys(json).length > 0) {
              console.log(`   JSON keys: ${Object.keys(json).slice(0, 10).join(', ')}`);
            }
          } catch (e) {
            console.log(`   Could not parse JSON: ${e}`);
          }
        } else {
          const body = await response.text();
          console.log(`   Response size: ${body.length} chars (${Math.round(body.length / 1024)}KB)`);
          console.log(`   Content-Type: ${contentType}`);
        }
      } catch (error: any) {
        console.log(`   Could not read response: ${error.message}`);
      }
    }
  });

  try {
    console.log('🌐 Navigating to OC.hu listings page...\n');
    await page.goto('https://oc.hu/ingatlanok/lista/ertekesites:elado', {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    console.log('\n⏳ Waiting for properties to load...\n');
    await page.waitForTimeout(5000);

    // Try scrolling to trigger lazy loading
    console.log('📜 Scrolling page to trigger lazy loading...\n');
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(2000);

    console.log(`\n📊 Captured ${apiCalls.length} API calls\n`);

    if (apiCalls.length > 0) {
      console.log('='.repeat(80));
      console.log('API CALL SUMMARY:');
      console.log('='.repeat(80));

      apiCalls.forEach((call, i) => {
        console.log(`\n${i + 1}. ${call.method} ${call.url}`);
        if (call.postData) {
          console.log(`   POST Data (first 500 chars):`);
          console.log(`   ${call.postData.substring(0, 500)}`);
        }

        // Log interesting headers
        if (call.headers['authorization']) {
          console.log(`   Authorization: ${call.headers['authorization']}`);
        }
        if (call.headers['x-api-key']) {
          console.log(`   X-API-Key: ${call.headers['x-api-key']}`);
        }
      });

      console.log('\n' + '='.repeat(80));
      console.log(`💾 Saved ${responses.size} response(s) to /tmp/`);
      console.log('='.repeat(80));
    } else {
      console.log('⚠️  No API calls captured. The site might be using a different approach.');
      console.log('Consider checking:');
      console.log('  - Server-side rendering');
      console.log('  - WebSocket connections');
      console.log('  - Different URL patterns');
    }

  } catch (error: any) {
    console.error(`\n❌ Error: ${error.message}`);
  } finally {
    await browser.close();
  }
}

captureApiCalls();
