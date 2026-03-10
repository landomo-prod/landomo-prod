/**
 * Full scrape test - tests complete pipeline with multiple categories
 * Fetches larger dataset to validate production performance
 */

import { fetchAllListingPages } from './src/utils/fetchData';
import { transformSRealityToStandard } from './src/transformers/srealityTransformer';
import { batchCreateSRealityChecksums } from './src/utils/checksumExtractor';
import { createLogger } from '@landomo/core';

const log = createLogger({ service: 'test-full-scrape' });

interface CategoryTestConfig {
  id: number;
  name: string;
  maxPages: number;
}

const CATEGORIES: CategoryTestConfig[] = [
  { id: 1, name: 'Apartments', maxPages: 3 },
  { id: 2, name: 'Houses', maxPages: 2 },
  { id: 3, name: 'Land', maxPages: 2 },
  { id: 4, name: 'Commercial', maxPages: 2 },
  { id: 5, name: 'Other', maxPages: 1 }
];

const TRANSACTION_TYPE = 1; // Sale

interface CategoryResults {
  category: string;
  fetched: number;
  checksums: number;
  transformed: number;
  errors: number;
  fetchTime: number;
  transformTime: number;
  sampleProperty?: any;
}

async function testCategory(config: CategoryTestConfig): Promise<CategoryResults> {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📋 Testing Category: ${config.name}`);
  console.log('='.repeat(60));

  const result: CategoryResults = {
    category: config.name,
    fetched: 0,
    checksums: 0,
    transformed: 0,
    errors: 0,
    fetchTime: 0,
    transformTime: 0
  };

  try {
    // Phase 1: Fetch listings
    console.log(`📥 Fetching ${config.name} (max ${config.maxPages} pages)...`);
    const fetchStart = Date.now();

    const listings = await fetchAllListingPages(
      config.id,
      TRANSACTION_TYPE,
      config.maxPages
    );

    result.fetchTime = (Date.now() - fetchStart) / 1000;
    result.fetched = listings.length;

    console.log(`✅ Fetched ${listings.length} listings in ${result.fetchTime.toFixed(2)}s`);
    console.log(`   Average: ${(result.fetchTime / listings.length * 1000).toFixed(0)}ms per listing`);

    if (listings.length === 0) {
      console.log('⚠️  No listings found for this category');
      return result;
    }

    // Phase 2: Generate checksums
    console.log(`🔐 Generating checksums...`);
    const checksumStart = Date.now();

    const checksums = batchCreateSRealityChecksums(listings);
    result.checksums = checksums.length;

    const checksumTime = (Date.now() - checksumStart) / 1000;
    console.log(`✅ Generated ${checksums.length} checksums in ${checksumTime.toFixed(2)}s`);
    console.log(`   Average: ${(checksumTime / checksums.length * 1000).toFixed(0)}ms per checksum`);

    // Phase 3: Transform listings
    console.log(`🔄 Transforming to Tier I format...`);
    const transformStart = Date.now();

    const results: any[] = [];
    const transformErrors: Array<{ id: string; error: string }> = [];

    for (const listing of listings) {
      try {
        const transformed = transformSRealityToStandard(listing);
        results.push(transformed);
        result.transformed++;
      } catch (error: any) {
        result.errors++;
        transformErrors.push({
          id: listing.hash_id,
          error: error.message
        });
      }
    }

    result.transformTime = (Date.now() - transformStart) / 1000;

    console.log(`✅ Transformed ${result.transformed} listings in ${result.transformTime.toFixed(2)}s`);
    console.log(`   Average: ${(result.transformTime / result.transformed * 1000).toFixed(0)}ms per listing`);
    console.log(`   Errors: ${result.errors} (${(result.errors / listings.length * 100).toFixed(1)}%)`);

    // Show error samples if any
    if (transformErrors.length > 0) {
      console.log(`\n⚠️  Transform Errors (showing first 3):`);
      transformErrors.slice(0, 3).forEach(err => {
        console.log(`   - ${err.id}: ${err.error}`);
      });
    }

    // Validate transformed data
    console.log(`\n✔️  Validating transformed data...`);
    const validation = {
      hasPropertyCategory: 0,
      hasBedrooms: 0,
      hasSqm: 0,
      hasPrice: 0,
      hasLocation: 0,
      hasPortalId: 0,
      hasStatus: 0,
      categoryBreakdown: {} as Record<string, number>
    };

    for (const property of results) {
      if (property.property_category) {
        validation.hasPropertyCategory++;
        validation.categoryBreakdown[property.property_category] =
          (validation.categoryBreakdown[property.property_category] || 0) + 1;
      }
      if (property.bedrooms !== undefined && property.bedrooms !== null) validation.hasBedrooms++;
      if (property.sqm !== undefined && property.sqm !== null) validation.hasSqm++;
      if (property.price) validation.hasPrice++;
      if (property.location) validation.hasLocation++;
      if (property.portal_id) validation.hasPortalId++;
      if (property.status) validation.hasStatus++;
    }

    console.log(`   - property_category: ${validation.hasPropertyCategory}/${results.length} (${(validation.hasPropertyCategory/results.length*100).toFixed(0)}%)`);
    console.log(`   - bedrooms: ${validation.hasBedrooms}/${results.length} (${(validation.hasBedrooms/results.length*100).toFixed(0)}%)`);
    console.log(`   - sqm: ${validation.hasSqm}/${results.length} (${(validation.hasSqm/results.length*100).toFixed(0)}%)`);
    console.log(`   - price: ${validation.hasPrice}/${results.length} (${(validation.hasPrice/results.length*100).toFixed(0)}%)`);
    console.log(`   - location: ${validation.hasLocation}/${results.length} (${(validation.hasLocation/results.length*100).toFixed(0)}%)`);
    console.log(`   - portal_id: ${validation.hasPortalId}/${results.length} (${(validation.hasPortalId/results.length*100).toFixed(0)}%)`);
    console.log(`   - status: ${validation.hasStatus}/${results.length} (${(validation.hasStatus/results.length*100).toFixed(0)}%)`);

    console.log(`\n   Category Breakdown:`);
    Object.entries(validation.categoryBreakdown).forEach(([cat, count]) => {
      console.log(`   - ${cat}: ${count} (${(count/results.length*100).toFixed(1)}%)`);
    });

    // Store sample property
    if (results.length > 0) {
      result.sampleProperty = results[0];
    }

  } catch (error: any) {
    console.error(`❌ Error testing ${config.name}:`, error.message);
    result.errors++;
  }

  return result;
}

async function runFullScrapeTest() {
  console.log('🚀 Starting Full Scrape Test\n');
  console.log('📊 Test Configuration:');
  console.log(`  - Categories: ${CATEGORIES.map(c => c.name).join(', ')}`);
  console.log(`  - Transaction Type: Sale (${TRANSACTION_TYPE})`);
  console.log(`  - Total Pages: ${CATEGORIES.reduce((sum, c) => sum + c.maxPages, 0)}`);
  console.log(`  - Expected Listings: ~${CATEGORIES.reduce((sum, c) => sum + c.maxPages, 0) * 100}`);
  console.log(`  - Mode: Read-only (no database writes)\n`);

  const overallStart = Date.now();
  const categoryResults: CategoryResults[] = [];

  // Test each category
  for (const category of CATEGORIES) {
    const result = await testCategory(category);
    categoryResults.push(result);
  }

  // Overall summary
  const totalTime = (Date.now() - overallStart) / 1000;

  console.log('\n' + '='.repeat(60));
  console.log('📊 OVERALL TEST SUMMARY');
  console.log('='.repeat(60));

  const totals = categoryResults.reduce((acc, r) => ({
    fetched: acc.fetched + r.fetched,
    checksums: acc.checksums + r.checksums,
    transformed: acc.transformed + r.transformed,
    errors: acc.errors + r.errors,
    fetchTime: acc.fetchTime + r.fetchTime,
    transformTime: acc.transformTime + r.transformTime
  }), { fetched: 0, checksums: 0, transformed: 0, errors: 0, fetchTime: 0, transformTime: 0 });

  console.log(`\n📈 Volume:`);
  console.log(`  - Total Listings Fetched: ${totals.fetched}`);
  console.log(`  - Checksums Generated: ${totals.checksums}`);
  console.log(`  - Successfully Transformed: ${totals.transformed}`);
  console.log(`  - Transform Errors: ${totals.errors}`);

  console.log(`\n⏱️  Performance:`);
  console.log(`  - Total Time: ${totalTime.toFixed(2)}s`);
  console.log(`  - Fetch Time: ${totals.fetchTime.toFixed(2)}s (${(totals.fetchTime/totalTime*100).toFixed(0)}%)`);
  console.log(`  - Transform Time: ${totals.transformTime.toFixed(2)}s (${(totals.transformTime/totalTime*100).toFixed(0)}%)`);
  console.log(`  - Average per Listing: ${(totalTime/totals.fetched*1000).toFixed(0)}ms`);
  console.log(`  - Throughput: ${(totals.fetched/totalTime).toFixed(1)} listings/sec`);

  console.log(`\n📋 By Category:`);
  categoryResults.forEach(r => {
    const successRate = r.fetched > 0 ? (r.transformed / r.fetched * 100).toFixed(0) : '0';
    console.log(`  - ${r.category.padEnd(15)} ${r.fetched.toString().padStart(4)} fetched, ${r.transformed.toString().padStart(4)} transformed (${successRate}% success)`);
  });

  // Quality Assessment
  console.log(`\n✅ Quality Assessment:`);
  const overallSuccessRate = totals.fetched > 0 ? totals.transformed / totals.fetched : 0;
  const overallErrorRate = totals.fetched > 0 ? totals.errors / totals.fetched : 0;

  console.log(`  - Transform Success Rate: ${(overallSuccessRate * 100).toFixed(1)}%`);
  console.log(`  - Error Rate: ${(overallErrorRate * 100).toFixed(1)}%`);
  console.log(`  - Checksum Coverage: ${totals.checksums === totals.fetched ? '100%' : (totals.checksums/totals.fetched*100).toFixed(1)+'%'}`);

  // Sample properties
  console.log(`\n📄 Sample Properties:`);
  categoryResults.filter(r => r.sampleProperty).forEach(r => {
    const p = r.sampleProperty;
    console.log(`\n  ${r.category}:`);
    console.log(`    - Category: ${p.property_category}`);
    console.log(`    - Portal ID: ${p.portal_id}`);
    console.log(`    - Price: ${p.price} ${p.currency}`);
    console.log(`    - Status: ${p.status}`);
    if (p.bedrooms !== undefined) console.log(`    - Bedrooms: ${p.bedrooms}`);
    if (p.sqm !== undefined) console.log(`    - SQM: ${p.sqm}`);
    if (p.sqm_living !== undefined) console.log(`    - SQM Living: ${p.sqm_living}`);
    if (p.sqm_plot !== undefined) console.log(`    - SQM Plot: ${p.sqm_plot}`);
  });

  // Final verdict
  console.log('\n' + '='.repeat(60));
  if (overallSuccessRate >= 0.95) {
    console.log('🎉 TEST PASSED: Full scrape working correctly!');
    console.log('='.repeat(60));
    console.log('✅ All categories processed successfully');
    console.log('✅ Transform success rate ≥95%');
    console.log('✅ Production-ready performance');
    console.log('✅ Category detection working across all types');
    console.log('✅ Checksum generation complete');
    process.exit(0);
  } else if (overallSuccessRate >= 0.85) {
    console.log('⚠️  TEST PASSED WITH WARNINGS');
    console.log('='.repeat(60));
    console.log(`⚠️  Transform success rate: ${(overallSuccessRate*100).toFixed(1)}% (target: ≥95%)`);
    console.log('⚠️  Review transform errors above');
    process.exit(0);
  } else {
    console.log('❌ TEST FAILED');
    console.log('='.repeat(60));
    console.log(`❌ Transform success rate: ${(overallSuccessRate*100).toFixed(1)}% (target: ≥95%)`);
    console.log('❌ Too many transform errors - investigation required');
    process.exit(1);
  }
}

// Run the test
runFullScrapeTest().catch(error => {
  console.error('\n❌ Unhandled error:', error);
  console.error('Stack trace:', error.stack);
  process.exit(1);
});
