import axios from 'axios';
import { getRealisticHeaders } from '../utils/headers';

async function main() {
  const url = `https://www.sreality.cz/api/cs/v2/estates?page=1&per_page=5&category_main_cb=1&category_type_cb=1&tms=${Date.now()}`;
  const { data } = await axios.get(url, { headers: getRealisticHeaders() });
  console.log(JSON.stringify(data, null, 2));
}

main().catch(console.error);
