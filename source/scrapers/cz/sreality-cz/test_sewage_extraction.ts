import axios from 'axios';

// Minimal implementation to test sewage extraction
function getItemValueAsString(value: any): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;

  // Handle array of objects (e.g., [{ name: 'Voda', value: 'Vodovod' }])
  if (Array.isArray(value) && value.length > 0) {
    const firstItem = value[0];
    if (typeof firstItem === 'object' && firstItem !== null && 'value' in firstItem) {
      return getItemValueAsString(firstItem.value);
    }
    if (typeof firstItem === 'string') {
      return firstItem;
    }
  }

  return String(value);
}

function extractSewageType(items: Array<{ name: string; value: any }>): string | undefined {
  if (!items) return undefined;

  const sewageItem = items.find(i => {
    const name = String(i.name || '').toLowerCase();
    return name.includes('kanalizace') ||
           name.includes('odkanalizace') ||
           name.includes('odpad') ||
           name.includes('jímka') ||
           name.includes('sewage') ||
           name.includes('wastewater');
  });

  if (!sewageItem?.value) return undefined;

  // Return raw value for normalization later (handles both strings and complex values)
  const rawValue = getItemValueAsString(sewageItem.value);
  return rawValue || undefined;
}

async function testExtraction() {
  const hash_id = 3014853452;
  const url = `https://www.sreality.cz/api/cs/v2/estates/${hash_id}`;

  const response = await axios.get(url, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
    timeout: 30000
  });

  const listing = response.data;
  console.log(`\nTesting extraction for hash ${hash_id}`);
  console.log(`Found ${listing.items.length} items\n`);

  // Find the Odpad item
  const odpadItem = listing.items.find((i: any) => i.name === 'Odpad');
  if (odpadItem) {
    console.log('Raw Odpad item:');
    console.log(JSON.stringify(odpadItem, null, 2));
    console.log();
  }

  // Test extraction
  const result = extractSewageType(listing.items);
  console.log(`Extracted sewage_type: ${result ? JSON.stringify(result) : 'undefined'}`);
}

testExtraction().catch(console.error);
