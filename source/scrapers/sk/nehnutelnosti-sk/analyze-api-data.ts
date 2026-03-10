/**
 * Data Analysis Script for Nehnutelnosti.sk API
 *
 * Fetches real data and analyzes all available fields to determine
 * the best extraction strategy.
 */

import axios from 'axios';

interface FieldAnalysis {
  fieldName: string;
  totalCount: number;
  populatedCount: number;
  populationRate: number;
  distinctValues: Set<any>;
  sampleValues: any[];
  dataTypes: Set<string>;
}

async function fetchSampleListings(): Promise<any[]> {
  console.log('🔍 Fetching sample data from Nehnutelnosti.sk API...\n');

  const url = 'https://www.nehnutelnosti.sk/api/v1/listings';
  const params = {
    page: 1,
    per_page: 50,
    region: 'bratislavsky-kraj',
    category: 'byty',
    transaction: 'prenajom'
  };

  try {
    const response = await axios.get(url, { params, timeout: 30000 });
    const listings = response.data?.results || response.data?.items || response.data || [];
    console.log(`✅ Fetched ${listings.length} listings\n`);
    return listings;
  } catch (error: any) {
    console.error('❌ Error fetching data:', error.message);
    return [];
  }
}

function analyzeField(fieldName: string, listings: any[]): FieldAnalysis {
  const analysis: FieldAnalysis = {
    fieldName,
    totalCount: listings.length,
    populatedCount: 0,
    populationRate: 0,
    distinctValues: new Set(),
    sampleValues: [],
    dataTypes: new Set()
  };

  for (const listing of listings) {
    const value = listing[fieldName];

    if (value !== null && value !== undefined && value !== '') {
      analysis.populatedCount++;
      analysis.distinctValues.add(JSON.stringify(value));
      analysis.dataTypes.add(typeof value);

      if (analysis.sampleValues.length < 5) {
        analysis.sampleValues.push(value);
      }
    }
  }

  analysis.populationRate = (analysis.populatedCount / analysis.totalCount) * 100;

  return analysis;
}

function analyzeNestedField(path: string, listings: any[]): FieldAnalysis {
  const analysis: FieldAnalysis = {
    fieldName: path,
    totalCount: listings.length,
    populatedCount: 0,
    populationRate: 0,
    distinctValues: new Set(),
    sampleValues: [],
    dataTypes: new Set()
  };

  const parts = path.split('.');

  for (const listing of listings) {
    let value: any = listing;

    for (const part of parts) {
      if (value && typeof value === 'object') {
        value = value[part];
      } else {
        value = undefined;
        break;
      }
    }

    if (value !== null && value !== undefined && value !== '') {
      analysis.populatedCount++;
      analysis.distinctValues.add(JSON.stringify(value));
      analysis.dataTypes.add(typeof value);

      if (analysis.sampleValues.length < 5) {
        analysis.sampleValues.push(value);
      }
    }
  }

  analysis.populationRate = (analysis.populatedCount / analysis.totalCount) * 100;

  return analysis;
}

function getAllKeys(obj: any, prefix = ''): string[] {
  const keys: string[] = [];

  for (const key in obj) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    keys.push(fullKey);

    if (obj[key] && typeof obj[key] === 'object' && !Array.isArray(obj[key])) {
      keys.push(...getAllKeys(obj[key], fullKey));
    }
  }

  return keys;
}

function printAnalysis(analysis: FieldAnalysis) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`Field: ${analysis.fieldName}`);
  console.log(`${'='.repeat(80)}`);
  console.log(`Population: ${analysis.populatedCount}/${analysis.totalCount} (${analysis.populationRate.toFixed(1)}%)`);
  console.log(`Data Types: ${Array.from(analysis.dataTypes).join(', ')}`);
  console.log(`Distinct Values: ${analysis.distinctValues.size}`);

  if (analysis.sampleValues.length > 0) {
    console.log(`\nSample Values:`);
    analysis.sampleValues.forEach((val, idx) => {
      const preview = JSON.stringify(val).substring(0, 100);
      console.log(`  ${idx + 1}. ${preview}${preview.length >= 100 ? '...' : ''}`);
    });
  }

  if (analysis.distinctValues.size <= 20 && analysis.distinctValues.size > 0) {
    console.log(`\nAll Distinct Values:`);
    Array.from(analysis.distinctValues).forEach((val, idx) => {
      console.log(`  - ${val}`);
    });
  }
}

async function main() {
  console.log('📊 NEHNUTELNOSTI.SK API DATA ANALYSIS\n');
  console.log('This script analyzes real API responses to determine optimal field extraction.\n');

  const listings = await fetchSampleListings();

  if (listings.length === 0) {
    console.log('❌ No data to analyze. Exiting.');
    return;
  }

  // Get all possible field paths
  const allKeys = new Set<string>();
  listings.forEach(listing => {
    getAllKeys(listing).forEach(key => allKeys.add(key));
  });

  console.log(`\n📋 Found ${allKeys.size} unique field paths across ${listings.length} listings\n`);

  // Priority fields we care about
  const priorityFields = [
    'id', 'hash_id', 'name', 'title', 'price', 'currency',
    'disposition', 'rooms', 'bedrooms', 'bathrooms',
    'construction_type', 'construction', 'building_type',
    'condition', 'state', 'status',
    'heating', 'heating_type',
    'ownership', 'vlastnictvo',
    'energy_rating', 'energy_class',
    'floor', 'total_floors', 'floor_number',
    'sqm', 'area', 'usable_area', 'floor_area',
    'images', 'photos', 'image_urls',
    'description', 'text', 'content',
    'features', 'amenities', 'equipment',
    'items', 'attributes', 'properties',
    'locality', 'city', 'address', 'location',
    'district', 'region'
  ];

  console.log('🎯 PRIORITY FIELDS ANALYSIS\n');

  for (const field of priorityFields) {
    // Check if field exists at root level
    if (allKeys.has(field)) {
      const analysis = analyzeField(field, listings);
      if (analysis.populatedCount > 0) {
        printAnalysis(analysis);
      }
    }

    // Check nested paths
    const nestedPaths = Array.from(allKeys).filter(k => k.endsWith(`.${field}`) || k.includes(field));
    for (const path of nestedPaths.slice(0, 3)) { // Limit to avoid spam
      const analysis = analyzeNestedField(path, listings);
      if (analysis.populatedCount > 0) {
        printAnalysis(analysis);
      }
    }
  }

  console.log('\n\n🗂️  ALL AVAILABLE FIELDS (with >50% population rate)\n');
  console.log('Field Path | Population | Distinct Values');
  console.log('-'.repeat(80));

  const allFieldsAnalysis: FieldAnalysis[] = [];

  for (const fieldPath of allKeys) {
    const analysis = analyzeNestedField(fieldPath, listings);
    if (analysis.populationRate >= 50) {
      allFieldsAnalysis.push(analysis);
    }
  }

  allFieldsAnalysis
    .sort((a, b) => b.populationRate - a.populationRate)
    .forEach(analysis => {
      console.log(
        `${analysis.fieldName.padEnd(40)} | ` +
        `${analysis.populationRate.toFixed(1)}%`.padEnd(12) + ` | ` +
        `${analysis.distinctValues.size}`
      );
    });

  console.log('\n✅ Analysis complete!\n');
}

main().catch(console.error);
