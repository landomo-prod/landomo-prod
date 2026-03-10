import * as cheerio from 'cheerio';
import { getRealisticHeaders } from '../utils/headers';

async function main() {
  const url = process.argv[2] || 'https://reality.idnes.cz/detail/prodej/byt/2+kk/praha-vinohrady/10718063';
  const headers = getRealisticHeaders();
  const response = await fetch(url, { headers });

  if (!response.ok) {
    console.error(`HTTP ${response.status}: ${response.statusText}`);
    process.exit(1);
  }

  const html = await response.text();
  const $ = cheerio.load(html);

  // Title
  const title = $('h1.b-detail__title span').first().text().trim()
    || $('h1').first().text().trim();

  // Price
  const priceText = $('p.b-detail__price strong').first().text().trim()
    || $('p.b-detail__price').first().text().trim();

  // dataLayer variables
  const dataLayer: Record<string, string | number> = {};
  $('script:not([src])').each((_, el) => {
    const content = $(el).html() || '';
    if (!content.includes('dataLayer')) return;

    const pairs = [
      'listing_price', 'listing_area', 'listing_lat', 'listing_lon',
      'listing_localityCity', 'listing_localityDistrict',
      'listing_localityRegion', 'listing_localityCityArea',
    ];

    for (const key of pairs) {
      const strMatch = content.match(new RegExp(`"${key}"\\s*:\\s*"([^"]+)"`));
      if (strMatch) { dataLayer[key] = strMatch[1]; continue; }
      const numMatch = content.match(new RegExp(`"${key}"\\s*:\\s*([+-]?\\d+\\.?\\d*)`));
      if (numMatch) { dataLayer[key] = parseFloat(numMatch[1]); }
    }
  });

  // Attributes from parameter table
  const attributes: Record<string, string> = {};
  $('.b-definition-columns dl dt').each((_, dtEl) => {
    const dtText = $(dtEl).text().trim();
    const ddEl = $(dtEl).next('dd');
    if (!ddEl.length) return;
    const hasCheck = ddEl.find('.icon--check').length > 0;
    if (hasCheck) { attributes[dtText] = 'ano'; return; }
    if (ddEl.hasClass('advertisement')) return;
    const ddText = ddEl.text().trim();
    if (dtText && ddText && dtText !== ddText) {
      attributes[dtText] = ddText;
    }
  });

  // Images
  const images: string[] = [];
  $('a[data-fancybox="images"]').each((_, el) => {
    const href = $(el).attr('href');
    if (href && !href.includes('placeholder') && !href.includes('no-image')) {
      images.push(href);
    }
  });

  console.log(JSON.stringify({ title, priceText, dataLayer, attributes, images }, null, 2));
}

main().catch(console.error);
