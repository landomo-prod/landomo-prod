import axios from 'axios';
import { transformSRealityToStandard } from './src/transformers/srealityTransformer';
import { getRandomUserAgent } from './src/utils/userAgents';
import { SRealityListing, SRealityDetailResponse } from './src/types/srealityTypes';

/**
 * Phase 2a Amenity Extraction Test
 * Tests: has_ac, has_security, has_fireplace, has_balcony, has_terrace, has_elevator
 */

interface TestResult {
  hash_id: number;
  title: string;
  property_type: string;
  amenities: {
    has_ac?: boolean;
    has_security?: boolean;
    has_fireplace?: boolean;
    has_balcony?: boolean;
    has_terrace?: boolean;
    has_elevator?: boolean;
  };
  raw_items?: Array<{ name: string; value: string }>;
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

interface TestReport {
  timestamp: string;
  total_listings_tested: number;
  listings_by_type: Record<string, number>;
  amenity_stats: AmenityStats[];
  sample_listings: TestResult[];
  errors: Array<{ hash_id: number; error: string }>;
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchEstateList(page: number = 1, perPage: number = 10): Promise<SRealityListing[]> {
  try {
    const url = `https://www.sreality.cz/api/cs/v2/estates?page=${page}&per_page=${perPage}&category_main_cb=1`;
    const headers = { 'User-Agent': getRandomUserAgent() };

    console.log(`Fetching page ${page}...`);
    const response = await axios.get(url, { headers, timeout: 30000 });

    const estates = response.data._embedded?.estates || [];
    console.log(`Got ${estates.length} listings from page ${page}`);
    return estates;
  } catch (error: any) {
    console.error(`Error fetching listings:`, error.message);
    throw error;
  }
}

async function fetchEstateDetail(hash_id: number): Promise<SRealityDetailResponse | null> {
  try {
    const url = `https://www.sreality.cz/api/cs/v2/estates/${hash_id}`;
    const headers = { 'User-Agent': getRandomUserAgent() };

    const response = await axios.get(url, { headers, timeout: 30000 });
    return response.data;
  } catch (error: any) {
    console.error(`Error fetching detail for ${hash_id}:`, error.message);
    return null;
  }
}

function testAmenityExtraction(listing: SRealityListing): TestResult {
  const transformed = transformSRealityToStandard(listing);

  return {
    hash_id: listing.hash_id,
    title: listing.name?.value || 'Unknown',
    property_type: transformed.property_type,
    amenities: {
      has_ac: transformed.amenities?.has_ac,
      has_security: transformed.amenities?.has_security,
      has_fireplace: transformed.amenities?.has_fireplace,
      has_balcony: transformed.amenities?.has_balcony,
      has_terrace: transformed.amenities?.has_terrace,
      has_elevator: transformed.amenities?.has_elevator,
    },
    raw_items: listing.items?.slice(0, 20) // Include first 20 items for debugging
  };
}

function calculateStats(results: TestResult[]): AmenityStats[] {
  const fields = ['has_ac', 'has_security', 'has_fireplace', 'has_balcony', 'has_terrace', 'has_elevator'];

  return fields.map(field => {
    const fieldName = field as keyof (typeof results[0]['amenities']);
    const values = results.map(r => r.amenities[fieldName]);

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

async function runTest(): Promise<void> {
  console.log('Starting Phase 2a Amenity Extraction Test\n');

  const results: TestResult[] = [];
  const errors: Array<{ hash_id: number; error: string }> = [];
  const propertyTypes: Record<string, number> = {};

  try {
    // Fetch initial listings from page 1
    console.log('Fetching apartment listings (category_main_cb=1)...\n');
    let listings = await fetchEstateList(1, 10);
    await delay(500);

    // Test each listing
    for (const listing of listings) {
      try {
        console.log(`Testing listing ${listing.hash_id}...`);
        const testResult = testAmenityExtraction(listing);
        results.push(testResult);

        // Track property types
        propertyTypes[testResult.property_type] = (propertyTypes[testResult.property_type] || 0) + 1;

        // Add delay between requests
        await delay(300 + Math.random() * 200);
      } catch (error: any) {
        console.error(`Error testing listing ${listing.hash_id}:`, error.message);
        errors.push({ hash_id: listing.hash_id, error: error.message });
      }
    }

    // Try to fetch a few house listings as well (category_main_cb=2)
    console.log('\nFetching house listings (category_main_cb=2)...\n');
    const houseUrl = 'https://www.sreality.cz/api/cs/v2/estates?page=1&per_page=5&category_main_cb=2';
    const houseResponse = await axios.get(houseUrl, {
      headers: { 'User-Agent': getRandomUserAgent() },
      timeout: 30000
    });
    const houseListings = houseResponse.data._embedded?.estates || [];

    for (const listing of houseListings) {
      try {
        console.log(`Testing house listing ${listing.hash_id}...`);
        const testResult = testAmenityExtraction(listing);
        results.push(testResult);
        propertyTypes[testResult.property_type] = (propertyTypes[testResult.property_type] || 0) + 1;
        await delay(300 + Math.random() * 200);
      } catch (error: any) {
        console.error(`Error testing house listing ${listing.hash_id}:`, error.message);
        errors.push({ hash_id: listing.hash_id, error: error.message });
      }
    }

  } catch (error: any) {
    console.error('Fatal error during test:', error.message);
  }

  // Calculate statistics
  const stats = calculateStats(results);

  // Generate report
  const report: TestReport = {
    timestamp: new Date().toISOString(),
    total_listings_tested: results.length,
    listings_by_type: propertyTypes,
    amenity_stats: stats,
    sample_listings: results.slice(0, 5), // Show first 5 as samples
    errors
  };

  // Print summary
  console.log('\n========== PHASE 2A AMENITY EXTRACTION TEST REPORT ==========\n');
  console.log(`Timestamp: ${report.timestamp}`);
  console.log(`Total Listings Tested: ${report.total_listings_tested}`);
  console.log(`Property Types: ${JSON.stringify(report.listings_by_type)}`);
  console.log(`Errors: ${errors.length}\n`);

  console.log('========== EXTRACTION RATES BY AMENITY ==========\n');
  console.log('Field Name           | Found | True | False | Undef | Extraction % | True %');
  console.log('---------------------|-------|------|-------|-------|--------------|-------');

  for (const stat of report.amenity_stats) {
    const fieldPad = stat.field.padEnd(20);
    const foundPad = stat.found_count.toString().padStart(5);
    const truePad = stat.true_count.toString().padStart(5);
    const falsePad = stat.false_count.toString().padStart(5);
    const undefPad = stat.undefined_count.toString().padStart(5);
    const extractPad = stat.extraction_rate.toString().padStart(11);
    const truePctPad = stat.positive_rate.toString().padStart(6);

    console.log(`${fieldPad}| ${foundPad} | ${truePad} | ${falsePad} | ${undefPad} | ${extractPad}% | ${truePctPad}%`);
  }

  console.log('\n========== SAMPLE LISTINGS ==========\n');
  for (const listing of report.sample_listings) {
    console.log(`Hash ID: ${listing.hash_id}`);
    console.log(`Title: ${listing.title}`);
    console.log(`Type: ${listing.property_type}`);
    console.log(`Amenities: ${JSON.stringify(listing.amenities, null, 2)}`);

    if (listing.raw_items && listing.raw_items.length > 0) {
      console.log(`\nRaw Items (sample):`);
      const amenityItems = listing.raw_items.filter(item => {
        const name = item.name?.toLowerCase() || '';
        return name.includes('balkón') || name.includes('terasa') || name.includes('výtah') ||
               name.includes('klimatizace') || name.includes('bezpečnost') || name.includes('krb');
      });
      amenityItems.forEach(item => {
        console.log(`  - ${item.name}: ${item.value}`);
      });
    }
    console.log('\n');
  }

  console.log('========== FULL JSON REPORT ==========\n');
  console.log(JSON.stringify(report, null, 2));
}

// Run the test
runTest().catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});
