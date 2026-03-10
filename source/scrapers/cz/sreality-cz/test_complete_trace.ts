import axios from 'axios';
import { transformSRealityToStandard } from './src/transformers/srealityTransformer';
import { SRealityListing } from './src/types/srealityTypes';

async function test() {
  try {
    const url = 'https://www.sreality.cz/api/cs/v2/estates/3014853452';
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    };

    const response = await axios.get(url, { headers, timeout: 30000 });
    const listing: SRealityListing = response.data;

    // Show raw water item
    const waterItem = listing.items?.find(i => i.name === 'Voda');
    console.log('Raw water item value:', waterItem?.value);
    console.log('Raw water item value type:', typeof waterItem?.value);
    console.log('Raw water item value is array:', Array.isArray(waterItem?.value));

    // Run transformer
    const transformed = transformSRealityToStandard(listing);

    // Show result
    const waterResult = transformed.country_specific?.water_supply;
    console.log('\nTransformed water_supply:', waterResult);
    console.log('Transformed water_supply type:', typeof waterResult);
    console.log('Is it [object Object]?', waterResult === '[object Object]');

    // Try to see what's in the water_supply
    if (typeof waterResult === 'string') {
      console.log('Char codes:', Array.from(waterResult).map(c => c.charCodeAt(0)));
    }

  } catch (error: any) {
    console.error('Error:', error.message);
  }
}

test();
