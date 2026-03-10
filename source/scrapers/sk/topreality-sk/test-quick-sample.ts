/**
 * Quick Sample Test for TopReality.sk
 * Fetches just first page to verify transformation quickly
 */

import { ListingsScraper } from './src/scrapers/listingsScraper';
import { transformTopRealityToStandard } from './src/transformers';

async function quickTest() {
  console.log('🧪 TOPREALITY.SK QUICK SAMPLE TEST\n');

  const scraper = new ListingsScraper();

  // Test single search: Bratislava apartments for sale
  console.log('📡 Fetching Bratislava apartments (sale) - Page 1 only...\n');

  const listings = await scraper.scrapeRegionWithFilters(
    'c100-Bratislavský kraj',
    '1', // byty (apartments)
    '1', // predaj (sale)
    1    // maxPages = 1
  );

  console.log(`✅ Got ${listings.length} listings\n`);
  console.log('='.repeat(80));

  if (listings.length === 0) {
    console.log('❌ No listings found');
    return;
  }

  // Analyze first 5 listings
  const sample = listings.slice(0, 5);

  for (let i = 0; i < sample.length; i++) {
    const listing = sample[i];
    const transformed = transformTopRealityToStandard(listing);

    console.log(`\n[${i + 1}] ${listing.title.substring(0, 70)}`);
    console.log('-'.repeat(80));

    // TIER 1
    console.log('📋 TIER 1:');
    console.log(`   Price: ${transformed.price} €`);
    console.log(`   Type: ${transformed.property_type} / ${transformed.transaction_type}`);
    console.log(`   Category: ${transformed.property_category}`);
    console.log(`   City: ${transformed.location.city}`);
    console.log(`   Area: ${transformed.details.sqm || 'N/A'} m²`);
    console.log(`   Rooms: ${transformed.details.rooms || 'N/A'}`);
    console.log(`   Floor: ${transformed.details.floor ?? 'N/A'} / ${transformed.details.total_floors ?? 'N/A'}`);
    console.log(`   Condition: ${transformed.condition || 'N/A'}`);
    console.log(`   Heating: ${transformed.heating_type || 'N/A'}`);
    console.log(`   Furnished: ${transformed.furnished || 'N/A'}`);
    console.log(`   Construction: ${transformed.construction_type || 'N/A'}`);
    console.log(`   Energy: ${transformed.energy_rating || 'N/A'}`);

    // TIER 2
    console.log('\n🇸🇰 TIER 2:');
    const cs = transformed.country_specific || {};
    console.log(`   Disposition: ${cs.disposition || 'N/A'}`);
    console.log(`   Ownership: ${cs.ownership || 'N/A'}`);
    console.log(`   Area Living: ${cs.area_living || 'N/A'} m²`);
    console.log(`   Floor (SK): ${cs.floor ?? 'N/A'}`);
    console.log(`   Rooms (SK): ${cs.rooms || 'N/A'}`);
    console.log(`   Elevator: ${cs.elevator ? 'Yes' : 'No'}`);
    console.log(`   Balcony: ${cs.balcony ? 'Yes' : 'No'}`);
    console.log(`   DB Column (slovak_disposition): ${(transformed as any).slovak_disposition || 'N/A'}`);

    // TIER 3
    console.log('\n📦 TIER 3:');
    const pm = transformed.portal_metadata?.topreality_sk;
    if (pm) {
      console.log(`   Original ID: ${pm.original_id}`);
      console.log(`   Property Cat: ${pm.property_category}`);
      console.log(`   Transaction Cat: ${pm.transaction_category}`);
    } else {
      console.log(`   ❌ NO METADATA`);
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('✅ TEST COMPLETE\n');
}

quickTest().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
