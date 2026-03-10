/**
 * Fetch a large sample of ceskereality listings + details and report distinct values per field.
 * HTML scraper — slower than API-based scrapers.
 * Usage: npx ts-node src/raw_samples/fetch-distinct-values.ts [--pages N]
 */
import * as cheerio from 'cheerio';
import { FieldCollector, parsePages, delay } from './analyze-fields';

const DETAIL_CONCURRENCY = 3;

type Category = 'apartment' | 'house' | 'land' | 'commercial';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'cs-CZ,cs;q=0.9,en;q=0.8',
  'Cache-Control': 'no-cache',
};

const LISTING_URLS: { url: string; category: Category }[] = [
  { url: 'https://www.ceskereality.cz/prodej/byty/', category: 'apartment' },
  { url: 'https://www.ceskereality.cz/prodej/domy/', category: 'house' },
  { url: 'https://www.ceskereality.cz/prodej/pozemky/', category: 'land' },
  { url: 'https://www.ceskereality.cz/prodej/komercni/', category: 'commercial' },
  { url: 'https://www.ceskereality.cz/pronajem/byty/', category: 'apartment' },
  { url: 'https://www.ceskereality.cz/pronajem/domy/', category: 'house' },
  { url: 'https://www.ceskereality.cz/pronajem/pozemky/', category: 'land' },
  { url: 'https://www.ceskereality.cz/pronajem/komercni/', category: 'commercial' },
];

function parseListingPage(html: string): { title: string | null; link: string | null; price: string | null }[] {
  const $ = cheerio.load(html);
  const listings: { title: string | null; link: string | null; price: string | null }[] = [];

  $('article.i-estate').each((_, article) => {
    const el = $(article);
    const href = el.find('a.i-estate__title-link').attr('href') ?? el.find('a[href$=".html"]').first().attr('href');
    const link = href ? (href.startsWith('http') ? href : `https://www.ceskereality.cz${href}`) : null;
    const title = el.find('.i-estate__header-title a').text().trim() || null;
    const price = el.find('.i-estate__footer-price-value').text().trim() || null;
    listings.push({ title, link, price });
  });
  return listings;
}

function parseDetailPage(html: string): Record<string, any> {
  const $ = cheerio.load(html);

  let jsonLd: any = null;
  const jsonLdScript = $('script[type="application/ld+json"]').first();
  if (jsonLdScript.length) {
    try { jsonLd = JSON.parse(jsonLdScript.html() || ''); } catch {}
  }

  const attributes: Record<string, string> = {};
  $('.i-info').each((_, el) => {
    const label = $(el).find('.i-info__title').text().trim();
    const value = $(el).find('.i-info__value').text().trim();
    if (label && value) attributes[label] = value;
  });

  const energyRating = $('.s-estate-detail-intro__energy').text().trim() || null;
  const imageCount = $('img[src*="img.ceskereality.cz/foto"]').length;

  return { jsonLd, attributes, energyRating, imageCount };
}

async function fetchPage(url: string): Promise<string> {
  const response = await fetch(url, { headers: HEADERS });
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
          if (listing.link) detailUrlsByCategory[category].push(listing.link);
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
      scraper: 'ceskereality-cz',
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
