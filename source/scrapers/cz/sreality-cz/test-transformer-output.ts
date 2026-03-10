import axios from 'axios';
import { transformSRealityToStandard } from './src/transformers/srealityTransformer';

/**
 * Test the updated transformer with real API data
 * Verify Tier II and III fields are populated correctly
 */
async function testTransformerOutput() {
  const userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36';

  try {
    console.log('=== SREALITY.CZ TRANSFORMER TEST ===\n');

    // Fetch apartment from list endpoint
    const tms = Date.now();
    const listUrl = `https://www.sreality.cz/api/cs/v2/estates?page=1&per_page=1&category_main_cb=1&category_sub_cb=2&tms=${tms}`;
    const listResponse = await axios.get(listUrl, {
      headers: { 'User-Agent': userAgent },
      timeout: 15000
    });

    const listing = listResponse.data._embedded?.estates?.[0];
    if (!listing) {
      console.log('❌ No listing found');
      return;
    }

    console.log(`Found listing: ${listing.name?.value || listing.name}\n`);

    // Fetch detail endpoint to get items array
    await new Promise(resolve => setTimeout(resolve, 500));

    const detailUrl = `https://www.sreality.cz/api/cs/v2/estates/${listing.hash_id}`;
    const detailResponse = await axios.get(detailUrl, {
      headers: { 'User-Agent': userAgent },
      timeout: 15000
    });

    const detailData = detailResponse.data;

    // Merge detail data into listing (transformer expects merged items array)
    const fullListing = {
      ...listing,
      items: detailData.items || [],
      text: detailData.text,
      _links: listing._links || detailData._links
    };

    console.log(`Merged listing has ${fullListing.items?.length || 0} items`);
    console.log(`Category codes: main=${fullListing.seo?.category_main_cb}, sub=${fullListing.seo?.category_sub_cb}, type=${fullListing.seo?.category_type_cb}`);
    console.log(`Sample items:`, fullListing.items.slice(0, 3).map((i: any) => `${i.name}: ${i.value}`).join(', '));
    console.log('');

    // Debug category detection first
    const { detectCategoryFromSreality } = await import('./src/utils/categoryDetection');
    try {
      const category = detectCategoryFromSreality(fullListing);
      console.log(`✅ Category detected: ${category}\n`);
    } catch (error) {
      console.log(`❌ Category detection failed: ${error instanceof Error ? error.message : error}\n`);
    }

    // Transform using updated transformer
    let transformed;
    try {
      transformed = transformSRealityToStandard(fullListing);
      console.log('✅ Transform succeeded, category:', (transformed as any).property_category);
    } catch (error) {
      console.log('❌ Transform failed:', error instanceof Error ? error.message : error);
      throw error;
    }

    console.log('\n=== TRANSFORMATION RESULT ===\n');

    // Tier I Fields
    console.log('--- Tier I (Global) ---');
    console.log(`Title: ${transformed.title}`);
    console.log(`Price: ${transformed.price} ${transformed.currency}`);
    console.log(`Transaction: ${transformed.transaction_type}`);
    console.log(`Location: ${transformed.location.city}, ${transformed.location.country}`);
    console.log(`Bedrooms: ${(transformed as any).bedrooms}`);
    console.log(`Bathrooms: ${(transformed as any).bathrooms}`);
    console.log(`SQM: ${(transformed as any).sqm}`);
    console.log(`Rooms: ${(transformed as any).rooms}`);
    console.log(`Floor: ${(transformed as any).floor}`);
    console.log(`Condition: ${(transformed as any).condition}`);
    console.log(`Construction Type: ${(transformed as any).construction_type}`);
    console.log(`Images: ${(transformed as any).images?.length || 0} images`);

    // Tier II Fields
    console.log('\n--- Tier II (Czech-Specific) ---');
    const czechData = (transformed as any).country_specific?.czech;
    if (czechData) {
      console.log(`Disposition: ${czechData.disposition || '(not found)'}`);
      console.log(`Ownership: ${czechData.ownership || '(not found)'}`);
      console.log(`Condition: ${czechData.condition || '(not found)'}`);
      console.log(`Heating Type: ${czechData.heating_type || '(not found)'}`);
      console.log(`Energy Rating: ${czechData.energy_rating || '(not found)'}`);
      console.log(`Furnished: ${czechData.furnished || '(not found)'}`);
      console.log(`Construction Type: ${czechData.construction_type || '(not found)'}`);
    } else {
      console.log('❌ No country_specific.czech data found');
    }

    // Tier III Fields
    console.log('\n--- Tier III (Portal Metadata) ---');
    const portalData = (transformed as any).portal_metadata?.sreality;
    if (portalData) {
      console.log(`Hash ID: ${portalData.hash_id}`);
      console.log(`Locality: ${portalData.locality}`);
      console.log(`Price CZK: ${portalData.price_czk}`);
      console.log(`Category Codes: ${portalData.category_main_cb}/${portalData.category_sub_cb}/${portalData.category_type_cb}`);
      console.log(`Images Count: ${portalData.advert_images_count}`);
      console.log(`Has Floor Plan: ${portalData.has_floor_plan}`);
      console.log(`Has Video: ${portalData.has_video}`);
      console.log(`Labels: ${portalData.labels?.slice(0, 3).join(', ') || '(none)'}`);
    } else {
      console.log('❌ No portal_metadata.sreality data found');
    }

    // Summary
    console.log('\n=== FIELD POPULATION SUMMARY ===');
    const tier1Fields = ['title', 'price', 'transaction_type', 'bedrooms', 'sqm', 'rooms'];
    const tier1Populated = tier1Fields.filter(f => (transformed as any)[f] != null).length;
    console.log(`✅ Tier I: ${tier1Populated}/${tier1Fields.length} fields populated`);

    const czechFields = czechData ? Object.keys(czechData).filter(k => czechData[k] != null) : [];
    console.log(`✅ Tier II (Czech): ${czechFields.length}/7 fields populated`);
    if (czechFields.length > 0) {
      console.log(`   Fields: ${czechFields.join(', ')}`);
    }

    const portalFields = portalData ? Object.keys(portalData).filter(k => portalData[k] != null) : [];
    console.log(`✅ Tier III (Portal): ${portalFields.length}/12 fields populated`);

  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : error);
    if (axios.isAxiosError(error)) {
      console.error('Response status:', error.response?.status);
    }
  }
}

testTransformerOutput();
