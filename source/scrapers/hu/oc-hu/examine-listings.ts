/**
 * Examine listings from working OC.hu URL
 */
import { fetchWithBrowserTLS } from './src/utils/cycleTLS';
import * as cheerio from 'cheerio';
import * as fs from 'fs';

async function examine() {
  console.log('🔍 Examining OC.hu listings...\n');

  try {
    const url = 'https://oc.hu/ingatlanok/lista/ertekesites:elado';
    console.log(`Fetching: ${url}\n`);

    const html = await fetchWithBrowserTLS(url, {
      browser: 'chrome',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });

    // Save to file
    fs.writeFileSync('/tmp/oc-hu-listings.html', html);
    console.log('✅ Saved to /tmp/oc-hu-listings.html\n');

    // Parse with Cheerio
    const $ = cheerio.load(html);

    // Try to find property listings
    const selectors = [
      '[data-item_id]',
      '.property-card',
      '.listing-card',
      'article',
      '.item',
      '[class*="card"]',
      '[class*="property"]',
      '[class*="ingatlan"]'
    ];

    console.log('🔍 Searching for property listings...\n');

    for (const selector of selectors) {
      const elements = $(selector);
      if (elements.length > 0) {
        console.log(`Selector "${selector}": ${elements.length} elements`);

        // Examine first element
        const first = $(elements.first());
        const text = first.text().trim().substring(0, 200);
        const hasPrice = text.match(/\d+.*ft/i) || text.match(/millió/i);
        const hasArea = text.match(/\d+.*m[²2]/i);

        console.log(`   First element text: ${text}...`);
        console.log(`   Has price: ${!!hasPrice}, Has area: ${!!hasArea}`);

        if (hasPrice || hasArea) {
          console.log(`   ✅ Looks like property listings!`);

          // Try to extract URLs
          first.find('a').each((i, el) => {
            const href = $(el).attr('href');
            if (href && href.includes('ingatlan')) {
              console.log(`   Link: ${href}`);
            }
          });
        }
        console.log('');
      }
    }

    // Check for pagination
    console.log('🔍 Checking pagination...\n');
    const paginationSelectors = [
      'a[rel="next"]',
      '.pagination',
      '[class*="pagination"]',
      '[class*="pager"]',
      'a:contains("Következő")',
      'a:contains("›")',
      'a:contains("»")'
    ];

    for (const selector of paginationSelectors) {
      const elements = $(selector);
      if (elements.length > 0) {
        console.log(`   Found pagination: ${selector} (${elements.length} elements)`);
        elements.each((i, el) => {
          const href = $(el).attr('href');
          const text = $(el).text().trim();
          console.log(`      ${text || 'no text'}: ${href || 'no href'}`);
        });
      }
    }

  } catch (error: any) {
    console.error('\n❌ Failed:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

examine();
