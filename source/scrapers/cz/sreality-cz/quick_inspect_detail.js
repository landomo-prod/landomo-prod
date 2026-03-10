const axios = require('axios');

async function test() {
  try {
    console.log('Fetching detail endpoint...');
    const url = 'https://www.sreality.cz/api/cs/v2/estates/2437342028';
    const res = await axios.get(url, { timeout: 20000 });

    console.log('\n========== Detail API Response structure ==========');
    console.log('Keys:', Object.keys(res.data).join(', '));
    console.log('Has items:', !!res.data.items);

    if (res.data.items) {
      console.log('Items count:', res.data.items.length);

      console.log('\n========== First 5 items ==========');
      res.data.items.slice(0, 5).forEach((item, idx) => {
        console.log(`\nItem ${idx}:`);
        console.log('  Type of item:', typeof item);
        console.log('  Is object:', item !== null && typeof item === 'object');

        if (typeof item === 'object' && item !== null) {
          console.log('  Keys:', Object.keys(item).join(', '));
          console.log('  name:', item.name, '(type:', typeof item.name, ')');
          console.log('  value:', typeof item.value === 'string' ? item.value.substring(0, 50) : item.value, '(type:', typeof item.value, ')');

          // Show structure if value is an object
          if (typeof item.value === 'object' && item.value !== null) {
            console.log('  value keys:', Object.keys(item.value).join(', '));
          }
        }

        console.log('  Full JSON:', JSON.stringify(item, null, 2).substring(0, 400));
      });

      // Check for amenity items
      console.log('\n========== Amenity-related items ==========');
      const amenityKeywords = ['balkón', 'terasa', 'výtah', 'klimatizace', 'bezpečnost', 'krb', 'alarm', 'kamera', 'parking'];
      const amenityItems = res.data.items.filter((item) => {
        const name = (item.name || '').toString().toLowerCase();
        return amenityKeywords.some(keyword => name.includes(keyword));
      });

      if (amenityItems.length > 0) {
        console.log(`Found ${amenityItems.length} amenity items:`);
        amenityItems.forEach(item => {
          console.log(`\n${item.name}:`);
          console.log('  Value:', JSON.stringify(item.value, null, 2).substring(0, 200));
        });
      } else {
        console.log('No amenity items found');
      }
    }
  } catch (e) {
    console.error('Error:', e.message);
    if (e.response && e.response.status) {
      console.log('Status:', e.response.status);
    }
  }
}

test();
