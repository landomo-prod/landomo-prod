import axios from 'axios';
import { SRealityListing } from './src/types/srealityTypes';

async function testWaterExtraction() {
  try {
    // Fetch a listing with water data
    const url = 'https://www.sreality.cz/api/cs/v2/estates/3014853452';
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    };

    const response = await axios.get(url, { headers, timeout: 30000 });
    const listing: SRealityListing = response.data;

    // Find water item
    const waterItem = listing.items?.find(i => i.name === 'Voda');
    
    console.log('Water Item:', JSON.stringify(waterItem, null, 2));
    console.log('Water Value Type:', typeof waterItem?.value);
    console.log('Water Value:', waterItem?.value);

    // Find gas item
    const gasItem = listing.items?.find(i => i.name === 'Plyn');
    console.log('\nGas Item:', JSON.stringify(gasItem, null, 2));
    console.log('Gas Value Type:', typeof gasItem?.value);
    console.log('Gas Value:', gasItem?.value);

  } catch (error: any) {
    console.error('Error:', error.message);
  }
}

testWaterExtraction();
