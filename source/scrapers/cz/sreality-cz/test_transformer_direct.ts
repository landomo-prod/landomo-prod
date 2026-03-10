import axios from 'axios';
import { transformSRealityToStandard } from './src/transformers/srealityTransformer';
import { SRealityListing } from './src/types/srealityTypes';

async function test() {
  const response = await axios.get('https://www.sreality.cz/api/cs/v2/estates/3014853452', {
    headers: { 'User-Agent': 'Mozilla/5.0' },
    timeout: 30000
  });

  const listing: SRealityListing = response.data;

  console.log('Before transform:');
  console.log('  listing.items.length:', listing.items?.length);

  const odpad = listing.items?.find(i => i.name === 'Odpad');
  console.log('  Odpad item exists:', !!odpad);
  if (odpad) {
    console.log('  Odpad.value:', JSON.stringify(odpad.value).substring(0, 100));
  }

  console.log('\nTransforming...');
  const result = transformSRealityToStandard(listing);

  console.log('\nAfter transform:');
  console.log('  sewage_type:', result.country_specific?.sewage_type);
  console.log('  water_supply:', result.country_specific?.water_supply);

  // Check all country_specific fields
  console.log('\nAll country_specific fields:');
  Object.entries(result.country_specific || {}).forEach(([key, value]) => {
    console.log(`  ${key}:`, value);
  });
}

test().catch(console.error);
