const axios = require('axios');

async function checkApiTypes() {
  try {
    const listings = [2437342028, 750941004, 3024319308];

    for (const id of listings) {
      const response = await axios.get(`https://www.sreality.cz/api/cs/v2/estates/${id}`);
      const items = response.data.items || [];
      const balcony = items.find(i => (i.name || '').includes('Balkón'));

      if (balcony) {
        console.log(`\nListing ${id}:`);
        console.log(`  Name: ${balcony.name}`);
        console.log(`  Value: ${balcony.value}`);
        console.log(`  Type: ${typeof balcony.value}`);
        console.log(`  Unit: ${balcony.unit || 'none'}`);
      }
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkApiTypes();
