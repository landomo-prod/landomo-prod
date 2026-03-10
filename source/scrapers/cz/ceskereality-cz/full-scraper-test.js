const { scrapeListings } = require('./dist/scrapers/listingsScraper');
const { sendToIngest } = require('./dist/adapters/ingestAdapter');
const { transformApartment } = require('./dist/transformers/ceskerealityApartmentTransformer');
const { transformHouse } = require('./dist/transformers/ceskerealityHouseTransformer');
const { transformLand } = require('./dist/transformers/ceskerealityLandTransformer');
const { transformCommercial } = require('./dist/transformers/ceskerealityCommercialTransformer');

// Override environment for test
process.env.MAX_PAGES = '1'; // Only 1 page per category
process.env.DELAY_MS = '200';
process.env.INGEST_API_URL = 'http://localhost:9999'; // Mock URL

console.log('═══════════════════════════════════════════════════════════════');
console.log('  FULL SCRAPER END-TO-END TEST');
console.log('  Testing: Scraping → Transformation → Validation');
console.log('═══════════════════════════════════════════════════════════════\n');

console.log('Configuration:');
console.log('  Max pages per category: 1');
console.log('  Delay between requests: 200ms');
console.log('  Categories: apartment, house, land, commercial\n');

// Track statistics
const stats = {
  apartment: { scraped: 0, transformed: 0, failed: 0, issues: [] },
  house: { scraped: 0, transformed: 0, failed: 0, issues: [] },
  land: { scraped: 0, transformed: 0, failed: 0, issues: [] },
  commercial: { scraped: 0, transformed: 0, failed: 0, issues: [] }
};

// Mock ingest to capture and validate data
const originalSendToIngest = sendToIngest;
require('./dist/adapters/ingestAdapter').sendToIngest = async function(listings, category, tracker) {
  stats[category].scraped += listings.length;

  console.log(`\n${'─'.repeat(70)}`);
  console.log(`📊 ${category.toUpperCase()} - Batch of ${listings.length} listings`);
  console.log(`${'─'.repeat(70)}`);

  // Transform the scraped listings based on category
  const transformedProperties = [];
  for (const listing of listings) {
    try {
      // Debug: check what we received
      if (!listing || !listing.jsonLd) {
        console.error(`❌ Invalid listing received: listing=${!!listing}, jsonLd=${!!listing?.jsonLd}, url=${listing?.url}`);
        continue;
      }

      let property;
      switch (category) {
        case 'apartment':
          property = transformApartment(listing.jsonLd, listing.url, listing.htmlData);
          break;
        case 'house':
          property = transformHouse(listing.jsonLd, listing.url, listing.htmlData);
          break;
        case 'land':
          property = transformLand(listing.jsonLd, listing.url, listing.htmlData);
          break;
        case 'commercial':
          property = transformCommercial(listing.jsonLd, listing.url, listing.htmlData);
          break;
      }
      if (property) {
        transformedProperties.push(property);
      } else {
        console.error(`❌ Transformer returned null/undefined for ${listing.url}`);
      }
    } catch (error) {
      console.error(`❌ Transformation error for ${listing?.url}:`, error.message);
      console.error(error.stack);
    }
  }

  transformedProperties.forEach((property, idx) => {
    const num = stats[category].transformed + idx + 1;

    // Validate required fields
    const issues = [];

    if (!property.property_category) issues.push('Missing property_category');
    if (!property.title) issues.push('Missing title');
    if (!property.price || property.price === 0) issues.push('Price is 0');
    if (!property.currency) issues.push('Missing currency');
    if (!property.location?.city) issues.push('Missing city');
    if (!property.source_url) issues.push('Missing source_url');
    if (!property.source_platform) issues.push('Missing source_platform');
    if (!property.status) issues.push('Missing status');

    // Category-specific validation
    if (category === 'apartment') {
      if (typeof property.bedrooms !== 'number') issues.push('Missing bedrooms');
      if (!property.sqm || property.sqm === 0) issues.push('Missing sqm');
      if (typeof property.has_elevator !== 'boolean') issues.push('Missing has_elevator');
      if (typeof property.has_balcony !== 'boolean') issues.push('Missing has_balcony');
      if (typeof property.has_parking !== 'boolean') issues.push('Missing has_parking');
      if (typeof property.has_basement !== 'boolean') issues.push('Missing has_basement');
    } else if (category === 'house') {
      if (typeof property.bedrooms !== 'number') issues.push('Missing bedrooms');
      if (!property.sqm_living || property.sqm_living === 0) issues.push('Missing sqm_living');
      if (typeof property.sqm_plot !== 'number') issues.push('Missing sqm_plot');
      if (typeof property.has_garden !== 'boolean') issues.push('Missing has_garden');
      if (typeof property.has_garage !== 'boolean') issues.push('Missing has_garage');
      if (typeof property.has_parking !== 'boolean') issues.push('Missing has_parking');
      if (typeof property.has_basement !== 'boolean') issues.push('Missing has_basement');
    } else if (category === 'land') {
      if (!property.area_plot_sqm || property.area_plot_sqm === 0) issues.push('Missing area_plot_sqm');
    } else if (category === 'commercial') {
      if (!property.sqm_total || property.sqm_total === 0) issues.push('Missing sqm_total');
      if (typeof property.has_elevator !== 'boolean') issues.push('Missing has_elevator');
      if (typeof property.has_parking !== 'boolean') issues.push('Missing has_parking');
      if (typeof property.has_bathrooms !== 'boolean') issues.push('Missing has_bathrooms');
    }

    if (issues.length > 0) {
      stats[category].failed++;
      stats[category].issues.push({ url: property.source_url, issues });
      console.log(`  ❌ [${num}] ${property.title?.substring(0, 40) || 'NO TITLE'}`);
      issues.forEach(issue => console.log(`       - ${issue}`));
    } else {
      stats[category].transformed++;
      console.log(`  ✅ [${num}] ${property.title.substring(0, 50)}`);
      console.log(`       Price: ${property.price} ${property.currency}, City: ${property.location.city}`);

      // Show key metrics
      if (category === 'apartment') {
        console.log(`       Bedrooms: ${property.bedrooms}, Sqm: ${property.sqm}, Floor: ${property.floor || 'N/A'}, Energy: ${property.energy_class || 'N/A'}`);
      } else if (category === 'house') {
        console.log(`       Bedrooms: ${property.bedrooms}, Living: ${property.sqm_living}m², Plot: ${property.sqm_plot}m², Energy: ${property.energy_class || 'N/A'}`);
      } else if (category === 'land') {
        console.log(`       Area: ${property.area_plot_sqm}m²`);
      } else if (category === 'commercial') {
        console.log(`       Area: ${property.sqm_total}m²`);
      }
    }
  });

  return Promise.resolve();
};

// Run the scraper
console.log('Starting scraper...\n');

scrapeListings()
  .then(() => {
    console.log('\n\n' + '═'.repeat(70));
    console.log('  FINAL RESULTS');
    console.log('═'.repeat(70));

    let totalScraped = 0;
    let totalTransformed = 0;
    let totalFailed = 0;

    Object.entries(stats).forEach(([category, data]) => {
      totalScraped += data.scraped;
      totalTransformed += data.transformed;
      totalFailed += data.failed;

      const status = data.failed === 0 ? '✅' : '⚠️';
      console.log(`\n${status} ${category.toUpperCase()}:`);
      console.log(`   Scraped: ${data.scraped}`);
      console.log(`   Valid: ${data.transformed}`);
      console.log(`   Failed: ${data.failed}`);

      if (data.issues.length > 0) {
        console.log(`   Issues:`);
        data.issues.slice(0, 3).forEach((issue, idx) => {
          console.log(`     ${idx + 1}. ${issue.issues.join(', ')}`);
        });
        if (data.issues.length > 3) {
          console.log(`     ... and ${data.issues.length - 3} more`);
        }
      }
    });

    console.log('\n' + '─'.repeat(70));
    console.log(`TOTAL: ${totalScraped} scraped, ${totalTransformed} valid, ${totalFailed} failed`);
    const successRate = totalScraped > 0 ? ((totalTransformed / totalScraped) * 100).toFixed(1) : 0;
    console.log(`Success Rate: ${successRate}%`);

    if (totalFailed === 0) {
      console.log('\n🎉 PERFECT! All listings validated successfully!');
    } else if (successRate >= 95) {
      console.log('\n✅ EXCELLENT! >95% success rate');
    } else if (successRate >= 90) {
      console.log('\n👍 GOOD! >90% success rate');
    } else {
      console.log('\n⚠️  Needs attention - success rate below 90%');
    }

    console.log('\n' + '═'.repeat(70));
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ SCRAPER FAILED:', error.message);
    console.error(error.stack);
    process.exit(1);
  });
