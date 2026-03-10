/**
 * Raw sample: fetch a ceskereality detail page and extract structured data.
 * Usage: npx ts-node src/raw_samples/fetch-detail.ts [url]
 */

import * as cheerio from 'cheerio';

const DEFAULT_URL = 'https://www.ceskereality.cz/prodej/byty/praha/byt-2-kk-na-prodej-praha-3550005.html';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'cs-CZ,cs;q=0.9,en;q=0.8',
  'Cache-Control': 'no-cache',
};

async function main() {
  const url = process.argv[2] || DEFAULT_URL;
  console.error(`Fetching: ${url}`);

  const response = await fetch(url, { headers: HEADERS });
  if (!response.ok) {
    console.error(`HTTP ${response.status}: ${response.statusText}`);
    process.exit(1);
  }

  const html = await response.text();
  const $ = cheerio.load(html);

  // JSON-LD structured data
  let jsonLd: any = null;
  const jsonLdScript = $('script[type="application/ld+json"]').first();
  if (jsonLdScript.length) {
    try {
      jsonLd = JSON.parse(jsonLdScript.html() || '');
    } catch {}
  }

  // Images
  const images: string[] = [];
  $('img[src*="img.ceskereality.cz/foto"]').each((_, el) => {
    const src = $(el).attr('src');
    if (src && !src.includes('logo') && !src.includes('icon') && !src.includes('makleri')) {
      const fullSizeUrl = src.split('?')[0];
      if (!images.includes(fullSizeUrl)) {
        images.push(fullSizeUrl);
      }
    }
  });

  // Property details from .i-info elements
  const attributes: Record<string, string> = {};
  $('.i-info').each((_, el) => {
    const label = $(el).find('.i-info__title').text().trim();
    const value = $(el).find('.i-info__value').text().trim();
    if (label && value) {
      attributes[label] = value;
    }
  });

  // Energy rating
  const energyRating = $('.s-estate-detail-intro__energy').text().trim() || null;

  const extracted = {
    jsonLd,
    images,
    attributes,
    energyRating,
  };

  console.log(JSON.stringify(extracted, null, 2));
}

main().catch(console.error);
