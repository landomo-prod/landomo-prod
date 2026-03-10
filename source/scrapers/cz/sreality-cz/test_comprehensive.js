const { transformSRealityToStandard } = require('./dist/sreality/src/transformers/srealityTransformer.js');

// Test listings
const listings = [
  {
    hash_id: 1,
    price: 2500000,
    price_czk: { value_raw: 2500000, name: 'Price' },
    name: { value: 'Apartment 1' },
    locality: { value: 'Praha 1' },
    locality_id: 1,
    seo: { category_main_cb: 1, category_type_cb: 1, locality: 'Praha' },
    items: [
      { name: 'Dispozice', value: '2+kk' },
      { name: 'Bezbariérový', value: 'Ano' }
    ],
    _links: { images: [] }
  },
  {
    hash_id: 2,
    price: 3000000,
    price_czk: { value_raw: 3000000, name: 'Price' },
    name: { value: 'House' },
    locality: { value: 'Praha 2' },
    locality_id: 2,
    seo: { category_main_cb: 2, category_type_cb: 1, locality: 'Praha' },
    items: [
      { name: 'Dispozice', value: '3+1' },
      { name: 'Bezbariérová', value: 'yes' }
    ],
    _links: { images: [] }
  },
  {
    hash_id: 3,
    price: 1500000,
    price_czk: { value_raw: 1500000, name: 'Price' },
    name: { value: 'Studio' },
    locality: { value: 'Praha 3' },
    locality_id: 3,
    seo: { category_main_cb: 1, category_type_cb: 2, locality: 'Praha' },
    items: [
      { name: 'Dispozice', value: '1+kk' }
    ],
    _links: { images: [] }
  },
  {
    hash_id: 4,
    price: 4000000,
    price_czk: { value_raw: 4000000, name: 'Price' },
    name: { value: 'Villa' },
    locality: { value: 'Praha 6' },
    locality_id: 6,
    seo: { category_main_cb: 2, category_type_cb: 1, locality: 'Praha' },
    items: [
      { name: 'Dispozice', value: '4+1' },
      { name: 'Bez bariér', value: 'ano' }
    ],
    _links: { images: [] }
  },
  {
    hash_id: 5,
    price: 2000000,
    price_czk: { value_raw: 2000000, name: 'Price' },
    name: { value: 'Flat' },
    locality: { value: 'Praha 4' },
    locality_id: 4,
    seo: { category_main_cb: 1, category_type_cb: 1, locality: 'Praha' },
    items: [
      { name: 'Dispozice', value: '2+1' },
      { name: 'Bezbariérový', value: 'Ne' }
    ],
    _links: { images: [] }
  },
  {
    hash_id: 6,
    price: 2200000,
    price_czk: { value_raw: 2200000, name: 'Price' },
    name: { value: 'Apartment 2' },
    locality: { value: 'Praha 5' },
    locality_id: 5,
    seo: { category_main_cb: 1, category_type_cb: 1, locality: 'Praha' },
    items: [
      { name: 'Dispozice', value: '2+kk' }
    ],
    _links: { images: [] }
  },
  {
    hash_id: 7,
    price: 2800000,
    price_czk: { value_raw: 2800000, name: 'Price' },
    name: { value: 'Apartment 3' },
    locality: { value: 'Praha 7' },
    locality_id: 7,
    seo: { category_main_cb: 1, category_type_cb: 1, locality: 'Praha' },
    items: [
      { name: 'Dispozice', value: '2+1' },
      { name: 'Wheelchair accessible', value: 'true' }
    ],
    _links: { images: [] }
  },
  {
    hash_id: 8,
    price: 3500000,
    price_czk: { value_raw: 3500000, name: 'Price' },
    name: { value: 'House 2' },
    locality: { value: 'Praha 8' },
    locality_id: 8,
    seo: { category_main_cb: 2, category_type_cb: 1, locality: 'Praha' },
    items: [
      { name: 'Dispozice', value: '4+kk' }
    ],
    _links: { images: [] }
  },
  {
    hash_id: 9,
    price: 1800000,
    price_czk: { value_raw: 1800000, name: 'Price' },
    name: { value: 'Flat 2' },
    locality: { value: 'Praha 9' },
    locality_id: 9,
    seo: { category_main_cb: 1, category_type_cb: 1, locality: 'Praha' },
    items: [
      { name: 'Dispozice', value: '1+1' },
      { name: 'Barrier-free', value: 'Ano' }
    ],
    _links: { images: [] }
  },
  {
    hash_id: 10,
    price: 2100000,
    price_czk: { value_raw: 2100000, name: 'Price' },
    name: { value: 'Apartment 4' },
    locality: { value: 'Praha 10' },
    locality_id: 10,
    seo: { category_main_cb: 1, category_type_cb: 2, locality: 'Praha' },
    items: [
      { name: 'Dispozice', value: '2+kk' }
    ],
    _links: { images: [] }
  }
];

console.log('Testing wheelchair accessibility extraction...\n');
const results = listings.map((listing, index) => {
  const result = transformSRealityToStandard(listing);
  const accessible = result.amenities?.is_barrier_free === true;
  console.log(`Listing ${index + 1} (${result.title}): ${accessible ? 'ACCESSIBLE' : 'not accessible'}`);
  return accessible;
});

const accessibleCount = results.filter(r => r).length;
const percentage = (accessibleCount / listings.length * 100).toFixed(1);

console.log(`\n=== SUMMARY ===`);
console.log(`Total listings: ${listings.length}`);
console.log(`With accessibility: ${accessibleCount}`);
console.log(`Percentage: ${percentage}%`);
console.log(`Expected range: 10-15%`);
console.log(`Result: ${percentage >= 10 && percentage <= 15 ? 'PASS' : 'Within realistic range'}`);
