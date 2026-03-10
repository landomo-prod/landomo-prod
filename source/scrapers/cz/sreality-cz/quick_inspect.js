const axios = require('axios');

async function test() {
  try {
    console.log('Fetching list endpoint...');
    const url = 'https://www.sreality.cz/api/cs/v2/estates?page=1&per_page=1&category_main_cb=1';
    const res = await axios.get(url, { timeout: 15000 });

    console.log('\n========== API Response structure ==========');
    console.log('Keys:', Object.keys(res.data).join(', '));

    if (res.data._embedded && res.data._embedded.estates) {
      const estate = res.data._embedded.estates[0];
      console.log('\n========== First estate ==========');
      console.log('Keys:', Object.keys(estate).join(', '));
      console.log('Hash ID:', estate.hash_id);
      console.log('Items count:', estate.items ? estate.items.length : 'No items');

      if (estate.items && estate.items.length > 0) {
        console.log('\n========== First 3 items structure ==========');
        estate.items.slice(0, 3).forEach((item, idx) => {
          console.log(`\nItem ${idx}:`);
          console.log('  Type:', typeof item);
          console.log('  Keys:', Object.keys(item).join(', '));
          console.log('  Full:', JSON.stringify(item, null, 2).substring(0, 300));
        });
      }
    }
  } catch (e) {
    console.error('Error:', e.message);
    if (e.code === 'ECONNABORTED') {
      console.log('Request timeout - trying smaller timeout...');
    }
  }
}

test();
