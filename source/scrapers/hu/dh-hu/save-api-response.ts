/**
 * Save DH.hu API response for analysis
 */
import { fetchWithBrowserTLS } from './src/utils/cycleTLS';
import * as fs from 'fs';

async function saveResponse() {
  console.log('🔍 Fetching and saving DH.hu API response...\n');

  const path = '/elado-ingatlan/lakas-haz/budapest';
  const encodedPath = Buffer.from(path).toString('base64');
  const apiUrl = `https://newdhapi01.dh.hu/api/loadWebsite?url=${encodedPath}`;

  console.log(`Path: ${path}`);
  console.log(`API URL: ${apiUrl}\n`);

  const response = await fetchWithBrowserTLS(apiUrl, {
    browser: 'chrome',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  });

  console.log(`✅ HTTP 200 - ${response.length} chars\n`);

  // Save to file
  fs.writeFileSync('/tmp/dh-api-response.json', response);
  console.log('✅ Saved to /tmp/dh-api-response.json\n');

  // Parse and analyze
  const json = JSON.parse(response);

  console.log('📊 Response structure:\n');
  console.log(`   status: ${json.status}`);

  if (json.results) {
    console.log(`   results keys: ${Object.keys(json.results).join(', ')}\n`);

    // Look for properties in different locations
    const locations = [
      'results.properties',
      'results.data',
      'results.items',
      'results.listings',
      'results.content',
    ];

    for (const location of locations) {
      const parts = location.split('.');
      let obj: any = json;

      for (const part of parts) {
        obj = obj?.[part];
      }

      if (obj && Array.isArray(obj)) {
        console.log(`   ✅ Found array at ${location}: ${obj.length} items`);
        if (obj[0]) {
          console.log(`      First item keys: ${Object.keys(obj[0]).join(', ')}`);
        }
      } else if (obj) {
        console.log(`   Found object at ${location}: ${typeof obj}`);
        if (typeof obj === 'object') {
          console.log(`      Keys: ${Object.keys(obj).join(', ')}`);
        }
      }
    }
  }

  // Pretty print first level of results
  console.log('\n📋 Results structure (formatted):\n');
  if (json.results) {
    for (const [key, value] of Object.entries(json.results)) {
      if (Array.isArray(value)) {
        console.log(`   ${key}: Array[${value.length}]`);
      } else if (typeof value === 'object' && value !== null) {
        console.log(`   ${key}: Object {${Object.keys(value).slice(0, 5).join(', ')}...}`);
      } else {
        console.log(`   ${key}: ${typeof value}`);
      }
    }
  }
}

saveResponse();
