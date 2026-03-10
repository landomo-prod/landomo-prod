import axios from 'axios';

async function checkItems() {
  try {
    const hashId = 340882252;
    const url = `https://www.sreality.cz/api/cs/v2/estates/${hashId}`;

    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 10000
    });

    console.log('All items for hash_id:', hashId);
    console.log('====================================');
    if (response.data.items) {
      for (const item of response.data.items) {
        console.log(`Name: "${item.name}"`);
        console.log(`Value: "${item.value}"`);
        console.log(`Type: "${item.type}"`);
        console.log('---');
      }
    }
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : error);
  }
}

checkItems();
