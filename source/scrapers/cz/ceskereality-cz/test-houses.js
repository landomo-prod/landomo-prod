const cheerio = require('cheerio');
const { transformHouse } = require('./dist/transformers/ceskerealityHouseTransformer');

async function testMultipleHouses() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  TESTING MULTIPLE HOUSES - AREA EXTRACTION VERIFICATION');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // Get fresh house listings
  const listingPageUrl = 'https://www.ceskereality.cz/prodej/rodinne-domy/';
  const listingResponse = await fetch(listingPageUrl);
  const listingHtml = await listingResponse.text();
  const $listing = cheerio.load(listingHtml);

  const houseUrls = [];
  $listing('a[href*="/prodej/rodinne-domy/"][href$=".html"]').each((_, el) => {
    const href = $listing(el).attr('href');
    if (href) {
      const absoluteUrl = href.startsWith('http') ? href : `https://www.ceskereality.cz${href}`;
      if (!houseUrls.includes(absoluteUrl)) {
        houseUrls.push(absoluteUrl);
      }
    }
  });

  console.log(`Found ${houseUrls.length} house listings. Testing first 5...\n`);

  for (let i = 0; i < Math.min(5, houseUrls.length); i++) {
    const url = houseUrls[i];

    console.log(`\n${'─'.repeat(70)}`);
    console.log(`HOUSE #${i + 1}`);
    console.log(`${'─'.repeat(70)}`);
    console.log(`URL: ${url}\n`);

    try {
      const response = await fetch(url);
      const html = await response.text();
      const $ = cheerio.load(html);

      const jsonLdScript = $('script[type="application/ld+json"]').first();
      if (!jsonLdScript.length) {
        console.log('❌ No JSON-LD found\n');
        continue;
      }

      const jsonLd = JSON.parse(jsonLdScript.html());

      const propertyDetails = {};
      $('.i-info').each((_, el) => {
        const label = $(el).find('.i-info__title').text().trim();
        const value = $(el).find('.i-info__value').text().trim();
        if (label && value) {
          propertyDetails[label] = value;
        }
      });

      console.log('RAW DATA:');
      console.log('  Title:', jsonLd.name);
      console.log('  Description snippet:', jsonLd.description?.substring(0, 150) + '...');

      console.log('\n  Property Details (area-related):');
      Object.entries(propertyDetails).forEach(([k, v]) => {
        if (/plocha|pozemek|m²/i.test(k) || /plocha|pozemek|m²/i.test(v)) {
          console.log(`    ${k}: ${v}`);
        }
      });

      // Check description for plot size
      const plotMatches = [];
      const patterns = [
        /pozemek[^\d]*([\d\s]+)\s*m[²2]/gi,
        /pozemku\s*o?\s*(?:výměře|rozloze)?\s*([\d\s]+)\s*m[²2]/gi,
        /zahrada[^\d]*([\d\s]+)\s*m[²2]/gi
      ];

      patterns.forEach((pattern, idx) => {
        const matches = [...(jsonLd.description || '').matchAll(pattern)];
        if (matches.length > 0) {
          matches.forEach(m => {
            const value = parseInt(m[1].replace(/\s/g, ''));
            plotMatches.push({ pattern: idx, match: m[0], value });
          });
        }
      });

      if (plotMatches.length > 0) {
        console.log('\n  Plot size patterns found in description:');
        plotMatches.forEach(m => {
          console.log(`    "${m.match}" → ${m.value} m²`);
        });
      }

      const transformed = transformHouse(jsonLd, url, { propertyDetails });

      console.log('\nTRANSFORMED OUTPUT:');
      console.log('  bedrooms:', transformed.bedrooms);
      console.log('  sqm_living:', transformed.sqm_living);
      console.log('  sqm_plot:', transformed.sqm_plot);
      console.log('  energy_class:', transformed.energy_class);
      console.log('  construction_type:', transformed.construction_type);

      console.log('\nVALIDATION:');

      // Check if sqm_living and sqm_plot are same (suspicious)
      if (transformed.sqm_living > 0 && transformed.sqm_plot > 0) {
        if (transformed.sqm_living === transformed.sqm_plot) {
          console.log('  ⚠️  WARNING: Living area equals plot area - may be extraction issue');
          console.log(`      Both are ${transformed.sqm_living} m²`);
        } else {
          console.log('  ✅ Living and plot areas are different (correct)');
          console.log(`      Living: ${transformed.sqm_living} m², Plot: ${transformed.sqm_plot} m²`);
        }
      } else {
        console.log('  ℹ️  One or both areas are 0');
      }

      // Check if plot was available but not extracted
      if (transformed.sqm_plot === 0 && plotMatches.length > 0) {
        console.log('  ❌ Plot size in description but not extracted!');
        console.log(`      Found: ${plotMatches[0].value} m² in description`);
      }

    } catch (error) {
      console.log(`❌ Error: ${error.message}\n`);
    }
  }

  console.log('\n' + '═'.repeat(70));
  console.log('  TEST COMPLETE');
  console.log('═'.repeat(70));
}

testMultipleHouses().catch(console.error);
