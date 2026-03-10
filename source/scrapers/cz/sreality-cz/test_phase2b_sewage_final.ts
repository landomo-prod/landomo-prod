import axios from 'axios';
import { transformSRealityToStandard } from './src/transformers/srealityTransformer';
import { SRealityListing } from './src/types/srealityTypes';
import * as fs from 'fs';

/**
 * Phase 2b Sewage Fix Final Verification Test
 * Tests the same 10 listings used in previous Phase 2b test
 * Verifies that sewage_type extraction now works with "Odpad" field name fix
 */

interface ExtractedSewageData {
  hash_id: number;
  address: string;
  property_type: string;
  sewage_found: boolean;
  sewage_value: string | null;
  sewage_raw_field_name: string | null;
  water_supply: string | undefined;
  gas_supply: boolean | undefined;
  bathrooms: number | undefined;
  recently_renovated: boolean | undefined;
}

interface FinalReport {
  test_timestamp: string;
  test_date: string;
  test_type: 'SEWAGE_FIX_VERIFICATION';
  comparison: {
    previous_test: {
      date: string;
      sewage_success_rate: string;
      sewage_found: number;
      sewage_total: number;
      note: string;
    };
    current_test: {
      date: string;
      sewage_success_rate: string;
      sewage_found: number;
      sewage_total: number;
    };
    improvement: {
      absolute: number;
      percentage_points: number;
      improved: boolean;
    };
  };
  phase2b_metrics: {
    water_supply: {
      found: number;
      total: number;
      success_rate: string;
      example_values: string[];
    };
    sewage_type: {
      found: number;
      total: number;
      success_rate: string;
      example_values: string[];
    };
    gas_supply: {
      found: number;
      total: number;
      success_rate: string;
    };
    bathrooms: {
      found: number;
      total: number;
      success_rate: string;
      example_values: number[];
    };
    recently_renovated: {
      found: number;
      total: number;
      success_rate: string;
    };
  };
  detailed_results: ExtractedSewageData[];
  fix_validation: {
    odpad_field_detected_in: number;
    test_listings: {
      hash_id: number;
      address: string;
      has_odpad: boolean;
    }[];
  };
}

async function fetchEstateDetail(hash_id: number, retries: number = 3): Promise<SRealityListing | null> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const url = `https://www.sreality.cz/api/cs/v2/estates/${hash_id}`;
      const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      };

      const response = await axios.get(url, { headers, timeout: 30000 });
      return response.data;
    } catch (error: any) {
      if (attempt < retries) {
        console.log(`    Retry ${attempt}/${retries}...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
      } else {
        console.error(`    Failed after ${retries} attempts: ${error.message}`);
        return null;
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

async function runFinalTest() {
  console.log('\n========================================');
  console.log('Phase 2b Sewage Field Fix - Final Test');
  console.log('========================================\n');

  const report: FinalReport = {
    test_timestamp: new Date().toISOString(),
    test_date: new Date().toLocaleDateString(),
    test_type: 'SEWAGE_FIX_VERIFICATION',
    comparison: {
      previous_test: {
        date: '2026-02-07',
        sewage_success_rate: '0%',
        sewage_found: 0,
        sewage_total: 10,
        note: 'No sewage extraction ("Odpad" field not recognized)'
      },
      current_test: {
        date: new Date().toLocaleDateString(),
        sewage_success_rate: '0%',
        sewage_found: 0,
        sewage_total: 10
      },
      improvement: {
        absolute: 0,
        percentage_points: 0,
        improved: false
      }
    },
    phase2b_metrics: {
      water_supply: { found: 0, total: 10, success_rate: '0%', example_values: [] },
      sewage_type: { found: 0, total: 10, success_rate: '0%', example_values: [] },
      gas_supply: { found: 0, total: 10, success_rate: '0%' },
      bathrooms: { found: 0, total: 10, success_rate: '0%', example_values: [] },
      recently_renovated: { found: 0, total: 10, success_rate: '0%' }
    },
    detailed_results: [],
    fix_validation: {
      odpad_field_detected_in: 0,
      test_listings: []
    }
  };

  const hashIds = [
    3014853452, 1867608908, 390759244, 526713676, 5665612,
    4230087500, 1519919948, 2887349068, 2679886668, 2952667980
  ];

  console.log(`Testing ${hashIds.length} listings...\n`);

  let successCount = 0;

  for (let i = 0; i < hashIds.length; i++) {
    const hash_id = hashIds[i];
    console.log(`[${i + 1}/${hashIds.length}] Hash ${hash_id}...`);

    const listing = await fetchEstateDetail(hash_id);
    if (!listing) {
      console.log(`    ✗ Failed to fetch\n`);
      continue;
    }

    try {
      const transformed = transformSRealityToStandard(listing);
      successCount++;

      const hasSewage = hasSewageField(listing.items);
      const result: ExtractedSewageData = {
        hash_id,
        address: transformed.location.address || 'Unknown',
        property_type: transformed.property_type,
        sewage_found: !!transformed.country_specific?.sewage_type,
        sewage_value: transformed.country_specific?.sewage_type || null,
        sewage_raw_field_name: hasSewage ? 'Odpad' : null,
        water_supply: transformed.country_specific?.water_supply,
        gas_supply: transformed.country_specific?.gas_supply,
        bathrooms: transformed.details?.bathrooms,
        recently_renovated: transformed.country_specific?.recently_renovated
      };

      report.detailed_results.push(result);

      // Track fix validation
      if (hasSewage) {
        report.fix_validation.test_listings.push({
          hash_id,
          address: result.address,
          has_odpad: true
        });
      }

      // Update metrics
      if (result.sewage_found) {
        report.phase2b_metrics.sewage_type.found++;
        if (!report.phase2b_metrics.sewage_type.example_values.includes(result.sewage_value!)) {
          report.phase2b_metrics.sewage_type.example_values.push(result.sewage_value!);
        }
      }

      if (result.water_supply) {
        report.phase2b_metrics.water_supply.found++;
        if (!report.phase2b_metrics.water_supply.example_values.includes(result.water_supply)) {
          report.phase2b_metrics.water_supply.example_values.push(result.water_supply);
        }
      }

      if (result.gas_supply !== undefined) {
        report.phase2b_metrics.gas_supply.found++;
      }

      if (result.bathrooms !== undefined) {
        report.phase2b_metrics.bathrooms.found++;
        if (!report.phase2b_metrics.bathrooms.example_values.includes(result.bathrooms)) {
          report.phase2b_metrics.bathrooms.example_values.push(result.bathrooms);
        }
      }

      if (result.recently_renovated !== undefined) {
        report.phase2b_metrics.recently_renovated.found++;
      }

      console.log(`    ✓ ${result.property_type.toUpperCase()}`);
      console.log(`      Sewage: ${result.sewage_value ? result.sewage_value : '(not found)'}${hasSewage && !result.sewage_found ? ' [ERROR: Field exists but not extracted]' : ''}`);
      console.log(`      Water: ${result.water_supply || 'N/A'}`);
      console.log();

    } catch (error: any) {
      console.log(`    ✗ Error: ${error.message}\n`);
    }

    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // Calculate final metrics
  report.phase2b_metrics.water_supply.success_rate = `${Math.round((report.phase2b_metrics.water_supply.found / 10) * 100)}%`;
  report.phase2b_metrics.sewage_type.success_rate = `${Math.round((report.phase2b_metrics.sewage_type.found / 10) * 100)}%`;
  report.phase2b_metrics.gas_supply.success_rate = `${Math.round((report.phase2b_metrics.gas_supply.found / 10) * 100)}%`;
  report.phase2b_metrics.bathrooms.success_rate = `${Math.round((report.phase2b_metrics.bathrooms.found / 10) * 100)}%`;
  report.phase2b_metrics.recently_renovated.success_rate = `${Math.round((report.phase2b_metrics.recently_renovated.found / 10) * 100)}%`;

  // Update comparison
  report.comparison.current_test.sewage_found = report.phase2b_metrics.sewage_type.found;
  report.comparison.current_test.sewage_success_rate = report.phase2b_metrics.sewage_type.success_rate;
  report.comparison.improvement.absolute = report.phase2b_metrics.sewage_type.found - 0;
  report.comparison.improvement.percentage_points = (report.phase2b_metrics.sewage_type.found * 10) - 0;
  report.comparison.improvement.improved = report.phase2b_metrics.sewage_type.found > 0;
  report.fix_validation.odpad_field_detected_in = report.fix_validation.test_listings.length;

  // Save report
  const reportPath = '/Users/samuelseidel/Development/landomo-world/scrapers/Czech Republic/sreality/phase2b_sewage_fix_final_report.json';
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  // Print summary
  console.log('\n========================================');
  console.log('FINAL TEST RESULTS');
  console.log('========================================\n');

  console.log('SEWAGE TYPE EXTRACTION IMPROVEMENT:');
  console.log(`  Previous (Feb 7):  0% (0/10) ✗`);
  console.log(`  Current (${report.test_date}):   ${report.phase2b_metrics.sewage_type.success_rate} (${report.phase2b_metrics.sewage_type.found}/10) ${report.comparison.improvement.improved ? '✓' : '✗'}`);
  console.log(`  Improvement:       +${report.comparison.improvement.percentage_points}pp\n`);

  console.log('SEWAGE FIELD VALIDATION:');
  console.log(`  "Odpad" field found in: ${report.fix_validation.odpad_field_detected_in}/${hashIds.length} listings`);
  if (report.fix_validation.test_listings.length > 0) {
    console.log(`  Listings with "Odpad":`);
    report.fix_validation.test_listings.slice(0, 3).forEach(l => {
      console.log(`    - ${l.address}`);
    });
  }
  console.log();

  console.log('ALL PHASE 2B METRICS:');
  console.log(`  Water Supply:        ${report.phase2b_metrics.water_supply.success_rate} (${report.phase2b_metrics.water_supply.found}/10)`);
  console.log(`  Sewage Type:         ${report.phase2b_metrics.sewage_type.success_rate} (${report.phase2b_metrics.sewage_type.found}/10) [CRITICAL FIX]`);
  console.log(`  Gas Supply:          ${report.phase2b_metrics.gas_supply.success_rate} (${report.phase2b_metrics.gas_supply.found}/10)`);
  console.log(`  Bathrooms:           ${report.phase2b_metrics.bathrooms.success_rate} (${report.phase2b_metrics.bathrooms.found}/10)`);
  console.log(`  Recently Renovated:  ${report.phase2b_metrics.recently_renovated.success_rate} (${report.phase2b_metrics.recently_renovated.found}/10)\n`);

  if (report.phase2b_metrics.sewage_type.example_values.length > 0) {
    console.log('EXTRACTED SEWAGE VALUES:');
    report.phase2b_metrics.sewage_type.example_values.forEach(v => {
      console.log(`  - "${v}"`);
    });
    console.log();
  }

  console.log(`Report: ${reportPath}`);
  console.log('\n========================================\n');

  return report;
}

runFinalTest().catch(console.error);
