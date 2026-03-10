/**
 * Incrementally discover Realingo GraphQL fields
 * Add one field at a time to see which ones work
 */

import axios from 'axios';

const GRAPHQL_URL = 'https://www.realingo.cz/graphql';

const baseFields = ['id', 'category', 'url', 'property'];

const fieldsToTest = [
  // Location variations
  'location', 'address', 'city', 'district', 'region', 'gps', 'coordinates',
  // Price variations
  'price', 'priceTotal', 'cost', 'currency',
  // Area variations
  'area', 'surface', 'sqm', 'areaFloor', 'areaPlot',
  // Czech-specific
  'disposition', 'ownership', 'condition', 'heatingType', 'constructionType',
  'energyRating', 'penb', 'furnished', 'equipped',
  // Rooms
  'bedrooms', 'bathrooms', 'rooms', 'floor', 'totalFloors',
  // Amenities
  'features', 'parking', 'garage', 'lift', 'balcony', 'terrace', 'cellar',
  // Media
  'photos', 'images', 'videos', 'virtualTour',
  // Meta
  'title', 'description', 'publishedAt', 'updatedAt', 'daysActive',
  // Agent
  'agent', 'advertiser', 'contact'
];

async function testField(field: string): Promise<{ field: string; works: boolean; error?: string }> {
  const query = `
    query TestField {
      searchOffer(filter: { purpose: SELL, property: FLAT }, first: 1) {
        items {
          ${field}
        }
      }
    }
  `;

  try {
    const response = await axios.post(
      GRAPHQL_URL,
      { query },
      {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0'
        },
        timeout: 5000
      }
    );

    if (response.data.errors) {
      return { field, works: false, error: response.data.errors[0].message };
    }

    return { field, works: true };
  } catch (error: any) {
    return { field, works: false, error: error.message };
  }
}

async function discoverFields() {
  console.log('🔍 Discovering Realingo GraphQL Fields...\n');
  console.log(`Base fields (known to work): ${baseFields.join(', ')}\n`);
  console.log(`Testing ${fieldsToTest.length} additional fields...\n`);

  const workingFields: string[] = [...baseFields];
  const failedFields: { field: string; error: string }[] = [];

  for (let i = 0; i < fieldsToTest.length; i++) {
    const field = fieldsToTest[i];
    process.stdout.write(`[${i + 1}/${fieldsToTest.length}] Testing "${field}"... `);

    const result = await testField(field);

    if (result.works) {
      console.log('✅ WORKS');
      workingFields.push(field);
    } else {
      console.log(`❌ FAILED: ${result.error}`);
      failedFields.push({ field, error: result.error || 'Unknown error' });
    }

    // Small delay
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  console.log('\n' + '='.repeat(80));
  console.log('RESULTS');
  console.log('='.repeat(80));

  console.log(`\n✅ Working Fields (${workingFields.length}):`);
  workingFields.forEach(f => console.log(`   - ${f}`));

  console.log(`\n❌ Failed Fields (${failedFields.length}):`);
  failedFields.forEach(({ field, error }) => {
    console.log(`   - ${field}: ${error.substring(0, 60)}...`);
  });

  console.log('\n' + '='.repeat(80));
  console.log('RECOMMENDED QUERY');
  console.log('='.repeat(80) + '\n');

  const query = `query SearchOffer(
  $purpose: OfferPurpose,
  $property: PropertyType,
  $first: Int,
  $after: String
) {
  searchOffer(
    filter: { purpose: $purpose, property: $property }
    first: $first
    after: $after
  ) {
    total
    items {
${workingFields.map(f => `      ${f}`).join('\n')}
    }
  }
}`;

  console.log(query);

  console.log('\n📄 Next Steps:');
  console.log('1. Update src/scrapers/listingsScraper.ts with working fields');
  console.log('2. Update src/types/realingoTypes.ts interface');
  console.log('3. Update transformers to map new fields');
}

discoverFields().catch(console.error);
