import * as cheerio from 'cheerio';
import { transformApartment } from './src/transformers/ceskerealityApartmentTransformer';
import { transformHouse } from './src/transformers/ceskerealityHouseTransformer';
import { transformLand } from './src/transformers/ceskerealityLandTransformer';
import { transformCommercial } from './src/transformers/ceskerealityCommercialTransformer';

const CATEGORIES = [
  { name: 'apartment', url: 'https://www.ceskereality.cz/prodej/byty/', transform: transformApartment },
  { name: 'house', url: 'https://www.ceskereality.cz/prodej/domy/', transform: transformHouse },
  { name: 'land', url: 'https://www.ceskereality.cz/prodej/pozemky/', transform: transformLand },
  { name: 'commercial', url: 'https://www.ceskereality.cz/prodej/komercni/', transform: transformCommercial },
];

async function delay(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function findFirstListingUrl(categoryUrl: string): Promise<string | null> {
  const res = await fetch(categoryUrl);
  if (!res.ok) return null;
  const html = await res.text();
  const $ = cheerio.load(html);
  const links: string[] = [];
  $('a[href*="/prodej/"][href$=".html"]').each((_, el) => {
    const href = $(el).attr('href');
    if (href) {
      links.push(href.startsWith('http') ? href : `https://www.ceskereality.cz${href}`);
    }
  });
  return links[0] || null;
}

async function scrapeDetail(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = await res.text();
  const $ = cheerio.load(html);

  const jsonLdScript = $('script[type="application/ld+json"]').first();
  if (!jsonLdScript.length) throw new Error('No JSON-LD');
  const jsonLd = JSON.parse(jsonLdScript.html()!);

  const images: string[] = [];
  $('img[src*="img.ceskereality.cz/foto"]').each((_, el) => {
    const src = $(el).attr('src');
    if (src && !src.includes('logo') && !src.includes('icon') && !src.includes('makleri')) {
      const full = src.split('?')[0];
      if (!images.includes(full)) images.push(full);
    }
  });

  const propertyDetails: Record<string, string> = {};
  $('.i-info').each((_, el) => {
    const label = $(el).find('.i-info__title').text().trim();
    const value = $(el).find('.i-info__value').text().trim();
    if (label && value) propertyDetails[label] = value;
  });

  return { jsonLd, htmlData: { images, propertyDetails } };
}

interface ValidationResult {
  category: string;
  url: string;
  pass: boolean;
  errors: string[];
  fields: Record<string, any>;
}

function validateCommon(result: any, category: string): string[] {
  const errors: string[] = [];
  if (result.property_category !== category) errors.push(`property_category: expected "${category}", got "${result.property_category}"`);
  if (!result.source_url) errors.push('missing source_url');
  if (result.source_platform !== 'ceskereality-cz') errors.push(`source_platform: expected "ceskereality-cz", got "${result.source_platform}"`);
  if (result.status !== 'active') errors.push(`status: expected "active", got "${result.status}"`);
  if (!result.title || result.title === 'Untitled') errors.push('missing/default title');
  if (!result.currency) errors.push('missing currency');
  if (!result.location?.city || result.location.city === 'Unknown') errors.push('missing/default city');
  if (!result.location?.country) errors.push('missing country');
  return errors;
}

function validateCategory(result: any, category: string): string[] {
  const errors: string[] = [];
  switch (category) {
    case 'apartment':
      if (result.bedrooms === undefined) errors.push('missing bedrooms');
      if (!result.sqm && result.sqm !== 0) errors.push('missing sqm');
      if (result.has_elevator === undefined) errors.push('missing has_elevator');
      if (result.has_balcony === undefined) errors.push('missing has_balcony');
      if (result.has_parking === undefined) errors.push('missing has_parking');
      if (result.has_basement === undefined) errors.push('missing has_basement');
      break;
    case 'house':
      if (result.bedrooms === undefined) errors.push('missing bedrooms');
      if (result.sqm_living === undefined) errors.push('missing sqm_living');
      if (result.sqm_plot === undefined) errors.push('missing sqm_plot');
      if (result.has_garden === undefined) errors.push('missing has_garden');
      if (result.has_garage === undefined) errors.push('missing has_garage');
      if (result.has_parking === undefined) errors.push('missing has_parking');
      if (result.has_basement === undefined) errors.push('missing has_basement');
      break;
    case 'land':
      if (result.area_plot_sqm === undefined) errors.push('missing area_plot_sqm');
      break;
    case 'commercial':
      if (result.sqm_total === undefined) errors.push('missing sqm_total');
      if (result.has_elevator === undefined) errors.push('missing has_elevator');
      if (result.has_parking === undefined) errors.push('missing has_parking');
      if (result.has_bathrooms === undefined) errors.push('missing has_bathrooms');
      break;
  }
  return errors;
}

async function main() {
  console.log('='.repeat(80));
  console.log('  CESKEREALITY SCRAPER - ALL 4 CATEGORIES TEST');
  console.log('='.repeat(80));

  const results: ValidationResult[] = [];

  for (const cat of CATEGORIES) {
    console.log(`\n${'─'.repeat(80)}`);
    console.log(`  Category: ${cat.name.toUpperCase()}`);
    console.log(`${'─'.repeat(80)}`);

    try {
      // Step 1: Find a listing URL
      console.log(`  Finding listing from: ${cat.url}`);
      const listingUrl = await findFirstListingUrl(cat.url);
      if (!listingUrl) {
        results.push({ category: cat.name, url: '', pass: false, errors: ['No listing URLs found on category page'], fields: {} });
        console.log('  FAIL: No listing URLs found');
        continue;
      }
      console.log(`  Found: ${listingUrl}`);

      await delay(500);

      // Step 2: Scrape detail page
      console.log(`  Scraping detail page...`);
      const { jsonLd, htmlData } = await scrapeDetail(listingUrl);
      console.log(`  JSON-LD type: ${jsonLd.additionalType || jsonLd['@type']}`);
      console.log(`  Images: ${htmlData.images.length}`);
      console.log(`  Property details: ${Object.keys(htmlData.propertyDetails).length} fields`);

      // Step 3: Transform
      console.log(`  Transforming...`);
      const transformed = cat.transform(jsonLd, listingUrl, htmlData);

      // Step 4: Validate
      const commonErrors = validateCommon(transformed, cat.name);
      const categoryErrors = validateCategory(transformed, cat.name);
      const allErrors = [...commonErrors, ...categoryErrors];

      const keyFields: Record<string, any> = {
        property_category: transformed.property_category,
        title: transformed.title,
        price: `${transformed.price} ${transformed.currency}`,
        city: transformed.location?.city,
        images: transformed.images?.length || 0,
      };

      // Add category-specific fields
      if (cat.name === 'apartment') {
        keyFields.bedrooms = (transformed as any).bedrooms;
        keyFields.sqm = (transformed as any).sqm;
        keyFields.has_elevator = (transformed as any).has_elevator;
        keyFields.has_balcony = (transformed as any).has_balcony;
      } else if (cat.name === 'house') {
        keyFields.bedrooms = (transformed as any).bedrooms;
        keyFields.sqm_living = (transformed as any).sqm_living;
        keyFields.sqm_plot = (transformed as any).sqm_plot;
        keyFields.has_garden = (transformed as any).has_garden;
        keyFields.has_garage = (transformed as any).has_garage;
      } else if (cat.name === 'land') {
        keyFields.area_plot_sqm = (transformed as any).area_plot_sqm;
      } else if (cat.name === 'commercial') {
        keyFields.sqm_total = (transformed as any).sqm_total;
        keyFields.has_elevator = (transformed as any).has_elevator;
        keyFields.has_parking = (transformed as any).has_parking;
      }

      const pass = allErrors.length === 0;
      results.push({ category: cat.name, url: listingUrl, pass, errors: allErrors, fields: keyFields });

      // Print fields
      console.log(`\n  Key Fields:`);
      for (const [k, v] of Object.entries(keyFields)) {
        console.log(`    ${k}: ${v}`);
      }

      if (allErrors.length > 0) {
        console.log(`\n  Validation Errors:`);
        for (const e of allErrors) {
          console.log(`    - ${e}`);
        }
      }

      console.log(`\n  Result: ${pass ? 'PASS' : 'FAIL'}`);

    } catch (error: any) {
      results.push({ category: cat.name, url: '', pass: false, errors: [error.message], fields: {} });
      console.log(`  FAIL: ${error.message}`);
    }

    await delay(500);
  }

  // Summary
  console.log(`\n${'='.repeat(80)}`);
  console.log('  SUMMARY');
  console.log(`${'='.repeat(80)}`);

  for (const r of results) {
    const icon = r.pass ? 'PASS' : 'FAIL';
    console.log(`  [${icon}] ${r.category.padEnd(12)} ${r.url ? r.url.substring(0, 60) : 'N/A'}`);
    if (r.errors.length > 0) {
      for (const e of r.errors) {
        console.log(`         - ${e}`);
      }
    }
  }

  const passed = results.filter(r => r.pass).length;
  console.log(`\n  Total: ${passed}/${results.length} categories passed`);
  console.log(`${'='.repeat(80)}`);

  if (passed < results.length) process.exit(1);
}

main().catch(e => { console.error(e); process.exit(1); });
