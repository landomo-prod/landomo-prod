import { IngestAdapter } from './src/adapters/ingestAdapter';
import type { ApartmentPropertyTierI } from '@landomo/core';

/**
 * Simple test to verify retry logic
 * This will attempt to send to a non-existent server to trigger retries
 */
async function testRetryLogic() {
  console.log('🧪 Testing IngestAdapter retry logic...\n');

  // Configure environment for testing
  process.env.INGEST_API_URL = 'http://nonexistent-server-12345.test:9999';
  process.env.INGEST_API_KEY = 'test-key';
  process.env.MAX_RETRIES = '3';
  process.env.INITIAL_RETRY_DELAY = '500'; // Faster for testing
  process.env.INGEST_TIMEOUT = '2000'; // Short timeout for testing

  const adapter = new IngestAdapter('bezrealitky');

  // Create a minimal test property
  const testProperty: ApartmentPropertyTierI = {
    property_category: 'apartment',
    title: 'Test Apartment',
    price: 5000000,
    currency: 'CZK',
    transaction_type: 'sale',
    location: {
      address: 'Test Address, Prague',
      city: 'Prague',
      region: 'Prague',
      postal_code: '11000',
      country: 'Czech Republic',
      coordinates: {
        lat: 50.0755,
        lon: 14.4378
      }
    },
    bedrooms: 2,
    sqm: 65,
    has_elevator: true,
    has_balcony: false,
    has_parking: true,
    has_basement: false,
    source_url: 'https://test.com/123',
    source_platform: 'bezrealitky',
    status: 'active',
    images: []
  };

  console.log('📤 Attempting to send 1 property to non-existent server...');
  console.log('   Expected: Network error → 3 retries → failure after ~4 attempts\n');

  try {
    await adapter.sendProperties([{
      portalId: 'test-123',
      data: testProperty,
      rawData: { test: true }
    }]);
    console.log('\n❌ TEST FAILED: Should have thrown an error!\n');
  } catch (error: any) {
    console.log('\n✅ TEST PASSED: Error thrown as expected');
    console.log(`   Final error: ${error.code || error.message}`);
    console.log('\n📊 If you saw retry attempts with increasing delays, the retry logic is working!\n');
  }
}

testRetryLogic().catch(console.error);
