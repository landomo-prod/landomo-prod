import axios from 'axios';

/**
 * Analyze real sreality.cz API responses to understand:
 * 1. Available fields in list endpoint vs detail endpoint
 * 2. Field paths (especially `items` array structure)
 * 3. Tier I, II, and III field extraction opportunities
 */
async function analyzeRealData() {
  const userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36';

  try {
    console.log('=== SREALITY.CZ API STRUCTURE ANALYSIS ===\n');

    // Fetch from list endpoint
    const tms = Date.now();
    const listUrl = `https://www.sreality.cz/api/cs/v2/estates?page=1&per_page=3&category_main_cb=1&tms=${tms}`;
    console.log('Fetching from list endpoint...');
    const listResponse = await axios.get(listUrl, {
      headers: { 'User-Agent': userAgent },
      timeout: 15000
    });

    const listings = listResponse.data._embedded?.estates || [];
    console.log(`\n✅ Found ${listings.length} listings from list endpoint\n`);

    if (listings.length === 0) {
      console.log('❌ No listings found');
      return;
    }

    const firstListing = listings[0];

    // Analyze LIST endpoint structure
    console.log('=== LIST ENDPOINT STRUCTURE ===');
    console.log('Top-level keys:', Object.keys(firstListing).join(', '));
    console.log('\nSample listing (first 1500 chars):');
    console.log(JSON.stringify(firstListing, null, 2).substring(0, 1500));
    console.log('...\n');

    // Fetch DETAIL endpoint
    console.log(`\nFetching detail endpoint for hash_id: ${firstListing.hash_id}...\n`);
    await new Promise(resolve => setTimeout(resolve, 500));

    const detailUrl = `https://www.sreality.cz/api/cs/v2/estates/${firstListing.hash_id}`;
    const detailResponse = await axios.get(detailUrl, {
      headers: { 'User-Agent': userAgent },
      timeout: 15000
    });

    const detailData = detailResponse.data;

    // Analyze DETAIL endpoint structure
    console.log('=== DETAIL ENDPOINT STRUCTURE ===');
    console.log('Top-level keys:', Object.keys(detailData).join(', '));
    console.log('\n✅ Detail endpoint HAS items array:', !!detailData.items);
    console.log('✅ Detail endpoint HAS _embedded:', !!detailData._embedded);
    console.log('✅ Detail endpoint HAS locality:', !!detailData.locality);

    if (detailData.items) {
      console.log(`\n=== ITEMS ARRAY (${detailData.items.length} items) ===`);
      console.log('Sample items:');
      detailData.items.slice(0, 15).forEach((item: any) => {
        console.log(`  - ${item.name}: ${item.value || '(empty)'} ${item.unit || ''}`);
      });

      // Show all unique field names
      const allFieldNames = new Set(detailData.items.map((i: any) => i.name));
      console.log(`\n📋 ALL UNIQUE FIELD NAMES (${allFieldNames.size} total):`);
      Array.from(allFieldNames).sort().forEach((name: any) => {
        console.log(`  - ${name}`);
      });
    }

    // Analyze for Tier II Czech-specific fields
    console.log('\n=== TIER II FIELD EXTRACTION OPPORTUNITIES ===');

    const czechFields = {
      disposition: findItemValue(detailData.items, 'Dispozice'),
      ownership: findItemValue(detailData.items, 'Vlastnictví'),
      heating: findItemValue(detailData.items, 'Vytápění', 'Vytopeni'),
      condition: findItemValue(detailData.items, 'Stav objektu'),
      construction_type: findItemValue(detailData.items, 'Typ budovy', 'Stavba'),
      energy_class: findItemValue(detailData.items, 'Třída PENB', 'Energetická náročnost budovy'),
      floor: findItemValue(detailData.items, 'Podlaží'),
      furnished: findItemValue(detailData.items, 'Vybavení')
    };

    console.log('Czech-specific fields found:');
    Object.entries(czechFields).forEach(([key, value]) => {
      console.log(`  ${key}: ${value || '(not found)'}`);
    });

    // Analyze for Tier III portal metadata
    console.log('\n=== TIER III PORTAL METADATA ===');
    const portalMetadata = {
      hash_id: detailData.hash_id,
      name: detailData.name?.value,
      locality: detailData.locality?.value,
      price_czk: detailData.price_czk?.value_raw,
      advert_images_count: detailData.advert_images_count,
      category_main_cb: detailData.seo?.category_main_cb,
      category_type_cb: detailData.seo?.category_type_cb,
      has_images: !!detailData._links?.images,
      gps_lat: detailData.gps?.lat || detailData.map?.lat,
      gps_lon: detailData.gps?.lon || detailData.map?.lon
    };

    console.log('Portal metadata available:');
    Object.entries(portalMetadata).forEach(([key, value]) => {
      console.log(`  ${key}: ${JSON.stringify(value)}`);
    });

    // Sample complete detail response (truncated)
    console.log('\n=== SAMPLE DETAIL RESPONSE (first 2500 chars) ===');
    console.log(JSON.stringify(detailData, null, 2).substring(0, 2500));
    console.log('...\n');

    // Field extraction summary
    console.log('\n=== EXTRACTION SUMMARY ===');
    console.log('✅ Tier I (Global): Available in list endpoint (title, price, sqm, location)');
    console.log('✅ Tier I (Rooms/Bedrooms): Extract from Dispozice in detail endpoint');
    console.log('✅ Tier II (Czech): Extract from items array in detail endpoint');
    console.log('   - disposition (Dispozice)');
    console.log('   - ownership (Vlastnictví)');
    console.log('   - heating_type (Vytápění)');
    console.log('   - condition (Stav objektu)');
    console.log('   - construction_type (Typ budovy)');
    console.log('   - energy_class (Třída PENB)');
    console.log('   - furnished (Vybavení)');
    console.log('✅ Tier III (Portal): Available in both endpoints');
    console.log('   - hash_id, locality, price_czk, images, gps, category codes');

  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : error);
    if (axios.isAxiosError(error)) {
      console.error('Response status:', error.response?.status);
      console.error('Response data:', JSON.stringify(error.response?.data).substring(0, 500));
    }
  }
}

/**
 * Find item value from items array by field name(s)
 */
function findItemValue(items: any[] = [], ...fieldNames: string[]): string | undefined {
  for (const fieldName of fieldNames) {
    const item = items.find(i => i.name === fieldName);
    if (item?.value) {
      return typeof item.value === 'object' ? JSON.stringify(item.value) : String(item.value);
    }
  }
  return undefined;
}

// Run analysis
analyzeRealData();
