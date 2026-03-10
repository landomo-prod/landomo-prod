import { transformSRealityToStandard } from './src/transformers/srealityTransformer';
import { SRealityListing } from './src/types/srealityTypes';

// Test data with all 5 fields
const testListing: SRealityListing = {
  hash_id: 12345,
  name: { value: 'Test Property' },
  locality: { value: 'Praha 1' },
  price_czk: { value_raw: 5000000 },
  seo: {
    category_main_cb: 1,
    category_type_cb: 1,
    locality: 'Praha'
  },
  gps: { lat: 50.08, lon: 14.44 },
  items: [
    // Test Parking (45-55% availability)
    { name: 'Parkování', value: 'Ano' },
    // Test Garage (30-40% availability)
    { name: 'Garáž', value: 'Ano, 1x garáž' },
    // Test Total Area (40-50% availability)
    { name: 'Celková plocha', value: '150 m²' },
    // Test Plot Area (30-40% availability)
    { name: 'Plocha pozemku', value: '500,5 m²' },
    // Test Year Built (15-25% availability)
    { name: 'Rok postavení', value: '1985' },
    // Other fields for context
    { name: 'Dispozice', value: '2+kk' },
    { name: 'Užitná plocha', value: '65 m²' },
    { name: 'Podlaží', value: '3. podlaží' }
  ],
  _links: {
    images: [
      { href: 'https://example.com/image1.jpg' }
    ]
  }
};

const result = transformSRealityToStandard(testListing);

console.log('Phase 1 Field Extraction Test Results:');
console.log('=========================================');
console.log('1. Parking (has_parking):', result.amenities?.has_parking);
console.log('2. Garage (has_garage):', result.amenities?.has_garage);
console.log('3. Total Area:', result.country_specific?.area_total, 'm²');
console.log('4. Plot Area:', result.country_specific?.area_plot, 'm²');
console.log('5. Year Built:', result.country_specific?.year_built);
console.log('');
console.log('Expected enrichment: +25-30% (5 fields)');
console.log('Field Availability Targets:');
console.log('  - Parking: 45-55%');
console.log('  - Garage: 30-40%');
console.log('  - Total Area: 40-50%');
console.log('  - Plot Area: 30-40%');
console.log('  - Year Built: 15-25%');
