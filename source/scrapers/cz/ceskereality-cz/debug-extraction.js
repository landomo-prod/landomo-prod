const cheerio = require('cheerio');

async function test() {
  const url = 'https://www.ceskereality.cz/prodej/byty/byty-3-kk/karlovy-vary/prodej-bytu-3-kk-88-m2-v-karlove-vary-3659249.html';
  console.log('Testing URL:', url);

  try {
    const response = await fetch(url);
    const html = await response.text();
    const $ = cheerio.load(html);

    // Check for JSON-LD
    const jsonLdScript = $('script[type="application/ld+json"]').first();
    console.log('\nJSON-LD found:', jsonLdScript.length > 0);

    if (jsonLdScript.length > 0) {
      const jsonLd = JSON.parse(jsonLdScript.html());
      console.log('JSON-LD type:', jsonLd['@type']);
      console.log('Has name:', !!jsonLd.name);
      console.log('Has price:', !!jsonLd.offers?.price);
      console.log('Has description:', !!jsonLd.description);
      console.log('\nFull JSON-LD:');
      console.log(JSON.stringify(jsonLd, null, 2));
    } else {
      console.log('\n⚠️ NO JSON-LD FOUND!');
      console.log('Page title:', $('title').text());
      console.log('Has .i-info elements:', $('.i-info').length);
    }

    // Check property details
    const detailsCount = $('.i-info').length;
    console.log('\nProperty details found:', detailsCount);

    // Check images
    const imagesCount = $('img[src*="img.ceskereality.cz/foto"]').length;
    console.log('Images found:', imagesCount);

  } catch (error) {
    console.error('Error:', error.message);
  }
}

test();
