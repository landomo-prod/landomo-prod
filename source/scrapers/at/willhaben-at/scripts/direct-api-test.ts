/**
 * Direct API performance test for Willhaben scraper
 * Bypasses Playwright and uses direct HTTP requests
 * Usage: ts-node --transpile-only scripts/direct-api-test.ts
 */

import axios from 'axios';
import { transformWillhabenToStandard } from '../src/transformers/willhabenTransformer';

interface PerformanceMetrics {
  totalAvailable: number;
  listingsFetched: number;
  fetchTimeMs: number;
  transformTimeMs: number;
  totalTimeMs: number;
  fetchSpeed: number; // listings/second
  transformSpeed: number; // listings/second
  successRate: number; // percentage
  errors: string[];
  apiMetadata: any;
}

/**
 * Extract CSRF token from HTTP headers
 */
async function extractCsrfTokenSimple(): Promise<string> {
  const response = await axios.get('https://www.willhaben.at/iad/immobilien/eigentumswohnung/eigentumswohnung-angebote', {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
  });

  const setCookieHeader = response.headers['set-cookie'];
  if (setCookieHeader) {
    for (const cookie of setCookieHeader) {
      if (cookie.includes('x-bbx-csrf-token=')) {
        const match = cookie.match(/x-bbx-csrf-token=([^;]+)/);
        if (match) {
          return match[1];
        }
      }
    }
  }

  throw new Error('Failed to extract CSRF token from cookies');
}

/**
 * Fetch listings from Willhaben API
 */
async function fetchListings(csrfToken: string, page: number = 1, rowsPerPage: number = 30): Promise<any> {
  const url = `https://www.willhaben.at/webapi/iad/search/atz/2/101/atverz?rows=${rowsPerPage}&page=${page}`;

  const response = await axios.get(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'x-bbx-csrf-token': csrfToken,
      'x-wh-client': 'api@willhaben.at;responsive_web;server;1.0.0;desktop',
      'Accept': 'application/json',
      'Referer': 'https://www.willhaben.at/iad/immobilien/eigentumswohnung/eigentumswohnung-angebote',
      'Cache-Control': 'no-cache'
    },
    timeout: 30000
  });

  return response.data;
}

async function performanceTest() {
  console.log('=== Willhaben Scraper Performance Test (Direct API) ===\n');

  const metrics: PerformanceMetrics = {
    totalAvailable: 0,
    listingsFetched: 0,
    fetchTimeMs: 0,
    transformTimeMs: 0,
    totalTimeMs: 0,
    fetchSpeed: 0,
    transformSpeed: 0,
    successRate: 0,
    errors: [],
    apiMetadata: null
  };

  const testStartTime = Date.now();

  try {
    // Step 1: Extract CSRF token
    console.log('🔑 Extracting CSRF token...');
    const tokenStartTime = Date.now();
    const csrfToken = await extractCsrfTokenSimple();
    const tokenEndTime = Date.now();
    console.log(`✅ CSRF token obtained in ${(tokenEndTime - tokenStartTime)}ms\n`);

    // Step 2: Fetch 3 pages of listings (90 listings max)
    console.log('📡 Fetching listings (3 pages for speed test)...');
    const fetchStartTime = Date.now();

    const allListings: any[] = [];
    const pagesToFetch = 3;
    const rowsPerPage = 30;

    for (let page = 1; page <= pagesToFetch; page++) {
      const data = await fetchListings(csrfToken, page, rowsPerPage);

      if (data.advertSummary && data.advertSummary.length > 0) {
        allListings.push(...data.advertSummary);
        console.log(`  Page ${page}: ${data.advertSummary.length} listings`);

        // Capture metadata from first page
        if (page === 1) {
          // Log full response structure to understand what's available
          const availableKeys = Object.keys(data);
          console.log(`  Available response keys: ${availableKeys.join(', ')}`);

          metrics.apiMetadata = {
            rowsFound: data.rowsFound || data.totalCount || data.total || 'unknown',
            rowsRequested: data.rowsRequested || rowsPerPage,
            page: data.page || page,
            allKeys: availableKeys
          };
          if (data.rowsFound) {
            metrics.totalAvailable = data.rowsFound;
          } else if (data.totalCount) {
            metrics.totalAvailable = data.totalCount;
          } else if (data.total) {
            metrics.totalAvailable = data.total;
          }
        }

        // Stop if we got less than requested (end of results)
        if (data.advertSummary.length < rowsPerPage) {
          break;
        }
      } else {
        break;
      }

      // Small delay between pages to be polite
      if (page < pagesToFetch) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    const fetchEndTime = Date.now();
    metrics.fetchTimeMs = fetchEndTime - fetchStartTime;
    metrics.listingsFetched = allListings.length;

    console.log(`\n✅ Fetched ${allListings.length} listings in ${(metrics.fetchTimeMs / 1000).toFixed(2)}s`);
    console.log(`   Fetch speed: ${(allListings.length / (metrics.fetchTimeMs / 1000)).toFixed(2)} listings/second\n`);

    if (allListings.length > 0) {
      // Step 3: Transform all listings
      console.log('🔄 Transforming listings to standard format...');
      const transformStartTime = Date.now();

      let successfulTransforms = 0;
      const transformedProperties = [];

      for (const listing of allListings) {
        try {
          const transformed = transformWillhabenToStandard(listing);
          transformedProperties.push(transformed);
          successfulTransforms++;
        } catch (error: any) {
          metrics.errors.push(`Transform error for listing ${listing.id}: ${error.message}`);
        }
      }

      const transformEndTime = Date.now();
      metrics.transformTimeMs = Math.max(transformEndTime - transformStartTime, 1); // Ensure minimum 1ms for calculation

      console.log(`✅ Transformed ${successfulTransforms}/${allListings.length} listings in ${(metrics.transformTimeMs / 1000).toFixed(2)}s`);
      console.log(`   Transform speed: ${(successfulTransforms / (metrics.transformTimeMs / 1000)).toFixed(2)} listings/second\n`);

      // Calculate metrics
      metrics.successRate = (successfulTransforms / allListings.length) * 100;
      metrics.fetchSpeed = allListings.length / (metrics.fetchTimeMs / 1000);
      metrics.transformSpeed = successfulTransforms / (metrics.transformTimeMs / 1000);

      // Sample first transformed listing
      if (transformedProperties.length > 0) {
        console.log('📄 Sample transformed listing:');
        const sample = transformedProperties[0];
        console.log(`   Title: ${sample.title}`);
        console.log(`   Price: ${sample.price} ${sample.currency}`);
        console.log(`   Type: ${sample.property_type}`);
        console.log(`   Location: ${sample.location?.city || 'N/A'}`);
        console.log(`   Rooms: ${sample.rooms || 'N/A'}`);
        console.log(`   Area: ${sample.area_sqm || 'N/A'} m²`);
        console.log(`   URL: ${sample.source_url}\n`);
      }
    }

    metrics.totalTimeMs = Date.now() - testStartTime;

    // Print final report
    console.log('=== Performance Report ===');
    console.log(`\n📊 Metrics:`);
    console.log(`   Total available listings: ${metrics.totalAvailable > 0 ? metrics.totalAvailable.toLocaleString() : 'Unknown'}`);
    console.log(`   Listings fetched: ${metrics.listingsFetched}`);
    console.log(`   Fetch time: ${(metrics.fetchTimeMs / 1000).toFixed(2)}s`);
    console.log(`   Transform time: ${(metrics.transformTimeMs / 1000).toFixed(2)}s`);
    console.log(`   Total time: ${(metrics.totalTimeMs / 1000).toFixed(2)}s`);
    console.log(`\n⚡ Speed:`);
    console.log(`   Fetch speed: ${metrics.fetchSpeed.toFixed(2)} listings/second`);
    console.log(`   Transform speed: ${metrics.transformSpeed.toFixed(2)} listings/second`);
    console.log(`   Overall speed: ${(metrics.listingsFetched / (metrics.totalTimeMs / 1000)).toFixed(2)} listings/second`);
    console.log(`\n✅ Success Rate:`);
    console.log(`   ${metrics.successRate.toFixed(1)}% successful transforms`);

    if (metrics.apiMetadata) {
      console.log(`\n📈 API Metadata:`);
      console.log(`   Rows found: ${typeof metrics.apiMetadata.rowsFound === 'number' ? metrics.apiMetadata.rowsFound.toLocaleString() : metrics.apiMetadata.rowsFound}`);
      console.log(`   Rows requested: ${metrics.apiMetadata.rowsRequested}`);
      console.log(`   Current page: ${metrics.apiMetadata.page}`);
    }

    if (metrics.errors.length > 0) {
      console.log(`\n⚠️  Errors (${metrics.errors.length}):`);
      metrics.errors.slice(0, 5).forEach(error => console.log(`   - ${error}`));
      if (metrics.errors.length > 5) {
        console.log(`   ... and ${metrics.errors.length - 5} more errors`);
      }
    }

    console.log('\n=== Test Complete ===');

  } catch (error: any) {
    console.error('\n❌ Performance test failed:', error.message);
    if (error.response) {
      console.error(`   HTTP Status: ${error.response.status}`);
      console.error(`   Response: ${JSON.stringify(error.response.data).substring(0, 200)}`);
    }
    if (error.stack) {
      console.error(error.stack);
    }

    // Record error
    metrics.errors.push(`Fatal error: ${error.message}`);

    // Print partial metrics if available
    if (metrics.listingsFetched > 0 || metrics.errors.length > 0) {
      console.log('\n=== Partial Results ===');
      console.log(`Listings fetched: ${metrics.listingsFetched}`);
      console.log(`Errors: ${metrics.errors.length}`);
      metrics.errors.forEach(err => console.log(`  - ${err}`));
    }

    process.exit(1);
  }
}

// Run performance test
performanceTest().catch(console.error);
