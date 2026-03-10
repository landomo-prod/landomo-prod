import axios from 'axios';
import { SRealityListing } from './src/types/srealityTypes';

// Copy the helper and extractor functions for testing
function getItemValueAsString(value: any): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;

  // Handle array of objects (e.g., [{ name: 'Voda', value: 'Vodovod' }])
  if (Array.isArray(value) && value.length > 0) {
    const firstItem = value[0];
    console.log('  Array item:', firstItem, 'Type:', typeof firstItem);
    if (typeof firstItem === 'object' && firstItem !== null && 'value' in firstItem) {
      console.log('  Found value:', firstItem.value);
      return getItemValueAsString(firstItem.value);
    }
    if (typeof firstItem === 'string') {
      return firstItem;
    }
  }

  console.log('  Fallback String conversion');
  return String(value);
}

function extractWaterSupply(items?: Array<{ name: string; value: any }>): string | undefined {
  if (!items) return undefined;

  const waterItem = items.find(i =>
    i.name === 'Voda' ||
    i.name === 'Vodovod' ||
    i.name === 'Water supply' ||
    (i.name && i.name.toLowerCase().includes('voda'))
  );

  console.log('Water item:', waterItem?.name, 'value type:', typeof waterItem?.value);

  if (!waterItem?.value) return undefined;

  // Return raw value for normalization later (handles both strings and complex values)
  const rawValue = getItemValueAsString(waterItem.value);
  console.log('Raw value result:', rawValue);
  return rawValue || undefined;
}

async function test() {
  try {
    const url = 'https://www.sreality.cz/api/cs/v2/estates/3014853452';
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    };

    const response = await axios.get(url, { headers, timeout: 30000 });
    const listing: SRealityListing = response.data;

    console.log('Testing water extraction...');
    const result = extractWaterSupply(listing.items);
    console.log('Final result:', result);
    console.log('Result type:', typeof result);

  } catch (error: any) {
    console.error('Error:', error.message);
  }
}

test();
