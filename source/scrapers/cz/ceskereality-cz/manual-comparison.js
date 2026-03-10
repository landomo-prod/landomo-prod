const cheerio = require('cheerio');
const { transformApartment } = require('./dist/transformers/ceskerealityApartmentTransformer');
const { transformHouse } = require('./dist/transformers/ceskerealityHouseTransformer');

async function manualComparison() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  MANUAL DATA COMPARISON: Raw vs Transformed');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // Test apartment with known data
  const aptUrl = 'https://www.ceskereality.cz/prodej/byty/byty-3-kk/praha/prodej-bytu-3-kk-100-m2-na-vysocanskych-vinicich-3084877.html';

  console.log('TEST 1: APARTMENT');
  console.log('URL:', aptUrl);
  console.log('\n1. Fetching raw HTML...\n');

  const response = await fetch(aptUrl);
  const html = await response.text();
  const $ = cheerio.load(html);

  // Extract JSON-LD
  const jsonLdScript = $('script[type="application/ld+json"]').first();
  const jsonLd = JSON.parse(jsonLdScript.html());

  console.log('2. RAW JSON-LD DATA:');
  console.log(JSON.stringify(jsonLd, null, 2));

  // Extract property details
  const propertyDetails = {};
  $('.i-info').each((_, el) => {
    const label = $(el).find('.i-info__title').text().trim();
    const value = $(el).find('.i-info__value').text().trim();
    if (label && value) {
      propertyDetails[label] = value;
    }
  });

  console.log('\n3. RAW PROPERTY DETAILS (HTML):');
  Object.entries(propertyDetails).forEach(([k, v]) => {
    console.log(`   ${k}: ${v}`);
  });

  // Extract images
  const images = [];
  $('img[src*="img.ceskereality.cz/foto"]').each((_, el) => {
    const src = $(el).attr('src');
    if (src && !src.includes('logo') && !src.includes('icon') && !src.includes('makleri')) {
      const fullSizeUrl = src.split('?')[0];
      if (!images.includes(fullSizeUrl)) {
        images.push(fullSizeUrl);
      }
    }
  });

  console.log(`\n4. RAW IMAGES: ${images.length} images found`);
  console.log('   First image:', images[0]);

  // Transform
  const transformed = transformApartment(jsonLd, aptUrl, { images, propertyDetails });

  console.log('\n5. TRANSFORMED OUTPUT:');
  console.log('   property_category:', transformed.property_category);
  console.log('   title:', transformed.title);
  console.log('   price:', transformed.price, transformed.currency);
  console.log('   city:', transformed.location.city);
  console.log('   address:', transformed.location.address);
  console.log('   bedrooms:', transformed.bedrooms);
  console.log('   sqm:', transformed.sqm);
  console.log('   floor:', transformed.floor);
  console.log('   total_floors:', transformed.total_floors);
  console.log('   has_elevator:', transformed.has_elevator);
  console.log('   has_balcony:', transformed.has_balcony);
  console.log('   has_parking:', transformed.has_parking);
  console.log('   has_basement:', transformed.has_basement);
  console.log('   construction_type:', transformed.construction_type);
  console.log('   condition:', transformed.condition);
  console.log('   energy_class:', transformed.energy_class);
  console.log('   images:', transformed.images?.length);
  console.log('   description length:', transformed.description?.length);

  console.log('\n6. FIELD-BY-FIELD VERIFICATION:');

  // Verify critical mappings
  const checks = [
    {
      field: 'Title',
      raw: jsonLd.name,
      transformed: transformed.title,
      match: jsonLd.name === transformed.title
    },
    {
      field: 'Price',
      raw: jsonLd.offers?.price,
      transformed: transformed.price,
      match: jsonLd.offers?.price === transformed.price
    },
    {
      field: 'Currency',
      raw: jsonLd.offers?.priceCurrency,
      transformed: transformed.currency,
      match: jsonLd.offers?.priceCurrency === transformed.currency
    },
    {
      field: 'City',
      raw: jsonLd.offers?.areaServed?.address?.addressLocality,
      transformed: transformed.location.city,
      match: jsonLd.offers?.areaServed?.address?.addressLocality === transformed.location.city
    },
    {
      field: 'Description',
      raw: jsonLd.description?.substring(0, 50),
      transformed: transformed.description?.substring(0, 50),
      match: jsonLd.description === transformed.description
    },
    {
      field: 'Image count',
      raw: images.length,
      transformed: transformed.images?.length,
      match: images.length === transformed.images?.length
    },
    {
      field: 'Source URL',
      raw: aptUrl,
      transformed: transformed.source_url,
      match: aptUrl === transformed.source_url
    }
  ];

  checks.forEach(check => {
    const status = check.match ? '✅' : '❌';
    console.log(`   ${status} ${check.field}`);
    if (!check.match) {
      console.log(`      Raw: ${check.raw}`);
      console.log(`      Transformed: ${check.transformed}`);
    }
  });

  // Now test a house
  console.log('\n\n═══════════════════════════════════════════════════════════════');
  console.log('TEST 2: HOUSE WITH ENHANCED EXTRACTION');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const houseUrl = 'https://www.ceskereality.cz/prodej/rodinne-domy/rodinne-domy/strunkovice-nad-volynou/prodej-rodinneho-domu-183-m2-3620824.html';

  console.log('URL:', houseUrl);
  console.log('\n1. Fetching raw HTML...\n');

  const houseResponse = await fetch(houseUrl);
  const houseHtml = await houseResponse.text();
  const $house = cheerio.load(houseHtml);

  const houseJsonLdScript = $house('script[type="application/ld+json"]').first();
  const houseJsonLd = JSON.parse(houseJsonLdScript.html());

  console.log('2. RAW DATA:');
  console.log('   Title:', houseJsonLd.name);
  console.log('   Description (first 200 chars):', houseJsonLd.description?.substring(0, 200));

  // Extract property details
  const houseDetails = {};
  $house('.i-info').each((_, el) => {
    const label = $house(el).find('.i-info__title').text().trim();
    const value = $house(el).find('.i-info__value').text().trim();
    if (label && value) {
      houseDetails[label] = value;
    }
  });

  console.log('\n3. RAW PROPERTY DETAILS:');
  Object.entries(houseDetails).forEach(([k, v]) => {
    console.log(`   ${k}: ${v}`);
  });

  // Transform
  const houseTransformed = transformHouse(houseJsonLd, houseUrl, { propertyDetails: houseDetails });

  console.log('\n4. TRANSFORMED OUTPUT:');
  console.log('   bedrooms:', houseTransformed.bedrooms, '(extracted from description)');
  console.log('   sqm_living:', houseTransformed.sqm_living);
  console.log('   sqm_plot:', houseTransformed.sqm_plot, '(extracted from description/details)');
  console.log('   construction_type:', houseTransformed.construction_type);
  console.log('   has_garden:', houseTransformed.has_garden);
  console.log('   has_garage:', houseTransformed.has_garage);

  console.log('\n5. ENHANCED EXTRACTION VERIFICATION:');

  // Check if bedrooms were extracted from description
  const bedroomInDesc = houseJsonLd.description?.match(/(\d+)\s*(?:ložnic|pokojů|pokoj)/i);
  console.log('   Bedroom pattern in description:', bedroomInDesc ? bedroomInDesc[0] : 'Not found');
  console.log('   Extracted bedrooms:', houseTransformed.bedrooms);

  // Check if plot size was extracted
  const plotInDesc = houseJsonLd.description?.match(/pozemek[^\d]*([\d\s]+)\s*m[²2]/i);
  const plotInDetails = houseDetails['Plocha pozemku'];
  console.log('   Plot in description:', plotInDesc ? plotInDesc[0] : 'Not found');
  console.log('   Plot in details:', plotInDetails || 'Not found');
  console.log('   Extracted sqm_plot:', houseTransformed.sqm_plot);

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  COMPARISON COMPLETE');
  console.log('═══════════════════════════════════════════════════════════════');
}

manualComparison().catch(console.error);
