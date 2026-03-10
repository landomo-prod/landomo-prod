import * as cheerio from 'cheerio';
import { getRealisticHeaders } from '../utils/headers';

async function main() {
  const url = 'https://reality.idnes.cz/s/prodej/byty/';
  const headers = getRealisticHeaders();
  const response = await fetch(url, { headers });

  if (!response.ok) {
    console.error(`HTTP ${response.status}: ${response.statusText}`);
    process.exit(1);
  }

  const html = await response.text();
  const $ = cheerio.load(html);

  const listings: { title: string; url: string; price: string; location: string }[] = [];

  const selectors = ['.c-products__item', '.estate-item', '[data-dot="hp_product"]', '.property-item'];
  let items: cheerio.Cheerio<any> | null = null;
  for (const selector of selectors) {
    const found = $(selector);
    if (found.length > 0) { items = found; break; }
  }

  if (!items) {
    console.log('No listing items found on page');
    process.exit(0);
  }

  items.each((_, item) => {
    const $item = $(item);
    const title = $item.find('.c-products__title, h2, .title').first().text().trim();
    const href = $item.find('a.c-products__link, a[href*="/detail/"]').first().attr('href') || '';
    const price = $item.find('.c-products__price, .price').first().text().trim();
    const location = $item.find('.c-products__info, .location').first().text().trim();

    if (title && href) {
      listings.push({
        title,
        url: href.startsWith('http') ? href : `https://reality.idnes.cz${href}`,
        price,
        location,
      });
    }
  });

  console.log(JSON.stringify(listings, null, 2));
}

main().catch(console.error);
