import axios from 'axios';
import { SRealityListing } from './src/types/srealityTypes';

async function test() {
  const response = await axios.get('https://www.sreality.cz/api/cs/v2/estates/3014853452', {
    headers: { 'User-Agent': 'Mozilla/5.0' },
    timeout: 30000
  });

  const listing: SRealityListing = response.data;

  console.log('Listing keys:', Object.keys(listing).slice(0, 15));
  console.log('listing.items type:', typeof listing.items);
  console.log('listing.items is array:', Array.isArray(listing.items));
  console.log('listing.items length:', listing.items?.length);

  if (listing.items && listing.items.length > 0) {
    console.log('\nFirst item:', JSON.stringify(listing.items[0], null, 2));

    const odpad = listing.items.find(i => i.name === 'Odpad');
    console.log('\nOdpad item:', JSON.stringify(odpad, null, 2));

    // Check what type the items array elements are
    console.log('\nItem 13 (should be Odpad):', listing.items[15]?.name);
  }
}

test().catch(console.error);
