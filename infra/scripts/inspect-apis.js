/**
 * API Inspector using Playwright
 * Intercepts network requests to identify real API endpoints
 */

const { chromium } = require('playwright');

async function inspectPortalAPIs(url, portalName) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`Inspecting ${portalName}: ${url}`);
  console.log('='.repeat(80));

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
  });

  const page = await context.newPage();

  const apiCalls = [];
  const xhrCalls = [];
  const fetchCalls = [];

  // Intercept all network requests
  page.on('request', request => {
    const url = request.url();
    const resourceType = request.resourceType();

    // Log API-like requests
    if (resourceType === 'xhr' || resourceType === 'fetch') {
      xhrCalls.push({
        method: request.method(),
        url: url,
        resourceType: resourceType,
        postData: request.postData()
      });
    }

    // Look for common API patterns
    if (url.includes('/api/') || url.includes('/graphql') || url.includes('.json')) {
      apiCalls.push({
        method: request.method(),
        url: url,
        resourceType: resourceType,
        postData: request.postData()
      });
    }
  });

  // Intercept responses to see data structure
  page.on('response', async response => {
    const url = response.url();
    const contentType = response.headers()['content-type'] || '';

    if (contentType.includes('application/json')) {
      try {
        const data = await response.json();
        fetchCalls.push({
          url: url,
          status: response.status(),
          contentType: contentType,
          dataKeys: Object.keys(data).slice(0, 10), // First 10 keys
          dataPreview: JSON.stringify(data).slice(0, 200) + '...'
        });
      } catch (e) {
        // Ignore JSON parse errors
      }
    }
  });

  try {
    // Navigate and wait for network to settle
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

    // Wait a bit more for any lazy-loaded content
    await page.waitForTimeout(3000);

    // Try to trigger a search/listing load if possible
    console.log('\nAttempting to trigger listing load...');
    try {
      // Look for search buttons or listing links
      const searchButton = await page.$('button[type="submit"], .search-button, [class*="search"]');
      if (searchButton) {
        await searchButton.click();
        await page.waitForTimeout(2000);
      }
    } catch (e) {
      console.log('Could not trigger search:', e.message);
    }

  } catch (error) {
    console.error(`Error loading page: ${error.message}`);
  }

  await browser.close();

  // Report findings
  console.log('\n📊 API CALLS DETECTED:');
  console.log('='.repeat(80));

  if (apiCalls.length > 0) {
    console.log(`\n✅ Found ${apiCalls.length} API-like calls:\n`);
    apiCalls.forEach((call, i) => {
      console.log(`${i + 1}. ${call.method} ${call.url}`);
      if (call.postData) {
        console.log(`   POST Data: ${call.postData.slice(0, 150)}...`);
      }
    });
  } else {
    console.log('\n❌ No explicit API calls detected (may use HTML rendering)');
  }

  console.log(`\n\n📡 XHR/FETCH CALLS (${xhrCalls.length}):`);
  console.log('='.repeat(80));
  if (xhrCalls.length > 0) {
    xhrCalls.slice(0, 10).forEach((call, i) => {
      console.log(`\n${i + 1}. ${call.method} ${call.url}`);
      if (call.postData) {
        console.log(`   Body: ${call.postData.slice(0, 150)}`);
      }
    });
    if (xhrCalls.length > 10) {
      console.log(`\n... and ${xhrCalls.length - 10} more`);
    }
  }

  console.log(`\n\n📦 JSON RESPONSES (${fetchCalls.length}):`);
  console.log('='.repeat(80));
  if (fetchCalls.length > 0) {
    fetchCalls.slice(0, 5).forEach((call, i) => {
      console.log(`\n${i + 1}. ${call.url}`);
      console.log(`   Status: ${call.status}`);
      console.log(`   Keys: ${call.dataKeys.join(', ')}`);
      console.log(`   Preview: ${call.dataPreview}`);
    });
  }

  return {
    portalName,
    apiCalls,
    xhrCalls: xhrCalls.length,
    jsonResponses: fetchCalls.length,
    hasAPI: apiCalls.length > 0 || xhrCalls.length > 0
  };
}

async function main() {
  console.log('🔍 Starting API Inspection for Czech Real Estate Portals\n');

  const portals = [
    { url: 'https://www.reality.cz/prodej/byty/Ceska-republika/', name: 'reality.cz' },
    { url: 'http://reality.idnes.cz/', name: 'reality.idnes.cz' },
    { url: 'https://www.realingo.cz/prodej_reality/cr/', name: 'realingo.cz' },
    { url: 'https://ulovdomov.cz/pronajem/nemovitosti', name: 'ulovdomov.cz' }
  ];

  const results = [];

  for (const portal of portals) {
    try {
      const result = await inspectPortalAPIs(portal.url, portal.name);
      results.push(result);

      // Wait between portals to be respectful
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (error) {
      console.error(`\n❌ Error inspecting ${portal.name}:`, error.message);
      results.push({
        portalName: portal.name,
        error: error.message,
        hasAPI: false
      });
    }
  }

  // Summary
  console.log('\n\n' + '='.repeat(80));
  console.log('📋 SUMMARY');
  console.log('='.repeat(80));

  results.forEach(result => {
    if (result.error) {
      console.log(`\n${result.portalName}: ❌ Error - ${result.error}`);
    } else {
      console.log(`\n${result.portalName}:`);
      console.log(`  - API calls: ${result.apiCalls?.length || 0}`);
      console.log(`  - XHR/Fetch: ${result.xhrCalls || 0}`);
      console.log(`  - JSON responses: ${result.jsonResponses || 0}`);
      console.log(`  - Has API: ${result.hasAPI ? '✅ YES' : '❌ NO'}`);
    }
  });

  console.log('\n✅ Inspection complete!\n');
}

main().catch(console.error);
