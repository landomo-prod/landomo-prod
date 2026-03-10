/**
 * Raw sample: fetch bazos listing page via API.
 * Usage: npx ts-node src/raw_samples/fetch-listing-page.ts
 */

import axios from 'axios';

const URL = 'https://www.bazos.cz/api/v1/ads.php?offset=0&limit=5&section=RE';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept-Encoding': 'gzip, deflate, br',
  'Connection': 'keep-alive',
};

async function main() {
  const response = await axios.get(URL, { headers: HEADERS });
  console.log(JSON.stringify(response.data, null, 2));
}

main().catch(console.error);
