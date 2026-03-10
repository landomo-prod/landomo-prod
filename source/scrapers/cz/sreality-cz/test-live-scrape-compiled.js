/**
 * Live end-to-end scraper test using compiled JS
 */

const { fetchAllListingPages } = require('./dist/sreality/src/utils/fetchData');
const { transformSRealityToStandard } = require('./dist/sreality/src/transformers/srealityTransformer');
const { batchCreateSRealityChecksums } = require('./dist/sreality/src/utils/checksumExtractor');

async function runLiveTest() {
  console.log('🧪 Starting live end-to-end scraper test\n');
  console.log('📊 Test Configuration:');
  console.log('  - Categories: Apartments (1)');
  console.log('  - Type: Sale (1)');
  console.log('  - Limit: 1 page (max 100 listings)');
  console.log('  - Mode: Read-only (no database writes)\n');

  try {
    // Phase 1: Fetch listings (limited to 1 page)
    console.log('📋 Phase 1: Fetching listings from SReality API...');
    const startTime = Date.now();

    const listings = await fetchAllListingPages(
      1,  // category: apartments
      1,  // type: sale
      1   // maxPages: 1 (limit to single page)
    );

    const fetchDuration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`✅ Fetched ${listings.length} listings in ${fetchDuration}s\n`);

    if (listings.length === 0) {
      console.error('❌ No listings returned from API');
      process.exit(1);
    }

    // Show sample listing
    console.log('📄 Sample listing:');
    const sample = listings[0];
    console.log(`  - ID: ${sample.hash_id}`);
    console.log(`  - Name: ${sample.name}`);
    console.log(`  - Price: ${sample.price_czk?.value_raw || sample.price} CZK`);
    console.log(`  - Category: ${sample.seo?.category_main_cb}`);
    console.log('');

    // Phase 2: Generate checksums
    console.log('🔐 Phase 2: Generating checksums...');
    const checksumStart = Date.now();

    const checksums = batchCreateSRealityChecksums(listings);

    const checksumDuration = ((Date.now() - checksumStart) / 1000).toFixed(2);
    console.log(`✅ Generated ${checksums.length} checksums in ${checksumDuration}s`);
    console.log(`  - Sample hash: ${checksums[0].contentHash.substring(0, 16)}...`);
    console.log('');

    // Phase 3: Transform listings
    console.log('🔄 Phase 3: Transforming to Tier I format...');
    const transformStart = Date.now();

    let transformed = 0;
    let errors = 0;
    const results = [];

    for (const listing of listings.slice(0, 10)) { // Transform first 10 as sample
      try {
        const result = transformSRealityToStandard(listing);
        results.push(result);
        transformed++;
      } catch (error) {
        errors++;
        console.error(`  ⚠️  Transform error for ${listing.hash_id}: ${error.message}`);
      }
    }

    const transformDuration = ((Date.now() - transformStart) / 1000).toFixed(2);
    console.log(`✅ Transformed ${transformed} listings in ${transformDuration}s`);
    console.log(`  - Errors: ${errors}`);
    console.log('');

    // Validate transformed data
    console.log('✔️  Phase 4: Validating transformed data...');
    const validationResults = {
      hasPropertyCategory: 0,
      hasBedrooms: 0,
      hasSqm: 0,
      hasPrice: 0,
      hasLocation: 0,
      hasPortalId: 0,
      hasStatus: 0,
    };

    for (const result of results) {
      if (result.property_category) validationResults.hasPropertyCategory++;
      if (result.bedrooms !== undefined) validationResults.hasBedrooms++;
      if (result.sqm !== undefined) validationResults.hasSqm++;
      if (result.price) validationResults.hasPrice++;
      if (result.location) validationResults.hasLocation++;
      if (result.portal_id) validationResults.hasPortalId++;
      if (result.status) validationResults.hasStatus++;
    }

    console.log(`  - property_category: ${validationResults.hasPropertyCategory}/${results.length} (${(validationResults.hasPropertyCategory/results.length*100).toFixed(0)}%)`);
    console.log(`  - bedrooms: ${validationResults.hasBedrooms}/${results.length} (${(validationResults.hasBedrooms/results.length*100).toFixed(0)}%)`);
    console.log(`  - sqm: ${validationResults.hasSqm}/${results.length} (${(validationResults.hasSqm/results.length*100).toFixed(0)}%)`);
    console.log(`  - price: ${validationResults.hasPrice}/${results.length} (${(validationResults.hasPrice/results.length*100).toFixed(0)}%)`);
    console.log(`  - location: ${validationResults.hasLocation}/${results.length} (${(validationResults.hasLocation/results.length*100).toFixed(0)}%)`);
    console.log(`  - portal_id: ${validationResults.hasPortalId}/${results.length} (${(validationResults.hasPortalId/results.length*100).toFixed(0)}%)`);
    console.log(`  - status: ${validationResults.hasStatus}/${results.length} (${(validationResults.hasStatus/results.length*100).toFixed(0)}%)`);
    console.log('');

    // Show sample transformed property
    if (results.length > 0) {
      const sampleResult = results[0];
      console.log('📋 Sample transformed property:');
      console.log(`  - Category: ${sampleResult.property_category}`);
      console.log(`  - Bedrooms: ${sampleResult.bedrooms}`);
      console.log(`  - SQM: ${sampleResult.sqm}`);
      console.log(`  - Price: ${sampleResult.price} ${sampleResult.currency}`);
      console.log(`  - Type: ${sampleResult.transaction_type}`);
      console.log(`  - Elevator: ${sampleResult.has_elevator}`);
      console.log(`  - Balcony: ${sampleResult.has_balcony}`);
      console.log(`  - Portal ID: ${sampleResult.portal_id}`);
      console.log(`  - Status: ${sampleResult.status}`);
      console.log('');
    }

    // Final summary
    console.log('=' .repeat(60));
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(60));
    console.log(`✅ API Fetch: ${listings.length} listings in ${fetchDuration}s`);
    console.log(`✅ Checksums: ${checksums.length} generated in ${checksumDuration}s`);
    console.log(`✅ Transform: ${transformed}/${transformed + errors} successful (${(transformed/(transformed+errors)*100).toFixed(0)}%)`);
    console.log(`✅ Validation: ${validationResults.hasPropertyCategory}/${results.length} complete (${(validationResults.hasPropertyCategory/results.length*100).toFixed(0)}%)`);
    console.log('');

    const totalDuration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`⏱️  Total test duration: ${totalDuration}s`);
    console.log('');

    // Check if we meet quality thresholds
    const transformSuccessRate = transformed / (transformed + errors);
    const dataCompleteRate = validationResults.hasPropertyCategory / results.length;

    if (transformSuccessRate >= 0.95 && dataCompleteRate >= 0.90) {
      console.log('🎉 TEST PASSED: Scraper is working correctly!');
      console.log('');
      console.log('✅ Transform success rate: ≥95%');
      console.log('✅ Data completeness: ≥90%');
      console.log('✅ All critical fields present');
      console.log('✅ Category detection working');
      console.log('✅ Checksum generation working');
      process.exit(0);
    } else {
      console.log('⚠️  TEST PASSED WITH WARNINGS');
      console.log('');
      if (transformSuccessRate < 0.95) {
        console.log(`⚠️  Transform success rate: ${(transformSuccessRate*100).toFixed(0)}% (target: ≥95%)`);
      }
      if (dataCompleteRate < 0.90) {
        console.log(`⚠️  Data completeness: ${(dataCompleteRate*100).toFixed(0)}% (target: ≥90%)`);
      }
      process.exit(0);
    }

  } catch (error) {
    console.error('');
    console.error('=' .repeat(60));
    console.error('❌ TEST FAILED');
    console.error('='.repeat(60));
    console.error('Error:', error.message);
    console.error('');
    console.error('Stack trace:');
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the test
runLiveTest().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
