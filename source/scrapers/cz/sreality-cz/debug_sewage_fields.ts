import axios from 'axios';
import { SRealityListing } from './src/types/srealityTypes';

async function fetchEstateDetail(hash_id: number): Promise<SRealityListing | null> {
  try {
    const url = `https://www.sreality.cz/api/cs/v2/estates/${hash_id}`;
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    };

    const response = await axios.get(url, { headers, timeout: 30000 });
    return response.data;
  } catch (error: any) {
    console.error(`Failed to fetch: ${error.message}`);
    return null;
  }
}

async function debugSewageFields() {
  const testHashes = [3014853452, 1867608908, 390759244];

  for (const hash of testHashes) {
    console.log(`\n========== Hash: ${hash} ==========\n`);
    const listing = await fetchEstateDetail(hash);

    if (listing && listing.items) {
      console.log(`Total items: ${listing.items.length}\n`);

      // Show all items with names containing water, sewage, waste, etc.
      const relevantItems = listing.items.filter(i => {
        const name = String(i.name || '').toLowerCase();
        return name.includes('voda') || name.includes('kan') || name.includes('odpad') ||
               name.includes('jímka') || name.includes('vody') || name.includes('septic') ||
               name.includes('topení') || name.includes('plyn');
      });

      if (relevantItems.length > 0) {
        console.log('Relevant Infrastructure Items:');
        relevantItems.forEach(item => {
          const valueStr = JSON.stringify(item.value);
          console.log(`  - Name: "${item.name}" (type: ${item.type})`);
          console.log(`    Value: ${valueStr.substring(0, 150)}`);
          console.log();
        });
      } else {
        console.log('No infrastructure items found matching patterns\n');
      }

      // Show ALL items for inspection
      console.log('\nALL ITEMS:');
      listing.items.forEach((item, idx) => {
        console.log(`  [${idx}] ${item.name} (${item.type})`);
      });
    }

    await new Promise(resolve => setTimeout(resolve, 500));
  }
}

debugSewageFields().catch(console.error);
