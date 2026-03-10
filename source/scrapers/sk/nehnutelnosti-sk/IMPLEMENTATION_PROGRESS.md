# Nehnutelnosti.sk Implementation Progress

## Task #2: Checksum Mode + Full Category Routing

**Status:** 80% Complete
**Blocked On:** Type structure decision for Tier I transformers

### ✅ Completed Components

#### 1. Checksum Mode Infrastructure
- **File:** `src/utils/checksumExtractor.ts`
  - `extractNehnutelnostiChecksumFields()` - extracts price, title, description, sqm, disposition, floor
  - `createNehnutelnostiChecksum()` - creates checksum for single listing
  - `batchCreateNehnutelnostiChecksums()` - batch checksum creation

- **File:** `src/scrapers/httpScraper.ts`  
  - `scrapeWithChecksums()` - async function that:
    - Scrapes all listings
    - Creates checksums
    - Compares with database in batches (1000 per batch)
    - Returns only new/changed listings
    - Reports savings percentage

- **File:** `src/index.ts`
  - Added `USE_CHECKSUMS` environment variable routing
  - Conditional logic: checksum mode vs full mode
  - Logs checksum statistics after scrape

#### 2. Category Routing Infrastructure
- **File:** `src/utils/categoryDetector.ts`
  - `detectCategory()` function - routes to apartment/house/land
  - Logic based on property_type field (byty/domy/pozemky)
  - Fallback heuristics for edge cases

- **File:** `src/transformers/index.ts`
  - Main transformer entry point
  - Switch statement routing by category
  - Exports detectCategory for testing

- **File:** `src/transformers/helpers.ts`
  - 20+ shared extraction functions
  - Coordinate extraction, city parsing, bedroom/bathroom extraction
  - Image aggregation from multiple fields
  - Slovak→English value mapping functions

#### 3. Category-Specific Transformers (Structure Complete)
- **Apartments:** `src/transformers/apartments/apartmentTransformer.ts`
- **Houses:** `src/transformers/houses/houseTransformer.ts`
- **Land:** `src/transformers/land/landTransformer.ts`

Each transformer:
- Uses category-specific Tier I type
- Extracts category-relevant fields
- Maps Slovak values to English
- Handles missing data gracefully

### 🔧 Remaining Work

**TypeScript Compilation Errors:**
The transformers are structurally complete but don't match the exact Tier I type definitions.

**Root Cause:**
I initially assumed Tier I types would have fields like:
- `country_specific` object for Slovak-specific fields
- `portal_metadata` object for portal-specific data  
- `slovak_disposition` / `slovak_ownership` top-level fields

**Actual Tier I Structure:**
- Simple, focused types with only category-relevant fields
- Uses `media` object (not `images` array)
- Uses `source_platform` and `portal_id` (not source_portal/portal_listing_id)
- No `country_specific` or `portal_metadata` nested objects

**Options to Resolve:**
1. **Strip down** transformers to match pure Tier I types (lose Slovak fields)
2. **Hybrid approach** - wrap Tier I output with metadata in scraper
3. **Use StandardProperty** instead of Tier I types

**Estimated Time:** 20-30 minutes to align all 3 transformers + test

### 📦 Files Modified/Created

**New Files:**
- `src/utils/checksumExtractor.ts`
- `src/utils/categoryDetector.ts`
- `src/transformers/helpers.ts`
- `src/transformers/index.ts`
- `src/transformers/apartments/apartmentTransformer.ts`
- `src/transformers/houses/houseTransformer.ts`
- `src/transformers/land/landTransformer.ts`

**Modified Files:**
- `src/scrapers/httpScraper.ts` - added scrapeWithChecksums()
- `src/index.ts` - added checksum mode routing

### 🧪 Testing Plan (Pending)

Once type issues are resolved:

1. **Compilation Test**
   ```bash
   cd scrapers/Slovakia/nehnutelnosti-sk
   npm run build
   ```

2. **Category Detection Test**
   - Test with sample byty/domy/pozemky listings
   - Verify correct partition routing

3. **Checksum Mode Test**
   ```bash
   USE_CHECKSUMS=true npm start
   ```
   - Verify savings percentage calculation
   - Confirm only new/changed listings ingested

4. **Full Integration Test**
   - Docker build and deployment
   - Health check endpoint
   - Partition distribution verification

### 📊 Expected Metrics

**Checksum Savings:** 60-80% reduction in ingestion load (based on daily scrapes)

**Partition Distribution:**
- Apartments: ~70% (largest category)
- Houses: ~25%
- Land: ~5%

### 🔗 Dependencies

- `@landomo/core` - ChecksumClient, ScrapeRunTracker, Tier I types
- Shared Slovak value mappings
- Ingest API with checksum comparison endpoint
