/**
 * Discover DH.hu API parameters
 */
import { fetchWithBrowserTLS } from './src/utils/cycleTLS';

async function discoverParams() {
  console.log('🔍 Discovering DH.hu API parameters\n');

  const baseUrl = 'https://newdhapi03.dh.hu/api/search';

  // Try different parameter combinations
  const tests = [
    { name: 'Empty', params: '' },
    { name: 'Location only', params: '?location=budapest' },
    { name: 'City param', params: '?city=budapest' },
    { name: 'Settlement', params: '?settlement=budapest' },
    { name: 'Type + Transaction', params: '?type=lakas&transaction=elado' },
    { name: 'PropertyType', params: '?propertyType=lakas' },
    { name: 'TransactionType', params: '?transactionType=elado' },
    { name: 'Page', params: '?page=1' },
    { name: 'Limit', params: '?limit=10' },
    { name: 'Full query', params: '?city=budapest&propertyType=lakas&transactionType=elado&page=1&limit=20' },
    { name: 'Alternative', params: '?settlement=budapest&type=1&transactionType=1&pageSize=20&pageNumber=1' },
  ];

  for (const test of tests) {
    try {
      const url = baseUrl + test.params;
      console.log(`\nTesting: ${test.name}`);
      console.log(`   URL: ${url}`);

      const response = await fetchWithBrowserTLS(url, {
        browser: 'chrome',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        maxRetries: 1
      });

      console.log(`   ✅ HTTP 200 - ${response.length} chars`);

      // Parse JSON
      try {
        const json = JSON.parse(response);
        console.log(`   📦 JSON Response:`);
        console.log(`      status: ${json.status}`);

        if (json.result && Array.isArray(json.result)) {
          console.log(`      result: Array with ${json.result.length} items`);

          if (json.result.length > 0) {
            console.log(`      ✅ SUCCESS! Found ${json.result.length} properties!`);
            console.log(`\n      First property:`);
            const first = json.result[0];
            console.log(`         ID: ${first.id || first.propertyId || 'N/A'}`);
            console.log(`         Title: ${first.title || first.name || 'N/A'}`);
            console.log(`         Price: ${first.price || 'N/A'}`);
            console.log(`         Location: ${first.city || first.location || first.settlement || 'N/A'}`);
            console.log(`\n      All keys: ${Object.keys(first).join(', ')}`);
          }
        } else if (json.result) {
          console.log(`      result: ${typeof json.result}`);
        }

        if (json.total !== undefined) console.log(`      total: ${json.total}`);
        if (json.count !== undefined) console.log(`      count: ${json.count}`);
        if (json.error) console.log(`      error: ${json.error}`);

      } catch (parseError: any) {
        console.log(`   ⚠️  Not valid JSON: ${parseError.message}`);
        console.log(`      Response: ${response.substring(0, 200)}`);
      }

    } catch (error: any) {
      console.log(`   ❌ ${error.message}`);
    }
  }

  // Try POST request
  console.log('\n\n🔍 Testing POST request...\n');
  try {
    const postData = JSON.stringify({
      city: 'budapest',
      propertyType: 'apartment',
      transactionType: 'sale',
      page: 1,
      limit: 20
    });

    console.log(`   POST data: ${postData}`);

    // Note: CycleTLS doesn't support POST in the current wrapper
    // We'll need to add POST support if GET doesn't work
    console.log(`   ⚠️  POST testing requires CycleTLS POST support`);

  } catch (error: any) {
    console.log(`   ❌ ${error.message}`);
  }
}

discoverParams();
