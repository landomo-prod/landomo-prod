const cheerio = require('cheerio');
const { transformApartment } = require('./dist/transformers/ceskerealityApartmentTransformer');
const { transformHouse } = require('./dist/transformers/ceskerealityHouseTransformer');
const { transformLand } = require('./dist/transformers/ceskerealityLandTransformer');
const { transformCommercial } = require('./dist/transformers/ceskerealityCommercialTransformer');

async function comprehensiveCheck() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  COMPREHENSIVE DATA ACCURACY CHECK');
  console.log('  Testing multiple listings across all categories');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const tests = [
    {
      category: 'APARTMENT',
      url: 'https://www.ceskereality.cz/prodej/byty/byty-3-kk/praha/prodej-bytu-3-kk-100-m2-na-vysocanskych-vinicich-3084877.html',
      transformer: transformApartment,
      checkFields: ['bedrooms', 'sqm', 'has_balcony', 'has_elevator', 'floor', 'construction_type', 'condition', 'energy_class']
    },
    {
      category: 'HOUSE',
      url: 'https://www.ceskereality.cz/prodej/rodinne-domy/rodinne-domy/nemyceves/prodej-rodinneho-domu-150-m2-3578816.html',
      transformer: transformHouse,
      checkFields: ['bedrooms', 'sqm_living', 'sqm_plot', 'has_garden', 'has_garage', 'construction_type']
    },
    {
      category: 'LAND',
      url: 'https://www.ceskereality.cz/prodej/pozemky/stavebni-parcely/mostek/prodej-stavebni-parcely-1-660-m2-3004993.html',
      transformer: transformLand,
      checkFields: ['area_plot_sqm']
    }
  ];

  const results = {
    total: 0,
    passed: 0,
    failed: 0,
    issues: []
  };

  for (const test of tests) {
    console.log(`\n${'═'.repeat(70)}`);
    console.log(`  ${test.category}`);
    console.log(`${'═'.repeat(70)}`);
    console.log(`URL: ${test.url}\n`);

    try {
      const response = await fetch(test.url);
      const html = await response.text();
      const $ = cheerio.load(html);

      // Extract JSON-LD
      const jsonLdScript = $('script[type="application/ld+json"]').first();
      if (!jsonLdScript.length) {
        console.log('❌ No JSON-LD found - listing may have been removed\n');
        continue;
      }

      const jsonLd = JSON.parse(jsonLdScript.html());

      // Extract property details
      const propertyDetails = {};
      $('.i-info').each((_, el) => {
        const label = $(el).find('.i-info__title').text().trim();
        const value = $(el).find('.i-info__value').text().trim();
        if (label && value) {
          propertyDetails[label] = value;
        }
      });

      // Extract images
      const images = [];
      $('img[src*="img.ceskereality.cz/foto"]').each((_, el) => {
        const src = $(el).attr('src');
        if (src && !src.includes('logo') && !src.includes('icon') && !src.includes('makleri')) {
          const fullSizeUrl = src.split('?')[0];
          if (!images.includes(fullSizeUrl)) {
            images.push(fullSizeUrl);
          }
        }
      });

      // Transform
      const transformed = test.transformer(jsonLd, test.url, { images, propertyDetails });

      console.log('RAW DATA:');
      console.log('  Title:', jsonLd.name);
      console.log('  Price:', jsonLd.offers?.price, jsonLd.offers?.priceCurrency);
      console.log('  Description length:', jsonLd.description?.length, 'chars');
      console.log('  Images:', images.length);
      console.log('  Property details:', Object.keys(propertyDetails).length, 'fields');

      console.log('\nKEY PROPERTY DETAILS:');
      Object.entries(propertyDetails).slice(0, 10).forEach(([k, v]) => {
        console.log(`  ${k}: ${v}`);
      });

      console.log('\nTRANSFORMED DATA:');
      console.log('  property_category:', transformed.property_category);
      console.log('  title:', transformed.title);
      console.log('  price:', transformed.price, transformed.currency);
      console.log('  location:', transformed.location.city);
      console.log('  images:', transformed.images?.length);
      console.log('  description:', transformed.description?.length, 'chars');

      console.log('\nCATEGORY-SPECIFIC FIELDS:');
      test.checkFields.forEach(field => {
        const value = transformed[field];
        console.log(`  ${field}: ${value}`);
      });

      // Validation checks
      console.log('\nVALIDATION CHECKS:');
      const checks = [];

      // Basic checks
      checks.push({
        name: 'Property category set',
        pass: !!transformed.property_category,
        value: transformed.property_category
      });

      checks.push({
        name: 'Title matches',
        pass: transformed.title === jsonLd.name,
        raw: jsonLd.name,
        transformed: transformed.title
      });

      checks.push({
        name: 'Price matches',
        pass: transformed.price === jsonLd.offers?.price,
        raw: jsonLd.offers?.price,
        transformed: transformed.price
      });

      checks.push({
        name: 'Currency matches',
        pass: transformed.currency === jsonLd.offers?.priceCurrency,
        raw: jsonLd.offers?.priceCurrency,
        transformed: transformed.currency
      });

      checks.push({
        name: 'Description matches',
        pass: transformed.description === jsonLd.description,
        raw: jsonLd.description?.substring(0, 50) + '...',
        transformed: transformed.description?.substring(0, 50) + '...'
      });

      checks.push({
        name: 'Images match',
        pass: transformed.images?.length === images.length,
        raw: images.length,
        transformed: transformed.images?.length
      });

      checks.push({
        name: 'Source URL correct',
        pass: transformed.source_url === test.url,
        raw: test.url,
        transformed: transformed.source_url
      });

      checks.push({
        name: 'Status is active',
        pass: transformed.status === 'active',
        value: transformed.status
      });

      // Category-specific checks
      if (test.category === 'APARTMENT') {
        checks.push({
          name: 'Bedrooms extracted',
          pass: typeof transformed.bedrooms === 'number',
          value: transformed.bedrooms
        });

        checks.push({
          name: 'Sqm extracted',
          pass: transformed.sqm > 0,
          value: transformed.sqm
        });

        // Check if balcony detection works
        const hasBalconyKeyword = /balkon|terasa|lodžie/i.test(jsonLd.description || '');
        const hasBalconyInDetails = Object.keys(propertyDetails).some(k => /balkon/i.test(k));
        if (hasBalconyKeyword || hasBalconyInDetails) {
          checks.push({
            name: 'Balcony/terrace detected',
            pass: transformed.has_balcony || transformed.has_terrace,
            info: 'Found balcony keyword in description or details'
          });
        }
      }

      if (test.category === 'HOUSE') {
        // Check plot size extraction
        const plotInDesc = jsonLd.description?.match(/pozemek[^\d]*([\d\s]+)\s*m[²2]/i);
        const plotInDetails = propertyDetails['Plocha pozemku'];

        if (plotInDesc || plotInDetails) {
          checks.push({
            name: 'Plot size extracted',
            pass: transformed.sqm_plot > 0,
            raw: plotInDesc?.[0] || plotInDetails,
            transformed: transformed.sqm_plot
          });
        }

        // Check bedroom extraction
        const bedroomInDesc = jsonLd.description?.match(/(\d+)\s*(?:ložnic|pokojů|pokoj)/i);
        if (bedroomInDesc) {
          checks.push({
            name: 'Bedrooms extracted from description',
            pass: transformed.bedrooms > 0,
            raw: bedroomInDesc[0],
            transformed: transformed.bedrooms
          });
        }
      }

      if (test.category === 'LAND') {
        checks.push({
          name: 'Area extracted',
          pass: transformed.area_plot_sqm > 0,
          value: transformed.area_plot_sqm
        });
      }

      // Print check results
      let testPassed = true;
      checks.forEach(check => {
        const status = check.pass ? '✅' : '❌';
        console.log(`  ${status} ${check.name}`);
        if (!check.pass) {
          testPassed = false;
          if (check.raw !== undefined) {
            console.log(`      Raw: ${check.raw}`);
            console.log(`      Transformed: ${check.transformed}`);
          }
          if (check.value !== undefined) {
            console.log(`      Value: ${check.value}`);
          }
          if (check.info) {
            console.log(`      Info: ${check.info}`);
          }
          results.issues.push({
            category: test.category,
            url: test.url,
            check: check.name
          });
        }
      });

      results.total++;
      if (testPassed) {
        results.passed++;
        console.log('\n✅ ALL CHECKS PASSED');
      } else {
        results.failed++;
        console.log('\n❌ SOME CHECKS FAILED');
      }

    } catch (error) {
      console.log(`❌ Error testing ${test.category}:`, error.message);
      results.total++;
      results.failed++;
    }
  }

  // Final summary
  console.log('\n\n' + '═'.repeat(70));
  console.log('  FINAL SUMMARY');
  console.log('═'.repeat(70));
  console.log(`Total listings tested: ${results.total}`);
  console.log(`Passed: ${results.passed} ✅`);
  console.log(`Failed: ${results.failed} ${results.failed > 0 ? '❌' : ''}`);

  if (results.issues.length > 0) {
    console.log('\nISSUES FOUND:');
    results.issues.forEach((issue, i) => {
      console.log(`  ${i + 1}. ${issue.category} - ${issue.check}`);
    });
  } else {
    console.log('\n🎉 NO ISSUES FOUND - ALL DATA ACCURATE!');
  }

  console.log('\n' + '═'.repeat(70));
}

comprehensiveCheck().catch(console.error);
