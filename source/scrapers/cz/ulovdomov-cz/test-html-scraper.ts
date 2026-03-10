#!/usr/bin/env ts-node
/**
 * Test script for HTML scraper
 * Tests extracting a few listings to verify the scraper works
 */

import { HtmlScraper } from './src/scrapers/htmlScraper';

async function test() {
  console.log('=== Testing UlovDomov HTML Scraper ===\n');

  const scraper = new HtmlScraper();

  try {
    // Initialize browser
    console.log('Initializing browser...');
    await scraper.init();

    // Test scraping just apartments (byty) for faster testing
    console.log('\nTesting: Scraping rental apartments...');
    const listings = await scraper.scrapeByPropertyType('pronajem', 'byty');

    console.log(`\n✅ Success! Scraped ${listings.length} listings`);

    if (listings.length > 0) {
      console.log('\nSample listing:');
      const sample = listings[0];
      console.log(JSON.stringify({
        id: sample.id,
        title: sample.title,
        price: sample.price,
        area: sample.area,
        disposition: sample.dispozice,
        location: sample.location,
        offerType: sample.offerType,
        propertyType: sample.propertyType
      }, null, 2));
    }

    // Close browser
    await scraper.close();

    console.log('\n✅ Test complete!');
    process.exit(0);

  } catch (error: any) {
    console.error('\n❌ Test failed:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }

    await scraper.close();
    process.exit(1);
  }
}

test();
