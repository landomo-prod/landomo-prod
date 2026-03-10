/**
 * Test house transformation with FULL detail data (not preview)
 */

const axios = require('axios');
const { transformSRealityToStandard } = require('./dist/sreality/src/transformers/srealityTransformer');

async function testHouseDetailTransform() {
  console.log('🏡 Testing House Transform with Full Detail Data\n');

  // Fetch full detail for a house
  const hashId = 3699618380;
  const detailUrl = `https://www.sreality.cz/api/cs/v2/estates/${hashId}`;

  console.log(`📥 Fetching full detail for listing ${hashId}...`);

  const response = await axios.get(detailUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
    }
  });

  const detail = response.data;
  console.log(`✅ Detail fetched (has items: ${!!detail.items}, count: ${detail.items?.length || 0})\n`);

  // Transform using the actual transformer
  console.log('🔄 Transforming with houseTransformer...\n');
  const transformed = transformSRealityToStandard(detail);

  console.log('📋 Transformed House Data:\n');
  console.log('  Category:', transformed.property_category);
  console.log('  Portal ID:', transformed.portal_id);
  console.log('  Title:', transformed.title.substring(0, 60) + '...');
  console.log('  Price:', transformed.price, transformed.currency);
  console.log('');
  console.log('  🏠 House-Specific Fields:');
  console.log('  - Bedrooms:', transformed.bedrooms);
  console.log('  - Living Area (sqm_living):', transformed.sqm_living, 'm²');
  console.log('  - Total Area (sqm_total):', transformed.sqm_total, 'm²');
  console.log('  - 🎯 PLOT SIZE (sqm_plot):', transformed.sqm_plot, 'm²', transformed.sqm_plot > 0 ? '✅' : '❌');
  console.log('  - Stories:', transformed.stories);
  console.log('');
  console.log('  🏡 Amenities:');
  console.log('  - Garden:', transformed.has_garden);
  console.log('  - Garage:', transformed.has_garage);
  console.log('  - Parking:', transformed.has_parking, `(${transformed.parking_spaces} spaces)`);
  console.log('  - Basement:', transformed.has_basement);
  console.log('  - Pool:', transformed.has_pool);

  console.log('\n' + '='.repeat(60));
  if (transformed.sqm_plot && transformed.sqm_plot > 0) {
    console.log('✅ SUCCESS: Plot size extracted correctly!');
    console.log(`   Plot Size: ${transformed.sqm_plot.toLocaleString()} m²`);
    console.log('   The transformer works correctly with full detail data.');
  } else {
    console.log('❌ FAILED: Plot size not extracted');
    console.log('   Expected: 9319 m²');
    console.log('   Got:', transformed.sqm_plot);
  }
  console.log('='.repeat(60));
}

testHouseDetailTransform().catch(error => {
  console.error('❌ Error:', error.message);
  console.error(error.stack);
  process.exit(1);
});
