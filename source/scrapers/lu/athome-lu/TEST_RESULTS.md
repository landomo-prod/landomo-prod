# ATHome.lu Partial Test Results

## Test 1: ATHome.lu API Direct Probe
- **Status:** PASS
- **HTTP Status:** 200
- **Response:** JSON with `data` array containing listing objects
- **Endpoint:** `https://apigw.prd.athomegroup.lu/api-listings/listings`
- **Sample fields:** id, type, typeKey, permalink, address (with pin.lat/lon), contact, prices, surfaces, children
- **Notes:** API is public, no auth required. Returns rich data including coordinates, agency info, pricing. Pagination works via `page` and `pageSize` params.

## Test 2: Immoweb Search API
- **Status:** FAIL (DNS resolution)
- **Error:** `getaddrinfo ENOTFOUND search.immoweb.be`
- **Notes:** The search.immoweb.be hostname did not resolve. This may be a geo-restricted or internal endpoint. The immoweb scraper likely needs a different approach (e.g., Puppeteer or the classified API at `www.immoweb.be`).

## Test 3: TypeScript Compilation

### athome-lu
- **Before fixes:** 19 TypeScript errors
- **After fixes:** 0 errors (PASS)

### immoweb-be
- **Before fixes:** 4 TypeScript errors
- **After fixes:** 0 errors (PASS)

## Fixes Applied

### athome-lu (19 errors fixed)
1. **rawTypes.ts:** Changed `pin.lng` to `pin.lon` to match actual API response
2. **apartmentTransformer.ts, houseTransformer.ts:** `raw.bedrooms` is a `number`, not an object -- removed `.min`/`.max` access
3. **All 4 transformers:** Changed `zip_code` to `postal_code` (PropertyLocation interface)
4. **All 4 transformers:** Changed `latitude`/`longitude` to `coordinates: { lat, lon }` (PropertyLocation interface)
5. **All 4 transformers:** Changed `raw.images` to `raw.media?.photos` (correct field on AtHomeListingRaw)
6. **checksumExtractor.ts:** Changed `ChecksumEntry` to include `portal` and `contentHash` fields to match `ListingChecksum` interface; fixed `raw.bedrooms?.min` to `raw.bedrooms`

### immoweb-be (4 errors fixed)
1. **All 4 transformers:** Changed `zip_code` to `postal_code` (PropertyLocation interface)
2. **All 4 transformers:** Changed `latitude`/`longitude` to `coordinates: { lat, lon }` (PropertyLocation interface)
