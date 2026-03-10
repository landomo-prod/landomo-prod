import { HttpScraper } from './src/scrapers/httpScraper';
import { transformNehnutelnostiApartment } from './src/transformers/apartments/apartmentTransformer';

async function test() {
  console.log('📊 Testing Transformer with Real Data\n');

  const scraper = new HttpScraper();
  const url = 'https://www.nehnutelnosti.sk/bratislavsky-kraj/byty/prenajom/';

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    }
  });

  const html = await response.text();
  const listings: any[] = (scraper as any).extractListingsFromHtml(html);

  console.log(`✅ Extracted ${listings.length} raw listings\n`);

  if (listings.length === 0) {
    console.log('❌ No listings found');
    return;
  }

  // Transform first listing
  const rawListing = listings[0];
  const transformed = transformNehnutelnostiApartment(rawListing);

  console.log('📋 RAW LISTING STRUCTURE:\n');
  console.log('Raw _raw.parameters:', JSON.stringify(rawListing._raw?.parameters, null, 2));
  console.log('\n');

  console.log('📋 TRANSFORMED OUTPUT:\n');
  console.log('Title:', transformed.title);
  console.log('Price:', transformed.price);
  console.log('Rooms:', transformed.rooms);
  console.log('Bedrooms:', transformed.bedrooms);
  console.log('Condition:', transformed.condition);
  console.log('');

  console.log('Country Specific (Slovakia):');
  console.log(JSON.stringify(transformed.country_specific?.slovakia, null, 2));
  console.log('');

  console.log('Portal Metadata:');
  console.log(JSON.stringify(transformed.portal_metadata, null, 2));
}

test().catch(console.error);
