import axios from 'axios';

async function fetchDetail() {
  try {
    const hashId = 2437342028;
    const url = `https://www.sreality.cz/api/cs/v2/estates/${hashId}`;

    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 10000
    });

    // Just show items
    console.log('Items structure:');
    console.log(JSON.stringify(response.data.items, null, 2));
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : error);
  }
}

fetchDetail();
