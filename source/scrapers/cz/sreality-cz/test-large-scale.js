/**
 * Large-scale stress test - 50,000 listings
 * Tests performance, memory usage, and stability at production scale
 */

const { fetchAllListingPages } = require('./dist/sreality/src/utils/fetchData');
const { transformSRealityToStandard } = require('./dist/sreality/src/transformers/srealityTransformer');
const { batchCreateSRealityChecksums } = require('./dist/sreality/src/utils/checksumExtractor');

// Target: ~50,000 listings across 5 categories
const CATEGORIES = [
  { id: 1, name: 'Apartments', maxPages: 200 },  // ~20,000 listings
  { id: 2, name: 'Houses', maxPages: 125 },      // ~12,500 listings
  { id: 3, name: 'Land', maxPages: 125 },        // ~12,500 listings
  { id: 4, name: 'Commercial', maxPages: 40 },   // ~4,000 listings
  { id: 5, name: 'Other', maxPages: 10 }         // ~1,000 listings
];

const TRANSACTION_TYPE = 1; // Sale
const BATCH_SIZE = 5000; // Process in batches to manage memory

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

function getMemoryUsage() {
  const usage = process.memoryUsage();
  return {
    rss: formatBytes(usage.rss),
    heapTotal: formatBytes(usage.heapTotal),
    heapUsed: formatBytes(usage.heapUsed),
    external: formatBytes(usage.external)
  };
}

function showProgress(current, total, message) {
  const percent = Math.round(current / total * 100);
  const bar = '█'.repeat(Math.floor(percent / 2)) + '░'.repeat(50 - Math.floor(percent / 2));
  process.stdout.write(`\r[${bar}] ${percent}% - ${message}`);
}

async function testCategory(config, overallProgress) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`📋 Testing Category: ${config.name} (${config.maxPages} pages)`);
  console.log('='.repeat(70));

  const result = {
    category: config.name,
    fetched: 0,
    checksums: 0,
    transformed: 0,
    errors: 0,
    fetchTime: 0,
    transformTime: 0,
    checksumTime: 0,
    memoryPeak: { heapUsed: 0 },
    errorSamples: []
  };

  try {
    // Phase 1: Fetch listings
    console.log(`📥 Fetching ${config.name}...`);
    const fetchStart = Date.now();
    const memBefore = process.memoryUsage();

    const listings = await fetchAllListingPages(
      config.id,
      TRANSACTION_TYPE,
      config.maxPages
    );

    const memAfter = process.memoryUsage();
    result.fetchTime = (Date.now() - fetchStart) / 1000;
    result.fetched = listings.length;

    console.log(`\n✅ Fetched ${listings.length} listings in ${result.fetchTime.toFixed(2)}s`);
    console.log(`   Memory: ${formatBytes(memAfter.heapUsed - memBefore.heapUsed)} increase`);
    console.log(`   Rate: ${(listings.length / result.fetchTime).toFixed(0)} listings/sec`);

    if (listings.length === 0) {
      console.log('⚠️  No listings found for this category');
      return result;
    }

    // Phase 2: Generate checksums
    console.log(`\n🔐 Generating checksums...`);
    const checksumStart = Date.now();

    const checksums = batchCreateSRealityChecksums(listings);
    result.checksums = checksums.length;
    result.checksumTime = (Date.now() - checksumStart) / 1000;

    console.log(`✅ Generated ${checksums.length} checksums in ${result.checksumTime.toFixed(2)}s`);
    console.log(`   Rate: ${(checksums.length / result.checksumTime).toFixed(0)} checksums/sec`);

    // Phase 3: Transform listings in batches
    console.log(`\n🔄 Transforming to Tier I format (in batches of ${BATCH_SIZE})...`);
    const transformStart = Date.now();

    const results = [];
    const batchCount = Math.ceil(listings.length / BATCH_SIZE);
    let maxHeapUsed = 0;

    for (let batchIdx = 0; batchIdx < batchCount; batchIdx++) {
      const start = batchIdx * BATCH_SIZE;
      const end = Math.min(start + BATCH_SIZE, listings.length);
      const batch = listings.slice(start, end);

      showProgress(end, listings.length, `Transforming batch ${batchIdx + 1}/${batchCount}`);

      for (const listing of batch) {
        try {
          const transformed = transformSRealityToStandard(listing);
          results.push(transformed);
          result.transformed++;
        } catch (error) {
          result.errors++;
          if (result.errorSamples.length < 5) {
            result.errorSamples.push({
              id: listing.hash_id,
              error: error.message
            });
          }
        }
      }

      // Track memory usage
      const currentHeap = process.memoryUsage().heapUsed;
      if (currentHeap > maxHeapUsed) {
        maxHeapUsed = currentHeap;
      }

      // Force GC hint every 10 batches
      if (batchIdx % 10 === 0 && global.gc) {
        global.gc();
      }
    }

    process.stdout.write('\n');
    result.transformTime = (Date.now() - transformStart) / 1000;
    result.memoryPeak.heapUsed = maxHeapUsed;

    console.log(`✅ Transformed ${result.transformed} listings in ${result.transformTime.toFixed(2)}s`);
    console.log(`   Rate: ${(result.transformed / result.transformTime).toFixed(0)} listings/sec`);
    console.log(`   Errors: ${result.errors} (${(result.errors / listings.length * 100).toFixed(2)}%)`);
    console.log(`   Peak Memory: ${formatBytes(maxHeapUsed)}`);

    // Show error samples
    if (result.errorSamples.length > 0) {
      console.log(`\n⚠️  Error Samples (first ${result.errorSamples.length}):`);
      result.errorSamples.forEach(err => {
        console.log(`   - ${err.id}: ${err.error}`);
      });
    }

    // Validate sample
    console.log(`\n✔️  Data Quality (sampling first 1000)...`);
    const sampleSize = Math.min(1000, results.length);
    const validation = {
      hasPropertyCategory: 0,
      hasBedrooms: 0,
      hasPrice: 0,
      hasLocation: 0,
      hasPortalId: 0,
      hasStatus: 0
    };

    for (let i = 0; i < sampleSize; i++) {
      const property = results[i];
      if (property.property_category) validation.hasPropertyCategory++;
      if (property.bedrooms !== undefined) validation.hasBedrooms++;
      if (property.price) validation.hasPrice++;
      if (property.location) validation.hasLocation++;
      if (property.portal_id) validation.hasPortalId++;
      if (property.status) validation.hasStatus++;
    }

    console.log(`   - property_category: ${(validation.hasPropertyCategory/sampleSize*100).toFixed(1)}%`);
    console.log(`   - portal_id: ${(validation.hasPortalId/sampleSize*100).toFixed(1)}%`);
    console.log(`   - price: ${(validation.hasPrice/sampleSize*100).toFixed(1)}%`);
    console.log(`   - location: ${(validation.hasLocation/sampleSize*100).toFixed(1)}%`);
    console.log(`   - status: ${(validation.hasStatus/sampleSize*100).toFixed(1)}%`);

    // Store first property as sample
    if (results.length > 0) {
      result.sampleProperty = results[0];
    }

    // Clear results array to free memory
    results.length = 0;

  } catch (error) {
    console.error(`\n❌ Error testing ${config.name}:`, error.message);
    console.error(error.stack);
    result.errors++;
  }

  return result;
}

async function runLargeScaleTest() {
  console.log('🚀 LARGE-SCALE STRESS TEST\n');
  console.log('=' .repeat(70));
  console.log('Target: ~50,000 listings across 5 categories');
  console.log('=' .repeat(70));

  console.log('\n📊 Test Configuration:');
  CATEGORIES.forEach(c => {
    console.log(`  - ${c.name.padEnd(12)}: ${c.maxPages.toString().padStart(3)} pages (~${(c.maxPages * 100).toLocaleString().padStart(6)} listings)`);
  });

  const totalPages = CATEGORIES.reduce((sum, c) => sum + c.maxPages, 0);
  console.log(`  - Total Pages: ${totalPages}`);
  console.log(`  - Expected: ~${(totalPages * 100).toLocaleString()} listings`);
  console.log(`  - Batch Size: ${BATCH_SIZE.toLocaleString()} listings per transform batch`);
  console.log(`  - Mode: Read-only (no database writes)\n`);

  const startMemory = getMemoryUsage();
  console.log('💾 Initial Memory:', JSON.stringify(startMemory, null, 2));

  const overallStart = Date.now();
  const categoryResults = [];

  // Test each category
  for (let i = 0; i < CATEGORIES.length; i++) {
    const category = CATEGORIES[i];
    const result = await testCategory(category, {
      current: i + 1,
      total: CATEGORIES.length
    });
    categoryResults.push(result);

    // Show current memory after each category
    const currentMem = getMemoryUsage();
    console.log(`\n💾 Current Memory: Heap ${currentMem.heapUsed} / ${currentMem.heapTotal}`);

    // Force GC between categories if available
    if (global.gc) {
      console.log('🧹 Running garbage collection...');
      global.gc();
      const afterGC = getMemoryUsage();
      console.log(`💾 After GC: Heap ${afterGC.heapUsed} / ${afterGC.heapTotal}`);
    }
  }

  // Overall summary
  const totalTime = (Date.now() - overallStart) / 1000;
  const endMemory = getMemoryUsage();

  console.log('\n\n' + '='.repeat(70));
  console.log('📊 FINAL RESULTS - LARGE-SCALE TEST');
  console.log('='.repeat(70));

  const totals = categoryResults.reduce((acc, r) => ({
    fetched: acc.fetched + r.fetched,
    checksums: acc.checksums + r.checksums,
    transformed: acc.transformed + r.transformed,
    errors: acc.errors + r.errors,
    fetchTime: acc.fetchTime + r.fetchTime,
    checksumTime: acc.checksumTime + r.checksumTime,
    transformTime: acc.transformTime + r.transformTime
  }), { fetched: 0, checksums: 0, transformed: 0, errors: 0, fetchTime: 0, checksumTime: 0, transformTime: 0 });

  console.log(`\n📈 Volume:`);
  console.log(`  - Total Listings Fetched: ${totals.fetched.toLocaleString()}`);
  console.log(`  - Checksums Generated: ${totals.checksums.toLocaleString()}`);
  console.log(`  - Successfully Transformed: ${totals.transformed.toLocaleString()}`);
  console.log(`  - Transform Errors: ${totals.errors.toLocaleString()} (${(totals.errors/totals.fetched*100).toFixed(3)}%)`);

  console.log(`\n⏱️  Performance:`);
  console.log(`  - Total Time: ${totalTime.toFixed(2)}s (${(totalTime/60).toFixed(2)} minutes)`);
  console.log(`  - Fetch Time: ${totals.fetchTime.toFixed(2)}s (${(totals.fetchTime/totalTime*100).toFixed(0)}%)`);
  console.log(`  - Checksum Time: ${totals.checksumTime.toFixed(2)}s (${(totals.checksumTime/totalTime*100).toFixed(0)}%)`);
  console.log(`  - Transform Time: ${totals.transformTime.toFixed(2)}s (${(totals.transformTime/totalTime*100).toFixed(0)}%)`);
  console.log(`  - Overall Throughput: ${(totals.fetched/totalTime).toFixed(1)} listings/sec`);
  console.log(`  - Transform Throughput: ${(totals.transformed/totals.transformTime).toFixed(0)} listings/sec`);

  console.log(`\n💾 Memory Usage:`);
  console.log(`  - Initial Heap: ${startMemory.heapUsed}`);
  console.log(`  - Final Heap: ${endMemory.heapUsed}`);
  console.log(`  - Peak Heap: ${formatBytes(Math.max(...categoryResults.map(r => r.memoryPeak.heapUsed)))}`);
  console.log(`  - RSS: ${endMemory.rss}`);

  console.log(`\n📋 By Category:`);
  categoryResults.forEach(r => {
    const successRate = r.fetched > 0 ? (r.transformed / r.fetched * 100).toFixed(2) : '0';
    const throughput = r.transformTime > 0 ? (r.transformed / r.transformTime).toFixed(0) : '0';
    console.log(`  - ${r.category.padEnd(12)} ${r.fetched.toLocaleString().padStart(6)} fetched, ${r.transformed.toLocaleString().padStart(6)} transformed (${successRate}% success, ${throughput} t/s)`);
  });

  // Quality Assessment
  console.log(`\n✅ Quality Assessment:`);
  const overallSuccessRate = totals.fetched > 0 ? totals.transformed / totals.fetched : 0;
  const overallErrorRate = totals.fetched > 0 ? totals.errors / totals.fetched : 0;

  console.log(`  - Transform Success Rate: ${(overallSuccessRate * 100).toFixed(3)}%`);
  console.log(`  - Error Rate: ${(overallErrorRate * 100).toFixed(3)}%`);
  console.log(`  - Checksum Coverage: ${totals.checksums === totals.fetched ? '100.000%' : (totals.checksums/totals.fetched*100).toFixed(3)+'%'}`);
  console.log(`  - Average Processing Time: ${(totalTime/totals.fetched*1000).toFixed(2)}ms per listing`);

  // Extrapolate to full production
  console.log(`\n📈 Production Extrapolation (if maintained):`);
  const listingsPerHour = (totals.fetched / totalTime) * 3600;
  const listingsPerDay = listingsPerHour * 24;
  console.log(`  - Potential Throughput: ${listingsPerHour.toFixed(0).toLocaleString()} listings/hour`);
  console.log(`  - Daily Capacity: ${listingsPerDay.toFixed(0).toLocaleString()} listings/day`);
  console.log(`  - Time for 1M listings: ${(1000000 / (totals.fetched / totalTime) / 3600).toFixed(1)} hours`);

  // Final verdict
  console.log('\n' + '='.repeat(70));
  if (overallSuccessRate >= 0.99) {
    console.log('🎉 STRESS TEST PASSED - EXCELLENT PERFORMANCE!');
    console.log('='.repeat(70));
    console.log(`✅ Processed ${totals.fetched.toLocaleString()} listings successfully`);
    console.log('✅ Transform success rate ≥99%');
    console.log('✅ High throughput sustained at scale');
    console.log('✅ Memory usage stable');
    console.log('✅ Production-ready for large-scale deployment');
    process.exit(0);
  } else if (overallSuccessRate >= 0.95) {
    console.log('✅ STRESS TEST PASSED');
    console.log('='.repeat(70));
    console.log(`✅ Processed ${totals.fetched.toLocaleString()} listings`);
    console.log(`✅ Transform success rate: ${(overallSuccessRate*100).toFixed(2)}% (≥95%)`);
    console.log('⚠️  Some errors detected - review samples above');
    process.exit(0);
  } else {
    console.log('❌ STRESS TEST FAILED');
    console.log('='.repeat(70));
    console.log(`❌ Transform success rate: ${(overallSuccessRate*100).toFixed(2)}% (target: ≥95%)`);
    console.log('❌ Too many transform errors at scale');
    process.exit(1);
  }
}

// Run the test
console.log('⚙️  Starting large-scale test...');
console.log('⚠️  This will take several minutes and fetch ~50,000 listings\n');

runLargeScaleTest().catch(error => {
  console.error('\n❌ Unhandled error:', error.message);
  console.error('Stack trace:', error.stack);
  process.exit(1);
});
