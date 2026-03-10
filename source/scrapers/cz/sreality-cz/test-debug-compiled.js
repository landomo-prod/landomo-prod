/**
 * Debug transformer output using compiled JS (no ts-node caching issues)
 */

const { fetchAllListingPages } = require('./dist/sreality/src/utils/fetchData');
const { transformSRealityToStandard } = require('./dist/sreality/src/transformers/srealityTransformer');

async function debugTransform() {
  console.log('🔍 Debugging Transformer Output (Compiled JS)\n');

  // Fetch one listing
  console.log('📥 Fetching 1 apartment listing...');
  const listings = await fetchAllListingPages(1, 1, 1);

  if (listings.length === 0) {
    console.error('❌ No listings fetched');
    process.exit(1);
  }

  const listing = listings[0];

  console.log('\n📄 Raw Listing Input:');
  console.log('  - hash_id:', listing.hash_id);
  console.log('  - name:', listing.name);
  console.log('  - price:', listing.price);
  console.log('  - category_main_cb:', listing.seo?.category_main_cb);
  console.log('  - Has items:', !!listing.items);
  console.log('  - Items count:', listing.items?.length);

  console.log('\n🔄 Calling transformSRealityToStandard...');
  const transformed = transformSRealityToStandard(listing);

  console.log('\n📋 Transformed Output:');
  console.log('  - Type:', typeof transformed);
  console.log('  - Keys:', Object.keys(transformed).length);
  console.log('\nFirst 20 keys:');
  console.log(Object.keys(transformed).slice(0, 20).join(', '));

  console.log('\n🔍 Critical Fields Check:');
  console.log('  - property_category:', transformed.property_category);
  console.log('  - property_type:', transformed.property_type);  // Old field (should not exist)
  console.log('  - portal_id:', transformed.portal_id);
  console.log('  - bedrooms:', transformed.bedrooms);
  console.log('  - sqm:', transformed.sqm);
  console.log('  - price:', transformed.price);
  console.log('  - status:', transformed.status);
  console.log('  - has_elevator:', transformed.has_elevator);
  console.log('  - has_balcony:', transformed.has_balcony);
  console.log('  - has_parking:', transformed.has_parking);
  console.log('  - has_basement:', transformed.has_basement);

  console.log('\n📍 Location:');
  console.log('  - city:', transformed.location?.city);
  console.log('  - country:', transformed.location?.country);
  console.log('  - lat/lon:', transformed.location?.coordinates?.lat, '/', transformed.location?.coordinates?.lon);

  console.log('\n📦 Portal Metadata:');
  console.log('  - Has sreality metadata:', !!transformed.portal_metadata?.sreality);
  console.log('  - hash_id in metadata:', transformed.portal_metadata?.sreality?.hash_id);

  console.log('\n✅ Field Validation:');
  const validations = {
    hasPropertyCategory: !!transformed.property_category,
    hasPortalId: !!transformed.portal_id,
    hasBedrooms: transformed.bedrooms !== undefined && transformed.bedrooms !== null,
    hasSqm: transformed.sqm !== undefined && transformed.sqm !== null && transformed.sqm > 0,
    hasPrice: !!transformed.price,
    hasStatus: !!transformed.status,
    hasLocation: !!transformed.location,
    hasHashId: !!(transformed.portal_metadata?.sreality?.hash_id)
  };

  Object.entries(validations).forEach(([key, value]) => {
    console.log(`  - ${key}: ${value ? '✅' : '❌'}`);
  });

  const passCount = Object.values(validations).filter(Boolean).length;
  const totalCount = Object.keys(validations).length;

  console.log(`\n📊 Overall: ${passCount}/${totalCount} validations passed (${Math.round(passCount/totalCount*100)}%)`);

  if (passCount === totalCount) {
    console.log('\n🎉 SUCCESS: All critical fields present!');
    process.exit(0);
  } else {
    console.log('\n⚠️  WARNING: Some critical fields missing');
    process.exit(1);
  }
}

debugTransform().catch(error => {
  console.error('❌ Error:', error.message);
  console.error('Stack:', error.stack);
  process.exit(1);
});
