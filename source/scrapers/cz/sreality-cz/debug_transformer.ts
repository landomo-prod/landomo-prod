import axios from 'axios';
import { transformSRealityToStandard } from './src/transformers/srealityTransformer';
import { SRealityListing } from './src/types/srealityTypes';

async function debugTransformer() {
  const hash_id = 3014853452;
  const url = `https://www.sreality.cz/api/cs/v2/estates/${hash_id}`;

  const response = await axios.get(url, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
    timeout: 30000
  });

  const listing: SRealityListing = response.data;

  console.log(`\nDebug Transformer - Hash ${hash_id}`);
  console.log(`Total items: ${listing.items ? listing.items.length : 'undefined'}`);

  // Check structure
  if (listing.items) {
    console.log('\nItems array structure:');
    console.log(`  Is array: ${Array.isArray(listing.items)}`);
    console.log(`  Length: ${listing.items.length}`);

    // Find Odpad
    const odpad = listing.items.find(i => i.name === 'Odpad');
    if (odpad) {
      console.log('\nOdpad item found:');
      console.log(`  name: ${typeof odpad.name} = "${odpad.name}"`);
      console.log(`  type: ${odpad.type}`);
      console.log(`  value type: ${typeof odpad.value}`);
      console.log(`  value is array: ${Array.isArray(odpad.value)}`);
      if (Array.isArray(odpad.value) && odpad.value.length > 0) {
        console.log(`    [0] type: ${typeof odpad.value[0]}`);
        console.log(`    [0] has 'value' property: ${'value' in odpad.value[0]}`);
        if ('value' in odpad.value[0]) {
          console.log(`    [0].value = "${odpad.value[0].value}"`);
        }
      }
    }
  }

  console.log('\n--- Running transformer ---\n');
  const transformed = transformSRealityToStandard(listing);

  console.log('Transformer output:');
  console.log(`  sewage_type: ${transformed.country_specific?.sewage_type || 'undefined'}`);
  console.log(`  water_supply: ${transformed.country_specific?.water_supply || 'undefined'}`);

  // Try manual extraction to compare
  console.log('\n--- Manual extraction test ---\n');

  function manualExtractSewage(items: Array<any>): string | undefined {
    const sewageItem = items.find(i => {
      const name = String(i.name || '').toLowerCase();
      const found = name.includes('kanalizace') ||
             name.includes('odkanalizace') ||
             name.includes('odpad') ||
             name.includes('jímka') ||
             name.includes('sewage') ||
             name.includes('wastewater');
      if (i.name === 'Odpad') {
        console.log(`Checking "${i.name}": lowercase="${name}", found=${found}`);
      }
      return found;
    });

    console.log(`Sewage item found: ${!!sewageItem}`);
    if (sewageItem) {
      console.log(`Sewage item name: "${sewageItem.name}"`);
      console.log(`Sewage item value: ${JSON.stringify(sewageItem.value)}`);
    }

    return sewageItem ? 'FOUND' : undefined;
  }

  const manualResult = manualExtractSewage(listing.items!);
  console.log(`\nManual extraction result: ${manualResult}`);
}

debugTransformer().catch(console.error);
