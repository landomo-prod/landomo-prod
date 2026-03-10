/**
 * Quick test - just one page
 */
import { fetchWithBrowserTLS, closeCycleTLS } from './src/utils/cycleTLS';
import { getRandomUserAgent } from './src/utils/userAgents';
import * as cheerio from 'cheerio';

async function quickTest() {
  console.log('🧪 Quick Test - Single Page\n');

  try {
    const url = 'https://www.reality.sk/byty/predaj';
    console.log(`📡 Fetching: ${url}`);

    const html = await fetchWithBrowserTLS(url, {
      browser: 'chrome',
      userAgent: getRandomUserAgent()
    });

    console.log(`✅ Fetched ${html.length} characters\n`);

    const $ = cheerio.load(html);
    const listings = $('.offer');

    console.log(`Found ${listings.length} listings\n`);

    // Extract first 3 listings
    listings.slice(0, 3).each((i, el) => {
      const $el = $(el);

      const id = $el.attr('data-offer-id');
      const title = $el.find('.offer-title').text().trim();
      const priceText = $el.find('.offer-price').contents().first().text().trim();
      const location = $el.find('.offer-location').text().trim();
      const params = $el.find('.offer-params').text();
      const url = $el.find('a[href*="/byty/"]').first().attr('href');

      console.log(`Listing ${i + 1}:`);
      console.log(`  ID: ${id}`);
      console.log(`  Title: ${title}`);
      console.log(`  Price: ${priceText}`);
      console.log(`  Location: ${location}`);
      console.log(`  Params: ${params.replace(/\s+/g, ' ').trim()}`);
      console.log(`  URL: ${url}`);
      console.log('');
    });

    await closeCycleTLS();
    console.log('✅ Test complete!');

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    await closeCycleTLS();
  }
}

quickTest();
