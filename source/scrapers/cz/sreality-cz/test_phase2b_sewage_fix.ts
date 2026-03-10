import axios from 'axios';
import { transformSRealityToStandard } from './src/transformers/srealityTransformer';
import { SRealityListing } from './src/types/srealityTypes';
import * as fs from 'fs';

/**
 * Phase 2b Sewage Fix Verification Test
 * Tests the same 10 listings used in previous Phase 2b test
 * Verifies that sewage_type extraction now works with "Odpad" field name fix
 */

interface TestResult {
  hash_id: number;
  address: string;
  property_type: string;
  extracted_fields: {
    water_supply?: string;
    sewage_type?: string;
    gas_supply?: boolean;
    bathrooms?: number;
    recently_renovated?: boolean;
  };
  raw_sewage_item?: {
    name: string;
    value: any;
  };
}

interface ComparisonReport {
  test_timestamp: string;
  test_type: 'SEWAGE_FIX_VERIFICATION';
  phase2b_improvements: {
    sewage_type_previous: {
      success_rate: string;
      found: number;
      total: number;
      example_values: any[];
    };
    sewage_type_current: {
      success_rate: string;
      found: number;
      total: number;
      example_values: string[];
    };
    improvement: {
      absolute_improvement: number;
      percentage_point_change: string;
      status: 'IMPROVED' | 'UNCHANGED' | 'REGRESSED';
    };
  };
  all_fields_metrics: {
    water_supply: {
      success_rate: string;
      found: number;
      total: number;
      example_values: string[];
    };
    gas_supply: {
      success_rate: string;
      found_true: number;
      found_false: number;
      total: number;
    };
    bathrooms: {
      success_rate: string;
      found: number;
      total: number;
      example_values: number[];
    };
    recently_renovated: {
      success_rate: string;
      found_true: number;
      found_false: number;
      total: number;
    };
  };
  test_results: TestResult[];
  test_hash_ids: number[];
  analysis: {
    critical_fix_working: boolean;
    sewage_extraction_details: Array<{
      hash_id: number;
      found: boolean;
      field_name_detected: string | null;
      raw_value: string | null;
    }>;
  };
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

function findSewageItemInRawData(items?: Array<any>): { name: string; value: any } | null {
  if (!items) return null;

  for (const item of items) {
    const name = String(item.name || '').toLowerCase();
    if (name.includes('kanalizace') ||
        name.includes('odkanalizace') ||
        name.includes('odpad') ||
        name.includes('jímka') ||
        name.includes('sewage') ||
        name.includes('wastewater')) {
      return { name: item.name, value: item.value };
    }
  }
  return null;
}

async function testSewageFix() {
  console.log('\n========================================');
  console.log('Phase 2b Sewage Field Fix Verification');
  console.log('========================================\n');

  const report: ComparisonReport = {
    test_timestamp: new Date().toISOString(),
    test_type: 'SEWAGE_FIX_VERIFICATION',
    phase2b_improvements: {
      sewage_type_previous: {
        success_rate: '0%',
        found: 0,
        total: 10,
        example_values: []
      },
      sewage_type_current: {
        success_rate: '0%',
        found: 0,
        total: 10,
        example_values: []
      },
      improvement: {
        absolute_improvement: 0,
        percentage_point_change: '+0pp',
        status: 'UNCHANGED'
      }
    },
    all_fields_metrics: {
      water_supply: {
        success_rate: '0%',
        found: 0,
        total: 10,
        example_values: []
      },
      gas_supply: {
        success_rate: '0%',
        found_true: 0,
        found_false: 0,
        total: 10
      },
      bathrooms: {
        success_rate: '0%',
        found: 0,
        total: 10,
        example_values: []
      },
      recently_renovated: {
        success_rate: '0%',
        found_true: 0,
        found_false: 0,
        total: 10
      }
    },
    test_results: [],
    test_hash_ids: [
      3014853452, 1867608908, 390759244, 526713676, 5665612,
      4230087500, 1519919948, 2887349068, 2679886668, 2952667980
    ],
    analysis: {
      critical_fix_working: false,
      sewage_extraction_details: []
    }
  };

  console.log(`Testing ${report.test_hash_ids.length} listings (same as previous Phase 2b test)...\n`);

  let successCount = 0;

  for (let i = 0; i < report.test_hash_ids.length; i++) {
    const hash_id = report.test_hash_ids[i];
    console.log(`[${i + 1}/${report.test_hash_ids.length}] Fetching listing ${hash_id}...`);

    const listing = await fetchEstateDetail(hash_id);
    if (!listing) {
      console.log(`  ✗ Failed to fetch\n`);
      continue;
    }

    try {
      const transformed = transformSRealityToStandard(listing);
      successCount++;

      // Find sewage item in raw data
      const sewageItem = findSewageItemInRawData(listing.items);

      const testResult: TestResult = {
        hash_id,
        address: transformed.location.address || 'Unknown',
        property_type: transformed.property_type,
        extracted_fields: {
          water_supply: transformed.country_specific?.water_supply,
          sewage_type: transformed.country_specific?.sewage_type,
          gas_supply: transformed.country_specific?.gas_supply,
          bathrooms: transformed.details?.bathrooms,
          recently_renovated: transformed.country_specific?.recently_renovated
        },
        raw_sewage_item: sewageItem || undefined
      };

      report.test_results.push(testResult);

      // Track sewage extraction
      if (testResult.extracted_fields.sewage_type) {
        report.phase2b_improvements.sewage_type_current.found++;
        if (!report.phase2b_improvements.sewage_type_current.example_values.includes(testResult.extracted_fields.sewage_type)) {
          report.phase2b_improvements.sewage_type_current.example_values.push(testResult.extracted_fields.sewage_type);
        }
      }

      // Track sewage detection details
      report.analysis.sewage_extraction_details.push({
        hash_id,
        found: !!testResult.extracted_fields.sewage_type,
        field_name_detected: sewageItem?.name || null,
        raw_value: sewageItem ? String(sewageItem.value) : null
      });

      // Track water supply
      if (testResult.extracted_fields.water_supply) {
        report.all_fields_metrics.water_supply.found++;
        if (!report.all_fields_metrics.water_supply.example_values.includes(testResult.extracted_fields.water_supply)) {
          report.all_fields_metrics.water_supply.example_values.push(testResult.extracted_fields.water_supply);
        }
      }

      // Track gas supply
      if (testResult.extracted_fields.gas_supply === true) {
        report.all_fields_metrics.gas_supply.found_true++;
      } else if (testResult.extracted_fields.gas_supply === false) {
        report.all_fields_metrics.gas_supply.found_false++;
      }

      // Track bathrooms
      if (testResult.extracted_fields.bathrooms !== undefined) {
        report.all_fields_metrics.bathrooms.found++;
        if (!report.all_fields_metrics.bathrooms.example_values.includes(testResult.extracted_fields.bathrooms)) {
          report.all_fields_metrics.bathrooms.example_values.push(testResult.extracted_fields.bathrooms);
        }
      }

      // Track recently renovated
      if (testResult.extracted_fields.recently_renovated === true) {
        report.all_fields_metrics.recently_renovated.found_true++;
      } else if (testResult.extracted_fields.recently_renovated === false) {
        report.all_fields_metrics.recently_renovated.found_false++;
      }

      console.log(`  ✓ ${transformed.property_type.toUpperCase()}: ${testResult.address}`);
      console.log(`    Sewage: ${testResult.extracted_fields.sewage_type ? '✓ ' + testResult.extracted_fields.sewage_type : '✗ not found'}`);
      console.log(`    Water: ${testResult.extracted_fields.water_supply || 'N/A'} | Gas: ${testResult.extracted_fields.gas_supply ? 'YES' : 'NO'} | Renovated: ${testResult.extracted_fields.recently_renovated ? 'YES' : 'NO'}\n`);
    } catch (error: any) {
      console.log(`  ✗ Transformation error: ${error.message}\n`);
    }

    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 300));
  }

  // Calculate final metrics
  report.phase2b_improvements.sewage_type_current.success_rate = `${Math.round((report.phase2b_improvements.sewage_type_current.found / 10) * 100)}%`;
  report.all_fields_metrics.water_supply.success_rate = `${Math.round((report.all_fields_metrics.water_supply.found / 10) * 100)}%`;
  report.all_fields_metrics.gas_supply.success_rate = `${Math.round(((report.all_fields_metrics.gas_supply.found_true + report.all_fields_metrics.gas_supply.found_false) / 10) * 100)}%`;
  report.all_fields_metrics.bathrooms.success_rate = `${Math.round((report.all_fields_metrics.bathrooms.found / 10) * 100)}%`;
  report.all_fields_metrics.recently_renovated.success_rate = `${Math.round(((report.all_fields_metrics.recently_renovated.found_true + report.all_fields_metrics.recently_renovated.found_false) / 10) * 100)}%`;

  // Calculate improvement
  const previousSewageFound = 0; // 0%
  const currentSewageFound = report.phase2b_improvements.sewage_type_current.found;
  const improvementPoints = currentSewageFound - previousSewageFound;
  report.phase2b_improvements.improvement.absolute_improvement = improvementPoints;
  report.phase2b_improvements.improvement.percentage_point_change = `+${improvementPoints * 10}pp`;

  if (currentSewageFound > previousSewageFound) {
    report.phase2b_improvements.improvement.status = 'IMPROVED';
    report.analysis.critical_fix_working = true;
  } else if (currentSewageFound < previousSewageFound) {
    report.phase2b_improvements.improvement.status = 'REGRESSED';
  } else {
    report.phase2b_improvements.improvement.status = 'UNCHANGED';
  }

  // Save report
  const reportPath = '/Users/samuelseidel/Development/landomo-world/scrapers/Czech Republic/sreality/phase2b_sewage_fix_verification.json';
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  // Print summary
  console.log('\n========================================');
  console.log('TEST RESULTS SUMMARY');
  console.log('========================================\n');

  console.log('CRITICAL FIX: Sewage Type ("Odpad" field detection)');
  console.log(`  Previous: 0% (0/10) ✗`);
  console.log(`  Current:  ${report.phase2b_improvements.sewage_type_current.success_rate} (${report.phase2b_improvements.sewage_type_current.found}/10) ${report.analysis.critical_fix_working ? '✓' : '✗'}`);
  console.log(`  Change:   ${report.phase2b_improvements.improvement.percentage_point_change}`);
  console.log(`  Status:   ${report.phase2b_improvements.improvement.status}\n`);

  console.log('SEWAGE DETECTION DETAILS:');
  const sewageDetailsWithValues = report.analysis.sewage_extraction_details.filter(s => s.found);
  if (sewageDetailsWithValues.length > 0) {
    console.log(`  Found in ${sewageDetailsWithValues.length} listings:\n`);
    sewageDetailsWithValues.slice(0, 5).forEach(s => {
      console.log(`    - Hash ${s.hash_id}: "${s.field_name_detected}" = "${s.raw_value}"`);
    });
  } else {
    console.log(`  No sewage values extracted\n`);
  }

  console.log('\nALL PHASE 2B FIELDS SUMMARY:');
  console.log(`  Water Supply:        ${report.all_fields_metrics.water_supply.success_rate} (${report.all_fields_metrics.water_supply.found}/10)`);
  console.log(`  Sewage Type:         ${report.phase2b_improvements.sewage_type_current.success_rate} (${report.phase2b_improvements.sewage_type_current.found}/10) [FIXED]`);
  console.log(`  Gas Supply:          ${report.all_fields_metrics.gas_supply.success_rate} (${report.all_fields_metrics.gas_supply.found_true + report.all_fields_metrics.gas_supply.found_false}/10)`);
  console.log(`  Bathrooms:           ${report.all_fields_metrics.bathrooms.success_rate} (${report.all_fields_metrics.bathrooms.found}/10)`);
  console.log(`  Recently Renovated:  ${report.all_fields_metrics.recently_renovated.success_rate} (${report.all_fields_metrics.recently_renovated.found_true + report.all_fields_metrics.recently_renovated.found_false}/10)\n`);

  console.log(`Report saved to: ${reportPath}`);
  console.log('\n========================================\n');

  return report;
}

testSewageFix().catch(console.error);
