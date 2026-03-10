/**
 * Comprehensive validation script for SReality category transformers
 * Fetches real listings from SReality API and validates all 4 categories
 */

const axios = require('axios');
const { transformSRealityToStandard } = require('./dist/sreality/src/transformers/srealityTransformer');
const { detectCategoryFromSreality } = require('./dist/sreality/src/utils/categoryDetection');
const { getRealisticHeaders } = require('./dist/sreality/src/utils/headers');
const { fetchEstateDetail } = require('./dist/sreality/src/utils/fetchData');

const CATEGORIES = {
  1: { name: 'Apartment', requiredFields: ['property_category', 'bedrooms', 'sqm', 'has_elevator', 'has_balcony', 'has_parking', 'has_basement'] },
  2: { name: 'House', requiredFields: ['property_category', 'bedrooms', 'sqm_living', 'sqm_plot', 'has_garden', 'has_garage', 'has_parking', 'has_basement'] },
  3: { name: 'Land', requiredFields: ['property_category', 'area_plot_sqm'] },
  4: { name: 'Commercial', requiredFields: ['property_category', 'sqm_total', 'has_elevator', 'has_parking', 'has_bathrooms'] },
};

const LISTINGS_PER_CATEGORY = 5;

async function fetchListingsForCategory(categoryId, count) {
  const url = `https://www.sreality.cz/api/cs/v2/estates?page=1&per_page=${count}&category_main_cb=${categoryId}&category_type_cb=1&tms=${Date.now()}`;
  const headers = getRealisticHeaders();

  try {
    const response = await axios.get(url, { headers, timeout: 15000 });
    return response.data._embedded?.estates || [];
  } catch (error) {
    console.error(`Failed to fetch category ${categoryId}: ${error.message}`);
    return [];
  }
}

async function fetchDetailForListing(hashId) {
  const headers = getRealisticHeaders();
  try {
    const result = await fetchEstateDetail(hashId, headers);
    return result.data;
  } catch (error) {
    console.error(`Failed to fetch detail for ${hashId}: ${error.message}`);
    return null;
  }
}

function validateTransformedListing(transformed, categoryInfo, listingIndex) {
  const results = { passed: [], failed: [], warnings: [] };

  // Check required fields
  for (const field of categoryInfo.requiredFields) {
    if (transformed[field] !== undefined && transformed[field] !== null) {
      results.passed.push(field);
    } else {
      results.failed.push(field);
    }
  }

  // Common validations
  if (!transformed.title || transformed.title === 'Unknown') {
    results.warnings.push('title is missing or Unknown');
  }
  if (!transformed.price || transformed.price === 0) {
    results.warnings.push('price is 0 or missing');
  }
  if (!transformed.source_url) {
    results.failed.push('source_url');
  } else {
    results.passed.push('source_url');
  }
  if (!transformed.portal_id) {
    results.failed.push('portal_id');
  } else {
    results.passed.push('portal_id');
  }
  if (transformed.status !== 'active') {
    results.failed.push('status (not active)');
  } else {
    results.passed.push('status');
  }
  if (transformed.source_platform !== 'sreality') {
    results.failed.push('source_platform');
  } else {
    results.passed.push('source_platform');
  }

  // Location check
  if (transformed.location?.city) {
    results.passed.push('location.city');
  } else {
    results.warnings.push('location.city missing');
  }
  if (transformed.location?.coordinates?.lat && transformed.location?.coordinates?.lon) {
    results.passed.push('location.coordinates');
  } else {
    results.warnings.push('location.coordinates missing');
  }

  // Check portal_metadata
  if (transformed.portal_metadata?.sreality?.hash_id) {
    results.passed.push('portal_metadata.hash_id');
  } else {
    results.warnings.push('portal_metadata.hash_id missing');
  }

  // Check country_specific
  if (transformed.country_specific) {
    results.passed.push('country_specific');
  } else {
    results.warnings.push('country_specific missing');
  }

  // Category-specific checks
  if (transformed.property_category === 'apartment') {
    if (typeof transformed.bedrooms === 'number') results.passed.push('bedrooms_value');
    if (typeof transformed.sqm === 'number' && transformed.sqm > 0) results.passed.push('sqm_value');
    if (transformed.country_specific?.czech?.disposition) results.passed.push('czech_disposition');
    if (transformed.floor !== undefined) results.passed.push('floor');
    if (transformed.condition) results.passed.push('condition');
    if (transformed.construction_type) results.passed.push('construction_type');
    if (transformed.heating_type) results.passed.push('heating_type');
  }

  if (transformed.property_category === 'house') {
    if (typeof transformed.sqm_living === 'number' && transformed.sqm_living > 0) results.passed.push('sqm_living_value');
    if (typeof transformed.sqm_plot === 'number') results.passed.push('sqm_plot_value');
    if (transformed.condition) results.passed.push('condition');
    if (transformed.construction_type) results.passed.push('construction_type');
  }

  if (transformed.property_category === 'land') {
    if (typeof transformed.area_plot_sqm === 'number' && transformed.area_plot_sqm > 0) results.passed.push('area_plot_sqm_value');
    if (transformed.land_type) results.passed.push('land_type');
    if (transformed.zoning) results.passed.push('zoning');
  }

  if (transformed.property_category === 'commercial') {
    if (typeof transformed.sqm_total === 'number' && transformed.sqm_total > 0) results.passed.push('sqm_total_value');
    if (transformed.property_subtype) results.passed.push('property_subtype');
  }

  return results;
}

async function runValidation() {
  console.log('='.repeat(80));
  console.log('SReality Category Transformer Validation');
  console.log('='.repeat(80));
  console.log(`Date: ${new Date().toISOString()}`);
  console.log(`Listings per category: ${LISTINGS_PER_CATEGORY}`);
  console.log('');

  const allResults = {};
  const categoryStats = {};
  let totalListings = 0;
  let totalPassed = 0;
  let totalFailed = 0;
  let totalTransformErrors = 0;

  for (const [catId, catInfo] of Object.entries(CATEGORIES)) {
    console.log(`\n${'─'.repeat(70)}`);
    console.log(`Category: ${catInfo.name} (category_main_cb=${catId})`);
    console.log(`${'─'.repeat(70)}`);

    // Fetch list page listings
    const listings = await fetchListingsForCategory(parseInt(catId), LISTINGS_PER_CATEGORY);
    console.log(`Fetched ${listings.length} listings from list API`);

    if (listings.length === 0) {
      categoryStats[catInfo.name] = { status: 'FAIL', listings: 0, passed: 0, failed: 0, errors: 0, details: [] };
      continue;
    }

    const categoryDetails = [];
    let catPassed = 0;
    let catFailed = 0;
    let catErrors = 0;

    for (let i = 0; i < listings.length; i++) {
      const listing = listings[i];
      const hashId = listing.hash_id;
      console.log(`\n  [${i + 1}/${listings.length}] Listing ${hashId}`);

      // Fetch detail for richer data
      await new Promise(r => setTimeout(r, 300 + Math.random() * 300));
      const detail = await fetchDetailForListing(hashId);

      // Use detail if available, otherwise use list data
      const fullListing = detail || listing;
      // Ensure seo data is present (list API provides it)
      if (!fullListing.seo && listing.seo) {
        fullListing.seo = listing.seo;
      }

      try {
        // Detect category
        const detectedCategory = detectCategoryFromSreality(fullListing);
        console.log(`    Category detected: ${detectedCategory}`);

        // Transform
        const transformed = transformSRealityToStandard(fullListing);
        console.log(`    Transformed: ${transformed.property_category}`);
        console.log(`    Title: ${(transformed.title || '').substring(0, 60)}`);
        console.log(`    Price: ${transformed.price} ${transformed.currency}`);

        // Validate
        const validation = validateTransformedListing(transformed, catInfo, i);

        console.log(`    Passed: ${validation.passed.length} | Failed: ${validation.failed.length} | Warnings: ${validation.warnings.length}`);

        if (validation.failed.length > 0) {
          console.log(`    FAILED: ${validation.failed.join(', ')}`);
          catFailed++;
        } else {
          catPassed++;
        }
        if (validation.warnings.length > 0) {
          console.log(`    WARNINGS: ${validation.warnings.join(', ')}`);
        }

        // Print key extracted values
        if (transformed.property_category === 'apartment') {
          console.log(`    sqm=${transformed.sqm}, bedrooms=${transformed.bedrooms}, floor=${transformed.floor}, elevator=${transformed.has_elevator}, balcony=${transformed.has_balcony}`);
          console.log(`    condition=${transformed.condition}, construction=${transformed.construction_type}, heating=${transformed.heating_type}`);
          console.log(`    disposition=${transformed.country_specific?.czech?.disposition}`);
        } else if (transformed.property_category === 'house') {
          console.log(`    sqm_living=${transformed.sqm_living}, sqm_plot=${transformed.sqm_plot}, bedrooms=${transformed.bedrooms}`);
          console.log(`    garden=${transformed.has_garden}, garage=${transformed.has_garage}, pool=${transformed.has_pool}`);
          console.log(`    condition=${transformed.condition}, construction=${transformed.construction_type}`);
        } else if (transformed.property_category === 'land') {
          console.log(`    area_plot_sqm=${transformed.area_plot_sqm}, land_type=${transformed.land_type}, zoning=${transformed.zoning}`);
          console.log(`    water=${transformed.water_supply}, sewage=${transformed.sewage}, electricity=${transformed.electricity}, gas=${transformed.gas}`);
        } else if (transformed.property_category === 'commercial') {
          console.log(`    sqm_total=${transformed.sqm_total}, subtype=${transformed.property_subtype}`);
          console.log(`    elevator=${transformed.has_elevator}, parking=${transformed.has_parking}`);
        }

        console.log(`    source_url=${transformed.source_url}`);

        categoryDetails.push({
          hashId,
          title: (transformed.title || '').substring(0, 50),
          passed: validation.passed.length,
          failed: validation.failed.length,
          warnings: validation.warnings.length,
          failedFields: validation.failed,
          error: null
        });

        totalListings++;
      } catch (error) {
        console.log(`    ERROR: ${error.message}`);
        catErrors++;
        totalTransformErrors++;
        categoryDetails.push({
          hashId,
          title: 'TRANSFORM ERROR',
          passed: 0,
          failed: 0,
          warnings: 0,
          failedFields: [],
          error: error.message
        });
        totalListings++;
      }
    }

    totalPassed += catPassed;
    totalFailed += catFailed;

    categoryStats[catInfo.name] = {
      status: catErrors === 0 && catFailed === 0 ? 'PASS' : catErrors > 0 ? 'ERROR' : 'PARTIAL',
      listings: listings.length,
      passed: catPassed,
      failed: catFailed,
      errors: catErrors,
      details: categoryDetails
    };
  }

  // Print summary
  console.log(`\n${'='.repeat(80)}`);
  console.log('VALIDATION SUMMARY');
  console.log(`${'='.repeat(80)}`);

  console.log('\n| Category    | Status  | Listings | Passed | Failed | Errors |');
  console.log('|-------------|---------|----------|--------|--------|--------|');
  for (const [name, stats] of Object.entries(categoryStats)) {
    const icon = stats.status === 'PASS' ? 'PASS' : stats.status === 'PARTIAL' ? 'WARN' : 'FAIL';
    console.log(`| ${name.padEnd(11)} | ${icon.padEnd(7)} | ${String(stats.listings).padEnd(8)} | ${String(stats.passed).padEnd(6)} | ${String(stats.failed).padEnd(6)} | ${String(stats.errors).padEnd(6)} |`);
  }

  console.log(`\nTotal: ${totalListings} listings, ${totalPassed} passed, ${totalFailed} failed, ${totalTransformErrors} transform errors`);

  // Overall verdict
  const allPass = Object.values(categoryStats).every(s => s.status === 'PASS');
  console.log(`\nOverall: ${allPass ? 'ALL CATEGORIES PASS' : 'ISSUES DETECTED'}`);

  // Output JSON for report
  const report = {
    timestamp: new Date().toISOString(),
    totalListings,
    totalPassed,
    totalFailed,
    totalTransformErrors,
    categories: categoryStats,
    overallPass: allPass
  };

  // Write report
  const fs = require('fs');
  fs.writeFileSync('/Users/samuelseidel/Development/landomo-world/scrapers/Czech Republic/sreality/validation-report.json', JSON.stringify(report, null, 2));
  console.log('\nReport saved to validation-report.json');
}

runValidation().catch(err => {
  console.error('Validation failed:', err);
  process.exit(1);
});
