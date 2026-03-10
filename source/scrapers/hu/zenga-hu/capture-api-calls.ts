/**
 * Use Playwright to capture Zenga.hu API calls
 */
import { chromium } from 'playwright';
import * as fs from 'fs';

async function captureApiCalls() {
  console.log('🔍 Launching browser to capture Zenga.hu API calls...\n');

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

    // Look for API patterns, especially GraphQL
    if (lowerUrl.includes('/api/') ||
        lowerUrl.includes('graphql') ||
        lowerUrl.includes('graphassets') ||
        lowerUrl.includes('properties') ||
        lowerUrl.includes('listings') ||
        lowerUrl.includes('search') ||
        lowerUrl.includes('ingatlan') ||
        lowerUrl.includes('zenga')) {

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
        const preview = postData.length > 500 ? postData.substring(0, 500) + '...' : postData;
        console.log(`   POST Data: ${preview}`);

        // If it looks like GraphQL, try to parse it
        try {
          const json = JSON.parse(postData);
          if (json.query) {
            console.log(`   🔷 GraphQL Query detected!`);
            console.log(`   Operation: ${json.operationName || 'unnamed'}`);
            if (json.variables) {
              console.log(`   Variables: ${JSON.stringify(json.variables).substring(0, 200)}`);
            }
          }
        } catch (e) {
          // Not JSON, that's okay
        }
      }

      // Log interesting headers
      if (headers['content-type']) {
        console.log(`   Content-Type: ${headers['content-type']}`);
      }
      if (headers['authorization']) {
        console.log(`   Authorization: ${headers['authorization'].substring(0, 50)}...`);
      }
    }
  });

  page.on('response', async response => {
    const url = response.url();
    const lowerUrl = url.toLowerCase();

    if (lowerUrl.includes('/api/') ||
        lowerUrl.includes('graphql') ||
        lowerUrl.includes('graphassets') ||
        lowerUrl.includes('properties') ||
        lowerUrl.includes('listings') ||
        lowerUrl.includes('search') ||
        lowerUrl.includes('ingatlan') ||
        lowerUrl.includes('zenga')) {

      console.log(`📥 API Response: ${response.status()} ${url}`);

      try {
        const contentType = response.headers()['content-type'] || '';

        if (contentType.includes('application/json')) {
          const body = await response.text();
          const sizeKB = Math.round(body.length / 1024);
          console.log(`   Response size: ${body.length} chars (${sizeKB}KB)`);

          // Flag large responses as likely property data
          if (sizeKB > 50) {
            console.log(`   ⭐ Large response detected - likely property data!`);
          }

          // Try to parse as JSON
          try {
            const json = JSON.parse(body);

            // Check for GraphQL response structure
            if (json.data) {
              console.log(`   🔷 GraphQL Response detected!`);
              const dataKeys = Object.keys(json.data);
              console.log(`   Data keys: ${dataKeys.join(', ')}`);

              // Look for arrays in the data
              dataKeys.forEach(key => {
                const value = json.data[key];
                if (Array.isArray(value)) {
                  console.log(`   ✅ Found array: ${key} with ${value.length} items`);
                  if (value[0]) {
                    console.log(`      First item keys: ${Object.keys(value[0]).slice(0, 10).join(', ')}...`);
                  }
                } else if (value && typeof value === 'object') {
                  // Check nested objects for arrays
                  Object.keys(value).forEach(nestedKey => {
                    if (Array.isArray(value[nestedKey])) {
                      console.log(`   ✅ Found nested array: ${key}.${nestedKey} with ${value[nestedKey].length} items`);
                      if (value[nestedKey][0]) {
                        console.log(`      First item keys: ${Object.keys(value[nestedKey][0]).slice(0, 10).join(', ')}...`);
                      }
                    }
                  });
                }
              });
            } else {
              // Regular JSON response
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
              } else if (Object.keys(json).length > 0) {
                console.log(`   JSON keys: ${Object.keys(json).slice(0, 10).join(', ')}`);
              }
            }

            // Save the response for analysis if it looks promising
            if ((json.data && Object.keys(json.data).length > 0) ||
                (sizeKB > 20)) {
              const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
              const filename = `/tmp/zenga-hu-response-${timestamp}.json`;
              fs.writeFileSync(filename, JSON.stringify(json, null, 2));
              console.log(`   💾 Saved response to: ${filename}`);

              responses.set(url, json);
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
    console.log('🌐 Navigating to Zenga.hu listings page...\n');
    await page.goto('https://zenga.hu/budapest+elado+lakas', {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    console.log('\n⏳ Waiting for properties to load...\n');
    await page.waitForTimeout(5000);

    // Try scrolling to trigger lazy loading
    console.log('📜 Scrolling page to trigger lazy loading...\n');
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(2000);

    // Scroll again
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
          console.log(`   POST Data:`);
          const data = call.postData.length > 1000 ? call.postData.substring(0, 1000) + '...' : call.postData;
          console.log(`   ${data}`);
        }

        // Log interesting headers
        if (call.headers['authorization']) {
          console.log(`   Authorization: ${call.headers['authorization'].substring(0, 50)}...`);
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
