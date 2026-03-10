// Quick test script
const { RealityApiScraper } = require('./dist/reality/src/scrapers/realityApiScraper');

async function test() {
  console.log('Testing RealityApiScraper with 5 apartments...\n');
  
  const scraper = new RealityApiScraper();
  try {
    const listings = await scraper.scrape('prodej', 'byty', undefined, 5);
    
    console.log(`✅ Fetched ${listings.length} listings\n`);
    
    if (listings.length > 0) {
      const first = listings[0];
      console.log('Sample listing:');
      console.log(`  ID: ${first.id}`);
      console.log(`  Title: ${first.title}`);
      console.log(`  Price: ${first.price}`);
      console.log(`  GPS: ${first.gps?.lat}, ${first.gps?.lng}`);
      console.log(`  Images: ${first.images?.length || 0}`);
      console.log(`  Info fields: ${first.information?.length || 0}`);
      console.log('\n✅ API scraper working!');
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

test();