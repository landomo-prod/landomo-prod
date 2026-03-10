import axios from 'axios';
import { transformSRealityToStandard } from './src/transformers/srealityTransformer';
import { getRandomUserAgent } from './src/utils/userAgents';
import { SRealityListing } from './src/types/srealityTypes';

/**
 * Phase 2a Amenity Extraction Test - COMPREHENSIVE VERSION
 * Fetches detail endpoints (which have the items array) and tests extraction
 */

interface Phase2aTestResult {
  hash_id: number;
  title: string;
  property_type: string;
  transaction_type: string;
  items_count: number;
  amenities_extracted: {
    has_ac?: boolean;
    has_security?: boolean;
    has_fireplace?: boolean;
    has_balcony?: boolean;
    has_terrace?: boolean;
    has_elevator?: boolean;
  };
  amenity_related_items: Array<{
    name: string;
    value: any;
    extracted_as?: string;
  }>;
}

interface AmenityStats {
  field: string;
  found_count: number;
  true_count: number;
  false_count: number;
  undefined_count: number;
  extraction_rate: number;
  positive_rate: number;
}

interface ComprehensiveReport {
  timestamp: string;
  total_listings_tested: number;
  successful_tests: number;
  failed_tests: number;
  listings_by_type: Record<string, number>;
  transaction_types: Record<string, number>;
  amenity_stats: AmenityStats[];
  most_common_amenities: Array<{ name: string; count: number; extraction_rate: number }>;
  sample_listings: Phase2aTestResult[];
  errors: Array<{ hash_id: number; error: string }>;
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchEstateList(page: number = 1, perPage: number = 10, category: number = 1): Promise<any[]> {
  try {
    const url = `https://www.sreality.cz/api/cs/v2/estates?page=${page}&per_page=${perPage}&category_main_cb=${category}`;
    const headers = { 'User-Agent': getRandomUserAgent() };

    const response = await axios.get(url, { headers, timeout: 20000 });
    const estates = response.data._embedded?.estates || [];
    return estates;
  } catch (error: any) {
    console.error(`Error fetching listings:`, error.message);
    throw error;
  }
}

async function fetchEstateDetail(hash_id: number): Promise<any> {
  try {
    const url = `https://www.sreality.cz/api/cs/v2/estates/${hash_id}`;
    const headers = { 'User-Agent': getRandomUserAgent() };

    const response = await axios.get(url, { headers, timeout: 20000 });
    return response.data;
  } catch (error: any) {
    console.error(`Error fetching detail for ${hash_id}:`, error.message);
    return null;
  }
}

function convertApiListingToStandard(detail: any): SRealityListing {
  // Convert detail response to SRealityListing format
  // The detail response has items array directly; convert to the expected format
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

function testAmenityExtraction(detail: any): Phase2aTestResult {
  // Convert to standard format and test
  const standardListing = convertApiListingToStandard(detail);
  const transformed = transformSRealityToStandard(standardListing);

  // Find amenity-related items in the detail response
  const amenityKeywords = ['balkón', 'terasa', 'výtah', 'klimatizace', 'bezpečnost', 'krb', 'alarm', 'kamera', 'parking', 'garáž'];
  const amenityItems = (detail.items || [])
    .filter((item: any) => {
      const name = (item.name || '').toString().toLowerCase();
      return amenityKeywords.some(keyword => name.includes(keyword));
    })
    .map((item: any) => {
      // Try to map to which amenity it should extract to
      const name = item.name?.toLowerCase() || '';
      let extractedAs = undefined;

      if (name.includes('balkón') || name.includes('balcony')) {
        extractedAs = 'has_balcony';
      } else if (name.includes('terasa') || name.includes('terrace')) {
        extractedAs = 'has_terrace';
      } else if (name.includes('výtah') || name.includes('elevator')) {
        extractedAs = 'has_elevator';
      } else if (name.includes('klimatizace') || name.includes('air condition')) {
        extractedAs = 'has_ac';
      } else if (name.includes('bezpečnost') || name.includes('alarm') || name.includes('kamera') || name.includes('security')) {
        extractedAs = 'has_security';
      } else if (name.includes('krb') || name.includes('fireplace')) {
        extractedAs = 'has_fireplace';
      }

      return {
        name: item.name,
        value: item.value,
        extracted_as: extractedAs
      };
    });

  return {
    hash_id: detail.hash_id,
    title: detail.name?.value || 'Unknown',
    property_type: transformed.property_type,
    transaction_type: transformed.transaction_type,
    items_count: detail.items?.length || 0,
    amenities_extracted: {
      has_ac: transformed.amenities?.has_ac,
      has_security: transformed.amenities?.has_security,
      has_fireplace: transformed.amenities?.has_fireplace,
      has_balcony: transformed.amenities?.has_balcony,
      has_terrace: transformed.amenities?.has_terrace,
      has_elevator: transformed.amenities?.has_elevator,
    },
    amenity_related_items: amenityItems
  };
}

function calculateStats(results: Phase2aTestResult[]): AmenityStats[] {
  const fields = ['has_ac', 'has_security', 'has_fireplace', 'has_balcony', 'has_terrace', 'has_elevator'];

  return fields.map(field => {
    const fieldName = field as keyof (typeof results[0]['amenities_extracted']);
    const values = results.map(r => r.amenities_extracted[fieldName]);

    const true_count = values.filter(v => v === true).length;
    const false_count = values.filter(v => v === false).length;
    const undefined_count = values.filter(v => v === undefined).length;
    const found_count = true_count + false_count;
    const extraction_rate = results.length > 0 ? (found_count / results.length) * 100 : 0;
    const positive_rate = found_count > 0 ? (true_count / found_count) * 100 : 0;

    return {
      field,
      found_count,
      true_count,
      false_count,
      undefined_count,
      extraction_rate: Math.round(extraction_rate * 10) / 10,
      positive_rate: Math.round(positive_rate * 10) / 10
    };
  });
}

async function runComprehensiveTest(): Promise<void> {
  console.log('Starting Phase 2a Comprehensive Amenity Extraction Test\n');

  const results: Phase2aTestResult[] = [];
  const errors: Array<{ hash_id: number; error: string }> = [];
  const propertyTypes: Record<string, number> = {};
  const transactionTypes: Record<string, number> = {};
  let successCount = 0;
  let failureCount = 0;

  try {
    // Fetch apartment listings (category_main_cb=1)
    console.log('Fetching apartment listings (category_main_cb=1)...');
    let listings = await fetchEstateList(1, 6, 1);
    console.log(`Got ${listings.length} apartment listings\n`);
    await delay(500);

    for (const listing of listings) {
      try {
        console.log(`Testing apartment ${listing.hash_id}...`);
        const detail = await fetchEstateDetail(listing.hash_id);

        if (detail && detail.items) {
          const testResult = testAmenityExtraction(detail);
          results.push(testResult);
          successCount++;

          propertyTypes[testResult.property_type] = (propertyTypes[testResult.property_type] || 0) + 1;
          transactionTypes[testResult.transaction_type] = (transactionTypes[testResult.transaction_type] || 0) + 1;

          console.log(`  ✓ ${testResult.items_count} items found`);
        } else {
          failureCount++;
          console.log(`  ✗ No items in detail response`);
          errors.push({ hash_id: listing.hash_id, error: 'No items in detail' });
        }

        await delay(400 + Math.random() * 200);
      } catch (error: any) {
        failureCount++;
        console.error(`  ✗ Error:`, error.message);
        errors.push({ hash_id: listing.hash_id, error: error.message });
      }
    }

    // Fetch house listings (category_main_cb=2)
    console.log('\n\nFetching house listings (category_main_cb=2)...');
    listings = await fetchEstateList(1, 4, 2);
    console.log(`Got ${listings.length} house listings\n`);
    await delay(500);

    for (const listing of listings) {
      try {
        console.log(`Testing house ${listing.hash_id}...`);
        const detail = await fetchEstateDetail(listing.hash_id);

        if (detail && detail.items) {
          const testResult = testAmenityExtraction(detail);
          results.push(testResult);
          successCount++;

          propertyTypes[testResult.property_type] = (propertyTypes[testResult.property_type] || 0) + 1;
          transactionTypes[testResult.transaction_type] = (transactionTypes[testResult.transaction_type] || 0) + 1;

          console.log(`  ✓ ${testResult.items_count} items found`);
        } else {
          failureCount++;
          console.log(`  ✗ No items in detail response`);
          errors.push({ hash_id: listing.hash_id, error: 'No items in detail' });
        }

        await delay(400 + Math.random() * 200);
      } catch (error: any) {
        failureCount++;
        console.error(`  ✗ Error:`, error.message);
        errors.push({ hash_id: listing.hash_id, error: error.message });
      }
    }

  } catch (error: any) {
    console.error('Fatal error during test:', error.message);
  }

  // Calculate statistics
  const stats = calculateStats(results);

  // Find most common amenities in raw API data
  const amenityCounts: Record<string, { count: number; field: string }> = {};
  results.forEach(result => {
    result.amenity_related_items.forEach(item => {
      const key = item.name || 'unknown';
      if (!amenityCounts[key]) {
        amenityCounts[key] = { count: 0, field: item.extracted_as || 'unknown' };
      }
      amenityCounts[key].count++;
    });
  });

  const mostCommonAmenities = Object.entries(amenityCounts)
    .map(([name, data]) => {
      // Find which field this maps to
      const field = stats.find(s => s.field === data.field);
      const extraction_rate = field ? field.extraction_rate : 0;
      return {
        name,
        count: data.count,
        extraction_rate
      };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Generate report
  const report: ComprehensiveReport = {
    timestamp: new Date().toISOString(),
    total_listings_tested: results.length,
    successful_tests: successCount,
    failed_tests: failureCount,
    listings_by_type: propertyTypes,
    transaction_types: transactionTypes,
    amenity_stats: stats,
    most_common_amenities: mostCommonAmenities,
    sample_listings: results.slice(0, 6),
    errors
  };

  // Print summary
  console.log('\n\n========== PHASE 2A COMPREHENSIVE TEST REPORT ==========\n');
  console.log(`Timestamp: ${report.timestamp}`);
  console.log(`Total Listings: ${report.total_listings_tested} (${successCount} success, ${failureCount} failed)`);
  console.log(`Property Types: ${JSON.stringify(report.listings_by_type)}`);
  console.log(`Transaction Types: ${JSON.stringify(report.transaction_types)}`);
  console.log(`Errors: ${errors.length}\n`);

  console.log('========== EXTRACTION RATES BY AMENITY ==========\n');
  console.log('Field                | Found | True | False | Undef | Extraction % | Positive %');
  console.log('----------------------|-------|------|-------|-------|--------------|----------');

  for (const stat of report.amenity_stats) {
    const fieldPad = stat.field.padEnd(20);
    const foundPad = stat.found_count.toString().padStart(5);
    const truePad = stat.true_count.toString().padStart(5);
    const falsePad = stat.false_count.toString().padStart(5);
    const undefPad = stat.undefined_count.toString().padStart(5);
    const extractPad = stat.extraction_rate.toString().padStart(11);
    const posPctPad = stat.positive_rate.toString().padStart(9);

    console.log(`${fieldPad}| ${foundPad} | ${truePad} | ${falsePad} | ${undefPad} | ${extractPad}% | ${posPctPad}%`);
  }

  console.log('\n========== MOST COMMON AMENITIES IN API DATA ==========\n');
  for (const amenity of report.most_common_amenities) {
    console.log(`${amenity.name.padEnd(35)} | Count: ${amenity.count.toString().padStart(2)} | Extraction: ${amenity.extraction_rate.toString().padStart(5)}%`);
  }

  console.log('\n========== SAMPLE LISTINGS (6 total) ==========\n');
  for (const listing of report.sample_listings) {
    console.log(`Hash ID: ${listing.hash_id} | Type: ${listing.property_type} | Transaction: ${listing.transaction_type}`);
    console.log(`Title: ${listing.title}`);
    console.log(`Items: ${listing.items_count}`);
    console.log(`Extracted Amenities: ${JSON.stringify(listing.amenities_extracted)}`);

    if (listing.amenity_related_items.length > 0) {
      console.log(`Amenity Items in API:`);
      listing.amenity_related_items.forEach(item => {
        const valueStr = typeof item.value === 'string' ? item.value.substring(0, 40) : String(item.value);
        const field = item.extracted_as ? ` → ${item.extracted_as}` : '';
        console.log(`  - ${item.name}: "${valueStr}"${field}`);
      });
    } else {
      console.log(`No amenity items in API`);
    }
    console.log('');
  }

  console.log('\n========== FULL JSON REPORT ==========\n');
  console.log(JSON.stringify(report, null, 2));
}

// Run the test
runComprehensiveTest().catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});
