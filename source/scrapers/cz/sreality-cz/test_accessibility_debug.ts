import { transformSRealityToStandard } from './src/transformers/srealityTransformer';
import { SRealityListing } from './src/types/srealityTypes';

// Test with accessibility info
const testListing: SRealityListing = {
  hash_id: 1,
  price: 2500000,
  price_czk: { value_raw: 2500000, name: 'Price' },
  name: { value: 'Test Apartment' },
  locality: { value: 'Praha 1' },
  locality_id: 1,
  seo: { category_main_cb: 1, category_type_cb: 1, locality: 'Praha' },
  items: [
    { name: 'Dispozice', value: '2+kk' },
    { name: 'Bezbariérový', value: 'Ano' }
  ],
  _links: { images: [] }
};

console.log('Input items:', JSON.stringify(testListing.items, null, 2));

const result = transformSRealityToStandard(testListing);

console.log('\nResult amenities:', result.amenities);
console.log('\nis_barrier_free:', result.amenities?.is_barrier_free);
