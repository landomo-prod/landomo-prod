/**
 * Verify house plot size extraction
 */

const { fetchAllListingPages } = require('./dist/sreality/src/utils/fetchData');
const { transformSRealityToStandard } = require('./dist/sreality/src/transformers/srealityTransformer');

async function testHousePlotSize() {
  console.log('🏡 Testing House Plot Size Extraction\n');

  // Fetch house listings
  console.log('📥 Fetching 100 house listings...');
  const houses = await fetchAllListingPages(2, 1, 1); // category 2 = houses, type 1 = sale

  console.log(`✅ Fetched ${houses.length} house listings\n`);

  // Transform and check plot sizes
  console.log('🔄 Transforming and checking plot sizes...\n');

  let withPlotSize = 0;
  let withoutPlotSize = 0;
  const samples = [];

  for (const house of houses.slice(0, 20)) { // Check first 20 as sample
    const transformed = transformSRealityToStandard(house);

    if (transformed.sqm_plot && transformed.sqm_plot > 0) {
      withPlotSize++;
      if (samples.length < 5) {
        samples.push({
          portal_id: transformed.portal_id,
          title: transformed.title,
          sqm_living: transformed.sqm_living,
          sqm_plot: transformed.sqm_plot,
          price: transformed.price
        });
      }
    } else {
      withoutPlotSize++;
    }
  }

  console.log('📊 Results (first 20 houses):');
  console.log(`  - With plot size: ${withPlotSize}/20 (${withPlotSize/20*100}%)`);
  console.log(`  - Without plot size: ${withoutPlotSize}/20 (${withoutPlotSize/20*100}%)`);

  if (samples.length > 0) {
    console.log('\n📄 Sample houses with plot sizes:\n');
    samples.forEach((house, idx) => {
      console.log(`${idx + 1}. ${house.title.substring(0, 60)}...`);
      console.log(`   Portal ID: ${house.portal_id}`);
      console.log(`   Living Area: ${house.sqm_living || 'N/A'} m²`);
      console.log(`   Plot Size: ${house.sqm_plot} m² ✅`);
      console.log(`   Price: ${(house.price / 1000000).toFixed(2)}M CZK`);
      console.log('');
    });
  }

  // Check all houses
  console.log('📈 Checking all ' + houses.length + ' houses...');
  let totalWithPlot = 0;
  let totalWithoutPlot = 0;
  let plotSizes = [];

  for (const house of houses) {
    const transformed = transformSRealityToStandard(house);
    if (transformed.sqm_plot && transformed.sqm_plot > 0) {
      totalWithPlot++;
      plotSizes.push(transformed.sqm_plot);
    } else {
      totalWithoutPlot++;
    }
  }

  console.log(`\n✅ Full Dataset Results:`);
  console.log(`  - Houses with plot size: ${totalWithPlot}/${houses.length} (${(totalWithPlot/houses.length*100).toFixed(1)}%)`);
  console.log(`  - Houses without plot size: ${totalWithoutPlot}/${houses.length} (${(totalWithoutPlot/houses.length*100).toFixed(1)}%)`);

  if (plotSizes.length > 0) {
    const avgPlot = plotSizes.reduce((a, b) => a + b, 0) / plotSizes.length;
    const minPlot = Math.min(...plotSizes);
    const maxPlot = Math.max(...plotSizes);

    console.log(`\n📊 Plot Size Statistics:`);
    console.log(`  - Average: ${avgPlot.toFixed(0)} m²`);
    console.log(`  - Min: ${minPlot} m²`);
    console.log(`  - Max: ${maxPlot.toLocaleString()} m²`);
  }

  console.log('\n' + '='.repeat(60));
  if (totalWithPlot >= houses.length * 0.5) {
    console.log('✅ SUCCESS: Plot size extraction working correctly!');
    console.log(`   ${(totalWithPlot/houses.length*100).toFixed(1)}% of houses have plot size data`);
  } else {
    console.log('⚠️  WARNING: Low plot size extraction rate');
    console.log(`   Only ${(totalWithPlot/houses.length*100).toFixed(1)}% of houses have plot size`);
  }
  console.log('='.repeat(60));
}

testHousePlotSize().catch(error => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
