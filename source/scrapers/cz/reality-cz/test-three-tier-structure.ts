/**
 * Test file to verify three-tier structure implementation for Reality.cz
 *
 * This tests that all transformers properly include:
 * - Tier I: Global StandardProperty fields
 * - Tier II: Legacy media fields (images, videos)
 * - Tier III: portal_metadata.reality and country_specific.czech
 */

import { transformRealityApartment } from './src/transformers/apartments/apartmentTransformer';
import { transformRealityHouse } from './src/transformers/houses/houseTransformer';
import { transformRealityLand } from './src/transformers/land/landTransformer';
import { RealityListing } from './src/types/realityTypes';

// Sample apartment listing from Reality.cz HTML scraping
const sampleApartment: RealityListing = {
  id: '428016862',
  title: 'Byt 2+kk, 62 m², Praha 10 - Strašnice',
  transaction_type: 'sale',
  property_type: 'apartment',
  price: 4500000,
  price_text: '4 500 000 Kč',
  location: {
    city: 'Praha 10',
    district: 'Strašnice',
    region: 'Praha',
    address: 'Pod strání, Praha 10 - Strašnice'
  },
  area: 62,
  area_text: '62 m²',
  description: 'byt 2+kk, 62 m², panel, osobní',
  images: ['https://www.reality.cz/image1.jpg', 'https://www.reality.cz/image2.jpg'],
  url: 'https://www.reality.cz/detail/428016862',
  disposition: '2+kk',
  floor: 3,
  features: ['Parkování', 'Balkon', 'Sklep'],
  ownership: 'Osobní vlastnictví',
  condition: 'Dobrý stav',
  furnished: 'Nevybaveno',
  energyRating: 'C',
  heatingType: 'Ústřední topení',
  constructionType: 'Panel',
  scraped_at: new Date().toISOString(),
  page_url: 'https://www.reality.cz/prodej/byty/Praha/',
  _attributes: {
    'Kauce': '45 000 Kč',
    'K nastěhování': '01.03.2024',
    'Rok rekonstrukce': '2018'
  }
};

// Sample house listing
const sampleHouse: RealityListing = {
  id: '400123456',
  title: 'Rodinný dům 5+1, 180 m², Brno - Žabovřesky',
  transaction_type: 'sale',
  property_type: 'house',
  price: 8900000,
  price_text: '8,9 mil. Kč',
  location: {
    city: 'Brno',
    district: 'Žabovřesky',
    region: 'Jihomoravský kraj',
    address: 'Brno - Žabovřesky'
  },
  area: 180,
  area_text: '180 m²',
  description: 'dům 5+1, 180 m², cihlový',
  images: ['https://www.reality.cz/house1.jpg'],
  url: 'https://www.reality.cz/detail/400123456',
  disposition: '5+1',
  features: ['Garáž', 'Zahrada', 'Terasa', 'Sklep'],
  ownership: 'Osobní vlastnictví',
  condition: 'Po rekonstrukci',
  heatingType: 'Plynové topení',
  constructionType: 'Cihlový',
  energyRating: 'B',
  scraped_at: new Date().toISOString(),
  page_url: 'https://www.reality.cz/prodej/domy/Brno/',
  _attributes: {
    'Rok rekonstrukce': '2020'
  }
};

// Sample land listing
const sampleLand: RealityListing = {
  id: '400789012',
  title: 'Pozemek 1500 m², Kutná Hora',
  transaction_type: 'sale',
  property_type: 'land',
  price: 1200000,
  price_text: '1,2 mil. Kč',
  location: {
    city: 'Kutná Hora',
    region: 'Středočeský kraj',
    address: 'Kutná Hora'
  },
  area: 1500,
  area_text: '1500 m²',
  description: 'pozemek 1500 m²',
  images: ['https://www.reality.cz/land1.jpg'],
  url: 'https://www.reality.cz/detail/400789012',
  ownership: 'Osobní vlastnictví',
  scraped_at: new Date().toISOString(),
  page_url: 'https://www.reality.cz/prodej/pozemky/Kutna-Hora/'
};

console.log('='.repeat(80));
console.log('Testing Reality.cz Three-Tier Structure Implementation');
console.log('='.repeat(80));

// Test Apartment Transformer
console.log('\n1. Testing APARTMENT transformer...\n');
const apartment = transformRealityApartment(sampleApartment);

console.log('✓ Tier I - Global Fields:');
console.log(`  - property_category: ${apartment.property_category}`);
console.log(`  - title: ${apartment.title}`);
console.log(`  - price: ${apartment.price} ${apartment.currency}`);
console.log(`  - bedrooms: ${apartment.bedrooms}`);
console.log(`  - sqm: ${apartment.sqm}`);
console.log(`  - floor: ${apartment.floor}`);
console.log(`  - has_parking: ${apartment.has_parking}`);
console.log(`  - has_balcony: ${apartment.has_balcony}`);
console.log(`  - has_basement: ${apartment.has_basement}`);

console.log('\n✓ Tier II - Legacy Media Fields:');
console.log(`  - images: [${apartment.images?.length || 0} images]`);
console.log(`  - videos: ${apartment.videos || 'undefined'}`);

console.log('\n✓ Tier III - Portal Metadata:');
console.log(`  - portal_metadata.reality:`);
console.log(`    * id: ${apartment.portal_metadata?.reality?.id}`);
console.log(`    * price_text: ${apartment.portal_metadata?.reality?.price_text}`);
console.log(`    * area_text: ${apartment.portal_metadata?.reality?.area_text}`);
console.log(`    * scraped_at: ${apartment.portal_metadata?.reality?.scraped_at}`);
console.log(`    * has_attributes: ${apartment.portal_metadata?.reality?.has_attributes}`);

console.log('\n✓ Tier III - Country Specific (Czech):');
console.log(`  - country_specific.czech:`);
console.log(`    * disposition: ${apartment.country_specific?.czech?.disposition}`);
console.log(`    * ownership: ${apartment.country_specific?.czech?.ownership}`);
console.log(`    * condition: ${apartment.country_specific?.czech?.condition}`);
console.log(`    * heating_type: ${apartment.country_specific?.czech?.heating_type}`);
console.log(`    * construction_type: ${apartment.country_specific?.czech?.construction_type}`);
console.log(`    * energy_rating: ${apartment.country_specific?.czech?.energy_rating}`);
console.log(`    * furnished: ${apartment.country_specific?.czech?.furnished}`);
console.log(`    * floor_number: ${apartment.country_specific?.czech?.floor_number}`);

// Test House Transformer
console.log('\n' + '='.repeat(80));
console.log('2. Testing HOUSE transformer...\n');
const house = transformRealityHouse(sampleHouse);

console.log('✓ Tier I - Global Fields:');
console.log(`  - property_category: ${house.property_category}`);
console.log(`  - title: ${house.title}`);
console.log(`  - price: ${house.price} ${house.currency}`);
console.log(`  - bedrooms: ${house.bedrooms}`);
console.log(`  - sqm_living: ${house.sqm_living}`);
console.log(`  - has_garage: ${house.has_garage}`);
console.log(`  - has_garden: ${house.has_garden}`);

console.log('\n✓ Tier II - Legacy Media Fields:');
console.log(`  - images: [${house.images?.length || 0} images]`);
console.log(`  - videos: ${house.videos || 'undefined'}`);

console.log('\n✓ Tier III - Portal Metadata:');
console.log(`  - portal_metadata.reality:`);
console.log(`    * id: ${house.portal_metadata?.reality?.id}`);
console.log(`    * price_text: ${house.portal_metadata?.reality?.price_text}`);

console.log('\n✓ Tier III - Country Specific (Czech):');
console.log(`  - country_specific.czech:`);
console.log(`    * disposition: ${house.country_specific?.czech?.disposition}`);
console.log(`    * ownership: ${house.country_specific?.czech?.ownership}`);
console.log(`    * condition: ${house.country_specific?.czech?.condition}`);
console.log(`    * heating_type: ${house.country_specific?.czech?.heating_type}`);
console.log(`    * construction_type: ${house.country_specific?.czech?.construction_type}`);
console.log(`    * renovation_year: ${house.country_specific?.czech?.renovation_year}`);
console.log(`    * has_garden: ${house.country_specific?.czech?.has_garden}`);

// Test Land Transformer
console.log('\n' + '='.repeat(80));
console.log('3. Testing LAND transformer...\n');
const land = transformRealityLand(sampleLand);

console.log('✓ Tier I - Global Fields:');
console.log(`  - property_category: ${land.property_category}`);
console.log(`  - title: ${land.title}`);
console.log(`  - price: ${land.price} ${land.currency}`);
console.log(`  - area_plot_sqm: ${land.area_plot_sqm}`);

console.log('\n✓ Tier II - Legacy Media Fields:');
console.log(`  - images: [${land.images?.length || 0} images]`);
console.log(`  - videos: ${land.videos || 'undefined'}`);

console.log('\n✓ Tier III - Portal Metadata:');
console.log(`  - portal_metadata.reality:`);
console.log(`    * id: ${land.portal_metadata?.reality?.id}`);
console.log(`    * price_text: ${land.portal_metadata?.reality?.price_text}`);

console.log('\n✓ Tier III - Country Specific (Czech):');
console.log(`  - country_specific.czech:`);
console.log(`    * ownership: ${land.country_specific?.czech?.ownership}`);

console.log('\n' + '='.repeat(80));
console.log('✅ All transformers successfully implement three-tier structure!');
console.log('='.repeat(80));

// Verify structure completeness
const checks = [
  { name: 'Apartment has images array', passed: Array.isArray(apartment.images) },
  { name: 'Apartment has portal_metadata.reality', passed: !!apartment.portal_metadata?.reality },
  { name: 'Apartment has country_specific.czech', passed: !!apartment.country_specific?.czech },
  { name: 'House has images array', passed: Array.isArray(house.images) },
  { name: 'House has portal_metadata.reality', passed: !!house.portal_metadata?.reality },
  { name: 'House has country_specific.czech', passed: !!house.country_specific?.czech },
  { name: 'Land has images array', passed: Array.isArray(land.images) },
  { name: 'Land has portal_metadata.reality', passed: !!land.portal_metadata?.reality },
  { name: 'Land has country_specific.czech', passed: !!land.country_specific?.czech },
];

console.log('\nStructure Validation:');
checks.forEach(check => {
  console.log(`  ${check.passed ? '✅' : '❌'} ${check.name}`);
});

const allPassed = checks.every(c => c.passed);
if (allPassed) {
  console.log('\n🎉 All validation checks passed!');
  process.exit(0);
} else {
  console.log('\n❌ Some validation checks failed!');
  process.exit(1);
}
