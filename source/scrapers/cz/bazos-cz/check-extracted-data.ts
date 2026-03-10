/**
 * Check data quality of extracted properties
 */

import dotenv from 'dotenv';
dotenv.config();

import { getExtractionCache } from './src/services/extractionCache';

async function checkDataQuality() {
  console.log('\n🔍 Checking Extracted Data Quality\n');

  const cache = getExtractionCache();

  // The 4 listings that completed
  const listingIds = ['214875342', '214816682', '214734585', '214127455'];

  for (const id of listingIds) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📋 Listing: ${id}`);
    console.log('='.repeat(60));

    try {
      // Try to get from cache (pass empty string for text since we're just reading)
      const cached = await cache.get('bazos', id, '');

      if (!cached) {
        console.log('❌ Not found in cache');
        continue;
      }

      const data = cached as any;

      console.log('\n📊 Core Fields:');
      console.log(`  Property Type: ${data.property_type || 'MISSING'}`);
      console.log(`  Transaction: ${data.transaction_type || 'MISSING'}`);
      console.log(`  Price: ${data.price || 'MISSING'}`);
      console.log(`  Price Note: ${data.price_note || 'none'}`);

      console.log('\n📍 Location:');
      if (data.location) {
        console.log(`  City: ${data.location.city || 'MISSING'}`);
        console.log(`  Street: ${data.location.street || 'none'}`);
        console.log(`  Region: ${data.location.region || 'none'}`);
        console.log(`  Postal Code: ${data.location.postal_code || 'none'}`);
      } else {
        console.log('  ❌ NO LOCATION DATA');
      }

      console.log('\n🏠 Property Details:');
      if (data.details) {
        console.log(`  Bedrooms: ${data.details.bedrooms ?? 'none'}`);
        console.log(`  Bathrooms: ${data.details.bathrooms ?? 'none'}`);
        console.log(`  Area (sqm): ${data.details.area_sqm ?? 'none'}`);
        console.log(`  Floor: ${data.details.floor ?? 'none'}`);
        console.log(`  Total Floors: ${data.details.total_floors ?? 'none'}`);
        console.log(`  Rooms: ${data.details.rooms ?? 'none'}`);
      } else {
        console.log('  ⚠️ No details object');
      }

      console.log('\n🇨🇿 Czech-Specific:');
      if (data.czech_specific) {
        console.log(`  Disposition: ${data.czech_specific.disposition || 'none'}`);
        console.log(`  Ownership: ${data.czech_specific.ownership || 'none'}`);
        console.log(`  Condition: ${data.czech_specific.condition || 'none'}`);
        console.log(`  Furnished: ${data.czech_specific.furnished || 'none'}`);
      } else {
        console.log('  ⚠️ No czech_specific object');
      }

      console.log('\n🎯 Amenities:');
      if (data.amenities && Object.keys(data.amenities).length > 0) {
        Object.entries(data.amenities).forEach(([key, value]) => {
          if (value === true) console.log(`  ✓ ${key}`);
        });
      } else {
        console.log('  none');
      }

    } catch (error: any) {
      console.error(`❌ Error reading ${id}:`, error.message);
    }
  }

  console.log(`\n${'='.repeat(60)}\n`);
  console.log('✅ Data quality check complete\n');
  process.exit(0);
}

checkDataQuality().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
