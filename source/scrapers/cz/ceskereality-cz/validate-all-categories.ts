/**
 * CeskeReality Comprehensive Validation Script
 * Tests 3+ listings per category against live ceskereality.cz
 */
import * as cheerio from 'cheerio';
import { transformApartment } from './src/transformers/ceskerealityApartmentTransformer';
import { transformHouse } from './src/transformers/ceskerealityHouseTransformer';
import { transformLand } from './src/transformers/ceskerealityLandTransformer';
import { transformCommercial } from './src/transformers/ceskerealityCommercialTransformer';

const LISTINGS_PER_CATEGORY = 3;

const CATEGORIES = [
  { name: 'apartment', url: 'https://www.ceskereality.cz/prodej/byty/', transform: transformApartment },
  { name: 'house', url: 'https://www.ceskereality.cz/prodej/rodinne-domy/', transform: transformHouse },
  { name: 'land', url: 'https://www.ceskereality.cz/prodej/pozemky/', transform: transformLand },
  { name: 'commercial', url: 'https://www.ceskereality.cz/prodej/komercni/', transform: transformCommercial },
];

async function delay(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function findListingUrls(categoryUrl: string, count: number): Promise<string[]> {
  try {
    const res = await fetch(categoryUrl);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();
    const $ = cheerio.load(html);
    const urls = new Set<string>();
    $('a[href*="/prodej/"][href$=".html"]').each((_, el) => {
      const href = $(el).attr('href');
      if (href) {
        urls.add(href.startsWith('http') ? href : `https://www.ceskereality.cz${href}`);
      }
    });
    return Array.from(urls).slice(0, count);
  } catch (e: any) {
    console.error(`  Failed to fetch category page: ${e.message}`);
    return [];
  }
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

  const energyRating = $('.s-estate-detail-intro__energy').text().trim() || undefined;

  return { jsonLd, htmlData: { images, propertyDetails, energyRating } };
}

interface ListingResult {
  url: string;
  pass: boolean;
  errors: string[];
  warnings: string[];
  fieldsExtracted: number;
  keyValues: Record<string, any>;
}

interface CategoryResult {
  name: string;
  status: 'PASS' | 'FAIL' | 'PARTIAL';
  listings: ListingResult[];
  totalListings: number;
  passedListings: number;
}

function validateListing(result: any, category: string): { errors: string[]; warnings: string[]; fieldsExtracted: number } {
  const errors: string[] = [];
  const warnings: string[] = [];
  let fieldsExtracted = 0;

  // Common required checks
  if (result.property_category !== category) errors.push(`property_category: expected "${category}", got "${result.property_category}"`);
  else fieldsExtracted++;

  if (!result.source_url) errors.push('missing source_url');
  else fieldsExtracted++;

  if (result.source_platform !== 'ceskereality-cz') errors.push(`source_platform: "${result.source_platform}"`);
  else fieldsExtracted++;

  if (result.status !== 'active') errors.push(`status: "${result.status}"`);
  else fieldsExtracted++;

  if (!result.title || result.title === 'Untitled') warnings.push('title missing/default');
  else fieldsExtracted++;

  if (!result.price || result.price === 0) warnings.push('price is 0');
  else fieldsExtracted++;

  if (result.currency) fieldsExtracted++;
  if (result.transaction_type) fieldsExtracted++;

  if (!result.location?.city || result.location.city === 'Unknown') warnings.push('city missing/Unknown');
  else fieldsExtracted++;

  if (result.location?.country) fieldsExtracted++;
  if (result.description) fieldsExtracted++;
  if (result.images?.length > 0) fieldsExtracted++;

  // Category-specific required fields
  if (category === 'apartment') {
    if (result.bedrooms === undefined) errors.push('missing bedrooms');
    else fieldsExtracted++;
    if (!result.sqm && result.sqm !== 0) errors.push('missing sqm');
    else fieldsExtracted++;
    if (result.has_elevator === undefined) errors.push('missing has_elevator');
    else fieldsExtracted++;
    if (result.has_balcony === undefined) errors.push('missing has_balcony');
    else fieldsExtracted++;
    if (result.has_parking === undefined) errors.push('missing has_parking');
    else fieldsExtracted++;
    if (result.has_basement === undefined) errors.push('missing has_basement');
    else fieldsExtracted++;

    // Optional enrichment fields
    if (result.floor !== undefined) fieldsExtracted++;
    if (result.total_floors !== undefined) fieldsExtracted++;
    if (result.construction_type) fieldsExtracted++;
    if (result.condition) fieldsExtracted++;
    if (result.energy_class) fieldsExtracted++;
    if (result.heating_type) fieldsExtracted++;
    if (result.year_built) fieldsExtracted++;
    if (result.furnished) fieldsExtracted++;
    if (result.hoa_fees) fieldsExtracted++;
  }

  if (category === 'house') {
    if (result.bedrooms === undefined) errors.push('missing bedrooms');
    else fieldsExtracted++;
    if (result.sqm_living === undefined) errors.push('missing sqm_living');
    else fieldsExtracted++;
    if (result.sqm_plot === undefined) errors.push('missing sqm_plot');
    else fieldsExtracted++;
    if (result.has_garden === undefined) errors.push('missing has_garden');
    else fieldsExtracted++;
    if (result.has_garage === undefined) errors.push('missing has_garage');
    else fieldsExtracted++;
    if (result.has_parking === undefined) errors.push('missing has_parking');
    else fieldsExtracted++;
    if (result.has_basement === undefined) errors.push('missing has_basement');
    else fieldsExtracted++;
  }

  if (category === 'land') {
    if (result.area_plot_sqm === undefined) errors.push('missing area_plot_sqm');
    else fieldsExtracted++;
  }

  if (category === 'commercial') {
    if (result.sqm_total === undefined) errors.push('missing sqm_total');
    else fieldsExtracted++;
    if (result.has_elevator === undefined) errors.push('missing has_elevator');
    else fieldsExtracted++;
    if (result.has_parking === undefined) errors.push('missing has_parking');
    else fieldsExtracted++;
    if (result.has_bathrooms === undefined) errors.push('missing has_bathrooms');
    else fieldsExtracted++;
  }

  return { errors, warnings, fieldsExtracted };
}

async function main() {
  const startTime = Date.now();

  console.log('='.repeat(80));
  console.log('  CESKEREALITY SCRAPER - COMPREHENSIVE VALIDATION');
  console.log('  Target: ceskereality.cz | Listings per category: ' + LISTINGS_PER_CATEGORY);
  console.log('  Date: ' + new Date().toISOString());
  console.log('='.repeat(80));

  const categoryResults: CategoryResult[] = [];

  for (const cat of CATEGORIES) {
    console.log(`\n${'─'.repeat(80)}`);
    console.log(`  Category: ${cat.name.toUpperCase()}`);
    console.log(`  URL: ${cat.url}`);
    console.log(`${'─'.repeat(80)}`);

    const listings: ListingResult[] = [];

    // Find listing URLs
    console.log(`  Finding ${LISTINGS_PER_CATEGORY} listings...`);
    const urls = await findListingUrls(cat.url, LISTINGS_PER_CATEGORY);
    console.log(`  Found ${urls.length} listing URLs`);

    if (urls.length === 0) {
      categoryResults.push({
        name: cat.name,
        status: 'FAIL',
        listings: [],
        totalListings: 0,
        passedListings: 0,
      });
      console.log('  FAIL: No listing URLs found');
      continue;
    }

    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];
      console.log(`\n  [${i + 1}/${urls.length}] ${url.substring(0, 70)}...`);

      try {
        await delay(400 + Math.random() * 300);

        const { jsonLd, htmlData } = await scrapeDetail(url);
        console.log(`    JSON-LD: ${jsonLd.name?.substring(0, 50) || 'N/A'}`);
        console.log(`    Images: ${htmlData.images.length}, Details: ${Object.keys(htmlData.propertyDetails).length} fields`);

        // Transform
        const transformed = cat.transform(jsonLd, url, htmlData);

        // Validate
        const { errors, warnings, fieldsExtracted } = validateListing(transformed, cat.name);
        const pass = errors.length === 0;

        // Collect key values
        const keyValues: Record<string, any> = {
          property_category: transformed.property_category,
          title: (transformed.title || '').substring(0, 50),
          price: `${transformed.price} ${transformed.currency}`,
          city: transformed.location?.city,
          images: transformed.images?.length || 0,
        };

        if (cat.name === 'apartment') {
          const t = transformed as any;
          keyValues.bedrooms = t.bedrooms;
          keyValues.sqm = t.sqm;
          keyValues.has_elevator = t.has_elevator;
          keyValues.has_balcony = t.has_balcony;
          keyValues.has_parking = t.has_parking;
          keyValues.has_basement = t.has_basement;
          keyValues.floor = t.floor;
          keyValues.construction_type = t.construction_type;
          keyValues.condition = t.condition;
          keyValues.energy_class = t.energy_class;
        } else if (cat.name === 'house') {
          const t = transformed as any;
          keyValues.bedrooms = t.bedrooms;
          keyValues.sqm_living = t.sqm_living;
          keyValues.sqm_plot = t.sqm_plot;
          keyValues.has_garden = t.has_garden;
          keyValues.has_garage = t.has_garage;
          keyValues.has_parking = t.has_parking;
          keyValues.has_basement = t.has_basement;
        } else if (cat.name === 'land') {
          keyValues.area_plot_sqm = (transformed as any).area_plot_sqm;
        } else if (cat.name === 'commercial') {
          const t = transformed as any;
          keyValues.sqm_total = t.sqm_total;
          keyValues.has_elevator = t.has_elevator;
          keyValues.has_parking = t.has_parking;
          keyValues.has_bathrooms = t.has_bathrooms;
        }

        // Print results
        console.log(`    Fields extracted: ${fieldsExtracted}`);
        for (const [k, v] of Object.entries(keyValues)) {
          if (k !== 'title') console.log(`    ${k}: ${v}`);
        }

        if (errors.length > 0) {
          console.log(`    ERRORS: ${errors.join(', ')}`);
        }
        if (warnings.length > 0) {
          console.log(`    WARNINGS: ${warnings.join(', ')}`);
        }
        console.log(`    Result: ${pass ? 'PASS' : 'FAIL'}`);

        listings.push({ url, pass, errors, warnings, fieldsExtracted, keyValues });
      } catch (e: any) {
        console.log(`    ERROR: ${e.message}`);
        listings.push({ url, pass: false, errors: [e.message], warnings: [], fieldsExtracted: 0, keyValues: {} });
      }
    }

    const passedCount = listings.filter(l => l.pass).length;
    categoryResults.push({
      name: cat.name,
      status: passedCount === listings.length ? 'PASS' : passedCount === 0 ? 'FAIL' : 'PARTIAL',
      listings,
      totalListings: listings.length,
      passedListings: passedCount,
    });

    await delay(500);
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  // ============ SUMMARY ============
  console.log(`\n${'='.repeat(80)}`);
  console.log('  VALIDATION SUMMARY');
  console.log(`${'='.repeat(80)}`);

  console.log('\n  | Category    | Status  | Tested | Passed | Failed | Avg Fields |');
  console.log('  |-------------|---------|--------|--------|--------|------------|');
  for (const r of categoryResults) {
    const avgFields = r.listings.length > 0
      ? (r.listings.reduce((s, l) => s + l.fieldsExtracted, 0) / r.listings.length).toFixed(1)
      : '0';
    const icon = r.status === 'PASS' ? 'PASS' : r.status === 'PARTIAL' ? 'WARN' : 'FAIL';
    console.log(`  | ${r.name.padEnd(11)} | ${icon.padEnd(7)} | ${String(r.totalListings).padEnd(6)} | ${String(r.passedListings).padEnd(6)} | ${String(r.totalListings - r.passedListings).padEnd(6)} | ${avgFields.padEnd(10)} |`);
  }

  const totalTested = categoryResults.reduce((s, r) => s + r.totalListings, 0);
  const totalPassed = categoryResults.reduce((s, r) => s + r.passedListings, 0);
  const allPass = categoryResults.every(r => r.status === 'PASS');

  console.log(`\n  Total: ${totalTested} listings, ${totalPassed} passed, ${totalTested - totalPassed} failed`);
  console.log(`  Time: ${elapsed}s`);
  console.log(`\n  Overall: ${allPass ? 'ALL CATEGORIES PASS' : 'ISSUES DETECTED'}`);

  // Detailed per-listing table
  console.log(`\n${'─'.repeat(80)}`);
  console.log('  DETAILED RESULTS');
  console.log(`${'─'.repeat(80)}`);
  for (const r of categoryResults) {
    console.log(`\n  ${r.name.toUpperCase()}:`);
    for (const l of r.listings) {
      const icon = l.pass ? 'PASS' : 'FAIL';
      console.log(`    [${icon}] ${l.url.substring(0, 65)} (${l.fieldsExtracted} fields)`);
      if (l.errors.length > 0) {
        for (const e of l.errors) console.log(`           Error: ${e}`);
      }
      if (l.warnings.length > 0) {
        for (const w of l.warnings) console.log(`           Warn: ${w}`);
      }
    }
  }

  console.log(`\n${'='.repeat(80)}`);

  // Write JSON report
  const report = {
    timestamp: new Date().toISOString(),
    scraper: 'ceskereality',
    elapsed_seconds: parseFloat(elapsed),
    totalTested,
    totalPassed,
    allPass,
    categories: categoryResults,
  };

  const fs = await import('fs');
  fs.writeFileSync('validation-report.json', JSON.stringify(report, null, 2));
  console.log('  Report saved to validation-report.json');

  if (!allPass) process.exit(1);
}

main().catch(e => { console.error(e); process.exit(1); });
