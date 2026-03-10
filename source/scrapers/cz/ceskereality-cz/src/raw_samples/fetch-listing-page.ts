/**
 * Raw sample: fetch a ceskereality listing page and extract card data.
 * Usage: npx ts-node src/raw_samples/fetch-listing-page.ts
 */

import * as cheerio from 'cheerio';

const URL = 'https://www.ceskereality.cz/prodej/byty/';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'cs-CZ,cs;q=0.9,en;q=0.8',
  'Cache-Control': 'no-cache',
};

async function main() {
  const response = await fetch(URL, { headers: HEADERS });
  if (!response.ok) {
    console.error(`HTTP ${response.status}: ${response.statusText}`);
    process.exit(1);
  }

  const html = await response.text();
  const $ = cheerio.load(html);

  const listings: { title: string | null; link: string | null; price: string | null }[] = [];

  $('article.i-estate').each((_, article) => {
    const el = $(article);

    const href = el.find('a.i-estate__title-link').attr('href')
      ?? el.find('a[href$=".html"]').first().attr('href');
    const link = href
      ? (href.startsWith('http') ? href : `https://www.ceskereality.cz${href}`)
      : null;

    const title = el.find('.i-estate__header-title a').text().trim() || null;
    const price = el.find('.i-estate__footer-price-value').text().trim() || null;

    listings.push({ title, link, price });
  });

  console.log(JSON.stringify(listings, null, 2));
}

main().catch(console.error);
