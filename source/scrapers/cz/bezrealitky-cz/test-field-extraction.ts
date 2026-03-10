/**
 * Bezrealitky Field Extraction Analysis
 *
 * This script analyzes actual API data to verify field extraction coverage
 */

import axios from 'axios';

const LISTINGS_QUERY = `query ListAdverts($offerType: [OfferType], $estateType: [EstateType], $limit: Int, $locale: Locale!) {
  listAdverts(offerType: $offerType, estateType: $estateType, limit: $limit, locale: $locale) {
    totalCount
    list {
      id
      title
      price
      surface
      disposition
      condition
      ownership
      equipped
      construction
      heating
      penb
      estateType
      offerType
      floor
      totalFloors
      age
      reconstruction
      water
      sewage
      parking
      garage
      lift
      balcony
      terrace
      cellar
      loggia
      frontGarden
      newBuilding
      petFriendly
      barrierFree
      lowEnergy
      isPrague
      isBrno
      shortTerm
      minRentDays
      maxRentDays
      availableFrom
      deposit
      charges
      serviceCharges
      utilityCharges
      gps {
        lat
        lng
      }
      city
      region {
        name
      }
      publicImages {
        url
        order
        main
      }
      tour360
      daysActive
      visitCount
    }
  }
}`;

interface TestResult {
  field: string;
  tier: 'I' | 'II' | 'III';
  category: string;
  availability: number;
  sample_values: any[];
  czech_values?: string[];
  normalized_values?: string[];
}

async function analyzeFieldExtraction() {
  console.log('🔍 Analyzing Bezrealitky Field Extraction...\n');

  try {
    // Fetch sample data
    const response = await axios.post('https://api.bezrealitky.cz/graphql/', {
      query: LISTINGS_QUERY,
      variables: {
        offerType: ['PRODEJ', 'PRONAJEM'],
        estateType: ['BYT'],
        limit: 20,
        locale: 'cs'
      }
    }, {
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      }
    });

    const listings = response.data?.data?.listAdverts?.list || [];

    if (listings.length === 0) {
      console.error('❌ No listings fetched');
      return;
    }

    console.log(`✅ Fetched ${listings.length} sample listings\n`);

    // Analyze field availability
    const results: TestResult[] = [];

    // Tier I - Global Fields
    const tier1Fields = [
      { field: 'price', category: 'Financial' },
      { field: 'surface', category: 'Dimensions' },
      { field: 'floor', category: 'Location' },
      { field: 'totalFloors', category: 'Building' },
      { field: 'age', category: 'Building' },
      { field: 'gps', category: 'Location' },
      { field: 'city', category: 'Location' },
      { field: 'publicImages', category: 'Media' },
      { field: 'tour360', category: 'Media' }
    ];

    // Tier II - Czech Specific Fields
    const tier2Fields = [
      { field: 'disposition', category: 'Classification', czech: true },
      { field: 'ownership', category: 'Legal', czech: true },
      { field: 'condition', category: 'State', czech: true },
      { field: 'equipped', category: 'Furnishing', czech: true },
      { field: 'construction', category: 'Building Type', czech: true },
      { field: 'heating', category: 'Utilities', czech: true },
      { field: 'water', category: 'Utilities', czech: true },
      { field: 'sewage', category: 'Utilities', czech: true },
      { field: 'penb', category: 'Energy Rating', czech: true }
    ];

    // Tier III - Portal Metadata
    const tier3Fields = [
      { field: 'isPrague', category: 'Geographic Segmentation' },
      { field: 'isBrno', category: 'Geographic Segmentation' },
      { field: 'shortTerm', category: 'Rental Details' },
      { field: 'minRentDays', category: 'Rental Details' },
      { field: 'deposit', category: 'Financial Details' },
      { field: 'charges', category: 'Financial Details' },
      { field: 'serviceCharges', category: 'Financial Details' },
      { field: 'daysActive', category: 'Analytics' },
      { field: 'visitCount', category: 'Analytics' }
    ];

    // Analyze each field
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('TIER I - GLOBAL STANDARD FIELDS');
    console.log('═══════════════════════════════════════════════════════════════\n');

    for (const { field, category } of tier1Fields) {
      const values = listings
        .map((l: any) => getNestedValue(l, field))
        .filter((v: any) => v !== null && v !== undefined);

      const availability = (values.length / listings.length) * 100;
      const sample = values.slice(0, 3);

      console.log(`${field.padEnd(20)} | ${category.padEnd(15)} | ${availability.toFixed(0).padStart(3)}% | ${JSON.stringify(sample).substring(0, 60)}`);

      results.push({
        field,
        tier: 'I',
        category,
        availability,
        sample_values: sample
      });
    }

    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('TIER II - CZECH REPUBLIC COUNTRY-SPECIFIC FIELDS');
    console.log('═══════════════════════════════════════════════════════════════\n');

    for (const { field, category } of tier2Fields) {
      const values = listings
        .map((l: any) => l[field])
        .filter((v: any) => v !== null && v !== undefined);

      const availability = (values.length / listings.length) * 100;
      const unique = [...new Set(values)];
      const sample = values.slice(0, 3);

      console.log(`${field.padEnd(20)} | ${category.padEnd(18)} | ${availability.toFixed(0).padStart(3)}% | Czech: ${unique.slice(0, 3).join(', ')}`);

      results.push({
        field,
        tier: 'II',
        category,
        availability,
        sample_values: sample,
        czech_values: unique.map(String)
      });
    }

    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('TIER III - PORTAL METADATA FIELDS');
    console.log('═══════════════════════════════════════════════════════════════\n');

    for (const { field, category } of tier3Fields) {
      const values = listings
        .map((l: any) => l[field])
        .filter((v: any) => v !== null && v !== undefined);

      const availability = (values.length / listings.length) * 100;
      const sample = values.slice(0, 3);

      console.log(`${field.padEnd(20)} | ${category.padEnd(25)} | ${availability.toFixed(0).padStart(3)}% | ${JSON.stringify(sample).substring(0, 40)}`);

      results.push({
        field,
        tier: 'III',
        category,
        availability,
        sample_values: sample
      });
    }

    // Summary
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('SUMMARY');
    console.log('═══════════════════════════════════════════════════════════════\n');

    const tier1Count = results.filter(r => r.tier === 'I').length;
    const tier2Count = results.filter(r => r.tier === 'II').length;
    const tier3Count = results.filter(r => r.tier === 'III').length;

    const tier1Avg = results.filter(r => r.tier === 'I').reduce((sum, r) => sum + r.availability, 0) / tier1Count;
    const tier2Avg = results.filter(r => r.tier === 'II').reduce((sum, r) => sum + r.availability, 0) / tier2Count;
    const tier3Avg = results.filter(r => r.tier === 'III').reduce((sum, r) => sum + r.availability, 0) / tier3Count;

    console.log(`Tier I   - ${tier1Count} fields | Avg availability: ${tier1Avg.toFixed(1)}%`);
    console.log(`Tier II  - ${tier2Count} fields | Avg availability: ${tier2Avg.toFixed(1)}%`);
    console.log(`Tier III - ${tier3Count} fields | Avg availability: ${tier3Avg.toFixed(1)}%`);
    console.log(`\nTotal: ${results.length} fields analyzed`);

    // Save results
    const output = {
      timestamp: new Date().toISOString(),
      sample_size: listings.length,
      results,
      summary: {
        tier1: { count: tier1Count, avg_availability: tier1Avg },
        tier2: { count: tier2Count, avg_availability: tier2Avg },
        tier3: { count: tier3Count, avg_availability: tier3Avg }
      }
    };

    console.log('\n✅ Analysis complete!\n');

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
  }
}

function getNestedValue(obj: any, path: string): any {
  if (path === 'gps') {
    return obj.gps?.lat ? `${obj.gps.lat},${obj.gps.lng}` : null;
  }
  if (path === 'publicImages') {
    return obj.publicImages?.length || 0;
  }
  return obj[path];
}

// Run analysis
analyzeFieldExtraction();
