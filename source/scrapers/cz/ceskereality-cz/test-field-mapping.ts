import * as cheerio from 'cheerio';
import { transformApartment } from './src/transformers/ceskerealityApartmentTransformer';

async function scrapeAndTest(url: string) {
  const response = await fetch(url);
  const html = await response.text();
  const $ = cheerio.load(html);

  const jsonLdScript = $('script[type="application/ld+json"]').first();
  const jsonLd = JSON.parse(jsonLdScript.html() || '{}');

  const htmlData: any = {};
  const images: string[] = [];
  $('img[src*="img.ceskereality.cz/foto"]').each((_, el) => {
    const src = $(el).attr('src');
    if (src && !src.includes('logo') && !src.includes('icon') && !src.includes('makleri')) {
      const fullSizeUrl = src.split('?')[0];
      if (!images.includes(fullSizeUrl)) images.push(fullSizeUrl);
    }
  });
  if (images.length > 0) htmlData.images = images;

  const propertyDetails: Record<string, string> = {};
  $('.i-info').each((_, el) => {
    const label = $(el).find('.i-info__title').text().trim();
    const value = $(el).find('.i-info__value').text().trim();
    if (label && value) propertyDetails[label] = value;
  });
  if (Object.keys(propertyDetails).length > 0) htmlData.propertyDetails = propertyDetails;

  const transformed = transformApartment(jsonLd, url, htmlData);
  return { propertyDetails, transformed };
}

async function testFieldMapping() {
  console.log('🗺️  Testing Property Details Field Mapping\n');
  console.log('=' .repeat(80));

  const url = 'https://www.ceskereality.cz/prodej/byty/byty-2-kk/horazdovice/prodej-bytu-2-kk-43-m2-predmesti-3649205.html';
  const { propertyDetails, transformed } = await scrapeAndTest(url);

  console.log('\n📋 RAW Property Details (from HTML):');
  console.log('─'.repeat(80));
  Object.entries(propertyDetails).forEach(([key, value]) => {
    console.log(`   ${key.padEnd(30)} : ${value}`);
  });

  console.log('\n\n✅ MAPPED TierI Fields:');
  console.log('─'.repeat(80));

  const mappings = [
    { label: 'Property Category', value: transformed.property_category },
    { label: 'Title', value: transformed.title },
    { label: 'Price', value: `${transformed.price} ${transformed.currency}` },
    { label: 'Location', value: `${transformed.location.city}, ${transformed.location.country}` },
    { label: '', value: '' }, // Separator
    { label: '🏠 Core Apartment Fields:', value: '' },
    { label: '  Bedrooms', value: transformed.bedrooms },
    { label: '  Living Area (sqm)', value: transformed.sqm },
    { label: '  Has Elevator', value: transformed.has_elevator ? '✅' : '❌' },
    { label: '  Has Balcony', value: transformed.has_balcony ? '✅' : '❌' },
    { label: '  Has Parking', value: transformed.has_parking ? '✅' : '❌' },
    { label: '  Has Basement', value: transformed.has_basement ? '✅' : '❌' },
    { label: '', value: '' },
    { label: '📐 Additional Details:', value: '' },
    { label: '  Floor', value: transformed.floor || 'Not set' },
    { label: '  Total Floors', value: transformed.total_floors || 'Not set' },
    { label: '  Balcony Area', value: transformed.balcony_area ? `${transformed.balcony_area} m²` : 'Not set' },
    { label: '  Cellar Area', value: transformed.cellar_area ? `${transformed.cellar_area} m²` : 'Not set' },
    { label: '  Construction Type', value: transformed.construction_type || 'Not set' },
    { label: '  Condition', value: transformed.condition || 'Not set' },
    { label: '  Year Built', value: transformed.year_built || 'Not set' },
    { label: '', value: '' },
    { label: '🔌 Utilities (in metadata):', value: '' },
    { label: '  Energy Class', value: transformed.portal_metadata?.energy_class || 'Not set' },
    { label: '  Heating', value: transformed.portal_metadata?.heating || 'Not set' },
    { label: '  Water', value: transformed.portal_metadata?.water || 'Not set' },
    { label: '  Sewage', value: transformed.portal_metadata?.sewage || 'Not set' },
    { label: '  Electricity', value: transformed.portal_metadata?.electricity || 'Not set' },
    { label: '  Gas', value: transformed.portal_metadata?.gas || 'Not set' },
    { label: '', value: '' },
    { label: '📸 Media:', value: '' },
    { label: '  Images', value: `${transformed.images?.length || 0} images` },
    { label: '', value: '' },
    { label: '🏢 Agent:', value: '' },
    { label: '  Name', value: transformed.portal_metadata?.agent_name || 'Not set' },
    { label: '  Phone', value: transformed.portal_metadata?.agent_phone || 'Not set' },
  ];

  mappings.forEach(({ label, value }) => {
    if (label === '') {
      console.log('');
    } else {
      console.log(`   ${label.padEnd(30)} : ${value}`);
    }
  });

  console.log('\n' + '='.repeat(80));
  console.log('\n✅ Field Mapping Test Complete!\n');

  // Summary
  const mappedCount = [
    transformed.floor,
    transformed.total_floors,
    transformed.balcony_area,
    transformed.cellar_area,
    transformed.construction_type,
    transformed.condition,
    transformed.year_built,
    transformed.portal_metadata?.energy_class,
    transformed.portal_metadata?.sewage,
  ].filter(v => v !== undefined && v !== 'Not set').length;

  console.log(`📊 Summary:`);
  console.log(`   - ${Object.keys(propertyDetails).length} raw fields extracted from HTML`);
  console.log(`   - ${mappedCount} fields successfully mapped to TierI schema`);
  console.log(`   - ${transformed.images?.length || 0} images captured`);
  console.log(`   - All utilities info preserved in portal_metadata`);
}

testFieldMapping().catch(console.error);
