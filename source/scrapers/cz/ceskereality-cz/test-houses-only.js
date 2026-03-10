const { scrapeListings } = require('./dist/scrapers/listingsScraper');
const { sendToIngest } = require('./dist/adapters/ingestAdapter');
const { transformHouse } = require('./dist/transformers/ceskerealityHouseTransformer');

// Override environment for test
process.env.MAX_PAGES = '1'; // Only 1 page
process.env.DELAY_MS = '200';
process.env.INGEST_API_URL = 'http://localhost:9999'; // Mock URL

console.log('Testing HOUSES only...\n');

// Mock ingest to capture and validate data
require('./dist/adapters/ingestAdapter').sendToIngest = async function(listings, category, tracker) {
  if (category !== 'house') return; // Skip non-houses

  console.log(`\n📊 Received ${listings.length} house listings`);
  console.log('First listing structure:', {
    hasUrl: !!listings[0]?.url,
    hasJsonLd: !!listings[0]?.jsonLd,
    hasHtmlData: !!listings[0]?.htmlData,
    jsonLdKeys: listings[0]?.jsonLd ? Object.keys(listings[0].jsonLd) : 'none',
    htmlDataKeys: listings[0]?.htmlData ? Object.keys(listings[0].htmlData) : 'none'
  });

  console.log('\n═'.repeat(70));
  console.log('Transforming first 3 houses...');
  console.log('═'.repeat(70));

  for (let i = 0; i < Math.min(3, listings.length); i++) {
    const listing = listings[i];
    console.log(`\n[${i + 1}] URL: ${listing.url?.substring(0, 80)}...`);

    try {
      console.log('  JSON-LD name:', listing.jsonLd?.name);
      console.log('  JSON-LD type:', listing.jsonLd?.additionalType);
      console.log('  JSON-LD price:', listing.jsonLd?.offers?.price);

      const property = transformHouse(listing.jsonLd, listing.url, listing.htmlData);

      console.log('  ✅ Transformed:');
      console.log('    - property_category:', property.property_category);
      console.log('    - title:', property.title);
      console.log('    - price:', property.price);
      console.log('    - bedrooms:', property.bedrooms);
      console.log('    - sqm_living:', property.sqm_living);
      console.log('    - sqm_plot:', property.sqm_plot);
    } catch (error) {
      console.log('  ❌ Error:', error.message);
      console.log(error.stack);
    }
  }

  console.log('\n═'.repeat(70));
  process.exit(0);
};

// Modify categories to only scrape houses
const originalCategories = [
  { name: 'houses', url: 'https://www.ceskereality.cz/prodej/rodinne-domy/', type: 'house' }
];

scrapeListings().catch(console.error);
