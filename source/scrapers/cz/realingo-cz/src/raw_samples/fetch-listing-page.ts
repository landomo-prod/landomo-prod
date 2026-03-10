/**
 * Fetch a single page of Realingo.cz search results via GraphQL.
 * Usage: npx ts-node src/raw_samples/fetch-listing-page.ts
 */

const query = `
  query SearchOffer(
    $purpose: OfferPurpose,
    $property: PropertyType,
    $first: Int,
    $skip: Int
  ) {
    searchOffer(
      filter: {
        purpose: $purpose
        property: $property
      }
      first: $first
      skip: $skip
    ) {
      total
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
    body: JSON.stringify({
      query,
      variables: { purpose: 'SELL', property: 'FLAT', first: 5, skip: 0 },
    }),
  });

  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
}

main().catch(console.error);
