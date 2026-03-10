import axios from 'axios';

async function test() {
  // Import the COMPILED version directly
  const { transformSRealityToStandard } = require('./dist/sreality/src/transformers/srealityTransformer');

  const response = await axios.get('https://www.sreality.cz/api/cs/v2/estates/3014853452', {
    headers: { 'User-Agent': 'Mozilla/5.0' },
    timeout: 30000
  });

  const listing = response.data;

  console.log('Before transform:');
  console.log('  listing.items.length:', listing.items?.length);

  console.log('\nTransforming...');
  const result = transformSRealityToStandard(listing);

  console.log('\nAfter transform:');
  console.log('  sewage_type:', result.country_specific?.sewage_type);
}

test().catch(console.error);
