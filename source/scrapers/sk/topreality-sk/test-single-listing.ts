import { ListingsScraper } from './src/scrapers/listingsScraper';
import { transformTopRealityToStandard } from './src/transformers';

async function test() {
  const scraper = new ListingsScraper();
  const listings = await scraper.scrapeRegionWithFilters('c100-Bratislavský kraj', '1', '1', 1);
  
  if (listings.length > 0) {
    const listing = listings[0];
    console.log('\n📄 RAW LISTING DATA:');
    console.log(JSON.stringify(listing, null, 2));
    
    const transformed = transformTopRealityToStandard(listing);
    console.log('\n🔄 TRANSFORMED DATA (key fields):');
    console.log('Title:', transformed.title);
    console.log('Price:', transformed.price);
    console.log('Area:', transformed.details.sqm);
    console.log('Rooms:', transformed.details.rooms);
    console.log('Description length:', transformed.description?.length || 0);
    console.log('Description preview:', transformed.description?.substring(0, 200));
  }
}

test();
