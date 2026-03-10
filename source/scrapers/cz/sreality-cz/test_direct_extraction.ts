import axios from 'axios';

async function test() {
  const response = await axios.get('https://www.sreality.cz/api/cs/v2/estates/3014853452', {
    headers: { 'User-Agent': 'Mozilla/5.0' },
    timeout: 30000
  });

  const items = response.data.items;

  // Inline the exact same function from the transformer
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

  const result = extractSewageType(items);
  console.log('Result:', result);
}

test().catch(console.error);
