import axios from 'axios';

async function checkListing(hash_id: number) {
  try {
    const url = `https://www.sreality.cz/api/cs/v2/estates/${hash_id}`;
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    };

    const response = await axios.get(url, { headers, timeout: 30000 });
    const listing = response.data;

    console.log(`Hash: ${hash_id}`);
    console.log(`Address: ${listing.locality?.value}`);
    console.log(`Total items: ${listing.items ? listing.items.length : 0}`);

    if (listing.items) {
      console.log('\nAll item names:');
      listing.items.forEach((item: any) => {
        console.log(`  - ${item.name}`);
      });

      console.log('\nLooking for Odpad item:');
      const odpad = listing.items.find((i: any) => i.name === 'Odpad' || i.name === 'odpad');
      if (odpad) {
        console.log('FOUND!');
        console.log(JSON.stringify(odpad, null, 2));
      } else {
        console.log('NOT FOUND');
      }
    }
  } catch (error: any) {
    console.error(`Error: ${error.message}`);
  }
}

checkListing(3014853452);
