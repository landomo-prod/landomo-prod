import axios from 'axios';
import { getRandomUserAgent } from './src/utils/userAgents';

/**
 * Inspect actual API response structure to understand items format
 */

async function inspectApiResponse(): Promise<void> {
  try {
    // Fetch a listing that we know works
    const hash_id = 750941004;
    const url = `https://www.sreality.cz/api/cs/v2/estates/${hash_id}`;
    const headers = { 'User-Agent': getRandomUserAgent() };

    console.log(`Fetching detail for ${hash_id}...`);
    const response = await axios.get(url, { headers, timeout: 30000 });

    console.log('\n========== API RESPONSE STRUCTURE ==========\n');
    console.log(`Full response keys: ${Object.keys(response.data).join(', ')}`);

    if (response.data.items) {
      console.log(`\n========== ITEMS ARRAY (${response.data.items.length} items) ==========\n`);

      // Show first 10 items
      response.data.items.slice(0, 10).forEach((item: any, index: number) => {
        console.log(`Item ${index}:`);
        console.log(`  Type: ${typeof item}`);
        console.log(`  Keys: ${Object.keys(item).join(', ')}`);
        console.log(`  Full item: ${JSON.stringify(item, null, 2)}`);
        console.log('');
      });

      console.log('\n========== ALL ITEMS BY TYPE ==========\n');

      // Group by type
      const itemsByType: Record<string, any[]> = {};
      response.data.items.forEach((item: any) => {
        const key = item.type || 'unknown';
        if (!itemsByType[key]) itemsByType[key] = [];
        itemsByType[key].push(item);
      });

      Object.entries(itemsByType).forEach(([type, items]) => {
        console.log(`\nType: ${type} (${items.length} items)`);
        const sample = items[0];
        if (sample) {
          console.log(`Sample structure: ${JSON.stringify(sample, null, 2)}`);
        }
      });

      console.log('\n========== SEARCHING FOR AMENITY ITEMS ==========\n');

      const amenityKeywords = ['balkón', 'terasa', 'výtah', 'klimatizace', 'bezpečnost', 'krb', 'alarm', 'kamera', 'parking', 'garáž'];
      const amenityItems = response.data.items.filter((item: any) => {
        const name = item.name?.toLowerCase() || '';
        return amenityKeywords.some(keyword => name.includes(keyword));
      });

      console.log(`Found ${amenityItems.length} amenity-related items:`);
      amenityItems.forEach((item: any) => {
        console.log(`\n${JSON.stringify(item, null, 2)}`);
      });
    }

  } catch (error: any) {
    console.error('Error:', error.message);
  }
}

inspectApiResponse();
