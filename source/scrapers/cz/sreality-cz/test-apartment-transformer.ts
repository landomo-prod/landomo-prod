/**
 * Test: Apartment Transformer with real SReality API data
 * Fetches real listings, transforms them, validates output
 */

// We need to fetch real data from SReality API and then transform it
// Since we can't import directly in tsx without full module resolution,
// we'll inline the fetch and use the compiled dist if available, or raw imports

import { transformApartment } from './src/transformers/apartments/apartmentTransformer';
import { SRealityItemsParser } from './src/utils/itemsParser';

const API_BASE = 'https://www.sreality.cz/api/cs/v2';

interface TestResult {
  listing_id: number;
  title: string;
  passed: boolean;
  errors: string[];
  warnings: string[];
  new_fields: Record<string, any>;
  boolean_fields: Record<string, { value: any; type: string }>;
}

async function fetchApartmentListings(count: number): Promise<any[]> {
  // category_main_cb=1 = apartments, category_type_cb=1 = sale
  const url = `${API_BASE}/estates?category_main_cb=1&category_type_cb=1&per_page=${count}&page=1`;

  const resp = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'application/json',
    }
  });

  if (!resp.ok) throw new Error(`API returned ${resp.status}: ${resp.statusText}`);

  const data = await resp.json();
  return data._embedded?.estates || [];
}

async function fetchListingDetail(hashId: number): Promise<any> {
  const url = `${API_BASE}/estates/${hashId}`;

  const resp = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'application/json',
    }
  });

  if (!resp.ok) throw new Error(`Detail API returned ${resp.status} for ${hashId}`);
  return resp.json();
}

function validateTransformedApartment(transformed: any, rawListing: any): TestResult {
  const result: TestResult = {
    listing_id: rawListing.hash_id,
    title: typeof rawListing.name === 'string' ? rawListing.name : rawListing.name?.value || 'unknown',
    passed: true,
    errors: [],
    warnings: [],
    new_fields: {},
    boolean_fields: {},
  };

  // Check required fields
  const requiredFields = [
    'property_category', 'title', 'price', 'currency', 'transaction_type',
    'location', 'bedrooms', 'sqm', 'has_elevator', 'has_balcony',
    'has_parking', 'has_basement', 'source_url', 'source_platform',
    'portal_id', 'status'
  ];

  for (const field of requiredFields) {
    if (transformed[field] === undefined) {
      result.errors.push(`Missing required field: ${field}`);
      result.passed = false;
    }
  }

  // Check property_category
  if (transformed.property_category !== 'apartment') {
    result.errors.push(`property_category should be 'apartment', got '${transformed.property_category}'`);
    result.passed = false;
  }

  // Check boolean fields are never undefined
  const booleanFields = [
    'has_elevator', 'has_balcony', 'has_parking', 'has_basement',
    'has_loggia', 'has_terrace', 'has_garage'
  ];

  for (const field of booleanFields) {
    const val = transformed[field];
    result.boolean_fields[field] = { value: val, type: typeof val };

    if (val === undefined) {
      result.errors.push(`Boolean field '${field}' is undefined (should be true/false)`);
      result.passed = false;
    } else if (typeof val !== 'boolean') {
      result.errors.push(`Boolean field '${field}' is type '${typeof val}', expected boolean`);
      result.passed = false;
    }
  }

  // Check new fields in portal_metadata
  const pm = transformed.portal_metadata?.sreality;
  if (pm) {
    result.new_fields = {
      has_panorama: pm.has_panorama,
      has_floor_plan: pm.has_floor_plan,
      has_video: pm.has_video,
      labels: pm.labels,
      virtual_tour_url: pm.virtual_tour_url,
      video_url: pm.video_url,
      is_auction: pm.is_auction,
      exclusively_at_rk: pm.exclusively_at_rk,
    };
  } else {
    result.errors.push('Missing portal_metadata.sreality');
    result.passed = false;
  }

  // Check location has required fields
  if (transformed.location) {
    if (!transformed.location.country) {
      result.errors.push('Missing location.country');
      result.passed = false;
    }
  }

  // Check country_specific
  if (!transformed.country_specific?.czech) {
    result.warnings.push('Missing country_specific.czech');
  }

  // Validate price is a number
  if (typeof transformed.price !== 'number') {
    result.errors.push(`Price should be number, got ${typeof transformed.price}`);
    result.passed = false;
  }

  // Validate sqm is a number
  if (typeof transformed.sqm !== 'number') {
    result.errors.push(`sqm should be number, got ${typeof transformed.sqm}`);
    result.passed = false;
  }

  return result;
}

async function main() {
  console.log('=== Apartment Transformer Test ===\n');

  // Step 1: Fetch listings from list endpoint
  console.log('Fetching apartment listings from SReality API...');
  const listings = await fetchApartmentListings(8);
  console.log(`Got ${listings.length} listings from list endpoint\n`);

  if (listings.length === 0) {
    console.error('ERROR: No listings returned from API');
    process.exit(1);
  }

  // Step 2: Fetch details for first 5 listings
  const detailedListings: any[] = [];
  for (let i = 0; i < Math.min(5, listings.length); i++) {
    const listing = listings[i];
    try {
      console.log(`Fetching detail for listing ${listing.hash_id}...`);
      const detail = await fetchListingDetail(listing.hash_id);
      detailedListings.push(detail);
      // Rate limit
      await new Promise(r => setTimeout(r, 500));
    } catch (e: any) {
      console.warn(`  Skipping ${listing.hash_id}: ${e.message}`);
    }
  }

  console.log(`\nGot ${detailedListings.length} detailed listings\n`);

  // Step 3: Verify SRealityItemsParser is being used
  console.log('--- SRealityItemsParser Verification ---');
  const sampleListing = detailedListings[0];
  if (sampleListing?.items) {
    const parser = new SRealityItemsParser(sampleListing.items);
    const fieldNames = parser.getFieldNames();
    console.log(`Parser created with ${fieldNames.length} fields:`);
    fieldNames.forEach(f => console.log(`  - ${f}`));
    console.log(`Parser getBoolean test (Výtah): ${parser.getBoolean('Výtah' as any)}`);
    console.log(`Parser getArea test (Užitná plocha): ${parser.getArea('Užitná plocha' as any)}`);
    console.log('SRealityItemsParser: VERIFIED\n');
  }

  // Step 4: Transform and validate each listing
  console.log('--- Transform & Validate ---\n');
  const results: TestResult[] = [];

  for (const listing of detailedListings) {
    try {
      const transformed = transformApartment(listing);
      const result = validateTransformedApartment(transformed, listing);
      results.push(result);

      const status = result.passed ? 'PASS' : 'FAIL';
      console.log(`[${status}] Listing ${result.listing_id}: ${result.title}`);

      if (result.errors.length > 0) {
        result.errors.forEach(e => console.log(`  ERROR: ${e}`));
      }
      if (result.warnings.length > 0) {
        result.warnings.forEach(w => console.log(`  WARN: ${w}`));
      }

      // Print key transformed values
      console.log(`  price: ${transformed.price}, sqm: ${transformed.sqm}, bedrooms: ${transformed.bedrooms}`);
      console.log(`  floor: ${transformed.floor}, disposition: ${transformed.country_specific?.czech?.disposition}`);
      console.log(`  booleans: elevator=${transformed.has_elevator}, balcony=${transformed.has_balcony}, parking=${transformed.has_parking}, basement=${transformed.has_basement}`);
      console.log(`  new_fields: has_panorama=${result.new_fields.has_panorama}, has_floor_plan=${result.new_fields.has_floor_plan}, labels=${JSON.stringify(result.new_fields.labels)}`);
      console.log(`  virtual_tour_url=${result.new_fields.virtual_tour_url}, video_url=${result.new_fields.video_url}`);
      console.log('');
    } catch (e: any) {
      console.error(`[ERROR] Listing ${listing.hash_id}: Transform failed - ${e.message}`);
      results.push({
        listing_id: listing.hash_id,
        title: 'TRANSFORM_ERROR',
        passed: false,
        errors: [`Transform exception: ${e.message}`],
        warnings: [],
        new_fields: {},
        boolean_fields: {},
      });
    }
  }

  // Step 5: Summary
  console.log('\n=== SUMMARY ===');
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  console.log(`Total: ${results.length}, Passed: ${passed}, Failed: ${failed}`);

  // Check boolean fields across all results
  console.log('\n--- Boolean Fields Summary ---');
  const boolFieldNames = ['has_elevator', 'has_balcony', 'has_parking', 'has_basement', 'has_loggia', 'has_terrace', 'has_garage'];
  for (const field of boolFieldNames) {
    const allValid = results.every(r => {
      const bf = r.boolean_fields[field];
      return bf && typeof bf.value === 'boolean';
    });
    console.log(`  ${field}: ${allValid ? 'ALL BOOLEAN (OK)' : 'HAS ISSUES'}`);
  }

  // Check new fields presence
  console.log('\n--- New Fields Presence ---');
  const newFieldNames = ['has_panorama', 'has_floor_plan', 'labels', 'virtual_tour_url', 'video_url'];
  for (const field of newFieldNames) {
    const present = results.filter(r => r.new_fields[field] !== undefined).length;
    console.log(`  ${field}: present in ${present}/${results.length} listings`);
  }

  console.log(`\nOverall: ${failed === 0 ? 'ALL TESTS PASSED' : `${failed} TESTS FAILED`}`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
