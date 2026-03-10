/**
 * Live test of queue-based LLM extraction
 * Tests with 5 real Bazos listings
 */

import dotenv from 'dotenv';
dotenv.config();

import { ListingsScraper } from './src/scrapers/listingsScraper';
import { addExtractionJobs, waitForJobs } from './src/queue/llmQueue';

async function testQueue() {
  console.log('\n🧪 Testing Queue-Based LLM Extraction\n');

  try {
    // 1. Fetch 5 real listings
    console.log('📥 Fetching 5 test listings from Bazos...');
    const scraper = new ListingsScraper({
      countries: ['cz'],
      sections: ['RE'],
      maxPages: 1  // Just first page
    });
    const listings = (await scraper.scrapeAll()).slice(0, 5);
    console.log(`✅ Fetched ${listings.length} listings\n`);

    // 2. Add to queue
    console.log('📤 Adding jobs to queue...');
    const startTime = Date.now();
    const jobIds = await addExtractionJobs(listings, 'bazos', 'cz');
    console.log(`✅ Queued ${jobIds.size} jobs\n`);

    // 3. Wait for results (30 second timeout)
    console.log('⏳ Waiting for worker to process (30s timeout)...');
    const results = await waitForJobs(jobIds, 30000);
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);

    // 4. Report results
    console.log(`\n✅ Received ${results.size}/${jobIds.size} results in ${duration}s\n`);

    let successCount = 0;
    let failCount = 0;
    let cacheCount = 0;

    for (const [listingId, result] of results) {
      const status = result.isValid ? '✅' : '❌';
      const cache = result.fromCache ? '(cached)' : '(extracted)';
      console.log(`${status} ${listingId}: ${result.processingTimeMs}ms ${cache}`);

      if (result.isValid) successCount++;
      else failCount++;
      if (result.fromCache) cacheCount++;
    }

    console.log(`\n📊 Summary:`);
    console.log(`   Success: ${successCount}/${results.size}`);
    console.log(`   Failed: ${failCount}/${results.size}`);
    console.log(`   Cached: ${cacheCount}/${results.size}`);
    console.log(`   Avg time: ${Array.from(results.values()).reduce((sum, r) => sum + r.processingTimeMs, 0) / results.size}ms`);

    console.log('\n✅ Test complete!\n');
    process.exit(0);

  } catch (error: any) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

testQueue();
