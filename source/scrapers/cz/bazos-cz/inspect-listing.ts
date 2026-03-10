/**
 * Inspect a real Bazos listing to see original data
 */

import dotenv from 'dotenv';
dotenv.config();

import axios from 'axios';

async function inspectListing() {
  const listingId = '214875342';

  console.log(`\n🔍 Inspecting Bazos Listing: ${listingId}\n`);

  try {
    // Fetch from Bazos API
    const response = await axios.get(`https://bazos.cz/api.php`, {
      params: {
        hledat: '',
        rubriky: 'reality',
        hlokalita: '',
        cenaod: '',
        cenado: '',
        Submit: 'Hledat',
        kitx: listingId
      }
    });

    if (response.data && response.data.length > 0) {
      const listing = response.data[0];

      console.log('📋 ORIGINAL DATA FROM BAZOS API:');
      console.log('================================\n');
      console.log(`ID: ${listing.inzeratid}`);
      console.log(`Title: ${listing.title}`);
      console.log(`Price: ${listing.price} (formatted: ${listing.price_formatted})`);
      console.log(`Locality: ${listing.locality}`);
      console.log(`Posted: ${listing.from}`);
      console.log(`Image: ${listing.image_thumbnail ? 'Yes' : 'No'}`);
      console.log(`\nWhat LLM would see:`);
      console.log(`Text: "${listing.title}"`);
      console.log(`(Description would come from detail page scraping)`);

    } else {
      console.log('❌ Listing not found in API response');
    }

  } catch (error: any) {
    console.error('❌ Error:', error.message);
  }

  console.log('\n');
  process.exit(0);
}

inspectListing();
