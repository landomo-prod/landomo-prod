/**
 * Test Bazos Scraper with VPS Ingest Service
 * Verifies that the updated transformers work with the new schema
 */

import * as fs from 'fs';
import * as path from 'path';

// Load environment
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  const envFile = fs.readFileSync(envPath, 'utf-8');
  envFile.split('\n').forEach(line => {
    const match = line.match(/^([^=:#]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim();
      if (!process.env[key]) process.env[key] = value;
    }
  });
}

import { ListingsScraper } from './src/scrapers/listingsScraper';
import { transformBazosListingByCategory } from './src/transformers/bazosTransformer';
import { IngestAdapter } from './src/adapters/ingestAdapter';
import { scrapeDetailPages } from './src/scrapers/detailScraper';

async function main() {
  console.log('='.repeat(100));
  console.log('BAZOS SCRAPER → VPS INGEST SERVICE TEST');
  console.log('='.repeat(100));
  console.log();

  try {
    // Configuration
    const ingestUrl = process.env.INGEST_API_URL || 'http://187.77.70.123:3004';
    const ingestKey = process.env.INGEST_API_KEY || '';

    console.log('📋 Configuration:');
    console.log(`   Ingest URL: ${ingestUrl}`);
    console.log(`   API Key: ${ingestKey.substring(0, 15)}...`);
    console.log();

    // 1. Fetch real listings
    console.log('🔍 Step 1: Fetching real listings from Bazos.cz...');
    const scraper = new ListingsScraper({
      countries: ['cz'],
      sections: ['RE'],
      maxPages: 1, // Just 1 page for testing
      delayMs: 1000
    });

    const listings = await scraper.scrapeAll();
    console.log(`   ✅ Fetched ${listings.length} listings`);
    console.log();

    if (listings.length === 0) {
      throw new Error('No listings fetched');
    }

    // Take first 3 listings for testing
    const testListings = listings.slice(0, 3);

    // 2. Fetch detail pages for descriptions
    console.log('📄 Step 2: Fetching detail pages...');
    const urls = testListings.filter(l => l.url).map(l => l.url!);
    const descriptionMap = await scrapeDetailPages(urls, 300);

    // Add descriptions to listings
    for (const listing of testListings) {
      if (listing.url) {
        (listing as any).description = descriptionMap.get(listing.url) || '';
      }
    }
    console.log(`   ✅ Fetched ${descriptionMap.size}/${urls.length} descriptions`);
    console.log();

    // 3. Transform listings
    console.log('🔄 Step 3: Transforming listings...');
    const properties = [];

    for (const listing of testListings) {
      try {
        const transformed = await transformBazosListingByCategory(listing, 'cz');

        properties.push({
          portalId: listing.id,
          data: transformed,
          rawData: listing
        });

        console.log(`   ✅ Transformed ${listing.id} (category: ${transformed.property_category})`);

        // Show details
        const category = transformed.property_category;
        if (category === 'apartment') {
          console.log(`      - Bedrooms: ${(transformed as any).bedrooms}`);
          console.log(`      - Sqm: ${(transformed as any).sqm}`);
          console.log(`      - Has elevator: ${(transformed as any).has_elevator}`);
        } else if (category === 'house') {
          console.log(`      - Bedrooms: ${(transformed as any).bedrooms}`);
          console.log(`      - Living area: ${(transformed as any).sqm_living}`);
          console.log(`      - Plot area: ${(transformed as any).sqm_plot}`);
        } else if (category === 'land') {
          console.log(`      - Plot area: ${(transformed as any).area_plot_sqm}`);
          console.log(`      - Zoning: ${(transformed as any).zoning}`);
        }

        // Show country_specific
        if (transformed.country_specific?.czech) {
          console.log(`      - Country specific:`, JSON.stringify(transformed.country_specific.czech));
        }

      } catch (error: any) {
        console.error(`   ❌ Failed to transform ${listing.id}:`, error.message);
      }
    }

    console.log();
    console.log(`   ✅ Successfully transformed ${properties.length}/${testListings.length} listings`);
    console.log();

    // 4. Send to VPS ingest service
    console.log('📤 Step 4: Sending to VPS ingest service...');
    const adapter = new IngestAdapter('bazos', ingestUrl);

    try {
      await adapter.sendProperties(properties);
      console.log(`   ✅ Successfully sent ${properties.length} properties to ingest service`);
    } catch (error: any) {
      console.error(`   ❌ Failed to send properties:`, error.message);
      if (error.response) {
        console.error(`      Status: ${error.response.status}`);
        console.error(`      Data:`, JSON.stringify(error.response.data, null, 2));
      }
      throw error;
    }

    console.log();
    console.log('='.repeat(100));
    console.log('✅ TEST COMPLETED SUCCESSFULLY!');
    console.log(`   - Fetched: ${listings.length} listings`);
    console.log(`   - Transformed: ${properties.length} properties`);
    console.log(`   - Sent to: ${ingestUrl}`);
    console.log('='.repeat(100));

  } catch (error: any) {
    console.error();
    console.error('❌ TEST FAILED:', error.message);
    if (error.stack) {
      console.error();
      console.error('Stack trace:');
      console.error(error.stack);
    }
    process.exit(1);
  }
}

main().catch(console.error);
