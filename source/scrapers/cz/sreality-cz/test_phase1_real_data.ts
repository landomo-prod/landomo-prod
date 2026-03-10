import { transformSRealityToStandard } from './src/transformers/srealityTransformer';
import { SRealityListing } from './src/types/srealityTypes';
import axios from 'axios';
import * as fs from 'fs';

interface Phase1TestResult {
  hash_id: number;
  property_type: string;
  has_parking: boolean | undefined;
  has_garage: boolean | undefined;
  area_total: number | undefined;
  area_plot: number | undefined;
  year_built: number | undefined;
  success: number;
  total: number;
}

interface TestReport {
  timestamp: string;
  data_source: string;
  total_listings_tested: number;
  property_types: Record<string, number>;
  field_extraction_success: Record<string, {rate: number, count: number, total: number}>;
  results: Phase1TestResult[];
  example_values: Record<string, any>;
  errors: string[];
}

async function fetchListingsFromCategory(categoryMainCb: number): Promise<Array<{ hash_id: number; name?: any; locality?: any; price?: number; price_czk?: any; seo?: any; gps?: any; advert_images_count?: number; _links?: any }>> {
  try {
    const tms = Math.floor(Date.now() / 1000);
    const url = `https://www.sreality.cz/api/cs/v2/estates?page=1&per_page=10&category_main_cb=${categoryMainCb}&tms=${tms}`;

    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 10000
    });

    const listings = response.data?._embedded?.estates || [];
    console.log(`  [Category ${categoryMainCb}] Fetched ${listings.length} listings`);
    return listings;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.log(`  [API] Failed to fetch category ${categoryMainCb}: ${errorMsg}`);
    return [];
  }
}

async function fetchEstateDetail(hashId: number): Promise<any> {
  try {
    const url = `https://www.sreality.cz/api/cs/v2/estates/${hashId}`;
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 10000
    });
    return response.data;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    return null;
  }
}

function convertDetailToListingFormat(detailData: any, baseListing: any): SRealityListing {
  // Convert items from detail API format to transformer-expected format
  const items: Array<{ name: string; value: string }> = [];

  if (detailData.items && Array.isArray(detailData.items)) {
    for (const item of detailData.items) {
      // Handle different item types
      if (item.type === 'boolean') {
        items.push({ name: item.name, value: item.value ? 'Ano' : 'Ne' });
      } else if (Array.isArray(item.value)) {
        // Handle set type items
        for (const subItem of item.value) {
          items.push({ name: item.name, value: subItem.value });
        }
      } else if (item.value !== undefined && item.value !== null) {
        // Convert to string but skip [object Object]
        const valueStr = String(item.value);
        if (valueStr !== '[object Object]') {
          items.push({ name: item.name, value: valueStr });
        }
      }
    }
  }

  return {
    ...baseListing,
    items
  };
}

function classifyPropertyType(listing: SRealityListing): string {
  const categoryMainCb = listing.seo?.category_main_cb;
  const typeMap: Record<number, string> = {
    1: 'apartment',
    2: 'house',
    3: 'land',
    4: 'commercial',
    5: 'other'
  };
  return categoryMainCb ? (typeMap[categoryMainCb] || 'other') : 'other';
}

async function runPhase1Test(): Promise<void> {
  const report: TestReport = {
    timestamp: new Date().toISOString(),
    data_source: 'real_api',
    total_listings_tested: 0,
    property_types: {},
    field_extraction_success: {
      has_parking: { rate: 0, count: 0, total: 0 },
      has_garage: { rate: 0, count: 0, total: 0 },
      area_total: { rate: 0, count: 0, total: 0 },
      area_plot: { rate: 0, count: 0, total: 0 },
      year_built: { rate: 0, count: 0, total: 0 }
    },
    results: [],
    example_values: {
      has_parking: undefined,
      has_garage: undefined,
      area_total: undefined,
      area_plot: undefined,
      year_built: undefined
    },
    errors: []
  };

  console.log('Starting Phase 1 Field Extraction Test with Real SReality API Data');
  console.log('===================================================================\n');
  console.log('Step 1: Fetching listings from multiple property categories...\n');

  // Fetch listings from multiple categories for diverse property types
  const allListings: Array<any> = [];

  // Category 1: Apartments
  const apartments = await fetchListingsFromCategory(1);
  allListings.push(...apartments.slice(0, 3));
  await new Promise(resolve => setTimeout(resolve, 500));

  // Category 2: Houses
  const houses = await fetchListingsFromCategory(2);
  allListings.push(...houses.slice(0, 3));
  await new Promise(resolve => setTimeout(resolve, 500));

  // Category 3: Land
  const land = await fetchListingsFromCategory(3);
  allListings.push(...land.slice(0, 2));

  if (allListings.length === 0) {
    console.log('No listings could be fetched from API.\n');
    return;
  }

  console.log(`\nStep 2: Fetching full details for ${allListings.length} listings...\n`);

  // Process each listing - fetch detail to get items
  for (let i = 0; i < allListings.length; i++) {
    const baseListing = allListings[i];
    process.stdout.write(`[${i + 1}/${allListings.length}] hash_id ${baseListing.hash_id}... `);

    // Fetch detail endpoint to get items
    const detailData = await fetchEstateDetail(baseListing.hash_id);
    if (!detailData) {
      console.log('FAILED (detail fetch)');
      report.errors.push(`Failed to fetch detail for hash_id ${baseListing.hash_id}`);
      continue;
    }

    try {
      // Convert detail format to listing format
      const listing = convertDetailToListingFormat(detailData, baseListing);

      // Transform the listing
      const transformed = transformSRealityToStandard(listing);

      // Track property type
      const propType = classifyPropertyType(listing);
      report.property_types[propType] = (report.property_types[propType] || 0) + 1;

      // Extract Phase 1 field values
      const has_parking = transformed.amenities?.has_parking;
      const has_garage = transformed.amenities?.has_garage;
      const area_total = transformed.country_specific?.area_total;
      const area_plot = transformed.country_specific?.area_plot;
      const year_built = transformed.country_specific?.year_built;

      // Count successes
      let successCount = 0;
      if (has_parking !== undefined) successCount++;
      if (has_garage !== undefined) successCount++;
      if (area_total !== undefined) successCount++;
      if (area_plot !== undefined) successCount++;
      if (year_built !== undefined) successCount++;

      // Update field extraction counters
      report.field_extraction_success.has_parking.total++;
      report.field_extraction_success.has_garage.total++;
      report.field_extraction_success.area_total.total++;
      report.field_extraction_success.area_plot.total++;
      report.field_extraction_success.year_built.total++;

      if (has_parking !== undefined) report.field_extraction_success.has_parking.count++;
      if (has_garage !== undefined) report.field_extraction_success.has_garage.count++;
      if (area_total !== undefined) report.field_extraction_success.area_total.count++;
      if (area_plot !== undefined) report.field_extraction_success.area_plot.count++;
      if (year_built !== undefined) report.field_extraction_success.year_built.count++;

      // Store result
      report.results.push({
        hash_id: baseListing.hash_id,
        property_type: propType,
        has_parking,
        has_garage,
        area_total,
        area_plot,
        year_built,
        success: successCount,
        total: 5
      });

      // Store example values
      if (has_parking !== undefined && report.example_values.has_parking === undefined) {
        report.example_values.has_parking = has_parking;
      }
      if (has_garage !== undefined && report.example_values.has_garage === undefined) {
        report.example_values.has_garage = has_garage;
      }
      if (area_total !== undefined && report.example_values.area_total === undefined) {
        report.example_values.area_total = area_total;
      }
      if (area_plot !== undefined && report.example_values.area_plot === undefined) {
        report.example_values.area_plot = area_plot;
      }
      if (year_built !== undefined && report.example_values.year_built === undefined) {
        report.example_values.year_built = year_built;
      }

      console.log(`OK (${successCount}/5)`);

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      report.errors.push(`Transform error for hash_id ${baseListing.hash_id}: ${errorMsg}`);
      console.log(`ERROR: ${errorMsg}`);
    }

    // Delay between requests to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  report.total_listings_tested = report.results.length;

  // Calculate success rates
  for (const field of Object.keys(report.field_extraction_success)) {
    const data = report.field_extraction_success[field as keyof typeof report.field_extraction_success];
    if (data.total > 0) {
      data.rate = Math.round((data.count / data.total) * 100);
    }
  }

  // Print report
  console.log('\n\n========== PHASE 1 FIELD EXTRACTION TEST REPORT ==========\n');
  console.log(`Timestamp: ${report.timestamp}`);
  console.log(`Data Source: Real SReality API (Apartments, Houses, Land)`);
  console.log(`Total Listings Tested: ${report.total_listings_tested}`);
  console.log('\nProperty Types Tested:');
  for (const [type, count] of Object.entries(report.property_types)) {
    console.log(`  - ${type}: ${count}`);
  }

  console.log('\n\nField Extraction Success Rates:');
  console.log('================================');
  console.log('Phase 1 fields to track:');
  for (const [field, data] of Object.entries(report.field_extraction_success)) {
    console.log(`  ${field}: ${data.rate}% (${data.count}/${data.total})`);
  }

  const overallSuccess = Math.round(
    (Object.values(report.field_extraction_success).reduce((sum, f) => sum + f.count, 0) /
    (Object.values(report.field_extraction_success).reduce((sum, f) => sum + f.total, 0))) * 100
  );
  console.log(`\nOverall Enrichment: ${overallSuccess}% of Phase 1 fields successfully extracted`);

  console.log('\n\nExample Extracted Values:');
  console.log('==========================');
  for (const [field, value] of Object.entries(report.example_values)) {
    if (value !== undefined) {
      if (typeof value === 'boolean') {
        console.log(`${field}: ${value}`);
      } else {
        console.log(`${field}: ${value}`);
      }
    } else {
      console.log(`${field}: (not found in test data)`);
    }
  }

  console.log('\n\nDetailed Results by Listing:');
  console.log('=============================');
  for (const result of report.results) {
    console.log(`\nHash ID: ${result.hash_id} (${result.property_type})`);
    console.log(`  has_parking: ${result.has_parking ?? 'undefined'}`);
    console.log(`  has_garage: ${result.has_garage ?? 'undefined'}`);
    console.log(`  area_total: ${result.area_total !== undefined ? result.area_total + ' m²' : 'undefined'}`);
    console.log(`  area_plot: ${result.area_plot !== undefined ? result.area_plot + ' m²' : 'undefined'}`);
    console.log(`  year_built: ${result.year_built ?? 'undefined'}`);
    console.log(`  Fields extracted: ${result.success}/${result.total}`);
  }

  if (report.errors.length > 0) {
    console.log('\n\nErrors Encountered:');
    console.log('===================');
    for (const error of report.errors) {
      console.log(`  - ${error}`);
    }
  }

  console.log('\n\n========== JSON TEST RESULTS ==========\n');
  console.log(JSON.stringify(report, null, 2));

  // Save results to file
  fs.writeFileSync(
    '/Users/samuelseidel/Development/landomo-world/scrapers/Czech Republic/sreality/test_results_phase1.json',
    JSON.stringify(report, null, 2)
  );
  console.log('\n\nResults saved to: test_results_phase1.json');
}

// Run the test
runPhase1Test().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
