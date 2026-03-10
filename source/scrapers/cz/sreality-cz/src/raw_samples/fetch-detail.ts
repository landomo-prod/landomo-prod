import axios from 'axios';
import { getRealisticHeaders } from '../utils/headers';

async function main() {
  const hashId = process.argv[2] || '2456789';
  const url = `https://www.sreality.cz/api/cs/v2/estates/${hashId}`;
  const { data } = await axios.get(url, { headers: getRealisticHeaders() });
  console.log(JSON.stringify(data, null, 2));
}

main().catch(console.error);
