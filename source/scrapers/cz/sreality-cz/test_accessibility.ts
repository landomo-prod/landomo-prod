import { transformSRealityToStandard } from './src/transformers/srealityTransformer';
import { SRealityListing } from './src/types/srealityTypes';

// Test 1: Listing with accessibility amenity marked "Ano"
const testListing1: SRealityListing = {
  hash_id: 1,
  price: 2500000,
  price_czk: { value_raw: 2500000, name: 'Price' },
  name: { value: 'Test Apartment' },
  locality: { value: 'Praha 1, Staré Město' },
  locality_id: 1,
  seo: { category_main_cb: 1, category_type_cb: 1, locality: 'Praha' },
  items: [
    { name: 'Dispozice', value: '2+kk' },
    { name: 'Užitná plocha', value: '55 m²' },
    { name: 'Bezbariérový', value: 'Ano' }
  ],
  _links: { images: [] }
};

// Test 2: Listing with "Bezbariérová" variant
const testListing2: SRealityListing = {
  hash_id: 2,
  price: 3000000,
  price_czk: { value_raw: 3000000, name: 'Price' },
  name: { value: 'Test House' },
  locality: { value: 'Praha 2, Vinohrady' },
  locality_id: 2,
  seo: { category_main_cb: 2, category_type_cb: 1, locality: 'Praha' },
  items: [
    { name: 'Dispozice', value: '3+1' },
    { name: 'Užitná plocha', value: '100 m²' },
    { name: 'Bezbariérová', value: 'yes' }
  ],
  _links: { images: [] }
};

// Test 3: Listing without accessibility info
const testListing3: SRealityListing = {
  hash_id: 3,
  price: 1500000,
  price_czk: { value_raw: 1500000, name: 'Price' },
  name: { value: 'Test Studio' },
  locality: { value: 'Praha 3, Žižkov' },
  locality_id: 3,
  seo: { category_main_cb: 1, category_type_cb: 2, locality: 'Praha' },
  items: [
    { name: 'Dispozice', value: '1+kk' },
    { name: 'Užitná plocha', value: '30 m²' }
  ],
  _links: { images: [] }
};

// Test 4: Listing with "Bez bariér" (barrier-free) term
const testListing4: SRealityListing = {
  hash_id: 4,
  price: 4000000,
  price_czk: { value_raw: 4000000, name: 'Price' },
  name: { value: 'Test Villa' },
  locality: { value: 'Praha 6, Bubeneč' },
  locality_id: 6,
  seo: { category_main_cb: 2, category_type_cb: 1, locality: 'Praha' },
  items: [
    { name: 'Dispozice', value: '4+1' },
    { name: 'Užitná plocha', value: '150 m²' },
    { name: 'Bez bariér', value: 'ano' }
  ],
  _links: { images: [] }
};

// Test 5: Listing with accessibility marked as "Ne" (No)
const testListing5: SRealityListing = {
  hash_id: 5,
  price: 2000000,
  price_czk: { value_raw: 2000000, name: 'Price' },
  name: { value: 'Test Flat' },
  locality: { value: 'Praha 4, Nusle' },
  locality_id: 4,
  seo: { category_main_cb: 1, category_type_cb: 1, locality: 'Praha' },
  items: [
    { name: 'Dispozice', value: '2+1' },
    { name: 'Užitná plocha', value: '65 m²' },
    { name: 'Bezbariérový', value: 'Ne' }
  ],
  _links: { images: [] }
};

console.log('Testing wheelchair accessibility extraction...\n');

const result1 = transformSRealityToStandard(testListing1);
console.log(`Test 1 - "Bezbariérový: Ano"`);
console.log(`  is_barrier_free: ${result1.amenities?.is_barrier_free}`);
console.log(`  Expected: true\n`);

const result2 = transformSRealityToStandard(testListing2);
console.log(`Test 2 - "Bezbariérová: yes"`);
console.log(`  is_barrier_free: ${result2.amenities?.is_barrier_free}`);
console.log(`  Expected: true\n`);

const result3 = transformSRealityToStandard(testListing3);
console.log(`Test 3 - No accessibility info`);
console.log(`  is_barrier_free: ${result3.amenities?.is_barrier_free}`);
console.log(`  Expected: undefined\n`);

const result4 = transformSRealityToStandard(testListing4);
console.log(`Test 4 - "Bez bariér: ano"`);
console.log(`  is_barrier_free: ${result4.amenities?.is_barrier_free}`);
console.log(`  Expected: true\n`);

const result5 = transformSRealityToStandard(testListing5);
console.log(`Test 5 - "Bezbariérový: Ne"`);
console.log(`  is_barrier_free: ${result5.amenities?.is_barrier_free}`);
console.log(`  Expected: undefined\n`);

// Summary
const listings = [testListing1, testListing2, testListing3, testListing4, testListing5];
const transformed = listings.map(l => transformSRealityToStandard(l));
const withAccessibility = transformed.filter(t => t.amenities?.is_barrier_free === true).length;

console.log(`\n=== SUMMARY ===`);
console.log(`Total listings tested: ${listings.length}`);
console.log(`Listings with accessibility: ${withAccessibility}`);
console.log(`Percentage with accessibility: ${(withAccessibility / listings.length * 100).toFixed(1)}%`);
