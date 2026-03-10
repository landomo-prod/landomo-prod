/**
 * Debug transformer output to see what's actually being returned
 */

import { fetchAllListingPages } from './src/utils/fetchData';
import { transformSRealityToStandard } from './src/transformers/srealityTransformer';

async function debugTransform() {
  console.log('🔍 Debugging Transformer Output\n');

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
  console.log('\nFull object:');
  console.log(JSON.stringify(transformed, null, 2));

  console.log('\n🔍 Critical Fields Check:');
  const t = transformed as any;
  console.log('  - property_category:', t.property_category);
  console.log('  - portal_id:', t.portal_id);
  console.log('  - bedrooms:', t.bedrooms);
  console.log('  - sqm:', t.sqm);
  console.log('  - price:', t.price);
  console.log('  - status:', t.status);
}

debugTransform().catch(error => {
  console.error('❌ Error:', error);
  console.error('Stack:', error.stack);
  process.exit(1);
});
