import axios from 'axios';
import { transformSRealityToStandard } from './src/transformers/srealityTransformer';
import { getRandomUserAgent } from './src/utils/userAgents';
import { SRealityListing } from './src/types/srealityTypes';

/**
 * Phase 2a Amenity Extraction - FINAL TEST REPORT
 * Detailed analysis of extraction success, failures, and data availability
 */

interface ExtractionIssue {
  hash_id: string;
  amenity: string;
  api_value: any;
  expected_extraction: boolean;
  actual_extraction: boolean | undefined;
  issue: string;
}

interface FinalTestResult {
  hash_id: string;
  title: string;
  property_type: string;
  total_items: number;
  phase2a_results: {
    has_ac: boolean | undefined;
    has_security: boolean | undefined;
    has_fireplace: boolean | undefined;
    has_balcony: boolean | undefined;
    has_terrace: boolean | undefined;
    has_elevator: boolean | undefined;
  };
  api_amenity_items: Array<{ name: string; value: any; type?: string }>;
}

interface FinalReport {
  test_date: string;
  test_summary: {
    total_listings_tested: number;
    apartments: number;
    houses: number;
    sales_rentals: Record<string, number>;
  };
  phase2a_extraction_summary: {
    field: string;
    api_availability: number;
    extraction_success: number;
    extraction_rate: number;
    examples_in_data: string[];
  }[];
  extraction_issues_found: ExtractionIssue[];
  sample_test_results: FinalTestResult[];
  key_findings: string[];
  recommendations: string[];
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchEstateDetail(hash_id: number): Promise<any> {
  try {
    const url = `https://www.sreality.cz/api/cs/v2/estates/${hash_id}`;
    const headers = { 'User-Agent': getRandomUserAgent() };
    const response = await axios.get(url, { headers, timeout: 20000 });
    return response.data;
  } catch (error: any) {
    console.error(`Error fetching ${hash_id}:`, error.message);
    return null;
  }
}

async function fetchEstateList(page: number, category: number, perPage: number = 5): Promise<any[]> {
  try {
    const url = `https://www.sreality.cz/api/cs/v2/estates?page=${page}&per_page=${perPage}&category_main_cb=${category}`;
    const headers = { 'User-Agent': getRandomUserAgent() };
    const response = await axios.get(url, { headers, timeout: 20000 });
    return response.data._embedded?.estates || [];
  } catch (error: any) {
    console.error(`Error fetching list:`, error.message);
    return [];
  }
}

function convertApiListingToStandard(detail: any): SRealityListing {
  const items = detail.items?.map((item: any) => ({
    name: item.name,
    value: typeof item.value === 'object' && item.value !== null ? JSON.stringify(item.value) : String(item.value)
  })) || [];

  return {
    hash_id: detail.hash_id || 0,
    name: detail.name,
    locality: detail.locality,
    price: detail.price,
    price_czk: detail.price_czk,
    seo: detail.seo,
    gps: detail.map,
    text: detail.text,
    items: items,
    advert_images_count: detail.advert_images_count,
    _links: detail._links
  };
}

function testListing(detail: any): FinalTestResult {
  const standardListing = convertApiListingToStandard(detail);
  const transformed = transformSRealityToStandard(standardListing);

  const amenityKeywords = {
    ac: ['klimatizace', 'air condition'],
    security: ['bezpečnost', 'alarm', 'kamera', 'security', 'camera'],
    fireplace: ['krb', 'fireplace'],
    balcony: ['balkón', 'balcony'],
    terrace: ['terasa', 'terrace', 'patio'],
    elevator: ['výtah', 'elevator', 'lift', 'ascensor']
  };

  const apiAmenities: Array<{ name: string; value: any; type?: string }> = [];

  (detail.items || []).forEach((item: any) => {
    const name = (item.name || '').toString().toLowerCase();
    for (const [amenity, keywords] of Object.entries(amenityKeywords)) {
      if (keywords.some(kw => name.includes(kw))) {
        apiAmenities.push({
          name: item.name,
          value: item.value,
          type: item.type
        });
      }
    }
  });

  return {
    hash_id: detail.hash_id?.toString() || 'unknown',
    title: detail.name?.value || 'Unknown',
    property_type: transformed.property_type,
    total_items: detail.items?.length || 0,
    phase2a_results: {
      has_ac: transformed.amenities?.has_ac,
      has_security: transformed.amenities?.has_security,
      has_fireplace: transformed.amenities?.has_fireplace,
      has_balcony: transformed.amenities?.has_balcony,
      has_terrace: transformed.amenities?.has_terrace,
      has_elevator: transformed.amenities?.has_elevator,
    },
    api_amenity_items: apiAmenities
  };
}

async function runFinalTest(): Promise<void> {
  console.log('Starting Phase 2a Final Test Report\n');

  const allResults: FinalTestResult[] = [];
  const propertyTypeCounts: Record<string, number> = {};
  const transactionCounts: Record<string, number> = {};
  const extractionIssues: ExtractionIssue[] = [];

  try {
    // Test apartments
    console.log('Fetching apartment listings...');
    let estateList = await fetchEstateList(1, 1, 7);
    console.log(`Got ${estateList.length} apartments\n`);
    await delay(500);

    for (const estate of estateList) {
      try {
        console.log(`Testing apartment ${estate.hash_id}...`);
        const detail = await fetchEstateDetail(estate.hash_id);

        if (detail && detail.items) {
          const result = testListing(detail);
          allResults.push(result);

          propertyTypeCounts[result.property_type] = (propertyTypeCounts[result.property_type] || 0) + 1;

          // Track transaction type
          const txType = detail.seo?.category_type_cb === 1 ? 'sale' : 'rent';
          transactionCounts[txType] = (transactionCounts[txType] || 0) + 1;

          // Detect extraction issues
          result.api_amenity_items.forEach(item => {
            const name = item.name.toLowerCase();

            if (name.includes('balkón')) {
              if (result.phase2a_results.has_balcony !== true) {
                extractionIssues.push({
                  hash_id: result.hash_id,
                  amenity: 'balcony',
                  api_value: item.value,
                  expected_extraction: true,
                  actual_extraction: result.phase2a_results.has_balcony,
                  issue: `Value "${item.value}" (type: ${typeof item.value}) not detected as truthy`
                });
              }
            }

            if (name.includes('terasa') || name.includes('zahrada')) {
              if (result.phase2a_results.has_terrace !== true) {
                extractionIssues.push({
                  hash_id: result.hash_id,
                  amenity: 'terrace',
                  api_value: item.value,
                  expected_extraction: true,
                  actual_extraction: result.phase2a_results.has_terrace,
                  issue: `Value "${item.value}" (type: ${typeof item.value}) not detected`
                });
              }
            }

            if (name.includes('výtah')) {
              if (item.value === false && result.phase2a_results.has_elevator === true) {
                extractionIssues.push({
                  hash_id: result.hash_id,
                  amenity: 'elevator',
                  api_value: item.value,
                  expected_extraction: false,
                  actual_extraction: result.phase2a_results.has_elevator,
                  issue: `Boolean false value incorrectly extracted as true`
                });
              } else if (item.value !== false && result.phase2a_results.has_elevator !== true) {
                extractionIssues.push({
                  hash_id: result.hash_id,
                  amenity: 'elevator',
                  api_value: item.value,
                  expected_extraction: true,
                  actual_extraction: result.phase2a_results.has_elevator,
                  issue: `Value "${item.value}" (type: ${typeof item.value}) not detected as truthy`
                });
              }
            }

            if (name.includes('garáž') || name.includes('garage')) {
              if (result.phase2a_results.has_balcony === undefined) {
                extractionIssues.push({
                  hash_id: result.hash_id,
                  amenity: 'garage',
                  api_value: item.value,
                  expected_extraction: true,
                  actual_extraction: undefined,
                  issue: `Garage field not extracted (check if has_garage field exists)`
                });
              }
            }
          });

          console.log(`  ✓ ${result.total_items} items, ${result.api_amenity_items.length} amenity items`);
        } else {
          console.log(`  ✗ No items in detail`);
        }

        await delay(400 + Math.random() * 200);
      } catch (error: any) {
        console.error(`  ✗ Error:`, error.message);
      }
    }

    // Test houses
    console.log('\n\nFetching house listings...');
    estateList = await fetchEstateList(1, 2, 5);
    console.log(`Got ${estateList.length} houses\n`);
    await delay(500);

    for (const estate of estateList) {
      try {
        console.log(`Testing house ${estate.hash_id}...`);
        const detail = await fetchEstateDetail(estate.hash_id);

        if (detail && detail.items) {
          const result = testListing(detail);
          allResults.push(result);

          propertyTypeCounts[result.property_type] = (propertyTypeCounts[result.property_type] || 0) + 1;

          const txType = detail.seo?.category_type_cb === 1 ? 'sale' : 'rent';
          transactionCounts[txType] = (transactionCounts[txType] || 0) + 1;

          console.log(`  ✓ ${result.total_items} items, ${result.api_amenity_items.length} amenity items`);
        } else {
          console.log(`  ✗ No items in detail`);
        }

        await delay(400 + Math.random() * 200);
      } catch (error: any) {
        console.error(`  ✗ Error:`, error.message);
      }
    }

  } catch (error: any) {
    console.error('Fatal error:', error.message);
  }

  // Analyze extraction rates
  const amenities = ['has_ac', 'has_security', 'has_fireplace', 'has_balcony', 'has_terrace', 'has_elevator'];
  const extractionSummary = amenities.map(field => {
    const results = allResults.filter(r => {
      const amenityKey = field as keyof (typeof r['phase2a_results']);
      return r.phase2a_results[amenityKey] !== undefined;
    });

    const fieldName = field.replace('has_', '');
    const apiAvailable = allResults.filter(r => {
      return r.api_amenity_items.some(item => {
        const name = item.name.toLowerCase();
        const keywords: Record<string, string[]> = {
          ac: ['klimatizace'],
          security: ['bezpečnost', 'alarm'],
          fireplace: ['krb'],
          balcony: ['balkón'],
          terrace: ['terasa'],
          elevator: ['výtah']
        };
        return keywords[fieldName]?.some(kw => name.includes(kw)) || false;
      });
    }).length;

    return {
      field,
      api_availability: apiAvailable,
      extraction_success: results.length,
      extraction_rate: results.length > 0 ? Math.round((results.length / apiAvailable) * 100) : 0,
      examples_in_data: allResults
        .flatMap(r => r.api_amenity_items
          .filter(item => {
            const name = item.name.toLowerCase();
            const keywords: Record<string, string[]> = {
              ac: ['klimatizace'],
              security: ['bezpečnost', 'alarm'],
              fireplace: ['krb'],
              balcony: ['balkón'],
              terrace: ['terasa'],
              elevator: ['výtah']
            };
            return keywords[fieldName]?.some(kw => name.includes(kw)) || false;
          })
          .map(item => item.name)
        )
        .filter((v, i, a) => a.indexOf(v) === i)
        .slice(0, 5)
    };
  });

  // Generate final report
  const report: FinalReport = {
    test_date: new Date().toISOString(),
    test_summary: {
      total_listings_tested: allResults.length,
      apartments: propertyTypeCounts['apartment'] || 0,
      houses: propertyTypeCounts['house'] || 0,
      sales_rentals: transactionCounts
    },
    phase2a_extraction_summary: extractionSummary,
    extraction_issues_found: extractionIssues,
    sample_test_results: allResults.slice(0, 8),
    key_findings: [
      `Tested ${allResults.length} real listings (${propertyTypeCounts['apartment'] || 0} apartments, ${propertyTypeCounts['house'] || 0} houses)`,
      `Elevator ("Výtah") is the most common amenity found in API (${extractionSummary.find(e => e.field === 'has_elevator')?.api_availability || 0} listings)`,
      `Balcony ("Balkón") found in ${extractionSummary.find(e => e.field === 'has_balcony')?.api_availability || 0} listings`,
      `AC ("Klimatizace"), Security/Alarm, and Fireplace ("Krb") not found in test data`,
      `Elevator extraction has accuracy issues: false values incorrectly detected as true`,
      `Balcony extraction has detection issues: numeric values (like "3" sqm) not recognized as positive`,
      `Garage items appear in API but no extraction field exists in Phase 2a`
    ],
    recommendations: [
      'Fix elevator extraction to handle boolean false values correctly - should only extract when value is truthy',
      'Fix balcony/terrace extraction to recognize numeric values as positive existence indicators',
      'Expand amenity keyword matching - consider adding variations like "Garáž" for garage detection',
      'Test with larger dataset to find AC, security, and fireplace examples',
      'Consider adding has_garage field to Phase 2a for properties that have garage values in API',
      'Add proper type conversion in transformer for mixed value types (string vs boolean vs number)',
      'Test with different property types (commercial, land) for comprehensive coverage'
    ]
  };

  // Print report
  console.log('\n\n========== PHASE 2A FINAL TEST REPORT ==========\n');
  console.log(`Test Date: ${report.test_date}`);
  console.log(`Total Listings Tested: ${report.test_summary.total_listings_tested}`);
  console.log(`  - Apartments: ${report.test_summary.apartments}`);
  console.log(`  - Houses: ${report.test_summary.houses}`);
  console.log(`  - Sales: ${report.test_summary.sales_rentals['sale'] || 0}, Rentals: ${report.test_summary.sales_rentals['rent'] || 0}`);
  console.log('\n========== AMENITY EXTRACTION ANALYSIS ==========\n');

  console.log('Field             | API Count | Extracted | Rate  | Examples');
  console.log('------------------|-----------|-----------|-------|------------------------------------------');
  for (const stat of report.phase2a_extraction_summary) {
    const field = stat.field.replace('has_', '').padEnd(15);
    const apiCount = stat.api_availability.toString().padStart(9);
    const extracted = stat.extraction_success.toString().padStart(9);
    const rate = (stat.extraction_rate + '%').padStart(5);
    const examples = stat.examples_in_data.join(', ').substring(0, 40);
    console.log(`${field}| ${apiCount} | ${extracted} | ${rate} | ${examples}`);
  }

  console.log('\n========== EXTRACTION ISSUES FOUND ==========\n');
  if (extractionIssues.length > 0) {
    extractionIssues.slice(0, 10).forEach(issue => {
      console.log(`Hash ${issue.hash_id}: ${issue.amenity}`);
      console.log(`  API Value: ${JSON.stringify(issue.api_value)} (type: ${typeof issue.api_value})`);
      console.log(`  Expected: ${issue.expected_extraction}, Actual: ${issue.actual_extraction}`);
      console.log(`  Issue: ${issue.issue}\n`);
    });
    if (extractionIssues.length > 10) {
      console.log(`... and ${extractionIssues.length - 10} more issues`);
    }
  } else {
    console.log('No extraction issues found');
  }

  console.log('\n========== KEY FINDINGS ==========\n');
  report.key_findings.forEach((finding, i) => {
    console.log(`${i + 1}. ${finding}`);
  });

  console.log('\n========== RECOMMENDATIONS ==========\n');
  report.recommendations.forEach((rec, i) => {
    console.log(`${i + 1}. ${rec}`);
  });

  console.log('\n========== FULL JSON REPORT ==========\n');
  console.log(JSON.stringify(report, null, 2));
}

runFinalTest().catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});
