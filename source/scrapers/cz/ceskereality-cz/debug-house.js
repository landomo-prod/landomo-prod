const cheerio = require('cheerio');
const { transformHouse } = require('./dist/transformers/ceskerealityHouseTransformer');

async function test() {
  const url = 'https://www.ceskereality.cz/prodej/rodinne-domy/rodinne-domy/nemyceves/prodej-rodinneho-domu-150-m2-3578816.html';
  console.log('Testing house URL:', url);
  console.log('═'.repeat(70));

  try {
    const response = await fetch(url);
    const html = await response.text();
    const $ = cheerio.load(html);

    // Extract JSON-LD
    const jsonLdScript = $('script[type="application/ld+json"]').first();
    if (!jsonLdScript.length) {
      console.log('❌ NO JSON-LD FOUND');
      return;
    }

    const jsonLd = JSON.parse(jsonLdScript.html());
    console.log('\nJSON-LD:');
    console.log(JSON.stringify(jsonLd, null, 2));

    // Extract property details
    const propertyDetails = {};
    $('.i-info').each((_, el) => {
      const label = $(el).find('.i-info__title').text().trim();
      const value = $(el).find('.i-info__value').text().trim();
      if (label && value) {
        propertyDetails[label] = value;
      }
    });

    console.log('\nProperty Details:');
    console.log(JSON.stringify(propertyDetails, null, 2));

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

    console.log('\nImages count:', images.length);

    // Transform
    console.log('\n═'.repeat(70));
    console.log('TRANSFORMING...');
    console.log('═'.repeat(70));

    const transformed = transformHouse(jsonLd, url, { images, propertyDetails });

    console.log('\nTransformed result:');
    console.log(JSON.stringify(transformed, null, 2));

    console.log('\n═'.repeat(70));
    console.log('VALIDATION:');
    console.log('═'.repeat(70));
    console.log('Has property_category:', !!transformed?.property_category);
    console.log('Has title:', !!transformed?.title);
    console.log('Has price:', !!transformed?.price);
    console.log('Has bedrooms:', typeof transformed?.bedrooms === 'number');
    console.log('Has sqm_living:', !!transformed?.sqm_living);
    console.log('Has sqm_plot:', typeof transformed?.sqm_plot === 'number');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  }
}

test();
