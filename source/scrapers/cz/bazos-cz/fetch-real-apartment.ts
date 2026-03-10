/**
 * Fetch Real Apartment Listing from Bazos.cz
 *
 * Demonstrates LLM extraction on actual live data
 */

import * as fs from 'fs';
import * as path from 'path';

// Load environment
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  const envFile = fs.readFileSync(envPath, 'utf-8');
  envFile.split('\n').forEach(line => {
    const match = line.match(/^([^=:#]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim();
      if (!process.env[key]) process.env[key] = value;
    }
  });
}

import { ListingsScraper } from './src/scrapers/listingsScraper';
import { getLLMExtractor } from './src/services/bazosLLMExtractor';

async function main() {
  console.log('='.repeat(100));
  console.log('REAL BAZOS.CZ APARTMENT EXTRACTION TEST');
  console.log('='.repeat(100));
  console.log();

  try {
    // 1. Fetch real listings from Bazos.cz
    console.log('🔍 Fetching real apartment listings from Bazos.cz...');
    console.log();

    const scraper = new ListingsScraper({
      countries: ['cz'],
      sections: ['RE'],  // Real Estate
      maxPages: 1,       // Just 1 page (20 listings)
      delayMs: 0
    });

    const listings = await scraper.scrapeCountrySection('cz', 'RE', 1);

    if (listings.length === 0) {
      console.error('❌ No listings found from Bazos.cz');
      process.exit(1);
    }

    console.log(`✅ Fetched ${listings.length} listings from Bazos.cz`);
    console.log();

    // 2. Find an apartment listing
    const apartmentKeywords = ['byt', 'apartment', '1+kk', '2+kk', '3+kk', '1+1', '2+1', '3+1'];
    let apartment = listings.find(listing =>
      apartmentKeywords.some(keyword =>
        listing.title?.toLowerCase().includes(keyword)
      )
    );

    // If no apartment found, just use first listing
    if (!apartment) {
      console.log('⚠️  No apartment found, using first listing instead');
      apartment = listings[0];
    }

    console.log('📋 SELECTED LISTING:');
    console.log('-'.repeat(100));
    console.log(`  ID: ${apartment.id}`);
    console.log(`  Title: ${apartment.title}`);
    console.log(`  Category: ${(apartment.category as any)?.title || 'N/A'}`);
    console.log(`  Price: ${apartment.price_formatted || apartment.price}`);
    console.log(`  URL: https://reality.bazos.cz/inzerat/${apartment.id}/`);
    console.log();

    // Save raw listing for reference
    fs.writeFileSync(
      path.join(__dirname, 'real-apartment-fetched.json'),
      JSON.stringify(apartment, null, 2)
    );
    console.log('💾 Saved raw listing to: real-apartment-fetched.json');
    console.log();

    console.log('='.repeat(100));
    console.log('📝 LISTING TEXT TO EXTRACT:');
    console.log('='.repeat(100));
    console.log();
    console.log('TITLE:');
    console.log(apartment.title || 'No title');
    console.log();
    console.log('DESCRIPTION:');
    console.log(apartment.description || 'No description available (list API only provides titles)');
    console.log();
    console.log('='.repeat(100));
    console.log();

    // 3. Extract with LLM
    console.log('⚙️  EXTRACTING WITH LLM...');
    console.log();

    const extractor = getLLMExtractor();
    const inputText = `${apartment.title || ''}\n\n${apartment.description || 'No full description available from list API'}`;

    const startTime = Date.now();
    const result = await extractor.extract(inputText);
    const extractionTime = Date.now() - startTime;

    // Count fields
    const countFields = (obj: any): number => {
      let count = 0;
      for (const [key, value] of Object.entries(obj)) {
        if (value === null || value === undefined) continue;
        if (typeof value === 'object' && !Array.isArray(value)) {
          count += countFields(value);
        } else if (value !== '' && !(typeof value === 'boolean' && value === false)) {
          count++;
        }
      }
      return count;
    };

    const totalFields = countFields(result.data);

    console.log('='.repeat(100));
    console.log('📊 EXTRACTION RESULTS');
    console.log('='.repeat(100));
    console.log();
    console.log(`✅ Total Fields Extracted: ${totalFields}`);
    console.log(`🎯 Confidence: ${result.data.extraction_metadata.confidence}`);
    console.log(`⏱️  Processing Time: ${extractionTime}ms`);
    console.log(`💰 Tokens Used: ${result.tokensUsed}`);
    console.log(`💵 Cost: $${((result.tokensUsed || 0) / 1000 * 0.005).toFixed(6)}`);
    console.log();

    // Show key extracted data
    console.log('🏠 KEY EXTRACTED DATA:');
    console.log('-'.repeat(100));
    if (result.data.property_type) console.log(`  Property Type: ${result.data.property_type}`);
    if (result.data.transaction_type) console.log(`  Transaction: ${result.data.transaction_type}`);
    if (result.data.price) console.log(`  Price: ${result.data.price.toLocaleString()} CZK`);

    const loc = result.data.location || {};
    if (loc.city) console.log(`  City: ${loc.city}`);
    if (loc.district) console.log(`  District: ${loc.district}`);

    const det = result.data.details || {};
    if (det.area_sqm) console.log(`  Area: ${det.area_sqm} m²`);
    if (det.rooms !== undefined) console.log(`  Rooms: ${det.rooms}`);
    if (det.floor !== undefined) console.log(`  Floor: ${det.floor}`);

    const czech = result.data.czech_specific || {};
    if (czech.disposition) console.log(`  Disposition: ${czech.disposition}`);
    if (czech.ownership) console.log(`  Ownership: ${czech.ownership}`);
    if (czech.condition) console.log(`  Condition: ${czech.condition}`);
    console.log();

    console.log('📋 FULL EXTRACTED DATA (JSON):');
    console.log('-'.repeat(100));
    console.log(JSON.stringify(result.data, null, 2));
    console.log();
    console.log('='.repeat(100));
    console.log();
    console.log(`✅ DONE! Check the listing online at: https://reality.bazos.cz/inzerat/${apartment.id}/`);
    console.log('='.repeat(100));

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

main().catch(console.error);
