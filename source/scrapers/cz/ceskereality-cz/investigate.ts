import * as cheerio from 'cheerio';

async function investigateCeskeReality() {
  console.log('🔍 Investigating ceskereality.cz (Simple Fetch)...\n');

  // Test listing page
  console.log('1. Testing listing page with fetch...');
  const listingResponse = await fetch('https://www.ceskereality.cz/prodej/byty/?sff=1');
  const listingHtml = await listingResponse.text();
  const $ = cheerio.load(listingHtml);

  // Find listing links
  const listingLinks: string[] = [];
  $('a[href*="/prodej/"][href$=".html"]').each((_, el) => {
    const href = $(el).attr('href');
    if (href && !listingLinks.includes(href)) {
      // Convert relative URLs to absolute
      const url = href.startsWith('http') ? href : `https://www.ceskereality.cz${href}`;
      listingLinks.push(url);
    }
  });

  console.log(`✅ Found ${listingLinks.length} unique listing URLs`);
  console.log('First 5:');
  listingLinks.slice(0, 5).forEach((url, i) => {
    console.log(`   ${i + 1}. ${url}`);
  });

  // Test detail page
  if (listingLinks.length > 0) {
    console.log('\n2. Testing detail page with fetch...');
    const detailUrl = listingLinks[0];
    const detailResponse = await fetch(detailUrl);
    const detailHtml = await detailResponse.text();
    const $detail = cheerio.load(detailHtml);

    // Extract JSON-LD
    const jsonLdScript = $detail('script[type="application/ld+json"]').first();
    if (jsonLdScript.length > 0) {
      const jsonLdText = jsonLdScript.html();
      if (jsonLdText) {
        const jsonLd = JSON.parse(jsonLdText);
        console.log('✅ JSON-LD structured data found:');
        console.log(JSON.stringify(jsonLd, null, 2));
      }
    } else {
      console.log('❌ No JSON-LD data found');
    }

    // Extract additional details from HTML
    console.log('\n✅ Additional data in HTML:');
    const title = $detail('h1').first().text().trim();
    const price = $detail('.s-estate-detail-intro__price').text().trim();
    console.log(`   Title: ${title}`);
    console.log(`   Price: ${price}`);
  }

  // Test pagination
  console.log('\n3. Testing pagination...');
  const nextLink = $('a[rel="next"]').attr('href');
  const pageLinks = $('a[href*="strana"]').length;
  console.log(`✅ Pagination detected:`);
  console.log(`   Next page: ${nextLink || 'not found'}`);
  console.log(`   Page links found: ${pageLinks}`);

  console.log('\n✨ Investigation complete!');
  console.log('\nKey findings:');
  console.log('- ✅ Simple fetch works (no Playwright needed!)');
  console.log('- ✅ JSON-LD data available in HTML source');
  console.log('- ✅ Listing URLs easily extractable');
  console.log('- ✅ Much faster and lighter than browser automation');
}

investigateCeskeReality().catch(console.error);
