/**
 * Final comprehensive test
 */
import { ListingsScraper } from './src/scrapers/listingsScraper';

async function finalTest() {
  console.log('🧪 Final Comprehensive Test\n');

  try {
    const scraper = new ListingsScraper();

    // Test with just byty/predaj, 2 pages max
    console.log('📡 Testing: byty/predaj (max 2 pages)');

    // Temporarily modify scraper to test just one category
    const listings = await (scraper as any).scrapeCategory('byty', 'predaj', 2);

    console.log(`\n✅ Extracted ${listings.length} listings\n`);

    if (listings.length >= 5) {
      console.log('First 5 listings:\n');

      listings.slice(0, 5).forEach((listing: any, i: number) => {
        console.log(`${i + 1}. ${listing.title}`);
        console.log(`   ID: ${listing.id}`);
        console.log(`   Price: ${listing.price} ${listing.currency}`);
        console.log(`   Location: ${listing.location}`);
        console.log(`   Type: ${listing.propertyType} - ${listing.transactionType}`);
        console.log(`   URL: ${listing.url}`);
        if (listing.rooms) console.log(`   Rooms: ${listing.rooms}`);
        if (listing.sqm) console.log(`   Area: ${listing.sqm} m²`);
        if (listing.imageUrl) console.log(`   Image: ${listing.imageUrl.substring(0, 60)}...`);
        console.log('');
      });

      // Validate data quality
      const validListings = listings.filter((l: any) =>
        l.id && l.title && l.price > 0 && l.url
      );

      const percentValid = (validListings.length / listings.length * 100).toFixed(1);
      console.log(`\n📊 Data Quality:`);
      console.log(`   Valid listings: ${validListings.length}/${listings.length} (${percentValid}%)`);
      console.log(`   With rooms: ${listings.filter((l: any) => l.rooms).length}`);
      console.log(`   With area: ${listings.filter((l: any) => l.sqm).length}`);
      console.log(`   With images: ${listings.filter((l: any) => l.imageUrl).length}`);
      console.log(`   With description: ${listings.filter((l: any) => l.description).length}`);

      if (validListings.length >= 5) {
        console.log('\n✅ SUCCESS: At least 5 valid listings extracted!');
      } else {
        console.log('\n⚠️  WARNING: Less than 5 valid listings');
      }
    } else {
      console.log('❌ FAILURE: Less than 5 listings extracted');
    }

  } catch (error: any) {
    console.error('\n❌ Test failed:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

finalTest();
