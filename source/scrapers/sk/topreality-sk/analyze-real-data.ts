/**
 * Analyze Real Data from TopReality.sk
 *
 * Tests the complete transformation pipeline with actual listings
 * to verify all 3 tiers are populating correctly.
 */

import { ListingsScraper } from './src/scrapers/listingsScraper';
import { transformTopRealityToStandard } from './src/transformers';
import { StandardProperty } from '@landomo/core';

async function analyzeRealData() {
  console.log('🔍 TOPREALITY.SK REAL DATA ANALYSIS');
  console.log('='.repeat(80));
  console.log('Testing complete transformation pipeline with actual listings\n');

  try {
    const scraper = new ListingsScraper();

    // Limit to Bratislava region only for quick test
    (scraper as any).regions = ['c100-Bratislavský kraj'];

    console.log('📡 Fetching listings from Bratislava region...\n');

    const startTime = Date.now();
    const listings = await scraper.scrapeAll(2); // 2 concurrent
    const scrapeDuration = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log(`\n✅ Scraped ${listings.length} listings in ${scrapeDuration}s`);
    console.log('='.repeat(80));

    if (listings.length === 0) {
      console.log('❌ No listings found. Cannot analyze.');
      return;
    }

    // Take sample of 10 listings (or fewer if less available)
    const sampleSize = Math.min(10, listings.length);
    const sample = listings.slice(0, sampleSize);

    console.log(`\n📊 Analyzing ${sampleSize} sample listings...\n`);
    console.log('='.repeat(80));

    // Transform and analyze each listing
    const transformedProperties: Array<StandardProperty & Record<string, any>> = [];

    for (let i = 0; i < sample.length; i++) {
      const listing = sample[i];
      console.log(`\n[${i + 1}/${sampleSize}] ${listing.title.substring(0, 60)}...`);
      console.log('-'.repeat(80));

      try {
        const transformed = transformTopRealityToStandard(listing);
        transformedProperties.push(transformed);

        // Display transformation results
        console.log(`✅ Category: ${transformed.property_category}`);
        console.log(`   URL: ${transformed.source_url}`);

        // TIER 1: Global Fields
        console.log('\n   📋 TIER 1 (Global Fields):');
        console.log(`      - Price: ${transformed.price} ${transformed.currency}`);
        console.log(`      - Type: ${transformed.property_type} (${transformed.transaction_type})`);
        console.log(`      - Location: ${transformed.location.city}, ${transformed.location.country}`);
        console.log(`      - Address: ${transformed.location.address}`);
        console.log(`      - Coordinates: ${transformed.location.coordinates ? 'YES' : 'NO'}`);
        console.log(`      - Area: ${transformed.details.sqm || 'N/A'} m²`);
        console.log(`      - Rooms: ${transformed.details.rooms || 'N/A'}`);
        console.log(`      - Bedrooms: ${transformed.details.bedrooms || 'N/A'}`);
        console.log(`      - Bathrooms: ${transformed.details.bathrooms || 'N/A'}`);
        console.log(`      - Floor: ${transformed.details.floor ?? 'N/A'} / ${transformed.details.total_floors ?? 'N/A'}`);
        console.log(`      - Year Built: ${transformed.details.year_built || 'N/A'}`);
        console.log(`      - Renovation Year: ${transformed.details.renovation_year || 'N/A'}`);
        console.log(`      - Price/m²: ${transformed.price_per_sqm || 'N/A'} €/m²`);
        console.log(`      - Condition: ${transformed.condition || 'N/A'}`);
        console.log(`      - Heating: ${transformed.heating_type || 'N/A'}`);
        console.log(`      - Furnished: ${transformed.furnished || 'N/A'}`);
        console.log(`      - Construction: ${transformed.construction_type || 'N/A'}`);
        console.log(`      - Energy Rating: ${transformed.energy_rating || 'N/A'}`);
        console.log(`      - Deposit: ${transformed.deposit || 'N/A'}`);
        console.log(`      - Images: ${transformed.images?.length || 0}`);
        console.log(`      - Description Length: ${transformed.description?.length || 0} chars`);

        // Amenities
        const amenities = Object.entries(transformed.amenities || {})
          .filter(([_, value]) => value === true)
          .map(([key]) => key.replace('has_', '').replace('is_', ''));
        console.log(`      - Amenities: ${amenities.length > 0 ? amenities.join(', ') : 'None detected'}`);

        // TIER 2: Slovak-Specific Fields
        console.log('\n   🇸🇰 TIER 2 (Slovak-Specific Fields):');
        const cs = transformed.country_specific || {};
        console.log(`      - Disposition: ${cs.disposition || 'N/A'}`);
        console.log(`      - Ownership: ${cs.ownership || 'N/A'}`);
        console.log(`      - Condition (SK): ${cs.condition || 'N/A'}`);
        console.log(`      - Furnished (SK): ${cs.furnished || 'N/A'}`);
        console.log(`      - Heating (SK): ${cs.heating_type || 'N/A'}`);
        console.log(`      - Construction (SK): ${cs.construction_type || 'N/A'}`);
        console.log(`      - Area Living: ${cs.area_living || 'N/A'} m²`);
        console.log(`      - Area Plot: ${cs.area_plot || 'N/A'} m²`);
        console.log(`      - Energy (SK): ${cs.energy_rating || 'N/A'}`);
        console.log(`      - Year Built (SK): ${cs.year_built || 'N/A'}`);
        console.log(`      - Renovation (SK): ${cs.renovation_year || 'N/A'}`);
        console.log(`      - Floor (SK): ${cs.floor ?? 'N/A'}`);
        console.log(`      - Total Floors (SK): ${cs.total_floors ?? 'N/A'}`);
        console.log(`      - Rooms (SK): ${cs.rooms || 'N/A'}`);

        // Slovak amenities
        const skAmenities = [];
        if (cs.balcony) skAmenities.push('balcony');
        if (cs.terrace) skAmenities.push('terrace');
        if (cs.elevator) skAmenities.push('elevator');
        if (cs.garage) skAmenities.push('garage');
        if (cs.garden) skAmenities.push('garden');
        if (cs.loggia) skAmenities.push('loggia');
        if (cs.pool) skAmenities.push('pool');
        console.log(`      - SK Amenities: ${skAmenities.length > 0 ? skAmenities.join(', ') : 'None'}`);

        // Database columns
        console.log(`      - DB Column (slovak_disposition): ${(transformed as any).slovak_disposition || 'N/A'}`);
        console.log(`      - DB Column (slovak_ownership): ${(transformed as any).slovak_ownership || 'N/A'}`);

        // TIER 3: Portal Metadata
        console.log('\n   📦 TIER 3 (Portal Metadata - JSONB):');
        const pm = transformed.portal_metadata?.topreality_sk;
        if (pm) {
          console.log(`      - Original ID: ${pm.original_id}`);
          console.log(`      - Source URL: ${pm.source_url}`);
          console.log(`      - Property Category: ${pm.property_category}`);
          console.log(`      - Transaction Category: ${pm.transaction_category}`);
        } else {
          console.log(`      ❌ NO PORTAL METADATA`);
        }

      } catch (error: any) {
        console.log(`   ❌ Transformation failed: ${error.message}`);
      }
    }

    // SUMMARY STATISTICS
    console.log('\n' + '='.repeat(80));
    console.log('📈 SUMMARY STATISTICS');
    console.log('='.repeat(80));

    const stats = calculateFieldCoverage(transformedProperties);

    console.log('\n🎯 TIER 1 - Global Field Coverage:');
    console.log(`   Essential Fields:`);
    console.log(`     - Price: ${stats.tier1.price}%`);
    console.log(`     - Location: ${stats.tier1.location}%`);
    console.log(`     - Area: ${stats.tier1.area}%`);
    console.log(`     - Rooms: ${stats.tier1.rooms}%`);
    console.log(`     - Images: ${stats.tier1.images}%`);
    console.log(`     - Description: ${stats.tier1.description}%`);
    console.log(`   Optional Fields:`);
    console.log(`     - Floor: ${stats.tier1.floor}%`);
    console.log(`     - Year Built: ${stats.tier1.yearBuilt}%`);
    console.log(`     - Condition: ${stats.tier1.condition}%`);
    console.log(`     - Heating: ${stats.tier1.heating}%`);
    console.log(`     - Furnished: ${stats.tier1.furnished}%`);
    console.log(`     - Construction: ${stats.tier1.construction}%`);
    console.log(`     - Energy Rating: ${stats.tier1.energyRating}%`);
    console.log(`     - Deposit: ${stats.tier1.deposit}%`);
    console.log(`   Missing Fields:`);
    console.log(`     - Coordinates: ${stats.tier1.coordinates}% (HTML limitation)`);
    console.log(`     - Available From: ${stats.tier1.availableFrom}%`);
    console.log(`     - Published Date: ${stats.tier1.publishedDate}%`);

    console.log('\n🇸🇰 TIER 2 - Slovak-Specific Field Coverage:');
    console.log(`     - Disposition: ${stats.tier2.disposition}%`);
    console.log(`     - Ownership: ${stats.tier2.ownership}%`);
    console.log(`     - Area Living: ${stats.tier2.areaLiving}%`);
    console.log(`     - Area Plot: ${stats.tier2.areaPlot}%`);
    console.log(`     - Floor Info: ${stats.tier2.floor}%`);
    console.log(`     - Slovak Amenities: ${stats.tier2.amenities}%`);

    console.log('\n📦 TIER 3 - Portal Metadata Coverage:');
    console.log(`     - Portal Metadata: ${stats.tier3.metadata}%`);

    console.log('\n🏆 OVERALL FIELD EXTRACTION SCORE:');
    console.log(`     - Tier 1: ${stats.overall.tier1.toFixed(1)}%`);
    console.log(`     - Tier 2: ${stats.overall.tier2.toFixed(1)}%`);
    console.log(`     - Tier 3: ${stats.overall.tier3.toFixed(1)}%`);
    console.log(`     - TOTAL: ${stats.overall.total.toFixed(1)}%`);

    // Category breakdown
    console.log('\n📊 CATEGORY BREAKDOWN:');
    const categoryCount: Record<string, number> = {};
    transformedProperties.forEach(p => {
      categoryCount[p.property_category] = (categoryCount[p.property_category] || 0) + 1;
    });
    Object.entries(categoryCount).forEach(([cat, count]) => {
      console.log(`     - ${cat}: ${count} (${(count/transformedProperties.length*100).toFixed(1)}%)`);
    });

    console.log('\n' + '='.repeat(80));
    console.log('✅ ANALYSIS COMPLETE');
    console.log('='.repeat(80));
    console.log(`\n📝 Analyzed ${transformedProperties.length}/${sample.length} listings successfully`);
    console.log(`⏱️  Total time: ${((Date.now() - startTime) / 1000).toFixed(1)}s`);

  } catch (error: any) {
    console.error('\n❌ ANALYSIS FAILED:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

/**
 * Calculate field coverage statistics
 */
function calculateFieldCoverage(properties: Array<StandardProperty & Record<string, any>>) {
  const count = properties.length;
  if (count === 0) return getEmptyStats();

  const hasField = (field: any) => field !== undefined && field !== null && field !== '' && field !== 0;
  const countField = (getter: (p: any) => any) =>
    properties.filter(p => hasField(getter(p))).length;
  const percent = (n: number) => Math.round((n / count) * 100);

  return {
    tier1: {
      price: percent(countField(p => p.price)),
      location: percent(countField(p => p.location?.city)),
      area: percent(countField(p => p.details?.sqm)),
      rooms: percent(countField(p => p.details?.rooms)),
      images: percent(countField(p => p.images?.length)),
      description: percent(countField(p => p.description)),
      floor: percent(countField(p => p.details?.floor)),
      yearBuilt: percent(countField(p => p.details?.year_built)),
      condition: percent(countField(p => p.condition)),
      heating: percent(countField(p => p.heating_type)),
      furnished: percent(countField(p => p.furnished)),
      construction: percent(countField(p => p.construction_type)),
      energyRating: percent(countField(p => p.energy_rating)),
      deposit: percent(countField(p => p.deposit)),
      coordinates: percent(countField(p => p.location?.coordinates)),
      availableFrom: percent(countField(p => p.available_from)),
      publishedDate: percent(countField(p => p.published_date)),
    },
    tier2: {
      disposition: percent(countField(p => p.country_specific?.disposition)),
      ownership: percent(countField(p => p.country_specific?.ownership)),
      areaLiving: percent(countField(p => p.country_specific?.area_living)),
      areaPlot: percent(countField(p => p.country_specific?.area_plot)),
      floor: percent(countField(p => p.country_specific?.floor)),
      amenities: percent(countField(p => {
        const cs = p.country_specific || {};
        return cs.balcony || cs.terrace || cs.elevator || cs.garage || cs.garden;
      })),
    },
    tier3: {
      metadata: percent(countField(p => p.portal_metadata?.topreality_sk)),
    },
    overall: {
      tier1: 0,
      tier2: 0,
      tier3: 0,
      total: 0
    }
  };
}

function getEmptyStats() {
  return {
    tier1: { price: 0, location: 0, area: 0, rooms: 0, images: 0, description: 0,
             floor: 0, yearBuilt: 0, condition: 0, heating: 0, furnished: 0,
             construction: 0, energyRating: 0, deposit: 0, coordinates: 0,
             availableFrom: 0, publishedDate: 0 },
    tier2: { disposition: 0, ownership: 0, areaLiving: 0, areaPlot: 0, floor: 0, amenities: 0 },
    tier3: { metadata: 0 },
    overall: { tier1: 0, tier2: 0, tier3: 0, total: 0 }
  };
}

// Run analysis
analyzeRealData();
