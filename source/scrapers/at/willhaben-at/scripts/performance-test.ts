/**
 * Performance test script for Willhaben scraper
 * Measures fetch time, transform time, and processing speed
 * Usage: ts-node scripts/performance-test.ts
 */

import { ListingsScraper } from '../src/scrapers/listingsScraper';
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
}

async function performanceTest() {
  console.log('=== Willhaben Scraper Performance Test ===\n');

  const metrics: PerformanceMetrics = {
    totalAvailable: 0,
    listingsFetched: 0,
    fetchTimeMs: 0,
    transformTimeMs: 0,
    totalTimeMs: 0,
    fetchSpeed: 0,
    transformSpeed: 0,
    successRate: 0,
    errors: []
  };

  const testStartTime = Date.now();

  try {
    const scraper = new ListingsScraper();

    // Fetch 2-3 pages (60-90 listings) for speed test
    console.log('📡 Fetching listings (limiting to 3 pages for speed test)...');
    const fetchStartTime = Date.now();

    const listings = await scraper.scrapePages(3);

    const fetchEndTime = Date.now();
    metrics.fetchTimeMs = fetchEndTime - fetchStartTime;
    metrics.listingsFetched = listings.length;

    console.log(`✅ Fetched ${listings.length} listings in ${(metrics.fetchTimeMs / 1000).toFixed(2)}s`);
    console.log(`   Fetch speed: ${(listings.length / (metrics.fetchTimeMs / 1000)).toFixed(2)} listings/second\n`);

    if (listings.length > 0) {
      // Transform all listings
      console.log('🔄 Transforming listings to standard format...');
      const transformStartTime = Date.now();

      let successfulTransforms = 0;
      const transformedProperties = [];

      for (const listing of listings) {
        try {
          const transformed = transformWillhabenToStandard(listing);
          transformedProperties.push(transformed);
          successfulTransforms++;
        } catch (error: any) {
          metrics.errors.push(`Transform error for listing ${listing.id}: ${error.message}`);
        }
      }

      const transformEndTime = Date.now();
      metrics.transformTimeMs = transformEndTime - transformStartTime;

      console.log(`✅ Transformed ${successfulTransforms}/${listings.length} listings in ${(metrics.transformTimeMs / 1000).toFixed(2)}s`);
      console.log(`   Transform speed: ${(successfulTransforms / (metrics.transformTimeMs / 1000)).toFixed(2)} listings/second\n`);

      // Calculate metrics
      metrics.successRate = (successfulTransforms / listings.length) * 100;
      metrics.fetchSpeed = listings.length / (metrics.fetchTimeMs / 1000);
      metrics.transformSpeed = successfulTransforms / (metrics.transformTimeMs / 1000);

      // Sample first transformed listing
      if (transformedProperties.length > 0) {
        console.log('📄 Sample transformed listing:');
        const sample = transformedProperties[0];
        console.log(`   Title: ${sample.title}`);
        console.log(`   Price: ${sample.price} ${sample.currency}`);
        console.log(`   Type: ${sample.property_type}`);
        console.log(`   Location: ${sample.location?.city || 'N/A'}`);
        console.log(`   URL: ${sample.source_url}\n`);
      }
    }

    metrics.totalTimeMs = Date.now() - testStartTime;

    // Print final report
    console.log('=== Performance Report ===');
    console.log(`\n📊 Metrics:`);
    console.log(`   Total available listings: ${metrics.totalAvailable || 'Unknown (would need full scan)'}`);
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
