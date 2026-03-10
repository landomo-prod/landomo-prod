import axios from 'axios';

async function inspectAPI() {
  try {
    const tms = Math.floor(Date.now() / 1000);
    const url = `https://www.sreality.cz/api/cs/v2/estates?page=1&per_page=1&category_main_cb=1&tms=${tms}`;

    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 10000
    });

    const listings = response.data?._embedded?.estates || [];
    if (listings.length > 0) {
      console.log('Sample listing structure:');
      console.log(JSON.stringify(listings[0], null, 2));
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

inspectAPI();
