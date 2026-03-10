import * as cheerio from 'cheerio';
import { transformApartment } from './src/transformers/ceskerealityApartmentTransformer';

async function scrapeDetailPage(url: string) {
  const response = await fetch(url);
  const html = await response.text();
  const $ = cheerio.load(html);

  // Extract JSON-LD
  const jsonLdScript = $('script[type="application/ld+json"]').first();
  const jsonLd = JSON.parse(jsonLdScript.html() || '{}');

  // Extract additional HTML data
  const htmlData: any = {};

  // Get all images
  const images: string[] = [];
  $('img[src*="img.ceskereality.cz/foto"]').each((_, el) => {
    const src = $(el).attr('src');
    if (src && !src.includes('logo') && !src.includes('icon') && !src.includes('makleri')) {
      const fullSizeUrl = src.split('?')[0];
      if (!images.includes(fullSizeUrl)) {
        images.push(fullSizeUrl);
      }
    }
  });
  if (images.length > 0) {
    htmlData.images = images;
  }

  // Extract property details
  const propertyDetails: Record<string, string> = {};
  $('.i-info').each((_, el) => {
    const label = $(el).find('.i-info__title').text().trim();
    const value = $(el).find('.i-info__value').text().trim();
    if (label && value) {
      propertyDetails[label] = value;
    }
  });
  if (Object.keys(propertyDetails).length > 0) {
    htmlData.propertyDetails = propertyDetails;
  }

  // Extract energy rating
  const energyRating = $('.s-estate-detail-intro__energy').text().trim();
  if (energyRating) {
    htmlData.energyRating = energyRating;
  }

  return { jsonLd, htmlData };
}

async function testEnhancedScraping() {
  console.log('🧪 Testing enhanced scraping...\n');

  const url = 'https://www.ceskereality.cz/prodej/byty/byty-2-kk/horazdovice/prodej-bytu-2-kk-43-m2-predmesti-3649205.html';

  const { jsonLd, htmlData } = await scrapeDetailPage(url);

  console.log('1️⃣ HTML Data Extracted:');
  console.log(`   Images: ${htmlData.images?.length || 0}`);
  console.log(`   Property Details: ${Object.keys(htmlData.propertyDetails || {}).length} fields`);
  console.log(`   Energy Rating: ${htmlData.energyRating || htmlData.propertyDetails?.['Energetická náročnost'] || 'Not found'}`);

  console.log('\n2️⃣ Transformed Property:');
  const transformed = transformApartment(jsonLd, url, htmlData);

  console.log(`   Images: ${transformed.images?.length || 0}`);
  console.log(`   Floor: ${transformed.floor || 'Not set'}`);
  console.log(`   Condition: ${transformed.condition || 'Not set'}`);
  console.log(`   Energy Rating: ${transformed.portal_metadata?.energy_rating || 'Not set'}`);
  console.log(`   Property ID: ${transformed.portal_metadata?.property_id || 'Not set'}`);

  console.log('\n3️⃣ Sample Images:');
  transformed.images?.slice(0, 3).forEach((img, i) => {
    console.log(`   ${i + 1}. ${img}`);
  });

  console.log('\n4️⃣ Portal Metadata:');
  console.log(JSON.stringify(transformed.portal_metadata, null, 2));

  console.log('\n✅ Enhanced scraping test complete!');
  console.log(`\n📊 Summary:`);
  console.log(`   - Captured ${transformed.images?.length || 0} images (was 1)`);
  console.log(`   - Extracted ${Object.keys(htmlData.propertyDetails || {}).length} property details`);
  console.log(`   - Floor: ${transformed.floor ? 'Yes ✅' : 'No ❌'}`);
  console.log(`   - Condition: ${transformed.condition ? 'Yes ✅' : 'No ❌'}`);
  console.log(`   - Energy rating: ${transformed.portal_metadata?.energy_rating ? 'Yes ✅' : 'No ❌'}`);
}

testEnhancedScraping().catch(console.error);
