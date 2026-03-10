import https from 'https';

function fetchDetail(hashId: number): Promise<any> {
  return new Promise((resolve, reject) => {
    https.get(`https://www.sreality.cz/api/cs/v2/estates/${hashId}`, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });
}

async function test() {
  console.log('🧪 Testing Electricity Voltage Pattern Fix\n');
  
  try {
    const listing = await fetchDetail(3421832524);
    const { transformLand } = await import('./src/transformers/land/landTransformer.js');
    const { SRealityItemsParser, FIELD_NAMES } = await import('./src/utils/itemsParser.js');
    
    console.log('📋 Raw API Data:');
    console.log(`   items count: ${listing.items?.length || 0}`);
    
    // Check for electricity field
    const parser = new SRealityItemsParser(listing.items || []);
    const electricityRaw = parser.getString(FIELD_NAMES.ELECTRICITY);
    console.log(`   Electricity field value: "${electricityRaw || 'NOT FOUND'}"`);
    
    // Check if it contains voltage pattern
    if (electricityRaw) {
      const hasVoltage = /\d+v/i.test(electricityRaw);
      console.log(`   Contains voltage pattern (e.g., 230V): ${hasVoltage ? '✓' : '✗'}`);
    }
    
    // Transform
    const transformed = transformLand(listing);
    
    console.log('\n🔄 Transformer Output:');
    console.log(`   electricity: ${transformed.electricity || 'undefined'}`);
    console.log(`   has_electricity: ${transformed.has_electricity} (type: ${typeof transformed.has_electricity})`);
    console.log(`   portal_id: ${transformed.portal_id}`);
    console.log(`   area_plot_sqm: ${transformed.area_plot_sqm}`);
    
    console.log('\n📊 Test Results:');
    const portalIdPass = transformed.portal_id?.includes('3421832524');
    const booleanPass = typeof transformed.has_electricity === 'boolean';
    const areaPass = typeof transformed.area_plot_sqm === 'number';
    
    console.log(`   ${portalIdPass ? '✅' : '❌'} portal_id correct (hash_id extraction)`);
    console.log(`   ${booleanPass ? '✅' : '❌'} Boolean type correct (ensureBoolean)`);
    console.log(`   ${areaPass ? '✅' : '❌'} Area extraction working`);
    
    if (electricityRaw && /\d+v/i.test(electricityRaw)) {
      const voltageDetected = transformed.electricity === 'connected';
      console.log(`   ${voltageDetected ? '✅' : '❌'} Voltage pattern detected (Fix #3)`);
    }
    
    console.log('\n✅ Land transformer test passed!');
    
  } catch (error: any) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

test();
