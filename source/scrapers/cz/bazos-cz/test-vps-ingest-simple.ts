/**
 * Simple Test: Bazos Scraper → VPS Ingest (No LLM)
 * Tests schema mapping with VPS ingest service
 */

import * as fs from 'fs';
import * as path from 'path';

// Load environment and DISABLE LLM
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

// DISABLE LLM extraction for faster testing
process.env.LLM_EXTRACTION_ENABLED = 'false';

import { ListingsScraper } from './src/scrapers/listingsScraper';
import { transformBazosListingByCategory } from './src/transformers/bazosTransformer';
import { IngestAdapter } from './src/adapters/ingestAdapter';
import { scrapeDetailPages } from './src/scrapers/detailScraper';

async function main() {
  console.log('='.repeat(100));
  console.log('SIMPLE TEST: Bazos Scraper → VPS Ingest (No LLM)');
  console.log('='.repeat(100));
  console.log();

  try {
    const ingestUrl = process.env.INGEST_API_URL || 'http://187.77.70.123:3004';
    const ingestKey = process.env.INGEST_API_KEY || '';

    console.log('📋 Configuration:');
    console.log(`   Ingest URL: ${ingestUrl}`);
    console.log(`   LLM Enabled: false (testing schema only)`);
    console.log();

    // Fetch 1 page of listings
    console.log('🔍 Fetching listings...');
    const scraper = new ListingsScraper({
      countries: ['cz'],
      sections: ['RE'],
      maxPages: 1,
      delayMs: 500
    });

    const listings = await scraper.scrapeAll();
    console.log(`   ✅ Fetched ${listings.length} listings`);

    // Take 2 listings for quick test
    const testListings = listings.slice(0, 2);

    // Fetch descriptions
    console.log('📄 Fetching detail pages...');
    const urls = testListings.filter(l => l.url).map(l => l.url!);
    const descriptionMap = await scrapeDetailPages(urls, 300);

    for (const listing of testListings) {
      if (listing.url) {
        (listing as any).description = descriptionMap.get(listing.url) || '';
      }
    }
    console.log(`   ✅ Fetched descriptions`);
    console.log();

    // Transform
    console.log('🔄 Transforming...');
    const properties = [];

    for (const listing of testListings) {
      const transformed = await transformBazosListingByCategory(listing, 'cz');
      properties.push({
        portalId: listing.id,
        data: transformed,
        rawData: listing
      });

      console.log(`   ✅ ${listing.id}:`);
      console.log(`      - Category: ${transformed.property_category}`);
      console.log(`      - Title: ${transformed.title.substring(0, 50)}...`);
      console.log(`      - Price: ${transformed.price} ${transformed.currency}`);
      console.log(`      - Country specific:`, JSON.stringify(transformed.country_specific));
    }

    console.log();
    console.log('📤 Sending to VPS ingest service...');

    const adapter = new IngestAdapter('bazos', ingestUrl);
    await adapter.sendProperties(properties);

    console.log(`   ✅ Successfully sent ${properties.length} properties!`);
    console.log();

    console.log('='.repeat(100));
    console.log('✅ TEST PASSED!');
    console.log(`   Schema mapping is working correctly.`);
    console.log(`   Properties sent to: ${ingestUrl}`);
    console.log('='.repeat(100));

  } catch (error: any) {
    console.error();
    console.error('❌ TEST FAILED:', error.message);
    if (error.response?.data) {
      console.error('Response:', JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  }
}

main().catch(console.error);
