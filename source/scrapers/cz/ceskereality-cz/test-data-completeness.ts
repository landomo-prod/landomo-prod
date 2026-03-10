import * as cheerio from 'cheerio';
import { transformApartment } from './src/transformers/ceskerealityApartmentTransformer';

async function testDataCompleteness() {
  console.log('🔍 Testing data completeness...\n');

  // Fetch a real listing
  const url = 'https://www.ceskereality.cz/prodej/byty/byty-2-kk/horazdovice/prodej-bytu-2-kk-43-m2-predmesti-3649205.html';
  const response = await fetch(url);
  const html = await response.text();
  const $ = cheerio.load(html);

  // Extract JSON-LD
  const jsonLdScript = $('script[type="application/ld+json"]').first();
  const jsonLd = JSON.parse(jsonLdScript.html() || '{}');

  console.log('1️⃣ JSON-LD Data Available:');
  console.log(JSON.stringify(jsonLd, null, 2));

  console.log('\n2️⃣ Additional HTML Data:');

  // Check for additional data in HTML that might not be in JSON-LD
  const additionalData: any = {};

  // Price (if not in JSON-LD)
  const priceText = $('.s-estate-detail-intro__price').text().trim();
  additionalData.price_html = priceText;

  // Property details table
  const details: any = {};
  $('.i-info').each((_, el) => {
    const label = $(el).find('.i-info__title').text().trim();
    const value = $(el).find('.i-info__value').text().trim();
    if (label && value) {
      details[label] = value;
    }
  });
  additionalData.property_details = details;

  // Images (check if there are more images)
  const images: string[] = [];
  $('img[src*="img.ceskereality.cz"]').each((_, el) => {
    const src = $(el).attr('src');
    if (src && !src.includes('logo') && !src.includes('icon')) {
      images.push(src);
    }
  });
  additionalData.all_images = images.slice(0, 10); // First 10

  // Energy rating
  const energyRating = $('.s-estate-detail-intro__energy').text().trim();
  additionalData.energy_rating = energyRating;

  // Floor info
  const floorText = $('.i-info__value:contains("patro")').text();
  additionalData.floor_info = floorText;

  console.log(JSON.stringify(additionalData, null, 2));

  console.log('\n3️⃣ Transformed Property:');
  const transformed = transformApartment(jsonLd, url);
  console.log(JSON.stringify(transformed, null, 2));

  console.log('\n4️⃣ Data Comparison:');
  console.log('✅ From JSON-LD:');
  console.log(`   - Title: ${jsonLd.name}`);
  console.log(`   - Description: ${jsonLd.description?.substring(0, 100)}...`);
  console.log(`   - Price: ${jsonLd.offers?.price || 'null'}`);
  console.log(`   - Location: ${jsonLd.offers?.areaServed?.address?.addressLocality}`);
  console.log(`   - Agent: ${jsonLd.offers?.offeredby?.name}`);
  console.log(`   - Image: ${jsonLd.image ? 'Yes' : 'No'}`);

  console.log('\n🔍 From HTML (not in JSON-LD):');
  console.log(`   - Property details table: ${Object.keys(details).length} fields`);
  console.log(`   - Additional images: ${images.length} found`);
  console.log(`   - Energy rating: ${energyRating || 'Not found'}`);

  console.log('\n📊 Missing from Transformation:');
  const missing = [];
  if (!transformed.images || transformed.images.length < images.length) {
    missing.push(`Only ${transformed.images?.length || 0} images vs ${images.length} available`);
  }
  if (Object.keys(details).length > 0) {
    missing.push(`${Object.keys(details).length} property details not captured`);
  }
  if (energyRating) {
    missing.push('Energy rating not captured');
  }

  if (missing.length > 0) {
    console.log('   ⚠️  ' + missing.join('\n   ⚠️  '));
  } else {
    console.log('   ✅ All available data captured!');
  }

  console.log('\n✅ Data completeness test complete!');
}

testDataCompleteness().catch(console.error);
