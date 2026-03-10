/**
 * Fetch Real Listing from Bazos.cz and Test Extraction
 */

import axios from 'axios';
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

import { getLLMExtractor } from './src/services/bazosLLMExtractor';

async function fetchRealListing() {
  console.log('🔍 Fetching real apartment listing from Bazos.cz...');
  console.log();
  
  try {
    // Fetch from Bazos API - apartments in Prague
    const response = await axios.get('https://api.bazos.cz/search', {
      params: {
        hlokalita: 'praha',
        hkat: '70', // Byty (apartments)
        rubriky: 'RE', // Reality
        hlokalita: 'praha',
        typ: 'sell',
        cenaod: '5000000',
        cenado: '10000000'
      },
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      },
      timeout: 10000
    });
    
    if (response.data && response.data.inzeraty && response.data.inzeraty.length > 0) {
      // Get first apartment listing
      const listing = response.data.inzeraty[0];
      return listing;
    }
    
    throw new Error('No listings found in API response');
  } catch (error: any) {
    console.error('❌ API fetch failed:', error.message);
    console.log('📝 Using fallback: scraping Bazos website directly...');
    
    // Fallback: Try to fetch from website
    const htmlResponse = await axios.get('https://reality.bazos.cz/byty/praha/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      }
    });
    
    // Parse HTML to extract listing ID
    const html = htmlResponse.data;
    const idMatch = html.match(/\/inzerat\/(\d+)\//);
    
    if (idMatch) {
      const listingId = idMatch[1];
      console.log(`✅ Found listing ID: ${listingId}`);
      
      // Fetch listing details
      const detailResponse = await axios.get(`https://reality.bazos.cz/inzerat/${listingId}/`);
      const detailHtml = detailResponse.data;
      
      // Extract data from HTML (simplified)
      const titleMatch = detailHtml.match(/<h1[^>]*>([^<]+)<\/h1>/);
      const descMatch = detailHtml.match(/<div class="popisdetail">([^<]+)<\/div>/);
      const priceMatch = detailHtml.match(/(\d[\d\s]*)\s*Kč/);
      
      return {
        id: listingId,
        title: titleMatch ? titleMatch[1].trim() : 'Unknown',
        description: descMatch ? descMatch[1].trim() : 'No description',
        price: priceMatch ? priceMatch[1].replace(/\s/g, '') : '0',
        url: `https://reality.bazos.cz/inzerat/${listingId}/`,
        type: 'sell'
      };
    }
    
    throw new Error('Could not extract listing from website');
  }
}

async function main() {
  console.log('='.repeat(100));
  console.log('REAL BAZOS.CZ LISTING EXTRACTION TEST');
  console.log('='.repeat(100));
  console.log();
  
  try {
    // Fetch real listing
    const listing = await fetchRealListing();
    
    console.log('✅ Fetched real listing from Bazos.cz!');
    console.log();
    console.log('📋 LISTING INFO:');
    console.log('-'.repeat(100));
    console.log(`  ID: ${listing.id}`);
    console.log(`  URL: ${listing.url || `https://reality.bazos.cz/inzerat/${listing.id}/`}`);
    console.log(`  Title: ${listing.title}`);
    console.log(`  Price: ${listing.price_formatted || listing.price} CZK`);
    console.log();
    
    // Save to file
    fs.writeFileSync(
      path.join(__dirname, 'real-listing-fetched.json'),
      JSON.stringify(listing, null, 2)
    );
    console.log('💾 Saved to: real-listing-fetched.json');
    console.log();
    
    console.log('='.repeat(100));
    console.log('📝 LISTING TEXT:');
    console.log('='.repeat(100));
    console.log();
    console.log('TITLE:');
    console.log(listing.title);
    console.log();
    console.log('DESCRIPTION:');
    console.log(listing.description || 'No description available');
    console.log();
    console.log('='.repeat(100));
    console.log();
    
    // Extract with LLM
    console.log('⚙️  EXTRACTING WITH LLM...');
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
    console.log('📊 EXTRACTION RESULTS');
    console.log('='.repeat(100));
    console.log();
    console.log(`✅ Total Fields Extracted: ${totalFields}`);
    console.log(`🎯 Confidence: ${result.data.extraction_metadata.confidence}`);
    console.log(`⏱️  Processing Time: ${result.processingTimeMs}ms`);
    console.log(`💰 Cost: $${((result.tokensUsed || 0) / 1000 * 0.005).toFixed(6)}`);
    console.log();
    
    console.log('📋 EXTRACTED DATA (JSON):');
    console.log('-'.repeat(100));
    console.log(JSON.stringify(result.data, null, 2));
    console.log();
    console.log('='.repeat(100));
    console.log();
    console.log(`✅ DONE! Check the listing online at: ${listing.url || `https://reality.bazos.cz/inzerat/${listing.id}/`}`);
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
