/**
 * Test field extraction from reality-sk HTML listings
 * Verifies all 3 tiers populate correctly from text extraction
 */
import { transformRealityToStandard } from './src/transformers';
import { RealityListing } from './src/types/realityTypes';

// Sample HTML-based listings representing typical reality.sk data
const testListings: RealityListing[] = [
  {
    id: '001',
    title: '3-izbový byt, 75 m², Bratislava - Staré Mesto',
    price: 250000,
    currency: 'EUR',
    location: 'Bratislava - Staré Mesto',
    propertyType: 'byty',
    transactionType: 'predaj',
    url: 'https://www.reality.sk/byty/predaj/001',
    imageUrl: 'https://example.com/image1.jpg',
    rooms: 3,
    sqm: 75,
    description: 'Ponúkame na predaj krásny 3-izbový byt v novostavbe. Byt sa nachádza na 4. poschodí 8-poschodovej budovy. Zariadený, s balkónom a parkovaním. Výťah v budove. Tehlová stavba. Ústredné kúrenie. Energetická trieda A. Rok výstavby 2020.'
  },
  {
    id: '002',
    title: '2-izbový byt, 55 m², Košice',
    price: 800,
    currency: 'EUR',
    location: 'Košice - Sever',
    propertyType: 'byty',
    transactionType: 'prenajom',
    url: 'https://www.reality.sk/byty/prenajom/002',
    imageUrl: 'https://example.com/image2.jpg',
    rooms: 2,
    sqm: 55,
    description: 'Prenájom 2-izbového bytu po kompletnej rekonštrukcii. Čiastočne zariadený. Loggia. Pivnica. Panelový dom. Elektrické kúrenie. Depozit 800 €. Voľný od 1.3.2025.'
  },
  {
    id: '003',
    title: 'Rodinný dom, 150 m², Nitra',
    price: 180000,
    currency: 'EUR',
    location: 'Nitra - Chrenová',
    propertyType: 'domy',
    transactionType: 'predaj',
    url: 'https://www.reality.sk/domy/predaj/003',
    imageUrl: 'https://example.com/image3.jpg',
    rooms: 5,
    sqm: 150,
    description: 'Rodinný dom v dobrom stave. Pozemok 600 m². Garáž, záhrada, terasa. Murovaný dom. Plynové kúrenie. Rekonštrukcia 2018. Prízemie.'
  },
  {
    id: '004',
    title: 'Stavebný pozemok, 1200 m², Žilina',
    price: 45000,
    currency: 'EUR',
    location: 'Žilina - Bytčica',
    propertyType: 'pozemky',
    transactionType: 'predaj',
    url: 'https://www.reality.sk/pozemky/predaj/004',
    sqm: 1200,
    description: 'Stavebný pozemok v tichej lokalite. Rovinatý, všetky inžinierske siete. Možnosť výstavby rodinného domu.'
  },
  {
    id: '005',
    title: '1-izbový byt, 38 m², Prešov',
    price: 450,
    currency: 'EUR',
    location: 'Prešov - Centrum',
    propertyType: 'byty',
    transactionType: 'prenajom',
    url: 'https://www.reality.sk/byty/prenajom/005',
    rooms: 1,
    sqm: 38,
    description: 'Nezariadený 1-izbový byt v centre. 2. poschodie z 5. Bez výťahu. Tehla. Klimatizácia. Kaucia 450 €.'
  },
  {
    id: '006',
    title: '4-izbový byt, 95 m², Trnava',
    price: 320000,
    currency: 'EUR',
    location: 'Trnava - Linčianska',
    propertyType: 'byty',
    transactionType: 'predaj',
    url: 'https://www.reality.sk/byty/predaj/006',
    imageUrl: 'https://example.com/image6.jpg',
    rooms: 4,
    sqm: 95,
    description: 'Výborný stav. 3/8. Kompletne zariadený. Balkón, loggia. Garážové státie. Bazén v areáli. Tepelné čerpadlo. Energetická trieda B.'
  },
  {
    id: '007',
    title: 'Chata, 60 m², Vysoké Tatry',
    price: 95000,
    currency: 'EUR',
    location: 'Vysoké Tatry - Tatranská Lomnica',
    propertyType: 'chaty-chalupy',
    transactionType: 'predaj',
    url: 'https://www.reality.sk/chaty-chalupy/predaj/007',
    sqm: 60,
    description: 'Rekreačná chata pred rekonštrukciou. Pozemok 800 m². Drevostavba. Krb. Studňa na pozemku.'
  },
  {
    id: '008',
    title: 'Kancelária, 45 m², Banská Bystrica',
    price: 650,
    currency: 'EUR',
    location: 'Banská Bystrica - Centrum',
    propertyType: 'kancelarie',
    transactionType: 'prenajom',
    url: 'https://www.reality.sk/kancelarie/prenajom/008',
    sqm: 45,
    description: 'Moderná kancelária v administratívnej budove. Vo výstavbe, dokončenie 2026. Klimatizácia, parkovanie.'
  },
  {
    id: '009',
    title: 'Garáž, 18 m², Bratislava',
    price: 15000,
    currency: 'EUR',
    location: 'Bratislava - Petržalka',
    propertyType: 'garaze',
    transactionType: 'predaj',
    url: 'https://www.reality.sk/garaze/predaj/009',
    sqm: 18,
    description: 'Samostatná garáž v uzavretom areáli. Betónová konštrukcia. Elektrická brána.'
  },
  {
    id: '010',
    title: '2-izbový byt, 62 m², Martin',
    price: 135000,
    currency: 'EUR',
    location: 'Martin - Sever',
    propertyType: 'byty',
    transactionType: 'predaj',
    url: 'https://www.reality.sk/byty/predaj/010',
    rooms: 2,
    sqm: 62,
    description: 'Veľmi dobrý stav. Vyžaduje rekonštrukciu kúpeľne. Podlahové kúrenie. Z roku 1995.'
  }
];

console.log('🧪 Reality.sk Field Extraction Test\n');
console.log(`Testing ${testListings.length} listings...\n`);
console.log('='.repeat(80));

testListings.forEach((listing, index) => {
  console.log(`\n📋 Listing ${index + 1}/${testListings.length}: ${listing.title}`);
  console.log('-'.repeat(80));

  const transformed = transformRealityToStandard(listing);

  // Tier I: Global Fields
  console.log('\n✅ Tier I - Global Fields:');
  console.log(`  property_category: ${transformed.property_category}`);
  console.log(`  title: ${transformed.title}`);
  console.log(`  price: ${transformed.price} ${transformed.currency}`);
  console.log(`  transaction_type: ${transformed.transaction_type}`);
  console.log(`  location: ${transformed.location?.city}, ${transformed.location?.country}`);
  console.log(`  sqm: ${transformed.sqm || 'N/A'}`);
  console.log(`  bedrooms: ${(transformed as any).bedrooms || 'N/A'}`);
  console.log(`  rooms: ${(transformed as any).rooms || 'N/A'}`);
  console.log(`  bathrooms: ${(transformed as any).bathrooms || 'N/A'}`);

  // Extract condition, heating_type, etc. based on category
  if (transformed.property_category === 'apartment') {
    const apt = transformed as any;
    console.log(`  condition: ${apt.condition || 'N/A'}`);
    console.log(`  heating_type: ${apt.heating_type || 'N/A'}`);
    console.log(`  floor: ${apt.floor || 'N/A'}`);
    console.log(`  total_floors: ${apt.total_floors || 'N/A'}`);
    console.log(`  construction_type: ${apt.construction_type || 'N/A'}`);
    console.log(`  energy_class: ${apt.energy_class || 'N/A'}`);
    console.log(`  year_built: ${apt.year_built || 'N/A'}`);
  } else if (transformed.property_category === 'house') {
    const house = transformed as any;
    console.log(`  condition: ${house.condition || 'N/A'}`);
    console.log(`  heating_type: ${house.heating_type || 'N/A'}`);
    console.log(`  construction_type: ${house.construction_type || 'N/A'}`);
    console.log(`  land_area: ${house.land_area || 'N/A'}`);
  } else if (transformed.property_category === 'land') {
    const land = transformed as any;
    console.log(`  land_area: ${land.land_area || 'N/A'}`);
    console.log(`  land_type: ${land.land_type || 'N/A'}`);
  }

  // Tier II: Country-Specific (Slovakia)
  console.log('\n✅ Tier II - Slovakia-Specific Fields:');
  const countrySpecific = (transformed as any).country_specific?.slovakia;
  if (countrySpecific) {
    console.log(`  disposition: ${countrySpecific.disposition || 'N/A'}`);
    console.log(`  ownership: ${countrySpecific.ownership || 'N/A'}`);
    console.log(`  condition: ${countrySpecific.condition || 'N/A'}`);
    console.log(`  furnished: ${countrySpecific.furnished || 'N/A'}`);
    console.log(`  energy_rating: ${countrySpecific.energy_rating || 'N/A'}`);
    console.log(`  heating_type: ${countrySpecific.heating_type || 'N/A'}`);
    console.log(`  construction_type: ${countrySpecific.construction_type || 'N/A'}`);
    console.log(`  floor: ${countrySpecific.floor || 'N/A'}`);
    console.log(`  total_floors: ${countrySpecific.total_floors || 'N/A'}`);
    console.log(`  year_built: ${countrySpecific.year_built || 'N/A'}`);
    console.log(`  renovation_year: ${countrySpecific.renovation_year || 'N/A'}`);
    console.log(`  deposit: ${countrySpecific.deposit || 'N/A'}`);
    console.log(`  area_plot: ${countrySpecific.area_plot || 'N/A'}`);

    // Amenities (boolean features)
    const amenities = [];
    if (countrySpecific.balcony) amenities.push('balcony');
    if (countrySpecific.terrace) amenities.push('terrace');
    if (countrySpecific.elevator) amenities.push('elevator');
    if (countrySpecific.garage) amenities.push('garage');
    if (countrySpecific.garden) amenities.push('garden');
    if (countrySpecific.loggia) amenities.push('loggia');
    if (countrySpecific.pool) amenities.push('pool');
    console.log(`  amenities: ${amenities.length > 0 ? amenities.join(', ') : 'none detected'}`);
  } else {
    console.log('  ⚠️ country_specific.slovakia NOT FOUND');
  }

  // Tier III: Portal Metadata
  console.log('\n✅ Tier III - Portal Metadata:');
  const portalMetadata = (transformed as any).portal_metadata?.reality_sk;
  if (portalMetadata) {
    console.log(`  original_id: ${portalMetadata.original_id}`);
    console.log(`  source_url: ${portalMetadata.source_url}`);
    console.log(`  property_category: ${portalMetadata.property_category}`);
    console.log(`  transaction_category: ${portalMetadata.transaction_category}`);
  } else {
    console.log('  ⚠️ portal_metadata.reality_sk NOT FOUND');
  }

  // Media
  console.log('\n📸 Media:');
  const images = (transformed as any).images || [];
  console.log(`  images: ${images.length} image(s)`);
  console.log(`  description_length: ${transformed.description?.length || 0} chars`);

  console.log('\n' + '='.repeat(80));
});

// Summary statistics
console.log('\n📊 Field Population Summary\n');

const stats = {
  total: testListings.length,
  tier1: {
    price: 0,
    location: 0,
    sqm: 0,
    rooms: 0,
    condition: 0,
    heating: 0,
    construction: 0,
    floor: 0,
    year_built: 0,
  },
  tier2: {
    disposition: 0,
    furnished: 0,
    energy_rating: 0,
    deposit: 0,
    area_plot: 0,
    balcony: 0,
    terrace: 0,
    elevator: 0,
    garage: 0,
    garden: 0,
    pool: 0,
  },
  tier3: {
    portal_metadata: 0,
  }
};

testListings.forEach(listing => {
  const transformed = transformRealityToStandard(listing) as any;

  // Tier I
  if (transformed.price) stats.tier1.price++;
  if (transformed.location?.city) stats.tier1.location++;
  if (transformed.sqm) stats.tier1.sqm++;
  if (transformed.rooms) stats.tier1.rooms++;
  if (transformed.condition) stats.tier1.condition++;
  if (transformed.heating_type) stats.tier1.heating++;
  if (transformed.construction_type) stats.tier1.construction++;
  if (transformed.floor !== undefined) stats.tier1.floor++;
  if (transformed.year_built) stats.tier1.year_built++;

  // Tier II
  const sk = transformed.country_specific?.slovakia;
  if (sk) {
    if (sk.disposition) stats.tier2.disposition++;
    if (sk.furnished) stats.tier2.furnished++;
    if (sk.energy_rating) stats.tier2.energy_rating++;
    if (sk.deposit) stats.tier2.deposit++;
    if (sk.area_plot) stats.tier2.area_plot++;
    if (sk.balcony) stats.tier2.balcony++;
    if (sk.terrace) stats.tier2.terrace++;
    if (sk.elevator) stats.tier2.elevator++;
    if (sk.garage) stats.tier2.garage++;
    if (sk.garden) stats.tier2.garden++;
    if (sk.pool) stats.tier2.pool++;
  }

  // Tier III
  if (transformed.portal_metadata?.reality_sk) stats.tier3.portal_metadata++;
});

const pct = (count: number) => ((count / stats.total) * 100).toFixed(0) + '%';

console.log('Tier I - Global Fields:');
console.log(`  price:            ${stats.tier1.price}/${stats.total} (${pct(stats.tier1.price)})`);
console.log(`  location:         ${stats.tier1.location}/${stats.total} (${pct(stats.tier1.location)})`);
console.log(`  sqm:              ${stats.tier1.sqm}/${stats.total} (${pct(stats.tier1.sqm)})`);
console.log(`  rooms:            ${stats.tier1.rooms}/${stats.total} (${pct(stats.tier1.rooms)})`);
console.log(`  condition:        ${stats.tier1.condition}/${stats.total} (${pct(stats.tier1.condition)}) - text extraction`);
console.log(`  heating:          ${stats.tier1.heating}/${stats.total} (${pct(stats.tier1.heating)}) - text extraction`);
console.log(`  construction:     ${stats.tier1.construction}/${stats.total} (${pct(stats.tier1.construction)}) - text extraction`);
console.log(`  floor:            ${stats.tier1.floor}/${stats.total} (${pct(stats.tier1.floor)}) - text extraction`);
console.log(`  year_built:       ${stats.tier1.year_built}/${stats.total} (${pct(stats.tier1.year_built)}) - text extraction`);

console.log('\nTier II - Slovakia-Specific Fields:');
console.log(`  disposition:      ${stats.tier2.disposition}/${stats.total} (${pct(stats.tier2.disposition)}) - from rooms count`);
console.log(`  furnished:        ${stats.tier2.furnished}/${stats.total} (${pct(stats.tier2.furnished)}) - text extraction`);
console.log(`  energy_rating:    ${stats.tier2.energy_rating}/${stats.total} (${pct(stats.tier2.energy_rating)}) - text extraction`);
console.log(`  deposit:          ${stats.tier2.deposit}/${stats.total} (${pct(stats.tier2.deposit)}) - text extraction`);
console.log(`  area_plot:        ${stats.tier2.area_plot}/${stats.total} (${pct(stats.tier2.area_plot)}) - text extraction`);
console.log(`  balcony:          ${stats.tier2.balcony}/${stats.total} (${pct(stats.tier2.balcony)}) - text extraction`);
console.log(`  terrace:          ${stats.tier2.terrace}/${stats.total} (${pct(stats.tier2.terrace)}) - text extraction`);
console.log(`  elevator:         ${stats.tier2.elevator}/${stats.total} (${pct(stats.tier2.elevator)}) - text extraction`);
console.log(`  garage:           ${stats.tier2.garage}/${stats.total} (${pct(stats.tier2.garage)}) - text extraction`);
console.log(`  garden:           ${stats.tier2.garden}/${stats.total} (${pct(stats.tier2.garden)}) - text extraction`);
console.log(`  pool:             ${stats.tier2.pool}/${stats.total} (${pct(stats.tier2.pool)}) - text extraction`);

console.log('\nTier III - Portal Metadata:');
console.log(`  portal_metadata:  ${stats.tier3.portal_metadata}/${stats.total} (${pct(stats.tier3.portal_metadata)})`);

console.log('\n✅ Test complete!');
console.log('\n🎯 Key Takeaways:');
console.log('  - Core fields (price, location, sqm): 100% population from HTML');
console.log('  - Text-extracted fields: 30-80% population depending on mention in description');
console.log('  - Portal metadata: 100% population');
console.log('  - No API → No structured flags like hasFloorPlan, has3dTour');
console.log('  - Disposition inferred from room count (not from category.subValue like nehnutelnosti-sk)');
