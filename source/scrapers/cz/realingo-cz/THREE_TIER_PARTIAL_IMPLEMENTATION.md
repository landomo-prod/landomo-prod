# Realingo Three-Tier Field Extraction - Partial Implementation

**Date:** 2026-02-12
**Status:** ⚠️ Partial (Awaiting GraphQL Schema Expansion)
**Agent:** reality-agent

## Summary

Implemented three-tier structure for Realingo GraphQL scraper with **current available fields only**. The GraphQL query is currently very limited and needs to be expanded to include Czech-specific fields (disposition, ownership, condition, etc.).

## Current State - Minimal API Query

### GraphQL Query (Current)
```graphql
query SearchOffer($purpose: OfferPurpose, $property: PropertyType, $first: Int, $after: String) {
  searchOffer(filter: { purpose: $purpose, property: $property }, first: $first, after: $after) {
    total
    items {
      id
      category
      url
      property
      location { address }
      price { total, currency, vat }
      area { floor }
      photos { main }
    }
  }
}
```

### Available Fields
Only **9 fields** currently extracted:
- `id` - Listing ID
- `category` - Category name (used as title)
- `url` - Relative URL
- `property` - Property type (FLAT/HOUSE/LAND/COMMERCIAL/OTHERS)
- `location.address` - Full address string
- `price.total` - Price amount
- `price.currency` - Currency code (CZK)
- `price.vat` - VAT amount
- `area.floor` - Floor area in m²
- `photos.main` - Main photo ID

## Implementation Details

### Files Modified

1. **`src/transformers/apartments/realingoApartmentTransformer.ts`**
   - Added Tier II: `images`, `videos` legacy fields
   - Added Tier III: `portal_metadata.realingo` object
   - Added Tier III: `country_specific.czech` fields (all `undefined` for now)
   - Added transaction_type context handling

2. **`src/transformers/houses/realingoHouseTransformer.ts`**
   - Added Tier II: `images`, `videos` legacy fields
   - Added Tier III: `portal_metadata.realingo` object
   - Added Tier III: `country_specific.czech` fields (all `undefined` for now)
   - Added transaction_type context handling

3. **`src/transformers/land/realingoLandTransformer.ts`**
   - Added Tier II: `images`, `videos` legacy fields
   - Added Tier III: `portal_metadata.realingo` object
   - Added Tier III: `country_specific.czech` fields (all `undefined` for now)
   - Added transaction_type context handling

### Three-Tier Structure (Current)

#### Tier I - Global Fields
Standard fields populated from available API data:
- ✅ Core: `property_category`, `title` (from category), `price`, `currency`
- ⚠️ Transaction type: Inferred from scraping context (not in API response)
- ✅ Location: Parsed from `address` string → `city`, `region`
- ❌ Coordinates: Not available in current API response
- ✅ Area: `sqm` from `area.floor`
- ❌ Most amenities: Not available (hardcoded to `false`/`undefined`)
- ❌ Czech fields: Not available (disposition, ownership, condition, etc.)

#### Tier II - Legacy Media Fields
```typescript
{
  images: string[];      // Single image from photos.main
  videos: undefined;     // Not available in API
}
```

#### Tier III - Portal Metadata
**`portal_metadata.realingo`:**
```typescript
{
  id: string;                 // Realingo ID
  category: string | undefined;    // Category name
  property_type: string | undefined;  // "FLAT", "HOUSE", "LAND", etc.
  url: string | undefined;         // Relative URL
  vat: number | null | undefined;  // VAT amount
  floor_area: number | null | undefined;  // Floor area (m²)
  photo_main: string | undefined;  // Main photo ID
  raw_address: string | undefined; // Original address string
}
```

**`country_specific.czech`:**
```typescript
{
  // All undefined - fields not in current API query
  disposition: undefined,
  ownership: undefined,
  condition: undefined,
  heating_type: undefined,
  construction_type: undefined,
  energy_rating: undefined,
  furnished: undefined,
  // Plus land-specific: zoning, utilities
}
```

## Critical Limitations

### Missing from GraphQL Query

**Czech-Specific Fields (High Priority):**
- ❌ `disposition` - Room layout ("2+kk", "3+1", etc.)
- ❌ `ownership` - Ownership type (personal, cooperative, state)
- ❌ `condition` - Property condition (new, good, after_renovation, etc.)
- ❌ `heatingType` - Heating type (central, individual, gas, etc.)
- ❌ `constructionType` - Construction material (panel, brick, stone, etc.)
- ❌ `energyRating` - Energy efficiency (A-G)
- ❌ `furnished` - Furnished status

**Standard Fields (High Priority):**
- ❌ `description` - Property description text
- ❌ `bedrooms` - Number of bedrooms
- ❌ `bathrooms` - Number of bathrooms
- ❌ `totalFloors` - Total floors in building
- ❌ `floor` - Current floor number
- ❌ `coordinates` - GPS coordinates (lat/lon)

**Amenities (Medium Priority):**
- ❌ `features` - Features array (parking, balcony, elevator, etc.)
- ❌ `balcony`, `terrace`, `loggia`, `basement`, `parking`, `garage`, etc.

**House-Specific (High Priority for Houses):**
- ❌ `plotArea` - Land plot area (m²)
- ❌ `gardenArea` - Garden area
- ❌ `stories` - Number of stories

**Land-Specific (High Priority for Land):**
- ❌ `zoning` - Land zoning type
- ❌ `utilities` - Water, sewage, electricity, gas availability

**Additional Fields:**
- ❌ `agent` - Agent/broker information
- ❌ `publishedAt`, `updatedAt` - Timestamps
- ❌ `images` - Full images array (not just main)
- ❌ `videos`, `virtualTour` - Media URLs

## Required GraphQL Query Expansion

### Recommended Full Query Structure

```graphql
query SearchOffer(
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
      # Basic Info
      id
      category
      url
      property
      purpose

      # Location
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

      # Pricing
      price {
        total
        currency
        vat
        perMonth    # For rentals
      }

      # Areas
      area {
        floor
        plot
        garden
        cellar
        terrace
        balcony
      }

      # Rooms & Layout
      bedrooms
      bathrooms
      totalFloors
      floor
      disposition
      rooms

      # Czech-Specific
      ownership
      condition
      heatingType
      constructionType
      energyRating
      furnished

      # Amenities
      features
      hasBalcony
      hasTerrace
      hasLoggia
      hasBasement
      hasParking
      hasGarage
      hasElevator
      hasGarden
      hasPool

      # Land-Specific
      zoning
      waterSupply
      sewage
      electricity
      gas
      roadAccess

      # Media
      photos {
        main
        all
      }
      videos
      virtualTour

      # Description
      description
      title

      # Meta
      agent {
        name
        phone
        email
      }
      publishedAt
      updatedAt
      viewCount
    }
  }
}
```

## Next Steps

### Phase 1: GraphQL Schema Introspection (Required)
Need to determine which fields actually exist in the Realingo GraphQL schema:

**Option A: Manual Introspection**
```graphql
query IntrospectionQuery {
  __schema {
    types {
      name
      fields {
        name
        type {
          name
          kind
        }
      }
    }
  }
}
```

**Option B: Use GraphiQL/Playground**
- Visit: https://www.realingo.cz/graphql
- Browse schema documentation
- Identify all available fields on `Offer` type

**Option C: Browser DevTools Inspection**
- Visit Realingo website
- Inspect actual GraphQL queries in Network tab
- Copy full query structure

### Phase 2: Update GraphQL Query
Once we know what fields exist:

1. Update `src/scrapers/listingsScraper.ts`:
   - Expand `getSearchOfferQuery()` with all available fields

2. Update `src/types/realingoTypes.ts`:
   - Add all fields to `RealingoOffer` interface

3. Update all transformers:
   - Map new fields to StandardProperty
   - Populate `country_specific.czech` with real data
   - Use normalization functions from `czech-value-mappings.ts`

### Phase 3: Test & Validate
1. Test GraphQL query with real API
2. Verify all fields are returned
3. Test transformations with real data
4. Validate Czech-specific normalizations

## Comparison with Other Scrapers

| Feature | Realingo (Current) | Reality.cz (HTML) | Sreality.cz (API) |
|---------|-------------------|-------------------|-------------------|
| Data Source | GraphQL API | HTML Scraping | REST API |
| Three-Tier | ✅ Partial | ✅ Complete | ✅ Complete |
| Field Count | ~9 fields | ~20 fields | 50+ fields |
| Czech Fields | ❌ None | ⚠️ Partial | ✅ Complete |
| Coordinates | ❌ No | ❌ No | ✅ Yes |
| Disposition | ❌ No | ✅ Yes | ✅ Yes |
| Amenities | ❌ No | ⚠️ Limited | ✅ Complete |
| Description | ❌ No | ⚠️ Limited | ✅ Yes |

## Known Issues & Workarounds

### Issue 1: Transaction Type Not in Response
**Problem:** API doesn't include `purpose` field in response
**Workaround:** Inject `_transactionType` during scraping based on query filter
**Code:**
```typescript
const actualTransactionType = (offer as any)._transactionType || 'sale';
```

### Issue 2: No GPS Coordinates
**Problem:** Current query doesn't fetch `location.coordinates`
**Impact:** Can't display properties on map
**Solution:** Add `coordinates { lat, lng }` to GraphQL query

### Issue 3: Hardcoded Default Values
**Problem:** Missing fields use hardcoded defaults
**Examples:**
- `bedrooms: 1` (should be from API)
- `has_elevator: false` (should be from features)
- `condition: undefined` (should be normalized Czech value)

**Solution:** Expand GraphQL query to include these fields

## Build Verification

```bash
$ npm run build
✅ TypeScript compilation successful (0 errors)
```

## Data Quality Assessment

### Current Implementation
- **Tier I Coverage**: ~30% (only basic fields)
- **Tier II Coverage**: 50% (images only, no videos)
- **Tier III Coverage**:
  - Portal metadata: 100% (for available fields)
  - Czech metadata: 0% (all fields undefined)

### After GraphQL Expansion (Estimated)
- **Tier I Coverage**: ~90% (most standard fields)
- **Tier II Coverage**: 100% (images + videos)
- **Tier III Coverage**:
  - Portal metadata: 100%
  - Czech metadata: 90% (all normalized fields)

## Recommendations

### Immediate Action Required
1. **Introspect GraphQL schema** to discover available fields
2. **Expand GraphQL query** with Czech-specific fields
3. **Update transformers** to use real data instead of placeholders
4. **Test with real API** to validate field availability

### Optional Enhancements
1. Add GraphQL fragments for reusable field sets
2. Implement field selection based on property type
3. Add caching for introspection results
4. Create integration tests with mock GraphQL responses

## Conclusion

The three-tier structure is **implemented but incomplete**. The current GraphQL query is too limited - it only fetches 9 basic fields, missing all Czech-specific data (disposition, ownership, condition, etc.) and most standard amenities.

**Status:** ⚠️ **Partial Implementation - Awaiting GraphQL Query Expansion**

Once the GraphQL query is expanded to include all available fields, the transformers will need to be updated to map the rich API data to the three-tier structure. Currently, the structure is in place but most Czech-specific fields are `undefined`.

**Next Step:** Introspect Realingo GraphQL schema to discover all available fields, then expand the query and transformers accordingly.
