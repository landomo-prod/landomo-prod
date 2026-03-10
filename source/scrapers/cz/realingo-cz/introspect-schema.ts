/**
 * GraphQL Schema Introspection for Realingo.cz
 *
 * This script introspects the Realingo GraphQL API to discover all available fields
 * on the Offer/Property type, which we can then use to expand our query.
 */

import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

const GRAPHQL_URL = 'https://www.realingo.cz/graphql';

// Full introspection query
const INTROSPECTION_QUERY = `
  query IntrospectionQuery {
    __schema {
      queryType {
        name
      }
      types {
        kind
        name
        description
        fields {
          name
          description
          type {
            name
            kind
            ofType {
              name
              kind
              ofType {
                name
                kind
              }
            }
          }
        }
      }
    }
  }
`;

interface GraphQLType {
  kind: string;
  name: string;
  description?: string;
  fields?: GraphQLField[];
}

interface GraphQLField {
  name: string;
  description?: string;
  type: {
    name?: string;
    kind: string;
    ofType?: {
      name?: string;
      kind: string;
      ofType?: {
        name?: string;
        kind: string;
      };
    };
  };
}

interface IntrospectionResult {
  data: {
    __schema: {
      queryType: {
        name: string;
      };
      types: GraphQLType[];
    };
  };
}

async function introspectSchema() {
  console.log('🔍 Introspecting Realingo GraphQL Schema...\n');
  console.log(`Endpoint: ${GRAPHQL_URL}\n`);

  try {
    const response = await axios.post<IntrospectionResult>(
      GRAPHQL_URL,
      {
        query: INTROSPECTION_QUERY
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        },
        timeout: 30000
      }
    );

    const schema = response.data.data.__schema;

    console.log('✅ Schema introspection successful!\n');
    console.log(`Query Type: ${schema.queryType.name}`);
    console.log(`Total Types: ${schema.types.length}\n`);

    // Save full schema to JSON
    const schemaPath = path.join(__dirname, 'graphql-schema.json');
    fs.writeFileSync(schemaPath, JSON.stringify(response.data, null, 2));
    console.log(`📄 Full schema saved to: ${schemaPath}\n`);

    // Find the Offer/Property types
    console.log('=' .repeat(80));
    console.log('SEARCHING FOR PROPERTY/OFFER TYPES');
    console.log('='.repeat(80) + '\n');

    const relevantTypes = schema.types.filter(t =>
      t.name && (
        t.name.toLowerCase().includes('offer') ||
        t.name.toLowerCase().includes('property') ||
        t.name.toLowerCase().includes('listing') ||
        t.name.toLowerCase().includes('estate') ||
        t.name.toLowerCase().includes('nemovitost')
      ) && t.fields && t.fields.length > 0
    );

    if (relevantTypes.length === 0) {
      console.log('❌ No property/offer types found in schema');
      console.log('\nAll available types:');
      schema.types.forEach(t => {
        if (t.fields && t.fields.length > 0) {
          console.log(`  - ${t.name} (${t.fields.length} fields)`);
        }
      });
      return;
    }

    // Analyze each relevant type
    relevantTypes.forEach(type => {
      console.log(`\n📦 Type: ${type.name}`);
      console.log(`   Description: ${type.description || 'N/A'}`);
      console.log(`   Fields: ${type.fields?.length || 0}\n`);

      if (type.fields) {
        console.log(`   Available Fields:\n`);

        // Categorize fields
        const categories = {
          ids: [] as string[],
          location: [] as string[],
          pricing: [] as string[],
          areas: [] as string[],
          rooms: [] as string[],
          czech: [] as string[],
          amenities: [] as string[],
          utilities: [] as string[],
          media: [] as string[],
          agent: [] as string[],
          metadata: [] as string[],
          other: [] as string[]
        };

        type.fields.forEach(field => {
          const name = field.name;
          const typeName = getTypeString(field.type);
          const fieldStr = `${name}: ${typeName}`;

          if (name.match(/id|uuid|key/i)) categories.ids.push(fieldStr);
          else if (name.match(/location|address|city|district|region|gps|coordinate|lat|lng/i)) categories.location.push(fieldStr);
          else if (name.match(/price|cost|fee|deposit|rent|vat|currency/i)) categories.pricing.push(fieldStr);
          else if (name.match(/area|surface|sqm|plot|garden|balcony|terrace|cellar|loggia/i)) categories.areas.push(fieldStr);
          else if (name.match(/bedroom|bathroom|room|floor|disposition/i)) categories.rooms.push(fieldStr);
          else if (name.match(/ownership|condition|heating|construction|energy|penb|furnished|equipped/i)) categories.czech.push(fieldStr);
          else if (name.match(/parking|garage|lift|elevator|balcony|terrace|cellar|pool|sauna|fireplace/i)) categories.amenities.push(fieldStr);
          else if (name.match(/water|sewage|gas|electric/i)) categories.utilities.push(fieldStr);
          else if (name.match(/photo|image|video|tour|media|gallery/i)) categories.media.push(fieldStr);
          else if (name.match(/agent|broker|advertiser|contact/i)) categories.agent.push(fieldStr);
          else if (name.match(/created|updated|published|active|view|visit|days/i)) categories.metadata.push(fieldStr);
          else categories.other.push(fieldStr);
        });

        // Print categorized fields
        const printCategory = (title: string, fields: string[]) => {
          if (fields.length > 0) {
            console.log(`   ${title} (${fields.length}):`);
            fields.forEach(f => console.log(`     - ${f}`));
            console.log();
          }
        };

        printCategory('🆔 Identifiers', categories.ids);
        printCategory('📍 Location', categories.location);
        printCategory('💰 Pricing', categories.pricing);
        printCategory('📐 Areas', categories.areas);
        printCategory('🚪 Rooms & Layout', categories.rooms);
        printCategory('🇨🇿 Czech-Specific', categories.czech);
        printCategory('✨ Amenities', categories.amenities);
        printCategory('🔌 Utilities', categories.utilities);
        printCategory('📸 Media', categories.media);
        printCategory('👤 Agent/Advertiser', categories.agent);
        printCategory('🕐 Metadata', categories.metadata);
        printCategory('📦 Other', categories.other);

        // Save field analysis
        const analysisPath = path.join(__dirname, `realingo-${type.name.toLowerCase()}-fields.json`);
        fs.writeFileSync(analysisPath, JSON.stringify({ type: type.name, fields: type.fields }, null, 2));
        console.log(`   📄 Field analysis saved to: ${analysisPath}\n`);

        // Generate recommended GraphQL query
        console.log('=' .repeat(80));
        console.log(`RECOMMENDED GRAPHQL QUERY FOR ${type.name}`);
        console.log('='.repeat(80) + '\n');

        const query = generateRecommendedQuery(type);
        console.log(query);

        const queryPath = path.join(__dirname, `recommended-query-${type.name.toLowerCase()}.graphql`);
        fs.writeFileSync(queryPath, query);
        console.log(`\n📄 Query saved to: ${queryPath}\n`);
      }
    });

    console.log('=' .repeat(80));
    console.log('✅ INTROSPECTION COMPLETE');
    console.log('='.repeat(80));
    console.log('\nNext Steps:');
    console.log('1. Review the recommended GraphQL query');
    console.log('2. Update src/scrapers/listingsScraper.ts with expanded query');
    console.log('3. Update src/types/realingoTypes.ts with new fields');
    console.log('4. Update transformers to map new fields to StandardProperty');

  } catch (error: any) {
    console.error('❌ Schema introspection failed:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  }
}

function getTypeString(type: GraphQLField['type']): string {
  if (type.name) return type.name;
  if (type.ofType) {
    const inner = getTypeString(type.ofType);
    return type.kind === 'NON_NULL' ? `${inner}!` : `[${inner}]`;
  }
  return type.kind;
}

function generateRecommendedQuery(type: GraphQLType): string {
  if (!type.fields) return '';

  const indent = (level: number) => '  '.repeat(level);

  let query = `query SearchOffer(\n`;
  query += `  $purpose: OfferPurpose,\n`;
  query += `  $property: PropertyType,\n`;
  query += `  $first: Int,\n`;
  query += `  $after: String\n`;
  query += `) {\n`;
  query += `  searchOffer(\n`;
  query += `    filter: { purpose: $purpose, property: $property }\n`;
  query += `    first: $first\n`;
  query += `    after: $after\n`;
  query += `  ) {\n`;
  query += `    total\n`;
  query += `    items {\n`;

  // Group fields
  const simpleFields: string[] = [];
  const objectFields: { name: string; type: string }[] = [];

  type.fields.forEach(field => {
    const typeName = getTypeString(field.type);

    // Skip __typename and other meta fields
    if (field.name.startsWith('__')) return;

    // Check if it's an object type (needs nested fields)
    if (typeName.match(/[A-Z][a-zA-Z]+/) && !typeName.match(/String|Int|Float|Boolean|ID/)) {
      objectFields.push({ name: field.name, type: typeName });
    } else {
      simpleFields.push(field.name);
    }
  });

  // Add simple fields
  simpleFields.forEach(name => {
    query += `${indent(3)}${name}\n`;
  });

  // Add object fields with placeholders
  objectFields.forEach(({ name, type }) => {
    query += `${indent(3)}${name} {\n`;
    query += `${indent(4)}# TODO: Add ${type} fields\n`;
    query += `${indent(3)}}\n`;
  });

  query += `    }\n`;
  query += `  }\n`;
  query += `}\n`;

  return query;
}

// Run introspection
introspectSchema().catch(console.error);
