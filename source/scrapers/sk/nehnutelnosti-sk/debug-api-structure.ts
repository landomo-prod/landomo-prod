import axios from 'axios';

async function debugAPIStructure() {
  console.log('🔍 Fetching data to understand API structure...\n');

  const url = 'https://www.nehnutelnosti.sk/api/v1/listings';
  const params = {
    page: 1,
    per_page: 5,
    region: 'bratislavsky-kraj',
    category: 'byty',
    transaction: 'prenajom'
  };

  try {
    const response = await axios.get(url, { params, timeout: 30000 });
    console.log('Response type:', typeof response.data);
    console.log('Response keys:', Object.keys(response.data));
    console.log('\nFull response structure:\n');
    console.log(JSON.stringify(response.data, null, 2).substring(0, 5000));
  } catch (error: any) {
    console.error('Error:', error.message);
    console.log('\nTrying direct listing scrape instead...\n');
    
    // Try the actual scraper method
    const { scrapeListings } = await import('./src/scrapers/listingsScraper');
    const result = await scrapeListings({ maxPages: 1 });
    console.log('\nScraper returned:');
    console.log('Total listings:', result.length);
    if (result.length > 0) {
      console.log('\nFirst listing structure:');
      console.log(JSON.stringify(result[0], null, 2).substring(0, 3000));
    }
  }
}

debugAPIStructure();
