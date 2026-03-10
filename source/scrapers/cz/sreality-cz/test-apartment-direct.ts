import axios from 'axios';
import { transformApartment } from './src/transformers/apartments/apartmentTransformer';

async function testDirect() {
  try {
    const tms = Date.now();
    const listUrl = `https://www.sreality.cz/api/cs/v2/estates?page=1&per_page=1&category_main_cb=1&tms=${tms}`;
    const listResp = await axios.get(listUrl, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 15000 });
    const listing = listResp.data._embedded?.estates?.[0];

    await new Promise(r => setTimeout(r, 500));

    const detailUrl = `https://www.sreality.cz/api/cs/v2/estates/${listing.hash_id}`;
    const detailResp = await axios.get(detailUrl, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 15000 });

    const fullListing = {
      ...listing,
      items: detailResp.data.items || [],
      text: detailResp.data.text
    };

    console.log('Calling transformApartment directly...');
    const result = transformApartment(fullListing as any);

    console.log('\nResult:');
    console.log('- Title:', result.title);
    console.log('- Bedrooms:', result.bedrooms);
    console.log('- SQM:', result.sqm);
    console.log('- Condition:', result.condition);
    console.log('- Country specific:', JSON.stringify(result.country_specific, null, 2));
    console.log('- Portal metadata:', JSON.stringify(result.portal_metadata, null, 2));

  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : error);
    console.error('Stack:', error instanceof Error ? error.stack : '');
  }
}

testDirect();
