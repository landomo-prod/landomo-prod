/**
 * Full test for TopReality.sk scraper
 */
import { ListingsScraper } from './src/scrapers/listingsScraper';
import { transformTopRealityToStandard } from './src/transformers/toprealityTransformer';

async function test() {
  console.log('🧪 FULL TEST: TopReality.sk Scraper\n');
  console.log('='.repeat(60));

  try {
    const scraper = new ListingsScraper();

    // Test with first 2 regions only (to keep it reasonable)
    (scraper as any).regions = ['c100-Bratislavský kraj', 'c300-Trenčiansky kraj'];

    console.log('📡 Scraping 2 regions (Bratislava, Trenčín)...\n');

    const startTime = Date.now();
    const listings = await scraper.scrapeAll();
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log('\n' + '='.repeat(60));
    console.log('📊 RESULTS:');
    console.log('='.repeat(60));
    console.log(`Total listings scraped: ${listings.length}`);
    console.log(`Time taken: ${duration}s`);
    console.log(`Average per listing: ${(parseFloat(duration) / listings.length).toFixed(2)}s`);

    if (listings.length > 0) {
      console.log('\n📋 Sample Listings (first 5):');
      console.log('-'.repeat(60));

      listings.slice(0, 5).forEach((listing, idx) => {
        const transformed = transformTopRealityToStandard(listing);

        console.log(`\n${idx + 1}. ${listing.title.substring(0, 50)}...`);
        console.log(`   Price: ${transformed.price} ${transformed.currency}`);
        console.log(`   Type: ${transformed.property_type} (${transformed.transaction_type})`);
        console.log(`   Location: ${transformed.location.city}`);
        console.log(`   Area: ${transformed.details.sqm || 'N/A'} m²`);
        console.log(`   Rooms: ${transformed.details.rooms || 'N/A'}`);
        console.log(`   Disposition: ${transformed.country_specific?.slovak_disposition || 'N/A'}`);
        console.log(`   URL: ${transformed.source_url}`);
      });

      // Validation
      console.log('\n✅ VALIDATION:');
      console.log('-'.repeat(60));
      const validPrices = listings.filter(l => l.price > 1000 && l.price < 10000000).length;
      const withArea = listings.filter(l => l.area).length;
      const withRooms = listings.filter(l => l.rooms).length;

      console.log(`Valid prices: ${validPrices}/${listings.length} (${(validPrices/listings.length*100).toFixed(1)}%)`);
      console.log(`With area: ${withArea}/${listings.length} (${(withArea/listings.length*100).toFixed(1)}%)`);
      console.log(`With rooms: ${withRooms}/${listings.length} (${(withRooms/listings.length*100).toFixed(1)}%)`);
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ TEST COMPLETED SUCCESSFULLY');
    console.log('='.repeat(60));

  } catch (error: any) {
    console.error('\n❌ TEST FAILED:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

test();
