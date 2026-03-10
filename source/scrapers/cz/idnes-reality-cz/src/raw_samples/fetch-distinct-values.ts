/**
 * Fetch a large sample of idnes-reality listings + details and report distinct values per field.
 * HTML scraper — slower than API-based scrapers.
 * Usage: npx ts-node src/raw_samples/fetch-distinct-values.ts [--pages N]
 */
import * as cheerio from 'cheerio';
import { getRealisticHeaders } from '../utils/headers';
import { FieldCollector, parsePages, delay } from './analyze-fields';

const DETAIL_CONCURRENCY = 3;

type Category = 'apartment' | 'house' | 'land' | 'commercial';

const LISTING_URLS: { url: string; category: Category }[] = [
  { url: 'https://reality.idnes.cz/s/prodej/byty/', category: 'apartment' },
  { url: 'https://reality.idnes.cz/s/prodej/domy/', category: 'house' },
  { url: 'https://reality.idnes.cz/s/prodej/pozemky/', category: 'land' },
  { url: 'https://reality.idnes.cz/s/prodej/komercni/', category: 'commercial' },
  { url: 'https://reality.idnes.cz/s/pronajem/byty/', category: 'apartment' },
  { url: 'https://reality.idnes.cz/s/pronajem/domy/', category: 'house' },
  { url: 'https://reality.idnes.cz/s/pronajem/pozemky/', category: 'land' },
  { url: 'https://reality.idnes.cz/s/pronajem/komercni/', category: 'commercial' },
];

function parseListingPage(html: string): { title: string; url: string; price: string; location: string }[] {
  const $ = cheerio.load(html);
  const listings: { title: string; url: string; price: string; location: string }[] = [];

  const selectors = ['.c-products__item', '.estate-item', '[data-dot="hp_product"]', '.property-item'];
  let items: cheerio.Cheerio<any> | null = null;
  for (const selector of selectors) {
    const found = $(selector);
    if (found.length > 0) { items = found; break; }
  }
  if (!items) return listings;

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
  return listings;
}

function parseDetailPage(html: string): Record<string, any> {
  const $ = cheerio.load(html);

  const title = $('h1.b-detail__title span').first().text().trim() || $('h1').first().text().trim();
  const priceText = $('p.b-detail__price strong').first().text().trim() || $('p.b-detail__price').first().text().trim();

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

  const imageCount = $('a[data-fancybox="images"]').length;

  return { title, priceText, dataLayer, attributes, imageCount };
}

async function fetchPage(url: string): Promise<string> {
  const headers = getRealisticHeaders();
  const response = await fetch(url, { headers });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.text();
}

async function main() {
  const pages = parsePages(5);

  // Per-category collectors
  const categoryCollectors: Record<Category, { listing: FieldCollector; detail: FieldCollector }> = {
    apartment: { listing: new FieldCollector(), detail: new FieldCollector() },
    house: { listing: new FieldCollector(), detail: new FieldCollector() },
    land: { listing: new FieldCollector(), detail: new FieldCollector() },
    commercial: { listing: new FieldCollector(), detail: new FieldCollector() },
  };

  // Merged collectors (backward compat)
  const listingCollector = new FieldCollector();
  const detailCollector = new FieldCollector();

  let listingCount = 0;
  let detailCount = 0;
  const detailUrlsByCategory: Record<Category, string[]> = {
    apartment: [], house: [], land: [], commercial: [],
  };

  // Phase 1: Listing pages
  for (const { url: baseUrl, category } of LISTING_URLS) {
    for (let page = 1; page <= pages; page++) {
      const url = page === 1 ? baseUrl : `${baseUrl}?page=${page}`;
      try {
        const html = await fetchPage(url);
        const listings = parseListingPage(html);
        if (listings.length === 0) break;
        for (const listing of listings) {
          listingCollector.add(listing);
          categoryCollectors[category].listing.add(listing);
          listingCount++;
          detailUrlsByCategory[category].push(listing.url);
        }
        process.stderr.write(`\rListings: ${listingCount} items`);
      } catch (err: any) {
        process.stderr.write(`\nFailed ${url}: ${err.message}\n`);
      }
      await delay(1000);
    }
  }
  process.stderr.write('\n');

  // Phase 2: Detail pages
  const totalDetailUrls = Object.values(detailUrlsByCategory).reduce((s, a) => s + a.length, 0);
  for (const [category, urls] of Object.entries(detailUrlsByCategory)) {
    for (let i = 0; i < urls.length; i += DETAIL_CONCURRENCY) {
      const batch = urls.slice(i, i + DETAIL_CONCURRENCY);
      const results = await Promise.allSettled(
        batch.map(async (url) => {
          const html = await fetchPage(url);
          return parseDetailPage(html);
        })
      );
      for (const r of results) {
        if (r.status === 'fulfilled') {
          detailCollector.add(r.value);
          categoryCollectors[category as Category].detail.add(r.value);
          detailCount++;
        }
      }
      process.stderr.write(`\rDetails: ${detailCount}/${totalDetailUrls}`);
      await delay(500);
    }
  }
  process.stderr.write('\n');

  const categoriesSampled = (Object.keys(categoryCollectors) as Category[]).filter(
    (c) => detailUrlsByCategory[c].length > 0
  );

  const report: Record<string, any> = {
    meta: {
      scraper: 'idnes-reality-cz',
      categories_sampled: categoriesSampled,
      listings_fetched: listingCount,
      details_fetched: detailCount,
      timestamp: new Date().toISOString(),
    },
  };

  // Per-category sections
  for (const cat of categoriesSampled) {
    report[cat] = {
      listing_fields: categoryCollectors[cat].listing.report(),
      detail_fields: categoryCollectors[cat].detail.report(),
    };
  }

  // Backward-compat merged top-level
  report.listing_fields = listingCollector.report();
  report.detail_fields = detailCollector.report();

  console.log(JSON.stringify(report, null, 2));
}

main().catch(console.error);
