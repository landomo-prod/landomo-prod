import axios from 'axios';
import * as fs from 'fs';

// Use the COMPILED version to ensure we have the fix
const { transformSRealityToStandard } = require('./dist/sreality/src/transformers/srealityTransformer');

interface TestData {
  hash_id: number;
  address: string;
  property_type: string;
  sewage_extracted: boolean;
  sewage_value: string | null;
  water_supply: string | undefined;
  gas_supply: boolean | undefined;
  bathrooms: number | undefined;
  recently_renovated: boolean | undefined;
}

interface ComparisonReport {
  test_timestamp: string;
  test_type: string;
  fix_applied: boolean;
  fix_description: string;
  before_after_comparison: {
    sewage_type: {
      before: { success_rate: string; count: string };
      after: { success_rate: string; count: string };
      improvement: string;
    };
  };
  all_phase2b_metrics: {
    water_supply: { success_rate: string; found: number; total: number; examples: string[] };
    sewage_type: { success_rate: string; found: number; total: number; examples: string[] };
    gas_supply: { success_rate: string; found: number; total: number };
    bathrooms: { success_rate: string; found: number; total: number; examples: number[] };
    recently_renovated: { success_rate: string; found: number; total: number };
  };
  detailed_test_results: TestData[];
  critical_fix_status: {
    odpad_field_found_in_how_many_listings: number;
    extraction_success_for_listings_with_odpad: number;
    extraction_success_rate_for_odpad_listings: string;
  };
  conclusion: string;
}

async function fetchEstateDetail(hash_id: number, retries: number = 2): Promise<any | null> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await axios.get(`https://www.sreality.cz/api/cs/v2/estates/${hash_id}`, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
        timeout: 30000
      });
      return response.data;
    } catch (error: any) {
      if (attempt < retries) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }
  return null;
}

function hasSewageField(items?: Array<any>): boolean {
  if (!items) return false;
  return items.some(i => {
    const name = String(i.name || '').toLowerCase();
    return name.includes('odpad');
  });
}

async function runTest() {
  console.log('\n========================================');
  console.log('Phase 2b Sewage Field Fix Test');
  console.log('Using COMPILED transformer with Odpad fix');
  console.log('========================================\n');

  const report: ComparisonReport = {
    test_timestamp: new Date().toISOString(),
    test_type: 'SEWAGE_FIX_VERIFICATION',
    fix_applied: true,
    fix_description: 'Transformer updated to detect "Odpad" field (API standard name for sewage/waste disposal)',
    before_after_comparison: {
      sewage_type: {
        before: { success_rate: '0%', count: '0/10' },
        after: { success_rate: '0%', count: '0/10' },
        improvement: 'TBD'
      }
    },
    all_phase2b_metrics: {
      water_supply: { success_rate: '0%', found: 0, total: 10, examples: [] },
      sewage_type: { success_rate: '0%', found: 0, total: 10, examples: [] },
      gas_supply: { success_rate: '0%', found: 0, total: 10 },
      bathrooms: { success_rate: '0%', found: 0, total: 10, examples: [] },
      recently_renovated: { success_rate: '0%', found: 0, total: 10 }
    },
    detailed_test_results: [],
    critical_fix_status: {
      odpad_field_found_in_how_many_listings: 0,
      extraction_success_for_listings_with_odpad: 0,
      extraction_success_rate_for_odpad_listings: '0%'
    },
    conclusion: 'Test in progress...'
  };

  const hashIds = [
    3014853452, 1867608908, 390759244, 526713676, 5665612,
    4230087500, 1519919948, 2887349068, 2679886668, 2952667980
  ];

  console.log(`Testing ${hashIds.length} same listings from previous Phase 2b test...\n`);

  for (let i = 0; i < hashIds.length; i++) {
    const hash_id = hashIds[i];
    process.stdout.write(`[${i + 1}/${hashIds.length}] ${hash_id}... `);

    const listing = await fetchEstateDetail(hash_id);
    if (!listing) {
      console.log('(FAILED TO FETCH)');
      continue;
    }

    try {
      const transformed = transformSRealityToStandard(listing);
      const hasSewage = hasSewageField(listing.items);

      const testData: TestData = {
        hash_id,
        address: transformed.location.address || 'Unknown',
        property_type: transformed.property_type,
        sewage_extracted: !!transformed.country_specific?.sewage_type,
        sewage_value: transformed.country_specific?.sewage_type || null,
        water_supply: transformed.country_specific?.water_supply,
        gas_supply: transformed.country_specific?.gas_supply,
        bathrooms: transformed.details?.bathrooms,
        recently_renovated: transformed.country_specific?.recently_renovated
      };

      report.detailed_test_results.push(testData);

      // Update metrics
      if (testData.sewage_extracted) {
        report.all_phase2b_metrics.sewage_type.found++;
        if (!report.all_phase2b_metrics.sewage_type.examples.includes(testData.sewage_value!)) {
          report.all_phase2b_metrics.sewage_type.examples.push(testData.sewage_value!);
        }
      }

      if (testData.water_supply) {
        report.all_phase2b_metrics.water_supply.found++;
        if (!report.all_phase2b_metrics.water_supply.examples.includes(testData.water_supply)) {
          report.all_phase2b_metrics.water_supply.examples.push(testData.water_supply);
        }
      }

      if (testData.gas_supply !== undefined) {
        report.all_phase2b_metrics.gas_supply.found++;
      }

      if (testData.bathrooms !== undefined) {
        report.all_phase2b_metrics.bathrooms.found++;
        if (!report.all_phase2b_metrics.bathrooms.examples.includes(testData.bathrooms)) {
          report.all_phase2b_metrics.bathrooms.examples.push(testData.bathrooms);
        }
      }

      if (testData.recently_renovated !== undefined) {
        report.all_phase2b_metrics.recently_renovated.found++;
      }

      // Track Odpad field presence
      if (hasSewage) {
        report.critical_fix_status.odpad_field_found_in_how_many_listings++;
        if (testData.sewage_extracted) {
          report.critical_fix_status.extraction_success_for_listings_with_odpad++;
        }
      }

      console.log(`✓ (sewage: ${testData.sewage_value ? testData.sewage_value : 'N/A'})`);
    } catch (error: any) {
      console.log(`✗ ERROR: ${error.message}`);
    }

    await new Promise(resolve => setTimeout(resolve, 400));
  }

  // Calculate percentages
  report.all_phase2b_metrics.water_supply.success_rate = `${Math.round((report.all_phase2b_metrics.water_supply.found / 10) * 100)}%`;
  report.all_phase2b_metrics.sewage_type.success_rate = `${Math.round((report.all_phase2b_metrics.sewage_type.found / 10) * 100)}%`;
  report.all_phase2b_metrics.gas_supply.success_rate = `${Math.round((report.all_phase2b_metrics.gas_supply.found / 10) * 100)}%`;
  report.all_phase2b_metrics.bathrooms.success_rate = `${Math.round((report.all_phase2b_metrics.bathrooms.found / 10) * 100)}%`;
  report.all_phase2b_metrics.recently_renovated.success_rate = `${Math.round((report.all_phase2b_metrics.recently_renovated.found / 10) * 100)}%`;

  report.before_after_comparison.sewage_type.after.success_rate = report.all_phase2b_metrics.sewage_type.success_rate;
  report.before_after_comparison.sewage_type.after.count = `${report.all_phase2b_metrics.sewage_type.found}/10`;
  report.before_after_comparison.sewage_type.improvement = `${report.all_phase2b_metrics.sewage_type.found * 10}pp increase (from 0% to ${report.all_phase2b_metrics.sewage_type.success_rate})`;

  if (report.critical_fix_status.odpad_field_found_in_how_many_listings > 0) {
    report.critical_fix_status.extraction_success_rate_for_odpad_listings = `${Math.round((report.critical_fix_status.extraction_success_for_listings_with_odpad / report.critical_fix_status.odpad_field_found_in_how_many_listings) * 100)}%`;
  }

  // Determine conclusion
  if (report.all_phase2b_metrics.sewage_type.found > 0) {
    report.conclusion = `SUCCESS: Sewage extraction improved from 0% to ${report.all_phase2b_metrics.sewage_type.success_rate}. The "Odpad" field fix is WORKING. ${report.all_phase2b_metrics.sewage_type.found} listings now have sewage type extracted.`;
  } else if (report.critical_fix_status.odpad_field_found_in_how_many_listings > 0) {
    report.conclusion = `PARTIAL: "Odpad" field exists in ${report.critical_fix_status.odpad_field_found_in_how_many_listings} listings but extraction still failing. Code may not be using the fixed version.`;
  } else {
    report.conclusion = `NO IMPROVEMENT: No "Odpad" fields found in test listings, or fix is not working.`;
  }

  // Save report
  const reportPath = '/Users/samuelseidel/Development/landomo-world/scrapers/Czech Republic/sreality/PHASE2B_SEWAGE_FIX_FINAL_RESULTS.json';
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  // Print summary
  console.log('\n========================================');
  console.log('FINAL RESULTS - SEWAGE FIX VERIFICATION');
  console.log('========================================\n');

  console.log('SEWAGE TYPE EXTRACTION:');
  console.log(`  Previous (Feb 7):  ${report.before_after_comparison.sewage_type.before.success_rate} (${report.before_after_comparison.sewage_type.before.count})`);
  console.log(`  Current (Today):   ${report.before_after_comparison.sewage_type.after.success_rate} (${report.before_after_comparison.sewage_type.after.count})`);
  console.log(`  Improvement:       ${report.before_after_comparison.sewage_type.improvement}\n`);

  console.log('ODPAD FIELD ANALYSIS:');
  console.log(`  Found "Odpad" in:     ${report.critical_fix_status.odpad_field_found_in_how_many_listings}/10 listings`);
  console.log(`  Successfully extracted: ${report.critical_fix_status.extraction_success_for_listings_with_odpad}/${report.critical_fix_status.odpad_field_found_in_how_many_listings} (${report.critical_fix_status.extraction_success_rate_for_odpad_listings})\n`);

  console.log('ALL PHASE 2B METRICS:');
  console.log(`  Water Supply:       ${report.all_phase2b_metrics.water_supply.success_rate} (${report.all_phase2b_metrics.water_supply.found}/10)`);
  console.log(`  Sewage Type:        ${report.all_phase2b_metrics.sewage_type.success_rate} (${report.all_phase2b_metrics.sewage_type.found}/10) **CRITICAL FIX**`);
  console.log(`  Gas Supply:         ${report.all_phase2b_metrics.gas_supply.success_rate} (${report.all_phase2b_metrics.gas_supply.found}/10)`);
  console.log(`  Bathrooms:          ${report.all_phase2b_metrics.bathrooms.success_rate} (${report.all_phase2b_metrics.bathrooms.found}/10)`);
  console.log(`  Recently Renovated: ${report.all_phase2b_metrics.recently_renovated.success_rate} (${report.all_phase2b_metrics.recently_renovated.found}/10)\n`);

  if (report.all_phase2b_metrics.sewage_type.examples.length > 0) {
    console.log('EXTRACTED SEWAGE VALUES:');
    report.all_phase2b_metrics.sewage_type.examples.forEach(v => console.log(`  - "${v}"`));
    console.log();
  }

  console.log('CONCLUSION:');
  console.log(`  ${report.conclusion}\n`);

  console.log(`Full report: ${reportPath}\n`);
  console.log('========================================\n');
}

runTest().catch(console.error);
