/**
 * Check if properties were ingested successfully
 */
import axios from 'axios';

async function checkIngestion() {
  try {
    // Check recent properties from bazos
    const response = await axios.get('http://187.77.70.123:3004/api/v1/properties/recent', {
      params: {
        portal: 'bazos',
        limit: 5
      },
      headers: {
        'Authorization': 'Bearer prod_cz_ea45bf46910d245972b03e1ae2b0c9fb'
      },
      timeout: 10000
    });

    console.log('Recent bazos properties:');
    console.log(JSON.stringify(response.data, null, 2));
  } catch (error: any) {
    console.log('Could not fetch recent properties:', error.message);
    console.log('This endpoint might not exist, but properties may still be ingested.');
  }
}

checkIngestion();
