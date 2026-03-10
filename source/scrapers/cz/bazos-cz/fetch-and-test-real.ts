/**
 * Fetch real listing using existing Bazos scraper and test extraction
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

import { scrapeListings } from './src/scrapers/listingsScraper';
import { getLLMExtractor } from './src/services/bazosLLMExtractor';

async function main() {
  console.log('='.repeat(100));
  console.log('REAL BAZOS.CZ LISTING - LIVE EXTRACTION TEST');
  console.log('='.repeat(100));
  console.log();
  
  try {
    console.log('🔍 Fetching real listings from Bazos.cz...');
    console.log('   Category: Byty (Apartments)');
    console.log('   Location: Praha (Prague)');
    console.log('   Type: Prodej (Sale)');
    console.log();
    
    // Fetch real listings using the scraper
    const listings = await scrapeListings('cz', 1); // Fetch 1 page
    
    if (!listings || listings.length === 0) {
      throw new Error('No listings fetched');
    }
    
    // Get first listing
    const listing = listings[0];
    
    console.log('✅ Fetched real listing from Bazos.cz!');
    console.log();
    console.log('📋 LISTING INFO:');
    console.log('-'.repeat(100));
    console.log(`  ID: ${listing.id}`);
    console.log(`  URL: ${listing.url}`);
    console.log(`  Title: ${listing.title}`);
    console.log(`  Price: ${listing.price_formatted}`);
    console.log(`  Location: ${listing.locality}`);
    console.log(`  Category: ${listing.category?.title}`);
    console.log();
    
    // Save to file
    fs.writeFileSync(
      path.join(__dirname, 'real-listing-live.json'),
      JSON.stringify(listing, null, 2)
    );
    console.log('💾 Saved to: real-listing-live.json');
    console.log();
    
    console.log('='.repeat(100));
    console.log('📝 LISTING TEXT:');
    console.log('='.repeat(100));
    console.log();
    console.log('TITLE:');
    console.log(listing.title);
    console.log();
    console.log('DESCRIPTION (' + (listing.description?.length || 0) + ' characters):');
    console.log(listing.description || 'No description');
    console.log();
    console.log('='.repeat(100));
    console.log();
    
    // Extract with LLM
    console.log('⚙️  EXTRACTING WITH LLM (GPT-4.1)...');
    console.log();
    
    const extractor = getLLMExtractor();
    const inputText = `${listing.title}\n\n${listing.description || ''}`;
    
    const result = await extractor.extract(inputText);
    
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
    console.log('📊 EXTRACTION RESULTS - REAL BAZOS.CZ LISTING');
    console.log('='.repeat(100));
    console.log();
    console.log(`✅ Total Fields Extracted: ${totalFields}`);
    console.log(`🎯 Confidence: ${result.data.extraction_metadata.confidence}`);
    console.log(`⏱️  Processing Time: ${result.processingTimeMs}ms`);
    console.log(`🪙 Tokens Used: ${result.tokensUsed}`);
    console.log(`💰 Cost: $${((result.tokensUsed || 0) / 1000 * 0.005).toFixed(6)}`);
    console.log();
    
    // Show key extracted fields
    console.log('🏠 KEY EXTRACTED FIELDS:');
    console.log('-'.repeat(100));
    console.log(`  Property Type: ${result.data.property_type}`);
    console.log(`  Transaction: ${result.data.transaction_type}`);
    if (result.data.price) console.log(`  Price: ${result.data.price.toLocaleString()} CZK`);
    if (result.data.location?.city) console.log(`  City: ${result.data.location.city}`);
    if (result.data.location?.district) console.log(`  District: ${result.data.location.district}`);
    if ((result.data as any).czech_specific?.disposition) {
      console.log(`  Disposition: ${(result.data as any).czech_specific.disposition}`);
    }
    if (result.data.details?.area_sqm) console.log(`  Area: ${result.data.details.area_sqm} m²`);
    if (result.data.details?.floor !== undefined) console.log(`  Floor: ${result.data.details.floor}`);
    console.log();
    
    console.log('📋 COMPLETE EXTRACTED DATA (JSON):');
    console.log('-'.repeat(100));
    console.log(JSON.stringify(result.data, null, 2));
    console.log();
    
    console.log('='.repeat(100));
    console.log(`🌐 VIEW ONLINE: ${listing.url}`);
    console.log('='.repeat(100));
    console.log();
    console.log('✅ SUCCESS! Real listing extraction complete.');
    console.log(`   - Fetched from: Bazos.cz`);
    console.log(`   - Fields extracted: ${totalFields}`);
    console.log(`   - Confidence: ${result.data.extraction_metadata.confidence}`);
    console.log('='.repeat(100));
    
  } catch (error: any) {
    console.error();
    console.error('❌ Error:', error.message);
    if (error.stack) {
      console.error();
      console.error('Stack trace:');
      console.error(error.stack);
    }
    process.exit(1);
  }
}

main().catch(console.error);
