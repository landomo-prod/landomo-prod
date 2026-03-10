/**
 * Test Realingo GraphQL API to discover available fields
 *
 * Strategy: Try querying fields we expect, and see which ones work/fail
 */

import axios from 'axios';

const GRAPHQL_URL = 'https://www.realingo.cz/graphql';

// Test different field sets to see what's available
async function testFields() {
  console.log('🧪 Testing Realingo GraphQL Fields...\n');

  // Test 1: Try querying common real estate fields
  const testQueries = [
    {
      name: 'Basic Fields (Current)',
      query: `
        query TestBasic {
          searchOffer(filter: { purpose: SELL, property: FLAT }, first: 1) {
            total
            items {
              id
              category
              url
              property
            }
          }
        }
      `
    },
    {
      name: 'Location Fields',
      query: `
        query TestLocation {
          searchOffer(filter: { purpose: SELL, property: FLAT }, first: 1) {
            items {
              id
              location {
                address
                city
                district
                region
                coordinates {
                  lat
                  lng
                }
              }
            }
          }
        }
      `
    },
    {
      name: 'Price & Area Fields',
      query: `
        query TestPriceArea {
          searchOffer(filter: { purpose: SELL, property: FLAT }, first: 1) {
            items {
              id
              price {
                total
                currency
                vat
                perSqm
              }
              area {
                floor
                plot
                garden
                balcony
                terrace
                cellar
              }
            }
          }
        }
      `
    },
    {
      name: 'Czech-Specific Fields',
      query: `
        query TestCzech {
          searchOffer(filter: { purpose: SELL, property: FLAT }, first: 1) {
            items {
              id
              disposition
              ownership
              condition
              heatingType
              constructionType
              energyRating
              furnished
              equipped
            }
          }
        }
      `
    },
    {
      name: 'Room & Layout Fields',
      query: `
        query TestRooms {
          searchOffer(filter: { purpose: SELL, property: FLAT }, first: 1) {
            items {
              id
              bedrooms
              bathrooms
              rooms
              floor
              totalFloors
            }
          }
        }
      `
    },
    {
      name: 'Amenities',
      query: `
        query TestAmenities {
          searchOffer(filter: { purpose: SELL, property: FLAT }, first: 1) {
            items {
              id
              features
              hasBalcony
              hasTerrace
              hasLoggia
              hasBasement
              hasParking
              hasGarage
              hasElevator
              hasLift
              parking
              garage
              lift
              balcony
              terrace
              cellar
            }
          }
        }
      `
    },
    {
      name: 'Media Fields',
      query: `
        query TestMedia {
          searchOffer(filter: { purpose: SELL, property: FLAT }, first: 1) {
            items {
              id
              photos {
                main
                all
                url
                urls
              }
              images
              publicImages
              videos
              virtualTour
              tour360
            }
          }
        }
      `
    },
    {
      name: 'Description & Metadata',
      query: `
        query TestMeta {
          searchOffer(filter: { purpose: SELL, property: FLAT }, first: 1) {
            items {
              id
              title
              description
              publishedAt
              updatedAt
              createdAt
              daysActive
              viewCount
              visitCount
            }
          }
        }
      `
    },
    {
      name: 'Agent/Advertiser',
      query: `
        query TestAgent {
          searchOffer(filter: { purpose: SELL, property: FLAT }, first: 1) {
            items {
              id
              agent {
                name
                phone
                email
              }
              advertiser {
                name
                phone
                email
              }
              contact {
                name
                phone
                email
              }
            }
          }
        }
      `
    }
  ];

  for (const test of testQueries) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`Testing: ${test.name}`);
    console.log('='.repeat(80));

    try {
      const response = await axios.post(
        GRAPHQL_URL,
        { query: test.query },
        {
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
          },
          timeout: 10000
        }
      );

      if (response.data.errors) {
        console.log('❌ ERRORS:');
        response.data.errors.forEach((err: any) => {
          console.log(`   ${err.message}`);
          if (err.extensions?.exception?.stacktrace) {
            console.log(`   Location: ${JSON.stringify(err.locations)}`);
          }
        });
      }

      if (response.data.data) {
        console.log('✅ SUCCESS - Fields available:');
        const item = response.data.data.searchOffer?.items?.[0];
        if (item) {
          Object.keys(item).forEach(key => {
            const value = item[key];
            if (value && typeof value === 'object' && !Array.isArray(value)) {
              console.log(`   ${key}: { ${Object.keys(value).join(', ')} }`);
            } else {
              console.log(`   ${key}: ${typeof value}`);
            }
          });
        } else {
          console.log('   (No items returned)');
        }
      }

    } catch (error: any) {
      console.log('❌ REQUEST FAILED:', error.message);
    }

    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log(`\n${'='.repeat(80)}`);
  console.log('✅ FIELD TESTING COMPLETE');
  console.log('='.repeat(80));
}

testFields().catch(console.error);
