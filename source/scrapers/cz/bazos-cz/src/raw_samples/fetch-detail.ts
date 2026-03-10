/**
 * Raw sample: fetch a bazos ad detail via API.
 * Usage: npx ts-node src/raw_samples/fetch-detail.ts [ad_id]
 */

import axios from 'axios';

const DEFAULT_AD_ID = '123456';

async function main() {
  const adId = process.argv[2] || DEFAULT_AD_ID;
  const url = `https://www.bazos.cz/api/v1/ad-detail-2.php?ad_id=${adId}`;

  console.error(`Fetching: ${url}`);

  const response = await axios.get(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'application/json',
      'Accept-Encoding': 'gzip, deflate, br',
    },
  });

  console.log(JSON.stringify(response.data, null, 2));
}

main().catch(console.error);
