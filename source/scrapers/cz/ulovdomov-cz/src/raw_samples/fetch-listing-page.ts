/**
 * Fetch a single page of UlovDomov.cz listings via their REST API.
 * Usage: npx ts-node src/raw_samples/fetch-listing-page.ts
 */

const CZ_BOUNDS = {
  northEast: { lat: 51.06, lng: 18.87 },
  southWest: { lat: 48.55, lng: 12.09 },
};

async function main() {
  const res = await fetch(
    'https://ud.api.ulovdomov.cz/v1/offer/find?page=1&perPage=5&sorting=latest',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      body: JSON.stringify({
        offerType: 'sale',
        bounds: CZ_BOUNDS,
      }),
    },
  );

  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
}

main().catch(console.error);
