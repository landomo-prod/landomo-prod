import axios from 'axios';
import { transformSRealityToStandard } from './src/transformers/srealityTransformer';
import { SRealityListing } from './src/types/srealityTypes';
import * as fs from 'fs';

/**
 * Phase 2b Infrastructure Field Testing
 * Tests water_supply, sewage_type, gas_supply, bathrooms, and recently_renovated
 */

interface TestResult {
  hash_id: number;
  address: string;
  property_type: string;
  raw_items: Array<{ name: string; value: string }>;
  extracted_fields: {
    water_supply?: string;
    sewage_type?: string;
    gas_supply?: boolean;
    bathrooms?: number;
    recently_renovated?: boolean;
  };
  parsing_errors?: string[];
}

interface TestReport {
  test_timestamp: string;
  total_listings_tested: number;
  successful_transformations: number;
  failed_transformations: number;
  field_extraction_stats: {
    water_supply: {
      found: number;
      not_found: number;
      example_values: string[];
    };
    sewage_type: {
      found: number;
      not_found: number;
      example_values: string[];
    };
    gas_supply: {
      found_true: number;
      found_false: number;
      not_found: number;
    };
    bathrooms: {
      found: number;
      not_found: number;
      default_used: number;
      example_values: number[];
    };
    recently_renovated: {
      found_true: number;
      found_false: number;
      not_found: number;
    };
  };
  sample_listings: TestResult[];
  errors: string[];
}

async function fetchEstateDetail(hash_id: number): Promise<SRealityListing | null> {
  try {
    const url = `https://www.sreality.cz/api/cs/v2/estates/${hash_id}`;
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    };

    const response = await axios.get(url, { headers, timeout: 30000 });
    return response.data;
  } catch (error: any) {
    console.error(`Failed to fetch estate ${hash_id}:`, error.message);
    return null;
  }
}

async function fetchListingsPage(page: number = 1, category: number = 2): Promise<SRealityListing[]> {
  try {
    const url = `https://www.sreality.cz/api/cs/v2/estates?page=${page}&per_page=20&category_main_cb=${category}&tms=${Date.now()}`;
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    };

    const response = await axios.get(url, { headers, timeout: 30000 });
    return response.data._embedded?.estates || [];
  } catch (error: any) {
    console.error(`Failed to fetch listings page ${page}:`, error.message);
    return [];
  }
}

async function testPhase2bExtraction() {
  console.log('\n========================================');
  console.log('Phase 2b Infrastructure Field Testing');
  console.log('========================================\n');

  const report: TestReport = {
    test_timestamp: new Date().toISOString(),
    total_listings_tested: 0,
    successful_transformations: 0,
    failed_transformations: 0,
    field_extraction_stats: {
      water_supply: {
        found: 0,
        not_found: 0,
        example_values: []
      },
      sewage_type: {
        found: 0,
        not_found: 0,
        example_values: []
      },
      gas_supply: {
        found_true: 0,
        found_false: 0,
        not_found: 0
      },
      bathrooms: {
        found: 0,
        not_found: 0,
        default_used: 0,
        example_values: []
      },
      recently_renovated: {
        found_true: 0,
        found_false: 0,
        not_found: 0
      }
    },
    sample_listings: [],
    errors: []
  };

  // Step 1: Fetch listings from different categories for variety
  console.log('📡 Fetching listings from SReality API...');
  const allListings: SRealityListing[] = [];

  // Fetch from multiple pages and categories to get variety
  for (const category of [2, 3]) { // 2=house, 3=land
    console.log(`   Fetching category ${category}...`);
    const listings = await fetchListingsPage(1, category);
    if (listings.length > 0) {
      allListings.push(...listings.slice(0, 5)); // Get first 5 from each category
      console.log(`   ✓ Got ${listings.length} listings from category ${category}`);
    }

    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  if (allListings.length === 0) {
    report.errors.push('No listings fetched from API');
    return report;
  }

  console.log(`\n✓ Fetched ${allListings.length} listings total`);

  // Step 2: Fetch detail data for each listing to get full items array
  console.log('\n📥 Fetching detailed data for listings...');
  const detailedListings: SRealityListing[] = [];

  for (let i = 0; i < Math.min(allListings.length, 10); i++) {
    const listing = allListings[i];
    console.log(`   Fetching detail for listing ${i + 1}/${Math.min(allListings.length, 10)} (hash_id: ${listing.hash_id})`);

    const detail = await fetchEstateDetail(listing.hash_id);
    if (detail) {
      detailedListings.push(detail);
    }

    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 300));
  }

  console.log(`\n✓ Successfully fetched ${detailedListings.length} detailed listings`);

  // Step 3: Transform and test each listing
  console.log('\n🔄 Testing Phase 2b infrastructure field extraction...\n');

  for (const listing of detailedListings) {
    report.total_listings_tested++;

    try {
      const transformed = transformSRealityToStandard(listing);
      report.successful_transformations++;

      // Extract Phase 2b fields
      const testResult: TestResult = {
        hash_id: listing.hash_id,
        address: transformed.location.address || 'Unknown',
        property_type: transformed.property_type,
        raw_items: listing.items || [],
        extracted_fields: {
          water_supply: transformed.country_specific?.water_supply,
          sewage_type: transformed.country_specific?.sewage_type,
          gas_supply: transformed.country_specific?.gas_supply,
          bathrooms: transformed.details?.bathrooms,
          recently_renovated: transformed.country_specific?.recently_renovated
        },
        parsing_errors: []
      };

      // Update statistics
      if (testResult.extracted_fields.water_supply) {
        report.field_extraction_stats.water_supply.found++;
        if (!report.field_extraction_stats.water_supply.example_values.includes(testResult.extracted_fields.water_supply)) {
          report.field_extraction_stats.water_supply.example_values.push(testResult.extracted_fields.water_supply);
        }
      } else {
        report.field_extraction_stats.water_supply.not_found++;
      }

      if (testResult.extracted_fields.sewage_type) {
        report.field_extraction_stats.sewage_type.found++;
        if (!report.field_extraction_stats.sewage_type.example_values.includes(testResult.extracted_fields.sewage_type)) {
          report.field_extraction_stats.sewage_type.example_values.push(testResult.extracted_fields.sewage_type);
        }
      } else {
        report.field_extraction_stats.sewage_type.not_found++;
      }

      if (testResult.extracted_fields.gas_supply === true) {
        report.field_extraction_stats.gas_supply.found_true++;
      } else if (testResult.extracted_fields.gas_supply === false) {
        report.field_extraction_stats.gas_supply.found_false++;
      } else {
        report.field_extraction_stats.gas_supply.not_found++;
      }

      if (testResult.extracted_fields.bathrooms !== undefined) {
        report.field_extraction_stats.bathrooms.found++;
        if (!report.field_extraction_stats.bathrooms.example_values.includes(testResult.extracted_fields.bathrooms)) {
          report.field_extraction_stats.bathrooms.example_values.push(testResult.extracted_fields.bathrooms);
        }

        // Check if default was used
        if (testResult.extracted_fields.bathrooms === 1 && !listing.items?.some(i => i.name.toLowerCase().includes('koupel'))) {
          report.field_extraction_stats.bathrooms.default_used++;
        }
      } else {
        report.field_extraction_stats.bathrooms.not_found++;
      }

      if (testResult.extracted_fields.recently_renovated === true) {
        report.field_extraction_stats.recently_renovated.found_true++;
      } else if (testResult.extracted_fields.recently_renovated === false) {
        report.field_extraction_stats.recently_renovated.found_false++;
      } else {
        report.field_extraction_stats.recently_renovated.not_found++;
      }

      // Store sample results (limit to 10)
      if (report.sample_listings.length < 10) {
        report.sample_listings.push(testResult);
      }

      console.log(`✓ Listing ${listing.hash_id} (${transformed.property_type}): ${transformed.location.address}`);
      console.log(`  - Water: ${testResult.extracted_fields.water_supply || 'not found'}`);
      console.log(`  - Sewage: ${testResult.extracted_fields.sewage_type || 'not found'}`);
      console.log(`  - Gas: ${testResult.extracted_fields.gas_supply !== undefined ? testResult.extracted_fields.gas_supply : 'not found'}`);
      console.log(`  - Bathrooms: ${testResult.extracted_fields.bathrooms}`);
      console.log(`  - Renovated: ${testResult.extracted_fields.recently_renovated !== undefined ? testResult.extracted_fields.recently_renovated : 'not found'}`);
      console.log('');

    } catch (error: any) {
      report.failed_transformations++;
      report.errors.push(`Failed to transform listing ${listing.hash_id}: ${error.message}`);
      console.log(`✗ Failed to transform listing ${listing.hash_id}: ${error.message}`);
    }
  }

  return report;
}

// Run tests
(async () => {
  try {
    const report = await testPhase2bExtraction();

    // Calculate success rates
    const totalTested = report.total_listings_tested;
    const successRate = totalTested > 0 ? ((report.successful_transformations / totalTested) * 100).toFixed(2) : '0';

    const waterSuccessRate = report.field_extraction_stats.water_supply.found + report.field_extraction_stats.water_supply.not_found > 0
      ? ((report.field_extraction_stats.water_supply.found / (report.field_extraction_stats.water_supply.found + report.field_extraction_stats.water_supply.not_found)) * 100).toFixed(2)
      : '0';

    const sewageSuccessRate = report.field_extraction_stats.sewage_type.found + report.field_extraction_stats.sewage_type.not_found > 0
      ? ((report.field_extraction_stats.sewage_type.found / (report.field_extraction_stats.sewage_type.found + report.field_extraction_stats.sewage_type.not_found)) * 100).toFixed(2)
      : '0';

    const gasFoundCount = report.field_extraction_stats.gas_supply.found_true + report.field_extraction_stats.gas_supply.found_false;
    const gasSuccessRate = gasFoundCount + report.field_extraction_stats.gas_supply.not_found > 0
      ? ((gasFoundCount / (gasFoundCount + report.field_extraction_stats.gas_supply.not_found)) * 100).toFixed(2)
      : '0';

    const bathroomsSuccessRate = report.field_extraction_stats.bathrooms.found + report.field_extraction_stats.bathrooms.not_found > 0
      ? ((report.field_extraction_stats.bathrooms.found / (report.field_extraction_stats.bathrooms.found + report.field_extraction_stats.bathrooms.not_found)) * 100).toFixed(2)
      : '0';

    const renovatedFoundCount = report.field_extraction_stats.recently_renovated.found_true + report.field_extraction_stats.recently_renovated.found_false;
    const renovatedSuccessRate = renovatedFoundCount + report.field_extraction_stats.recently_renovated.not_found > 0
      ? ((renovatedFoundCount / (renovatedFoundCount + report.field_extraction_stats.recently_renovated.not_found)) * 100).toFixed(2)
      : '0';

    // Print summary
    console.log('\n========================================');
    console.log('TEST REPORT SUMMARY');
    console.log('========================================\n');

    console.log(`Test Timestamp: ${report.test_timestamp}`);
    console.log(`\nOverall Results:`);
    console.log(`  Total Listings Tested: ${report.total_listings_tested}`);
    console.log(`  Successful Transformations: ${report.successful_transformations}`);
    console.log(`  Failed Transformations: ${report.failed_transformations}`);
    console.log(`  Success Rate: ${successRate}%`);

    console.log(`\nPhase 2b Infrastructure Field Extraction Rates:`);
    console.log(`  Water Supply: ${waterSuccessRate}% (${report.field_extraction_stats.water_supply.found}/${report.field_extraction_stats.water_supply.found + report.field_extraction_stats.water_supply.not_found})`);
    console.log(`    Example values: ${report.field_extraction_stats.water_supply.example_values.join(', ') || 'none'}`);
    console.log(`  Sewage Type: ${sewageSuccessRate}% (${report.field_extraction_stats.sewage_type.found}/${report.field_extraction_stats.sewage_type.found + report.field_extraction_stats.sewage_type.not_found})`);
    console.log(`    Example values: ${report.field_extraction_stats.sewage_type.example_values.join(', ') || 'none'}`);
    console.log(`  Gas Supply: ${gasSuccessRate}% (${gasFoundCount}/${gasFoundCount + report.field_extraction_stats.gas_supply.not_found})`);
    console.log(`    Found True: ${report.field_extraction_stats.gas_supply.found_true}, Found False: ${report.field_extraction_stats.gas_supply.found_false}`);
    console.log(`  Bathrooms: ${bathroomsSuccessRate}% (${report.field_extraction_stats.bathrooms.found}/${report.field_extraction_stats.bathrooms.found + report.field_extraction_stats.bathrooms.not_found})`);
    console.log(`    Default Used: ${report.field_extraction_stats.bathrooms.default_used}, Example values: ${report.field_extraction_stats.bathrooms.example_values.join(', ') || 'none'}`);
    console.log(`  Recently Renovated: ${renovatedSuccessRate}% (${renovatedFoundCount}/${renovatedFoundCount + report.field_extraction_stats.recently_renovated.not_found})`);
    console.log(`    Found True: ${report.field_extraction_stats.recently_renovated.found_true}, Found False: ${report.field_extraction_stats.recently_renovated.found_false}`);

    if (report.errors.length > 0) {
      console.log(`\nErrors (${report.errors.length}):`);
      report.errors.forEach(err => console.log(`  - ${err}`));
    }

    // Save detailed report to file
    const reportPath = '/Users/samuelseidel/Development/landomo-world/scrapers/Czech Republic/sreality/phase2b_test_report.json';
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n✅ Detailed report saved to: ${reportPath}`);

  } catch (error: any) {
    console.error('Test failed:', error);
    process.exit(1);
  }
})();
