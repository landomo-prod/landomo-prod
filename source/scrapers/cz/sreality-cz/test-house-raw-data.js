/**
 * Inspect raw house listing data to see available fields
 */

const { fetchAllListingPages } = require('./dist/sreality/src/utils/fetchData');

async function inspectHouseData() {
  console.log('🔍 Inspecting Raw House Listing Data\n');

  const houses = await fetchAllListingPages(2, 1, 1); // category 2 = houses

  if (houses.length === 0) {
    console.error('❌ No houses fetched');
    process.exit(1);
  }

  const house = houses[0];

  console.log('📄 Raw House Listing Structure:\n');
  console.log('Top-level keys:', Object.keys(house).join(', '));
  console.log('\nFull listing (first house):');
  console.log(JSON.stringify(house, null, 2));

  console.log('\n\n🔍 Key Fields for Plot Size:');
  console.log('  - Has items array:', !!house.items);
  console.log('  - Items count:', house.items?.length || 0);
  console.log('  - Name:', house.name);

  if (house.items && house.items.length > 0) {
    console.log('\n📋 Items array (field details):');
    house.items.forEach((item, idx) => {
      console.log(`  ${idx + 1}. ${item.name || 'No name'}: ${item.value || 'No value'}`);
    });
  } else {
    console.log('\n⚠️  No items array - this is preview data only');
    console.log('   Plot size requires fetching individual listing details');
  }

  console.log('\n📊 Available area-related fields:');
  const areaFields = [];
  if (house.items) {
    house.items.forEach(item => {
      if (item.name && (
        item.name.toLowerCase().includes('plocha') ||
        item.name.toLowerCase().includes('area') ||
        item.name.toLowerCase().includes('pozemek') ||
        item.name.toLowerCase().includes('plot') ||
        item.name.toLowerCase().includes('m²')
      )) {
        areaFields.push(`${item.name}: ${item.value}`);
      }
    });
  }

  if (areaFields.length > 0) {
    areaFields.forEach(field => console.log(`  - ${field}`));
  } else {
    console.log('  - None found in preview data');
  }
}

inspectHouseData().catch(error => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
