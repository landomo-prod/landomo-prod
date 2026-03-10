import axios from 'axios';
import { transformSRealityToStandard } from './src/transformers/srealityTransformer';
import { getRandomUserAgent } from './src/utils/userAgents';
import { SRealityListing, SRealityDetailResponse } from './src/types/srealityTypes';

/**
 * Phase 2a Amenity Extraction Test - DETAILED VERSION
 * This version analyzes actual API response structure and fetches detail endpoints
 * to get complete item information for amenity extraction
 */

interface DetailedTestResult {
  hash_id: number;
  title: string;
  property_type: string;
  has_items_in_list: boolean;
  items_count: number;
  amenities: {
    has_ac?: boolean;
    has_security?: boolean;
    has_fireplace?: boolean;
    has_balcony?: boolean;
    has_terrace?: boolean;
    has_elevator?: boolean;
  };
  amenity_items_found: Array<{ name: string; value: string }>;
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

interface DetailedReport {
  timestamp: string;
  api_response_analysis: {
    listings_with_items_in_list: number;
    listings_without_items: number;
    avg_items_per_listing: number;
  };
  total_listings_tested: number;
  listings_by_type: Record<string, number>;
  amenity_stats: AmenityStats[];
  sample_listings: DetailedTestResult[];
  all_amenity_items_found: Array<{ hash_id: number; field_name: string; value: string }>;
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

    console.log(`  Fetching detail for ${hash_id}...`);
    const response = await axios.get(url, { headers, timeout: 30000 });
    return response.data;
  } catch (error: any) {
    console.error(`  Error fetching detail for ${hash_id}:`, error.message);
    return null;
  }
}

function testAmenityExtractionDetailed(listing: SRealityListing): DetailedTestResult {
  const transformed = transformSRealityToStandard(listing);

  // Find amenity-related items
  const amenityKeywords = ['balkón', 'terasa', 'výtah', 'klimatizace', 'bezpečnost', 'krb', 'alarm', 'kamera'];
  const amenityItems = (listing.items || []).filter(item => {
    const name = item.name?.toLowerCase() || '';
    return amenityKeywords.some(keyword => name.includes(keyword));
  });

  return {
    hash_id: listing.hash_id,
    title: listing.name?.value || 'Unknown',
    property_type: transformed.property_type,
    has_items_in_list: (listing.items?.length || 0) > 0,
    items_count: listing.items?.length || 0,
    amenities: {
      has_ac: transformed.amenities?.has_ac,
      has_security: transformed.amenities?.has_security,
      has_fireplace: transformed.amenities?.has_fireplace,
      has_balcony: transformed.amenities?.has_balcony,
      has_terrace: transformed.amenities?.has_terrace,
      has_elevator: transformed.amenities?.has_elevator,
    },
    amenity_items_found: amenityItems
  };
}

function calculateStats(results: DetailedTestResult[]): AmenityStats[] {
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

async function runDetailedTest(): Promise<void> {
  console.log('Starting Phase 2a Amenity Extraction Test (DETAILED VERSION)\n');

  const results: DetailedTestResult[] = [];
  const errors: Array<{ hash_id: number; error: string }> = [];
  const propertyTypes: Record<string, number> = {};
  const allAmenityItems: Array<{ hash_id: number; field_name: string; value: string }> = [];

  try {
    // Fetch initial listings from page 1
    console.log('Fetching apartment listings (category_main_cb=1)...\n');
    let listings = await fetchEstateList(1, 5);
    await delay(500);

    // Test each listing
    for (const listing of listings) {
      try {
        console.log(`\nTesting listing ${listing.hash_id}...`);
        console.log(`  Items in list response: ${listing.items?.length || 0}`);

        // If listing has items, test directly
        if (listing.items && listing.items.length > 0) {
          const testResult = testAmenityExtractionDetailed(listing);
          results.push(testResult);

          if (testResult.amenity_items_found.length > 0) {
            testResult.amenity_items_found.forEach(item => {
              allAmenityItems.push({
                hash_id: listing.hash_id,
                field_name: item.name,
                value: item.value
              });
            });
          }

          propertyTypes[testResult.property_type] = (propertyTypes[testResult.property_type] || 0) + 1;
        } else {
          // Try to fetch detail endpoint
          console.log(`  No items in list, fetching detail endpoint...`);
          const detail = await fetchEstateDetail(listing.hash_id);

          if (detail && detail.items && detail.items.length > 0) {
            // Create a merged listing with items from detail
            const mergedListing: SRealityListing = {
              ...listing,
              items: detail.items
            };

            const testResult = testAmenityExtractionDetailed(mergedListing);
            results.push(testResult);

            if (testResult.amenity_items_found.length > 0) {
              testResult.amenity_items_found.forEach(item => {
                allAmenityItems.push({
                  hash_id: listing.hash_id,
                  field_name: item.name,
                  value: item.value
                });
              });
            }

            propertyTypes[testResult.property_type] = (propertyTypes[testResult.property_type] || 0) + 1;
            console.log(`  Got ${detail.items.length} items from detail`);
          } else {
            console.log(`  Detail endpoint also has no items`);
            errors.push({ hash_id: listing.hash_id, error: 'No items in either list or detail response' });
          }
        }

        // Add delay between requests
        await delay(500 + Math.random() * 300);
      } catch (error: any) {
        console.error(`Error testing listing ${listing.hash_id}:`, error.message);
        errors.push({ hash_id: listing.hash_id, error: error.message });
      }
    }

    // Try to fetch a few house listings as well (category_main_cb=2)
    console.log('\n\nFetching house listings (category_main_cb=2)...\n');
    const houseUrl = 'https://www.sreality.cz/api/cs/v2/estates?page=1&per_page=3&category_main_cb=2';
    const houseResponse = await axios.get(houseUrl, {
      headers: { 'User-Agent': getRandomUserAgent() },
      timeout: 30000
    });
    const houseListings = houseResponse.data._embedded?.estates || [];

    for (const listing of houseListings) {
      try {
        console.log(`\nTesting house listing ${listing.hash_id}...`);
        console.log(`  Items in list response: ${listing.items?.length || 0}`);

        if (listing.items && listing.items.length > 0) {
          const testResult = testAmenityExtractionDetailed(listing);
          results.push(testResult);

          if (testResult.amenity_items_found.length > 0) {
            testResult.amenity_items_found.forEach(item => {
              allAmenityItems.push({
                hash_id: listing.hash_id,
                field_name: item.name,
                value: item.value
              });
            });
          }

          propertyTypes[testResult.property_type] = (propertyTypes[testResult.property_type] || 0) + 1;
        } else {
          console.log(`  No items in list, fetching detail endpoint...`);
          const detail = await fetchEstateDetail(listing.hash_id);

          if (detail && detail.items && detail.items.length > 0) {
            const mergedListing: SRealityListing = {
              ...listing,
              items: detail.items
            };

            const testResult = testAmenityExtractionDetailed(mergedListing);
            results.push(testResult);

            if (testResult.amenity_items_found.length > 0) {
              testResult.amenity_items_found.forEach(item => {
                allAmenityItems.push({
                  hash_id: listing.hash_id,
                  field_name: item.name,
                  value: item.value
                });
              });
            }

            propertyTypes[testResult.property_type] = (propertyTypes[testResult.property_type] || 0) + 1;
            console.log(`  Got ${detail.items.length} items from detail`);
          } else {
            console.log(`  Detail endpoint also has no items`);
            errors.push({ hash_id: listing.hash_id, error: 'No items in either list or detail response' });
          }
        }

        await delay(500 + Math.random() * 300);
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

  // API Response Analysis
  const listingsWithItems = results.filter(r => r.has_items_in_list).length;
  const avgItems = results.length > 0 ? results.reduce((sum, r) => sum + r.items_count, 0) / results.length : 0;

  // Generate report
  const report: DetailedReport = {
    timestamp: new Date().toISOString(),
    api_response_analysis: {
      listings_with_items_in_list: listingsWithItems,
      listings_without_items: results.length - listingsWithItems,
      avg_items_per_listing: Math.round(avgItems * 10) / 10
    },
    total_listings_tested: results.length,
    listings_by_type: propertyTypes,
    amenity_stats: stats,
    sample_listings: results.slice(0, 8),
    all_amenity_items_found: allAmenityItems,
    errors
  };

  // Print summary
  console.log('\n\n========== PHASE 2A AMENITY EXTRACTION TEST REPORT (DETAILED) ==========\n');
  console.log(`Timestamp: ${report.timestamp}`);
  console.log(`Total Listings Tested: ${report.total_listings_tested}`);
  console.log(`Property Types: ${JSON.stringify(report.listings_by_type)}`);
  console.log(`Errors: ${errors.length}\n`);

  console.log('========== API RESPONSE ANALYSIS ==========\n');
  console.log(`Listings with items in list response: ${report.api_response_analysis.listings_with_items_in_list}`);
  console.log(`Listings without items in list: ${report.api_response_analysis.listings_without_items}`);
  console.log(`Average items per listing: ${report.api_response_analysis.avg_items_per_listing}\n`);

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

  console.log('\n========== ALL AMENITY ITEMS FOUND ==========\n');
  if (allAmenityItems.length > 0) {
    allAmenityItems.forEach(item => {
      console.log(`Hash ${item.hash_id}: ${item.field_name} = ${item.value}`);
    });
  } else {
    console.log('No amenity-related items found in any listings');
  }

  console.log('\n========== SAMPLE LISTINGS (DETAILED) ==========\n');
  for (const listing of report.sample_listings) {
    console.log(`Hash ID: ${listing.hash_id}`);
    console.log(`Title: ${listing.title}`);
    console.log(`Type: ${listing.property_type}`);
    console.log(`Items Count: ${listing.items_count}`);
    console.log(`Has Items in List: ${listing.has_items_in_list}`);
    console.log(`Amenities Extracted: ${JSON.stringify(listing.amenities, null, 2)}`);

    if (listing.amenity_items_found.length > 0) {
      console.log(`Amenity Items Found:`);
      listing.amenity_items_found.forEach(item => {
        console.log(`  - ${item.name}: ${item.value}`);
      });
    }
    console.log('\n');
  }

  console.log('========== FULL JSON REPORT ==========\n');
  console.log(JSON.stringify(report, null, 2));
}

// Run the test
runDetailedTest().catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});
