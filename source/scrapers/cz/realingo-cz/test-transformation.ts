import axios from 'axios';
import { transformRealingoToStandard } from './src/transformers/realingoTransformer';
import { RealingoOffer } from './src/types/realingoTypes';

const GRAPHQL_URL = 'https://www.realingo.cz/graphql';

const query = `
  query SearchOffer($purpose: OfferPurpose, $first: Int, $skip: Int) {
    searchOffer(filter: { purpose: $purpose }, first: $first, skip: $skip) {
      items {
        id
        adId
        category
        url
        property
        purpose
        location {
          address
          latitude
          longitude
        }
        price {
          total
          currency
          vat
        }
        area {
          floor
          plot
          garden
          built
          cellar
          balcony
          terrace
          loggia
        }
        photos {
          main
          list
        }
        updatedAt
        createdAt
      }
      total
    }
  }
`;

async function testTransformation() {
  console.log('Fetching 5 sample listings from Realingo API...\n');

  const response = await axios.post(GRAPHQL_URL, {
    query,
    variables: {
      purpose: 'SELL',
      first: 5,
      skip: 0
    }
  });

  const listings: RealingoOffer[] = response.data.data.searchOffer.items;
  console.log(`✓ Fetched ${listings.length} listings\n`);

  for (let i = 0; i < listings.length; i++) {
    const listing = listings[i];
    console.log(`\n${'='.repeat(80)}`);
    console.log(`LISTING ${i + 1}: ${listing.id}`);
    console.log('='.repeat(80));

    console.log('\n📊 RAW API DATA:');
    console.log('  Category:', listing.category);
    console.log('  Property:', listing.property);
    console.log('  Purpose:', listing.purpose);
    console.log('  Address:', listing.location?.address);
    console.log('  Coordinates:', listing.location?.latitude && listing.location?.longitude
      ? `${listing.location.latitude}, ${listing.location.longitude}`
      : 'None');
    console.log('  Price:', listing.price?.total, listing.price?.currency);
    console.log('  Area (floor):', listing.area?.floor, 'sqm');
    console.log('  Area (plot):', listing.area?.plot, 'sqm');
    console.log('  Main photo:', listing.photos?.main ? 'Yes' : 'No');
    console.log('  Gallery photos:', listing.photos?.list?.length || 0);

    try {
      const transformed = transformRealingoToStandard(listing);
      console.log('\n✅ TRANSFORMED DATA:');
      console.log('  Category:', transformed.property_category);
      console.log('  Title:', transformed.title);
      console.log('  Transaction:', transformed.transaction_type);
      console.log('  Price:', transformed.price, transformed.currency);
      console.log('  Location:', transformed.location.city);
      console.log('  Coordinates:', transformed.location.coordinates
        ? `lat: ${transformed.location.coordinates.lat}, lon: ${transformed.location.coordinates.lon}`
        : 'None');

      if (transformed.property_category === 'apartment') {
        console.log('  Bedrooms:', transformed.bedrooms);
        console.log('  Sqm:', transformed.sqm);
      } else if (transformed.property_category === 'house') {
        console.log('  Bedrooms:', transformed.bedrooms);
        console.log('  Living area:', transformed.sqm_living, 'sqm');
        console.log('  Plot area:', transformed.sqm_plot, 'sqm');
      } else if (transformed.property_category === 'land') {
        console.log('  Plot area:', transformed.area_plot_sqm, 'sqm');
      }

      console.log('  Images:', transformed.images?.length || 0);
      console.log('  Source URL:', transformed.source_url);
      console.log('  Portal ID:', transformed.portal_id);

    } catch (error: any) {
      console.log('\n❌ TRANSFORMATION ERROR:');
      console.log('  ', error.message);
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('Test complete!');
  console.log('='.repeat(80));
}

testTransformation().catch(error => {
  console.error('Test failed:', error.message);
  process.exit(1);
});
