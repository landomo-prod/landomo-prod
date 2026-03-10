/**
 * Final comprehensive test of wohnnet-at scraper
 */

import { ListingsScraper } from './src/scrapers/listingsScraper';
import { transformWohnnetToStandard } from './src/transformers/wohnnetTransformer';
import { fetchListingPage } from './src/utils/fetchData';
import * as cheerio from 'cheerio';

async function extractTotalListings(): Promise<number> {
  console.log('Fetching page 1 to extract total listings count...');
  const html = await fetchListingPage(1);
  const $ = cheerio.load(html);

  // Extract from title
  const title = $('title').text();
  const titleMatch = title.match(/([\d.]+)\s*Immobilien/i);
  if (titleMatch) {
    const totalStr = titleMatch[1].replace(/\./g, '');
    return parseInt(totalStr, 10);
  }

  // Extract from meta description
  const metaDesc = $('meta[name="description"]').attr('content') || '';
  const metaMatch = metaDesc.match(/([\d.]+)\s*Immobilien/i);
  if (metaMatch) {
    const totalStr = metaMatch[1].replace(/\./g, '');
    return parseInt(totalStr, 10);
  }

  return 0;
}

async function runTest() {
  console.log('='.repeat(80));
  console.log('WOHNNET-AT SCRAPER - COMPREHENSIVE PERFORMANCE TEST');
  console.log('='.repeat(80));

  const testStartTime = Date.now();

  try {
    // Get total available listings
    console.log('\n[STEP 1/4] Detecting total available listings...');
    const totalAvailable = await extractTotalListings();
    console.log(`✓ Total listings available on Wohnnet: ${totalAvailable.toLocaleString()}`);

    // Calculate estimated pages (typical 20 listings per page)
    const estimatedPages = Math.ceil(totalAvailable / 20);
    console.log(`✓ Estimated total pages: ${estimatedPages.toLocaleString()}`);

    // Run limited scrape test
    const MAX_TEST_PAGES = 2;
    console.log(`\n[STEP 2/4] Fetching ${MAX_TEST_PAGES} pages for speed test...`);
    const fetchStartTime = Date.now();

    const scraper = new ListingsScraper({
      maxPages: MAX_TEST_PAGES,
      requestsPerSecond: 2,
      enableDetailScraping: false
    });

    const listings = await scraper.scrapeAll();
    const fetchEndTime = Date.now();
    const fetchTime = (fetchEndTime - fetchStartTime) / 1000;

    // Transform listings
    console.log(`\n[STEP 3/4] Transforming ${listings.length} listings...`);
    const transformStartTime = Date.now();

    let transformedCount = 0;
    let transformErrors = 0;

    const properties = listings.map(listing => {
      try {
        const transformed = {
          portalId: listing.id,
          data: transformWohnnetToStandard(listing),
          rawData: listing
        };
        transformedCount++;
        return transformed;
      } catch (error: any) {
        transformErrors++;
        return null;
      }
    }).filter(p => p !== null);

    const transformEndTime = Date.now();
    const transformTime = (transformEndTime - transformStartTime) / 1000;

    // Calculate metrics
    console.log('\n[STEP 4/4] Calculating metrics...');

    const testEndTime = Date.now();
    const totalTime = (testEndTime - testStartTime) / 1000;

    const fetchSpeed = listings.length / fetchTime;
    const transformSpeed = transformedCount / (transformTime || 0.001);
    const overallSpeed = transformedCount / totalTime;
    const successRate = listings.length > 0 ? (transformedCount / listings.length) * 100 : 0;

    // Estimate time for full scrape
    const estimatedFullFetchTime = (totalAvailable / fetchSpeed) / 60; // in minutes
    const estimatedFullTotalTime = (totalAvailable / overallSpeed) / 60; // in minutes

    // Display results
    console.log('\n' + '='.repeat(80));
    console.log('TEST RESULTS');
    console.log('='.repeat(80));

    console.log('\n📊 TOTAL AVAILABLE ON PLATFORM:');
    console.log(`  Total Listings:             ${totalAvailable.toLocaleString()}`);
    console.log(`  Estimated Pages:            ${estimatedPages.toLocaleString()}`);

    console.log('\n📦 DATA COLLECTED (Test Sample):');
    console.log(`  Pages Scraped:              ${MAX_TEST_PAGES}`);
    console.log(`  Listings Fetched:           ${listings.length}`);
    console.log(`  Successfully Transformed:   ${transformedCount}`);
    console.log(`  Transform Errors:           ${transformErrors}`);
    console.log(`  Success Rate:               ${successRate.toFixed(2)}%`);

    console.log('\n⏱️  TIMING (Test Sample):');
    console.log(`  Fetch Time:                 ${fetchTime.toFixed(2)}s`);
    console.log(`  Transform Time:             ${transformTime.toFixed(3)}s`);
    console.log(`  Total Test Time:            ${totalTime.toFixed(2)}s`);

    console.log('\n🚀 SPEED METRICS:');
    console.log(`  Fetch Speed:                ${fetchSpeed.toFixed(2)} listings/sec`);
    console.log(`  Transform Speed:            ${transformSpeed.toFixed(0)} listings/sec`);
    console.log(`  Overall Processing:         ${overallSpeed.toFixed(2)} listings/sec`);

    console.log('\n📈 FULL SCRAPE ESTIMATES:');
    console.log(`  Est. Fetch Time:            ${estimatedFullFetchTime.toFixed(1)} minutes (${(estimatedFullFetchTime/60).toFixed(1)} hours)`);
    console.log(`  Est. Total Time:            ${estimatedFullTotalTime.toFixed(1)} minutes (${(estimatedFullTotalTime/60).toFixed(1)} hours)`);
    console.log(`  Note: Includes rate limiting and human-like delays`);

    // Sample data
    if (properties.length > 0 && properties[0]) {
      const sample = properties[0];
      console.log('\n📋 SAMPLE LISTING DATA:');
      console.log(`  Portal ID:                  ${sample.portalId}`);
      console.log(`  Title:                      ${sample.data.title}`);
      console.log(`  Price:                      ${sample.data.price} ${sample.data.currency}`);
      console.log(`  Location:                   ${sample.data.location?.city || 'N/A'}, ${sample.data.location?.country}`);
      console.log(`  Property Type:              ${sample.data.property_type}`);
      console.log(`  Transaction Type:           ${sample.data.transaction_type}`);
      console.log(`  URL:                        ${sample.data.source_url}`);
    }

    console.log('\n' + '='.repeat(80));
    console.log('✅ TEST COMPLETED SUCCESSFULLY');
    console.log('='.repeat(80));

  } catch (error: any) {
    console.error('\n' + '='.repeat(80));
    console.error('❌ TEST FAILED');
    console.error('='.repeat(80));
    console.error('\nError:', error.message);
    if (error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Run test
runTest().then(() => {
  console.log('\nExiting...');
  process.exit(0);
}).catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
