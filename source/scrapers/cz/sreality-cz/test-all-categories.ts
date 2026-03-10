import axios from 'axios';
import { transformSRealityToStandard } from './src/transformers/srealityTransformer';

/**
 * Test all three category transformers (apartment, house, land) with real API data
 * Verify Tier II and III fields are populated correctly for each category
 */
async function testAllCategories() {
  const userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36';

  console.log('=== SREALITY.CZ ALL CATEGORIES TEST ===\n');

  // Test configurations for each category
  const categories = [
    { name: 'Apartments', main_cb: 1, sub_cb: 2, label: 'apartment' },
    { name: 'Houses', main_cb: 2, sub_cb: 7, label: 'house' },
    { name: 'Land', main_cb: 3, sub_cb: 18, label: 'land' }
  ];

  for (const category of categories) {
    try {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`Testing: ${category.name}`);
      console.log('='.repeat(60));

      // Fetch listing from category
      const tms = Date.now();
      const listUrl = `https://www.sreality.cz/api/cs/v2/estates?page=1&per_page=1&category_main_cb=${category.main_cb}&tms=${tms}`;
      const listResponse = await axios.get(listUrl, {
        headers: { 'User-Agent': userAgent },
        timeout: 15000
      });

      const listing = listResponse.data._embedded?.estates?.[0];
      if (!listing) {
        console.log(`❌ No ${category.name} listing found\n`);
        continue;
      }

      console.log(`\nFound: ${listing.name?.value || listing.name}`);

      // Fetch detail endpoint
      await new Promise(resolve => setTimeout(resolve, 500));

      const detailUrl = `https://www.sreality.cz/api/cs/v2/estates/${listing.hash_id}`;
      const detailResponse = await axios.get(detailUrl, {
        headers: { 'User-Agent': userAgent },
        timeout: 15000
      });

      // Merge detail data
      const fullListing = {
        ...listing,
        items: detailResponse.data.items || [],
        text: detailResponse.data.text
      };

      console.log(`Items in API: ${fullListing.items?.length || 0}`);

      // Transform
      const transformed = transformSRealityToStandard(fullListing);

      // Verify category
      const actualCategory = (transformed as any).property_category;
      if (actualCategory !== category.label) {
        console.log(`⚠️  Category mismatch: expected ${category.label}, got ${actualCategory}`);
      } else {
        console.log(`✅ Category: ${actualCategory}`);
      }

      // Check Tier I fields
      console.log('\n--- Tier I (Global) ---');
      console.log(`Title: ${transformed.title}`);
      console.log(`Price: ${transformed.price} ${transformed.currency}`);
      console.log(`Location: ${transformed.location.city}`);
      console.log(`Images: ${(transformed as any).images?.length || 0}`);

      // Check category-specific Tier I fields
      if (category.label === 'apartment') {
        console.log(`Bedrooms: ${(transformed as any).bedrooms}`);
        console.log(`SQM: ${(transformed as any).sqm}`);
        console.log(`Floor: ${(transformed as any).floor}`);
      } else if (category.label === 'house') {
        console.log(`Bedrooms: ${(transformed as any).bedrooms}`);
        console.log(`SQM Living: ${(transformed as any).sqm_living}`);
        console.log(`SQM Plot: ${(transformed as any).sqm_plot}`);
      } else if (category.label === 'land') {
        console.log(`Area Plot SQM: ${(transformed as any).area_plot_sqm}`);
        console.log(`Zoning: ${(transformed as any).zoning}`);
      }

      // Check Tier II
      console.log('\n--- Tier II (Czech-Specific) ---');
      const czechData = (transformed as any).country_specific?.czech;
      if (czechData) {
        const populatedFields = Object.keys(czechData).filter(k => czechData[k] != null);
        console.log(`✅ ${populatedFields.length} fields populated:`);
        populatedFields.forEach(field => {
          console.log(`   ${field}: ${czechData[field]}`);
        });
      } else {
        console.log('❌ No country_specific.czech data found');
      }

      // Check Tier III
      console.log('\n--- Tier III (Portal Metadata) ---');
      const portalData = (transformed as any).portal_metadata?.sreality;
      if (portalData) {
        const populatedFields = Object.keys(portalData).filter(k => portalData[k] != null);
        console.log(`✅ ${populatedFields.length}/15 fields populated`);
        console.log(`   Hash ID: ${portalData.hash_id}`);
        console.log(`   Locality: ${portalData.locality}`);
        console.log(`   Labels: ${portalData.labels?.length || 0}`);
      } else {
        console.log('❌ No portal_metadata.sreality data found');
      }

    } catch (error) {
      console.error(`❌ Error testing ${category.name}:`, error instanceof Error ? error.message : error);
    }

    // Wait between requests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log('\n' + '='.repeat(60));
  console.log('✅ All categories tested');
  console.log('='.repeat(60));
}

testAllCategories();
