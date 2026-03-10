/**
 * Fetch a single Realingo.cz offer detail via GraphQL.
 * Usage: npx ts-node src/raw_samples/fetch-detail.ts [offerId]
 */

const offerId = process.argv[2] || 'example-id';

const query = `
  {
    offer(id: "${offerId}") {
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
      detail {
        description
        externalUrl
        buildingType
        buildingStatus
        buildingPosition
        houseType
        ownership
        furniture
        floor
        floorTotal
        yearBuild
        yearReconstructed
        parking
        parkingPlaces
        garages
        energyPerformance
        energyPerformanceValue
        heating
        electricity
        waterSupply
        gas
        balcony
        loggia
        terrace
        lift
        cellar
        isBarrierFree
        isAuction
        roomCount
        flatCount
        flatClass
        availableFromDate
        ceilingHeight
      }
    }
  }
`;

async function main() {
  const res = await fetch('https://www.realingo.cz/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
    body: JSON.stringify({ query }),
  });

  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
}

main().catch(console.error);
