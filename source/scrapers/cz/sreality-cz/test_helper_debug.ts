// Test the helper function logic
function getItemValueAsString(value: any): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;

  // Handle array of objects (e.g., [{ name: 'Voda', value: 'Vodovod' }])
  if (Array.isArray(value) && value.length > 0) {
    const firstItem = value[0];
    console.log('First item:', firstItem, 'Type:', typeof firstItem);
    if (typeof firstItem === 'object' && firstItem !== null && 'value' in firstItem) {
      console.log('Found value in first item:', firstItem.value);
      return getItemValueAsString(firstItem.value);
    }
    if (typeof firstItem === 'string') {
      console.log('First item is string:', firstItem);
      return firstItem;
    }
  }

  console.log('Fallback: returning String(value)');
  return String(value);
}

// Test with sample data
const waterValue = [{ name: 'Voda', value: 'Vodovod' }];
const result = getItemValueAsString(waterValue);
console.log('\nResult:', result);
console.log('Result type:', typeof result);
