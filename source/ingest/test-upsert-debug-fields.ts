/**
 * Test UPSERT Functions - Debug New Fields
 * Tests if images, videos, portal_metadata, country_specific columns work
 */

import { upsertApartments } from './src/database/bulk-operations';
import { ApartmentPropertyTierI } from '@landomo/core';
import { getCoreDatabase } from './src/database/manager';

async function testUpsertDebugFields() {
  console.log('='.repeat(80));
  console.log('TEST: UPSERT Functions - Debug New Fields');
  console.log('='.repeat(80));
  console.log();

  const testApartment: ApartmentPropertyTierI = {
    source_platform: 'test-debug-fields',
    portal_id: 'debug-test-001',
    source_url: 'https://example.com/debug-test-001',
    title: 'DEBUG TEST: Apartment with New Fields',
    price: 100000,
    currency: 'EUR',
    transaction_type: 'sale' as const,
    status: 'active' as const,

    location: {
      address: '123 Debug Street',
      city: 'Bratislava',
      region: 'Bratislava Region',
      country: 'Slovakia',
      postal_code: '81101',
      coordinates: {
        lat: 48.1486,
        lon: 17.1077
      }
    },

    // Category-specific fields
    bedrooms: 2,
    bathrooms: 1,
    sqm: 65,
    floor: 3,
    total_floors: 8,
    rooms: 3,
    has_elevator: true,
    has_balcony: true,
    balcony_area: 5.5,
    has_parking: true,
    parking_spaces: 1,
    property_subtype: 'flat',
    year_built: 2015,
    construction_type: 'panel',
    condition: 'good',
    heating_type: 'central',
    energy_class: 'B',
    floor_location: 'middle',

    // CRITICAL: These are the new fields we're testing
    images: [
      {
        url: 'https://example.com/images/1.jpg',
        caption: 'Living room',
        order: 1,
        is_primary: true
      },
      {
        url: 'https://example.com/images/2.jpg',
        caption: 'Kitchen',
        order: 2,
        is_primary: false
      },
      {
        url: 'https://example.com/images/3.jpg',
        caption: 'Bedroom',
        order: 3,
        is_primary: false
      }
    ] as any,

    videos: [
      {
        url: 'https://example.com/videos/tour.mp4',
        caption: 'Virtual tour',
        duration: 120,
        thumbnail: 'https://example.com/videos/tour-thumb.jpg'
      }
    ] as any,

    portal_metadata: {
      listing_id: 'debug-001-internal',
      listing_date: '2026-02-11',
      portal_category: 'apartments',
      portal_subcategory: 'flats',
      view_count: 150,
      favorite_count: 12,
      last_updated: '2026-02-11T10:30:00Z',
      expires_at: '2026-05-11',
      featured: true,
      premium: false,
      boost_level: 2,
      agent_verified: true
    } as any,

    country_specific: {
      slovak_disposition: '2+1',
      slovak_ownership: 'personal',
      slovak_cadastral_area: 'Bratislava-Ružinov',
      slovak_building_type: 'residential',
      slovak_utilities_included: ['water', 'heating'],
      slovak_internet_available: true,
      slovak_parking_type: 'underground'
    } as any,

    // Standard fields
    media: {
      image_count: 3,
      video_count: 1,
      has_3d_tour: false,
      has_floor_plan: false
    },

    agent: {
      name: 'Test Agent',
      phone: '+421900123456',
      email: 'agent@example.com',
      agency: 'Debug Real Estate'
    },

    features: [
      'air-conditioning',
      'fitted-kitchen',
      'security-door',
      'video-intercom'
    ],

    description: 'This is a debug test property to verify that images, videos, portal_metadata, and country_specific fields are properly stored in the database.',

    first_seen_at: new Date(),
    last_seen_at: new Date()
  };

  try {
    console.log('1. Creating test apartment with populated new fields...');
    console.log();
    console.log('Fields to test:');
    console.log('  - images: ', JSON.stringify(testApartment.images).substring(0, 80) + '...');
    console.log('  - videos: ', JSON.stringify(testApartment.videos).substring(0, 80) + '...');
    console.log('  - portal_metadata: ', JSON.stringify(testApartment.portal_metadata).substring(0, 80) + '...');
    console.log('  - country_specific: ', JSON.stringify(testApartment.country_specific).substring(0, 80) + '...');
    console.log();

    // Call the UPSERT function
    const result = await upsertApartments([testApartment], 'slovakia');

    console.log('✅ UPSERT completed successfully');
    console.log('Result:', result);
    console.log();

    if (result.propertyIds.length === 0) {
      console.error('❌ ERROR: No property ID returned');
      process.exit(1);
    }

    const propertyId = result.propertyIds[0];
    console.log('Property ID:', propertyId);
    console.log();

    // Query the database to verify fields were stored
    console.log('2. Querying database to verify stored data...');
    console.log();

    const db = getCoreDatabase('slovakia');
    const queryResult = await db.query(
      `SELECT
        id, portal, portal_id, title, price,
        apt_bedrooms, apt_bathrooms, apt_sqm,
        images, videos, portal_metadata, country_specific,
        media, agent, features, description
       FROM properties_apartment
       WHERE portal = $1 AND portal_id = $2`,
      ['test-debug-fields', 'debug-test-001']
    );

    if (queryResult.rows.length === 0) {
      console.error('❌ ERROR: Property not found in database');
      process.exit(1);
    }

    const row = queryResult.rows[0];
    console.log('Retrieved property from database:');
    console.log('-'.repeat(80));
    console.log();

    // Check basic fields
    console.log('Basic fields:');
    console.log('  ID:', row.id);
    console.log('  Portal:', row.portal);
    console.log('  Portal ID:', row.portal_id);
    console.log('  Title:', row.title);
    console.log('  Price:', row.price);
    console.log('  Bedrooms:', row.apt_bedrooms);
    console.log('  Bathrooms:', row.apt_bathrooms);
    console.log('  SQM:', row.apt_sqm);
    console.log();

    // Check NEW fields (these are the critical ones)
    console.log('NEW FIELDS (the ones we\'re testing):');
    console.log('-'.repeat(80));
    console.log();

    console.log('1. IMAGES field:');
    if (row.images === null) {
      console.error('  ❌ FAIL: images is NULL');
    } else if (JSON.stringify(row.images) === '{}' || JSON.stringify(row.images) === '[]') {
      console.error('  ❌ FAIL: images is empty:', JSON.stringify(row.images));
    } else {
      console.log('  ✅ PASS: images stored correctly');
      console.log('  Value:', JSON.stringify(row.images, null, 2));
    }
    console.log();

    console.log('2. VIDEOS field:');
    if (row.videos === null) {
      console.error('  ❌ FAIL: videos is NULL');
    } else if (JSON.stringify(row.videos) === '{}' || JSON.stringify(row.videos) === '[]') {
      console.error('  ❌ FAIL: videos is empty:', JSON.stringify(row.videos));
    } else {
      console.log('  ✅ PASS: videos stored correctly');
      console.log('  Value:', JSON.stringify(row.videos, null, 2));
    }
    console.log();

    console.log('3. PORTAL_METADATA field:');
    if (row.portal_metadata === null) {
      console.error('  ❌ FAIL: portal_metadata is NULL');
    } else if (JSON.stringify(row.portal_metadata) === '{}') {
      console.error('  ❌ FAIL: portal_metadata is empty:', JSON.stringify(row.portal_metadata));
    } else {
      console.log('  ✅ PASS: portal_metadata stored correctly');
      console.log('  Value:', JSON.stringify(row.portal_metadata, null, 2));
    }
    console.log();

    console.log('4. COUNTRY_SPECIFIC field:');
    if (row.country_specific === null) {
      console.error('  ❌ FAIL: country_specific is NULL');
    } else if (JSON.stringify(row.country_specific) === '{}') {
      console.error('  ❌ FAIL: country_specific is empty:', JSON.stringify(row.country_specific));
    } else {
      console.log('  ✅ PASS: country_specific stored correctly');
      console.log('  Value:', JSON.stringify(row.country_specific, null, 2));
    }
    console.log();

    // Check other fields for completeness
    console.log('OTHER FIELDS (for completeness):');
    console.log('-'.repeat(80));
    console.log();

    console.log('5. MEDIA field:');
    console.log('  Value:', JSON.stringify(row.media, null, 2));
    console.log();

    console.log('6. AGENT field:');
    console.log('  Value:', JSON.stringify(row.agent, null, 2));
    console.log();

    console.log('7. FEATURES field:');
    console.log('  Value:', JSON.stringify(row.features));
    console.log();

    console.log('8. DESCRIPTION field:');
    console.log('  Value:', row.description?.substring(0, 100) + '...');
    console.log();

    // Final verdict
    console.log('='.repeat(80));
    console.log('FINAL VERDICT:');
    console.log('='.repeat(80));
    console.log();

    let allPass = true;

    if (row.images === null || JSON.stringify(row.images) === '{}' || JSON.stringify(row.images) === '[]') {
      console.error('❌ IMAGES field: FAILED');
      allPass = false;
    } else {
      console.log('✅ IMAGES field: PASSED');
    }

    if (row.videos === null || JSON.stringify(row.videos) === '{}' || JSON.stringify(row.videos) === '[]') {
      console.error('❌ VIDEOS field: FAILED');
      allPass = false;
    } else {
      console.log('✅ VIDEOS field: PASSED');
    }

    if (row.portal_metadata === null || JSON.stringify(row.portal_metadata) === '{}') {
      console.error('❌ PORTAL_METADATA field: FAILED');
      allPass = false;
    } else {
      console.log('✅ PORTAL_METADATA field: PASSED');
    }

    if (row.country_specific === null || JSON.stringify(row.country_specific) === '{}') {
      console.error('❌ COUNTRY_SPECIFIC field: FAILED');
      allPass = false;
    } else {
      console.log('✅ COUNTRY_SPECIFIC field: PASSED');
    }

    console.log();

    if (allPass) {
      console.log('🎉 ALL TESTS PASSED! UPSERT function works correctly.');
      console.log();
      console.log('The new fields (images, videos, portal_metadata, country_specific) are');
      console.log('being properly stored in the database. The issue must be elsewhere.');
    } else {
      console.error('⚠️  SOME TESTS FAILED! There is a bug in the UPSERT function.');
      console.log();
      console.log('The UPSERT code is not correctly storing these fields to the database.');
      console.log('Need to review the SQL parameters in bulk-operations.ts');
    }

    console.log();
    console.log('='.repeat(80));

    // Clean up - delete test data
    console.log();
    console.log('3. Cleaning up test data...');
    await db.query(
      'DELETE FROM properties_apartment WHERE portal = $1 AND portal_id = $2',
      ['test-debug-fields', 'debug-test-001']
    );
    console.log('✅ Test data deleted');

    process.exit(allPass ? 0 : 1);

  } catch (error) {
    console.error();
    console.error('❌ ERROR during test:');
    console.error(error);
    console.error();
    console.error('Stack trace:');
    if (error instanceof Error) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Run test
testUpsertDebugFields();
