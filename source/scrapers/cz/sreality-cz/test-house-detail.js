/**
 * Fetch full house detail to check if plot size is in items array
 */

const axios = require('axios');

async function fetchHouseDetail() {
  console.log('🔍 Fetching Full House Detail Data\n');

  // Use the house from previous test: hash_id 3699618380
  const hashId = 3699618380;
  const detailUrl = `https://www.sreality.cz/api/cs/v2/estates/${hashId}`;

  console.log(`📥 Fetching detail for listing ${hashId}...`);
  console.log(`   URL: ${detailUrl}\n`);

  try {
    const response = await axios.get(detailUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      }
    });

    const detail = response.data;

    console.log('✅ Detail fetched successfully\n');
    console.log('📄 Top-level keys:', Object.keys(detail).join(', '));
    console.log('\n🔍 Key Fields:');
    console.log('  - Has items array:', !!detail.items);
    console.log('  - Items count:', detail.items?.length || 0);
    console.log('  - Name:', detail.name);

    if (detail.items && detail.items.length > 0) {
      console.log('\n📋 Items Array (all fields):\n');
      detail.items.forEach((item, idx) => {
        console.log(`${(idx + 1).toString().padStart(2)}. ${item.name?.padEnd(40)} : ${item.value || 'N/A'}`);
      });

      console.log('\n🔍 Searching for plot/pozemek fields...\n');
      const plotFields = detail.items.filter(item =>
        item.name && (
          item.name.toLowerCase().includes('pozemek') ||
          item.name.toLowerCase().includes('plot') ||
          item.name.toLowerCase().includes('parcela') ||
          item.name.toLowerCase().includes('land')
        )
      );

      if (plotFields.length > 0) {
        console.log('✅ Found plot-related fields:');
        plotFields.forEach(field => {
          console.log(`   - ${field.name}: ${field.value}`);
        });
      } else {
        console.log('❌ No plot-related fields found in items array');
      }

      console.log('\n🔍 All area-related fields:\n');
      const areaFields = detail.items.filter(item =>
        item.name && (
          item.name.toLowerCase().includes('plocha') ||
          item.name.toLowerCase().includes('area') ||
          item.name.toLowerCase().includes('m²') ||
          item.name.toLowerCase().includes('m2')
        )
      );

      if (areaFields.length > 0) {
        areaFields.forEach(field => {
          console.log(`   - ${field.name}: ${field.value}`);
        });
      }
    } else {
      console.log('\n⚠️  No items array in detail response!');
    }

    // Also check for plot info in other fields
    console.log('\n🔍 Checking other potential fields:');
    console.log('  - text.value:', detail.text?.value ? 'Present (description)' : 'N/A');
    console.log('  - price:', detail.price);
    console.log('  - locality:', detail.locality);

  } catch (error) {
    console.error('❌ Error fetching detail:', error.message);
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', error.response.data);
    }
  }
}

fetchHouseDetail().catch(error => {
  console.error('❌ Unhandled error:', error.message);
  process.exit(1);
});
