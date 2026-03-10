/**
 * Fetch Full Detail Page from Real Bazos.cz Listing
 *
 * Demonstrates LLM extraction with complete description
 */

import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';

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

import { getLLMExtractor } from './src/services/bazosLLMExtractor';

async function fetchDetailPage(url: string): Promise<{ title: string; description: string; url: string }> {
  console.log(`📡 Fetching detail page: ${url}`);

  const response = await axios.get(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    },
    timeout: 10000
  });

  const html = response.data;

  // Extract title from H1 with class nadpisdetail (may or may not have quotes)
  const titleMatch = html.match(/<H1[^>]*class=["']?nadpisdetail["']?[^>]*>([^<]+)<\/H1>/i);
  const title = titleMatch ? titleMatch[1].trim() : 'No title found';

  // Extract description from div with class popisdetail (may or may not have quotes)
  const descMatch = html.match(/<div[^>]*class=["']?popisdetail["']?[^>]*>([\s\S]*?)<\/div>/i);
  let description = 'No description found';

  if (descMatch) {
    // Clean HTML tags and decode entities
    description = descMatch[1]
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .trim();
  }

  return { title, description, url };
}

async function main() {
  console.log('='.repeat(100));
  console.log('REAL BAZOS.CZ DETAIL PAGE EXTRACTION TEST');
  console.log('='.repeat(100));
  console.log();

  try {
    // Load the listing we fetched earlier
    const listingPath = path.join(__dirname, 'real-apartment-fetched.json');
    if (!fs.existsSync(listingPath)) {
      console.error('❌ No listing found. Run fetch-real-apartment.ts first.');
      process.exit(1);
    }

    const listing = JSON.parse(fs.readFileSync(listingPath, 'utf-8'));

    console.log('📋 FETCHING DETAIL FOR:');
    console.log(`  ID: ${listing.id}`);
    console.log(`  Title: ${listing.title}`);
    console.log(`  Price: ${listing.price_formatted}`);
    console.log(`  URL: ${listing.url}`);
    console.log();

    // Fetch full detail page using the URL from the listing
    const detailUrl = listing.url || `https://reality.bazos.cz/inzerat/${listing.id}/`;
    const detail = await fetchDetailPage(detailUrl);

    console.log('✅ Detail page fetched successfully!');
    console.log();

    console.log('='.repeat(100));
    console.log('📝 FULL LISTING TEXT:');
    console.log('='.repeat(100));
    console.log();
    console.log('TITLE:');
    console.log(detail.title);
    console.log();
    console.log('DESCRIPTION:');
    console.log(detail.description);
    console.log();
    console.log(`Word count: ${detail.description.split(/\s+/).length} words`);
    console.log();
    console.log('='.repeat(100));
    console.log();

    // Extract with LLM
    console.log('⚙️  EXTRACTING WITH LLM...');
    console.log();

    const extractor = getLLMExtractor();
    const inputText = `${detail.title}\n\n${detail.description}`;

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

    // Show key extracted data by category
    console.log('🏠 KEY EXTRACTED DATA:');
    console.log('-'.repeat(100));
    console.log();

    console.log('PROPERTY BASICS:');
    if (result.data.property_type) console.log(`  Property Type: ${result.data.property_type}`);
    if (result.data.transaction_type) console.log(`  Transaction: ${result.data.transaction_type}`);
    if (result.data.price) console.log(`  Price: ${result.data.price.toLocaleString()} CZK`);
    if (result.data.price_note) console.log(`  Price Note: ${result.data.price_note}`);
    console.log();

    console.log('LOCATION:');
    const loc = result.data.location || {};
    if (loc.city) console.log(`  City: ${loc.city}`);
    if (loc.district) console.log(`  District: ${loc.district}`);
    if (loc.region) console.log(`  Region: ${loc.region}`);
    if ((loc as any).country) console.log(`  Country: ${(loc as any).country}`);
    if ((loc as any).complex) console.log(`  Complex: ${(loc as any).complex}`);
    console.log();

    console.log('PROPERTY DETAILS:');
    const det = result.data.details || {};
    if (det.area_sqm) console.log(`  Area: ${det.area_sqm} m²`);
    if (det.rooms !== undefined) console.log(`  Rooms: ${det.rooms}`);
    if (det.bedrooms !== undefined) console.log(`  Bedrooms: ${det.bedrooms}`);
    if (det.bathrooms !== undefined) console.log(`  Bathrooms: ${det.bathrooms}`);
    if (det.floor !== undefined) console.log(`  Floor: ${det.floor}`);
    if (det.total_floors !== undefined) console.log(`  Total Floors: ${det.total_floors}`);
    if (det.year_built) console.log(`  Year Built: ${det.year_built}`);
    if (det.parking_spaces !== undefined) console.log(`  Parking: ${det.parking_spaces}`);
    console.log();

    console.log('CZECH-SPECIFIC:');
    const czech = result.data.czech_specific || {};
    if (czech.disposition) console.log(`  Disposition: ${czech.disposition}`);
    if (czech.ownership) console.log(`  Ownership: ${czech.ownership}`);
    if (czech.condition) console.log(`  Condition: ${czech.condition}`);
    if (czech.construction_type) console.log(`  Construction: ${czech.construction_type}`);
    if (czech.furnished) console.log(`  Furnished: ${czech.furnished}`);
    if (czech.energy_rating) console.log(`  Energy Rating: ${czech.energy_rating}`);
    if (czech.heating_type) console.log(`  Heating: ${czech.heating_type}`);
    if (czech.area_balcony) console.log(`  Balcony: ${czech.area_balcony} m²`);
    if (czech.area_terrace) console.log(`  Terrace: ${czech.area_terrace} m²`);
    console.log();

    console.log('AMENITIES:');
    const amen = result.data.amenities || {};
    const amenTrue = Object.entries(amen).filter(([_, v]) => v === true);
    if (amenTrue.length > 0) {
      amenTrue.forEach(([key]) => console.log(`  ✓ ${key}`));
    } else {
      console.log('  None extracted');
    }
    console.log();

    console.log('📋 FULL EXTRACTED DATA (JSON):');
    console.log('-'.repeat(100));
    console.log(JSON.stringify(result.data, null, 2));
    console.log();
    console.log('='.repeat(100));
    console.log();
    console.log(`✅ DONE! Check the listing online at: ${detail.url}`);
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
