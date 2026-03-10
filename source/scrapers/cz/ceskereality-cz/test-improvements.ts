/**
 * Comprehensive test for ceskereality scraper improvements
 * Tests: parseArea, parseNumber, parseFloor, mapCondition, label variants,
 *        house/commercial/land mapPropertyDetails usage
 */
import * as cheerio from 'cheerio';
import { transformApartment } from './src/transformers/ceskerealityApartmentTransformer';
import { transformHouse } from './src/transformers/ceskerealityHouseTransformer';
import { transformCommercial } from './src/transformers/ceskerealityCommercialTransformer';
import { transformLand } from './src/transformers/ceskerealityLandTransformer';
import { mapPropertyDetails } from './src/transformers/propertyDetailsMapper';

// ============================================================
// UNIT TESTS for parseArea, parseNumber, parseFloor, mapCondition
// ============================================================

function testParseAreaAndNumber() {
  console.log('\n=== UNIT TEST: parseArea / parseNumber (space-separated numbers) ===');
  const testCases: Array<{ input: Record<string, string>; expectedField: string; expectedValue: number }> = [
    { input: { 'Plocha pozemku': '2 510 m²' }, expectedField: 'sqmPlot', expectedValue: 2510 },
    { input: { 'Celková plocha': '43 m²' }, expectedField: 'sqm', expectedValue: 43 },
    { input: { 'Celková plocha': '1 200 m²' }, expectedField: 'sqm', expectedValue: 1200 },
    { input: { 'Celková plocha': '43,5 m²' }, expectedField: 'sqm', expectedValue: 43.5 },
    { input: { 'Celková plocha': '10 500 m2' }, expectedField: 'sqm', expectedValue: 10500 },
    { input: { 'Počet pokojů': '3' }, expectedField: 'rooms', expectedValue: 3 },
  ];

  let passed = 0;
  for (const tc of testCases) {
    const result = mapPropertyDetails(tc.input);
    const actual = (result as any)[tc.expectedField];
    const ok = actual === tc.expectedValue;
    console.log(`  ${ok ? 'PASS' : 'FAIL'}: "${JSON.stringify(tc.input)}" => ${tc.expectedField}=${actual} (expected ${tc.expectedValue})`);
    if (ok) passed++;
  }
  console.log(`  Result: ${passed}/${testCases.length} passed`);
  return { passed, total: testCases.length };
}

function testParseFloor() {
  console.log('\n=== UNIT TEST: parseFloor (basements) ===');
  const testCases: Array<{ input: Record<string, string>; expectedField: string; expectedValue: number }> = [
    { input: { 'Podlaží': 'Přízemí' }, expectedField: 'floor', expectedValue: 0 },
    { input: { 'Podlaží': 'Suterén' }, expectedField: 'floor', expectedValue: -1 },
    { input: { 'Podlaží': 'Podzemní podlaží' }, expectedField: 'floor', expectedValue: -1 },
    { input: { 'Podlaží': '3.' }, expectedField: 'floor', expectedValue: 3 },
    { input: { 'Podlaží': '1. patro' }, expectedField: 'floor', expectedValue: 1 },
    { input: { 'Počet podlaží': '5' }, expectedField: 'totalFloors', expectedValue: 5 },
    { input: { 'Počet pater': '3' }, expectedField: 'totalFloors', expectedValue: 3 },
    { input: { 'Podlaží celkem': '8' }, expectedField: 'totalFloors', expectedValue: 8 },
  ];

  let passed = 0;
  for (const tc of testCases) {
    const result = mapPropertyDetails(tc.input);
    const actual = (result as any)[tc.expectedField];
    const ok = actual === tc.expectedValue;
    console.log(`  ${ok ? 'PASS' : 'FAIL'}: "${JSON.stringify(tc.input)}" => ${tc.expectedField}=${actual} (expected ${tc.expectedValue})`);
    if (ok) passed++;
  }
  console.log(`  Result: ${passed}/${testCases.length} passed`);
  return { passed, total: testCases.length };
}

function testMapCondition() {
  console.log('\n=== UNIT TEST: mapCondition (expanded variants) ===');
  const testCases: Array<{ input: Record<string, string>; expectedValue: string }> = [
    { input: { 'Stav': 'Novostavba' }, expectedValue: 'new' },
    { input: { 'Stav': 'Nový' }, expectedValue: 'new' },
    { input: { 'Stav': 'Po rekonstrukci' }, expectedValue: 'after_renovation' },
    { input: { 'Stav': 'Po renovaci' }, expectedValue: 'after_renovation' },
    { input: { 'Stav': 'Výborný' }, expectedValue: 'excellent' },
    { input: { 'Stav': 'Velmi dobrý' }, expectedValue: 'excellent' },
    { input: { 'Stav': 'Vynikající' }, expectedValue: 'excellent' },
    { input: { 'Stav': 'Dobrý' }, expectedValue: 'good' },
    { input: { 'Stav': 'Udržovaný' }, expectedValue: 'good' },
    { input: { 'Stav': 'Zachovalý' }, expectedValue: 'good' },
    { input: { 'Stav': 'K rekonstrukci' }, expectedValue: 'requires_renovation' },
    { input: { 'Stav': 'Před rekonstrukcí' }, expectedValue: 'requires_renovation' },
    { input: { 'Stav': 'Špatný' }, expectedValue: 'requires_renovation' },
    { input: { 'Stav': 'K demolici' }, expectedValue: 'requires_renovation' },
  ];

  let passed = 0;
  for (const tc of testCases) {
    const result = mapPropertyDetails(tc.input);
    const ok = result.condition === tc.expectedValue;
    console.log(`  ${ok ? 'PASS' : 'FAIL'}: "${tc.input['Stav']}" => condition=${result.condition} (expected ${tc.expectedValue})`);
    if (ok) passed++;
  }
  console.log(`  Result: ${passed}/${testCases.length} passed`);
  return { passed, total: testCases.length };
}

// ============================================================
// LIVE SCRAPE TESTS - 5 per category
// ============================================================

const CATEGORY_URLS: Record<string, string> = {
  apartment: 'https://www.ceskereality.cz/prodej/byty/',
  house: 'https://www.ceskereality.cz/prodej/rodinne-domy/',
  land: 'https://www.ceskereality.cz/prodej/pozemky/',
  commercial: 'https://www.ceskereality.cz/prodej/komercni/',
};

async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function getListingUrls(categoryUrl: string, count: number): Promise<string[]> {
  const response = await fetch(categoryUrl);
  const html = await response.text();
  const $ = cheerio.load(html);
  const urls = new Set<string>();

  $('a[href*="/prodej/"][href$=".html"]').each((_, el) => {
    const href = $(el).attr('href');
    if (href) {
      urls.add(href.startsWith('http') ? href : `https://www.ceskereality.cz${href}`);
    }
  });

  return Array.from(urls).slice(0, count);
}

async function scrapeDetailPage(url: string): Promise<{ jsonLd: any; htmlData: any } | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const html = await response.text();
    const $ = cheerio.load(html);

    const jsonLdScript = $('script[type="application/ld+json"]').first();
    if (!jsonLdScript.length) return null;
    const jsonLd = JSON.parse(jsonLdScript.html()!);

    const htmlData: any = {};
    const images: string[] = [];
    $('img[src*="img.ceskereality.cz/foto"]').each((_, el) => {
      const src = $(el).attr('src');
      if (src && !src.includes('logo') && !src.includes('icon') && !src.includes('makleri')) {
        const fullSizeUrl = src.split('?')[0];
        if (!images.includes(fullSizeUrl)) images.push(fullSizeUrl);
      }
    });
    if (images.length > 0) htmlData.images = images;

    const propertyDetails: Record<string, string> = {};
    $('.i-info').each((_, el) => {
      const label = $(el).find('.i-info__title').text().trim();
      const value = $(el).find('.i-info__value').text().trim();
      if (label && value) propertyDetails[label] = value;
    });
    if (Object.keys(propertyDetails).length > 0) htmlData.propertyDetails = propertyDetails;

    const energyRating = $('.s-estate-detail-intro__energy').text().trim();
    if (energyRating) htmlData.energyRating = energyRating;

    return { jsonLd, htmlData };
  } catch (e) {
    console.error(`  Error fetching ${url}: ${e}`);
    return null;
  }
}

function countNonNullFields(obj: any, prefix = ''): { total: number; filled: number; details: Record<string, any> } {
  let total = 0;
  let filled = 0;
  const details: Record<string, any> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (key === 'portal_metadata' || key === 'country_specific') continue;
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      const sub = countNonNullFields(value, `${prefix}${key}.`);
      total += sub.total;
      filled += sub.filled;
      Object.assign(details, sub.details);
    } else {
      total++;
      const isFilled = value !== undefined && value !== null && value !== '' && value !== 0 && value !== false;
      if (isFilled) {
        filled++;
        details[`${prefix}${key}`] = value;
      }
    }
  }
  return { total, filled, details };
}

async function testCategory(category: string, count: number) {
  console.log(`\n=== LIVE TEST: ${category.toUpperCase()} (${count} listings) ===`);

  const urls = await getListingUrls(CATEGORY_URLS[category], count);
  console.log(`  Found ${urls.length} listing URLs`);

  const results: Array<{ url: string; fieldCount: number; totalFields: number; filledFields: string[]; rawDetails: Record<string, string> }> = [];

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    console.log(`  [${i + 1}/${urls.length}] ${url.substring(0, 80)}...`);
    await delay(300);

    const data = await scrapeDetailPage(url);
    if (!data) {
      console.log(`    SKIP: could not fetch`);
      continue;
    }

    let transformed: any;
    try {
      switch (category) {
        case 'apartment':
          transformed = transformApartment(data.jsonLd, url, data.htmlData);
          break;
        case 'house':
          transformed = transformHouse(data.jsonLd, url, data.htmlData);
          break;
        case 'commercial':
          transformed = transformCommercial(data.jsonLd, url, data.htmlData);
          break;
        case 'land':
          transformed = transformLand(data.jsonLd, url, data.htmlData);
          break;
      }
    } catch (e) {
      console.log(`    ERROR transforming: ${e}`);
      continue;
    }

    const stats = countNonNullFields(transformed);
    results.push({
      url,
      fieldCount: stats.filled,
      totalFields: stats.total,
      filledFields: Object.keys(stats.details),
      rawDetails: data.htmlData?.propertyDetails || {},
    });

    console.log(`    Fields filled: ${stats.filled}/${stats.total} | Raw details: ${Object.keys(data.htmlData?.propertyDetails || {}).length} labels`);
    console.log(`    Raw labels: ${Object.keys(data.htmlData?.propertyDetails || {}).join(', ')}`);
  }

  // Summary
  const avgFilled = results.length > 0 ? (results.reduce((s, r) => s + r.fieldCount, 0) / results.length).toFixed(1) : '0';
  const avgTotal = results.length > 0 ? (results.reduce((s, r) => s + r.totalFields, 0) / results.length).toFixed(1) : '0';
  console.log(`\n  SUMMARY for ${category}: ${results.length} listings tested`);
  console.log(`    Average fields filled: ${avgFilled} / ${avgTotal}`);

  // Check which mapped fields actually got populated
  const fieldCounts: Record<string, number> = {};
  for (const r of results) {
    for (const f of r.filledFields) {
      fieldCounts[f] = (fieldCounts[f] || 0) + 1;
    }
  }
  console.log(`    Field extraction rates:`);
  const sorted = Object.entries(fieldCounts).sort((a, b) => b[1] - a[1]);
  for (const [field, count] of sorted) {
    console.log(`      ${field}: ${count}/${results.length} (${((count / results.length) * 100).toFixed(0)}%)`);
  }

  return { category, results, fieldCounts, avgFilled: parseFloat(avgFilled as string) };
}

// ============================================================
// MAIN
// ============================================================

async function main() {
  console.log('========================================');
  console.log('CESKEREALITY SCRAPER IMPROVEMENT TESTS');
  console.log('========================================');

  // Unit tests
  const unitResults = [];
  unitResults.push(testParseAreaAndNumber());
  unitResults.push(testParseFloor());
  unitResults.push(testMapCondition());

  const totalUnit = unitResults.reduce((s, r) => s + r.total, 0);
  const passedUnit = unitResults.reduce((s, r) => s + r.passed, 0);
  console.log(`\n=== UNIT TEST TOTALS: ${passedUnit}/${totalUnit} passed ===`);

  // Live tests - 5 per category
  const liveResults = [];
  for (const cat of ['apartment', 'house', 'land', 'commercial']) {
    try {
      const result = await testCategory(cat, 5);
      liveResults.push(result);
    } catch (e) {
      console.error(`  FATAL ERROR testing ${cat}: ${e}`);
      liveResults.push({ category: cat, results: [], fieldCounts: {}, avgFilled: 0 });
    }
  }

  // Final summary
  console.log('\n========================================');
  console.log('FINAL SUMMARY');
  console.log('========================================');
  console.log(`Unit tests: ${passedUnit}/${totalUnit} passed`);
  for (const r of liveResults) {
    console.log(`${r.category}: ${r.results.length} listings, avg ${r.avgFilled} fields filled`);
  }

  const allTransformed = liveResults.reduce((s, r) => s + r.results.length, 0);
  console.log(`\nTotal listings transformed successfully: ${allTransformed}/20`);

  if (passedUnit < totalUnit) {
    console.log('\nWARNING: Some unit tests failed!');
    process.exit(1);
  }
  if (allTransformed < 15) {
    console.log('\nWARNING: Too few listings transformed (<15/20)');
    process.exit(1);
  }
  console.log('\nAll tests passed!');
}

main().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
