/**
 * Comprehensive data quality test
 * Shows actual extracted property data
 */

import dotenv from 'dotenv';
dotenv.config();

import { ListingsScraper } from './src/scrapers/listingsScraper';
import { transformBazosListingByCategory } from './src/transformers/bazosTransformer';

async function testDataQuality() {
  console.log('\n🧪 Data Quality Test (Direct Transformation)\n');

  try {
    // Fetch 3 test listings
    console.log('📥 Fetching 3 test listings...');
    const scraper = new ListingsScraper({ countries: ['cz'], sections: ['RE'], maxPages: 1 });
    const listings = (await scraper.scrapeAll()).slice(0, 3);

    // Fetch descriptions
    const { scrapeDetailPages } = await import('./src/scrapers/detailScraper');
    const urls = listings.filter(l => l.url).map(l => l.url!);
    const descriptionMap = await scrapeDetailPages(urls, 300);
    for (const listing of listings) {
      if (listing.url) {
        (listing as any).description = descriptionMap.get(listing.url) || '';
      }
    }

    console.log(`✅ Fetched ${listings.length} listings\n`);

    // Transform each
    for (const listing of listings) {
      console.log(`${'='.repeat(70)}`);
      console.log(`📋 Listing ${listing.id}`);
      console.log('='.repeat(70));
      console.log(`\n🔹 ORIGINAL DATA:`);
      console.log(`  Title: ${listing.title}`);
      console.log(`  Price (raw): ${listing.price_formatted}`);
      console.log(`  Locality: ${listing.locality}`);

      console.log(`\n🔹 TRANSFORMED DATA:`);
      const transformed: any = await transformBazosListingByCategory(listing, 'cz');

      console.log(`  Category: ${transformed.property_category}`);
      console.log(`  Price: ${transformed.price} ${transformed.currency}`);
      console.log(`  Transaction: ${transformed.transaction_type}`);
      console.log(`  City: ${transformed.location?.city || 'MISSING'}`);
      console.log(`  District: ${transformed.location?.district || 'none'}`);

      // Category-specific fields
      if (transformed.property_category === 'apartment') {
        console.log(`  Bedrooms: ${transformed.bedrooms ?? 'none'}`);
        console.log(`  Area: ${transformed.sqm ?? 'none'} m²`);
        console.log(`  Floor: ${transformed.floor ?? 'none'}`);
      }

      // Check for issues
      const issues = [];
      if (!transformed.price || transformed.price === 0) {
        issues.push('❌ Price missing or zero');
      }
      if (!transformed.location?.city) {
        issues.push('❌ City missing');
      }
      if (transformed.sqm && transformed.sqm > 500) {
        issues.push('⚠️ Unusually large area');
      }

      if (issues.length > 0) {
        console.log(`\n🚨 ISSUES FOUND:`);
        issues.forEach(issue => console.log(`  ${issue}`));
      } else {
        console.log(`\n✅ No data quality issues`);
      }
      console.log();
    }

    console.log('='.repeat(70));
    console.log('\n✅ Data quality test complete\n');
    process.exit(0);

  } catch (error: any) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

testDataQuality();
