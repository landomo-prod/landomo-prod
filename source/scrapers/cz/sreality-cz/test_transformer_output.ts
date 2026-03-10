import axios from 'axios';
import { transformSRealityToStandard } from './src/transformers/srealityTransformer';
import { SRealityListing } from './src/types/srealityTypes';

async function testTransformerOutput() {
  try {
    // Fetch a listing with water data
    const url = 'https://www.sreality.cz/api/cs/v2/estates/3014853452';
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    };

    const response = await axios.get(url, { headers, timeout: 30000 });
    const listing: SRealityListing = response.data;

    const transformed = transformSRealityToStandard(listing);

    console.log('Water Supply:', transformed.country_specific?.water_supply);
    console.log('Water Supply Type:', typeof transformed.country_specific?.water_supply);
    console.log('Gas Supply:', transformed.country_specific?.gas_supply);
    console.log('Sewage Type:', transformed.country_specific?.sewage_type);
    console.log('Bathrooms:', transformed.details?.bathrooms);
    console.log('Renovated:', transformed.country_specific?.recently_renovated);

  } catch (error: any) {
    console.error('Error:', error.message);
  }
}

testTransformerOutput();
