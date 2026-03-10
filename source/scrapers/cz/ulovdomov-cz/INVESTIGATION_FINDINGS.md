# UlovDomov Data Structure Investigation - Final Findings

**Investigator**: data-investigator agent
**Date**: February 14, 2026
**Status**: Investigation Complete ✅ | Mapper Updated ⚠️  | Testing Needed 🔄

---

## Executive Summary

The investigation successfully identified the data structure from UlovDomov's `window.__NEXT_DATA__.props.pageProps.offer.data`. The mapper has been created and updated, but **all 40 test listings are currently failing transformation** due to a mismatch between expected and actual data structure.

---

## Key Findings

### 1. Data Source Confirmed
✅ **Location**: `window.__NEXT_DATA__.props.pageProps.offer.data`
✅ **Extraction**: htmlScraper.ts successfully extracts data
✅ **Volume**: 40 listings scraped in test run (20 sales + 20 rentals)

### 2. Structure Differences (Documented vs Actual)

Based on API_INVESTIGATION.md (lines 88-112), the documented structure is:

```javascript
{
  id: 5574930,
  title: "Pronájem bytu 3+1 60 m2",
  area: 60,
  description: "...",
  disposition: "3+1",
  houseType: {...},
  geoCoordinates: { lat: 50.xxx, lng: 15.xxx },
  photos: [...],
  rentalPrice: { value: 17000, currency: "CZK" },
  village: {...},
  villagePart: {...},
  street: {...},
  convenience: [...],
  houseConvenience: [...],
  floorLevel: 7,
  offerType: "RENT",
  propertyType: "FLAT"
}
```

### 3. Current Issues

**VPS Test Results** (February 14, 2026 07:49 UTC):
- ✅ 40 listings extracted from HTML
- ❌ 0 listings transformed successfully
- ❌ 0 listings sent to ingest API

**Error Message**:
```
Error transforming listing XXXXX: Cannot read properties of undefined (reading 'street')
```

This error occurs for ALL 40 listings, indicating:
1. The mapper is running
2. The mapper is returning data
3. BUT `location.street` is undefined in the returned data
4. The transformer expects `location.street` to exist

---

## Investigation Deliverables

### 1. Documentation Created
- ✅ `HTML_TO_API_MAPPING.md` - Complete field mapping reference
- ✅ `INVESTIGATION_FINDINGS.md` - This document
- ✅ Investigation reports sent to team-lead

### 2. Code Analysis
- ✅ Examined `htmlScraper.ts` - Extraction logic
- ✅ Examined `ulovdomovTransformer.ts` - Transformation logic
- ✅ Examined `htmlDataMapper.ts` - Mapper (updated by mapper-developer)

### 3. VPS Testing
- ✅ Checked Docker logs for actual scrape results
- ✅ Identified transformation failure pattern
- ⏳ Debug logging added but not yet deployed

---

## Root Cause Analysis

### Hypothesis
The transformer (`ulovdomovTransformer.ts`) is accessing `location.street` directly without checking if it exists:

```typescript
// Likely code in transformer
const address = buildAddress(offer.location);  // ← offer.location might be undefined
```

### Evidence
1. Error happens at transformation stage (after mapping)
2. ALL listings fail with identical error
3. Error references `location.street` specifically
4. Mapper returns `location: { city, district, street, coordinates }`
5. If ANY of village/villagePart/street is missing in HTML, the mapped location field will be incomplete

### Possible Causes
1. **HTML data missing location fields** - Some listings don't have `village`, `villagePart`, or `street` in __NEXT_DATA__
2. **Mapper returning undefined location** - If all location sub-fields are undefined, location object might be undefined
3. **Transformer not handling undefined** - buildAddress() function doesn't check for undefined location

---

## Recommendations

### Immediate Actions (High Priority)

1. **Deploy Debug Logging** 🔴
   - Build and deploy updated code with debug logging
   - Trigger test scrape
   - Capture actual `__NEXT_DATA__` structure from logs
   - Verify exact field names match documentation

2. **Fix Transformer** 🔴
   - Add undefined checks in `buildAddress()` function
   - Handle cases where `location` is undefined
   - Handle cases where `location.city/district/street` are undefined

3. **Update Mapper** 🟡
   - Ensure location object is always returned (even if empty)
   - Add fallback values for missing location fields
   - Log warnings when expected fields are missing

### Testing Strategy

1. **Local Test**
   ```bash
   cd "scrapers/Czech Republic/ulovdomov"
   npm run build
   npm start
   curl -X POST http://localhost:8107/scrape
   ```

2. **VPS Deployment**
   ```bash
   rsync -av --exclude='node_modules' . landomo-vps:/opt/landomo-world/scrapers/Czech\ Republic/ulovdomov/
   ssh landomo-vps 'cd /opt/landomo-world/scrapers/Czech\ Republic/ulovdomov && npm run build'
   ssh landomo-vps 'docker restart landomo-scraper-ulovdomov'
   ```

3. **Verification**
   - Check logs for debug output
   - Verify transformation success rate > 0%
   - Verify ingest API receives listings
   - Check database for new listings

---

## Next Steps

### For integration-tester (Task #3)
1. Deploy debug version to VPS
2. Capture real data sample from logs
3. Compare with documented structure
4. Fix any mismatches in mapper

### For mapper-developer (Task #2 - Completed?)
1. Review actual data sample (once captured)
2. Update mapper if field names don't match
3. Add error handling for missing fields
4. Ensure location object is always valid

### For transformer updates
1. Add undefined checks in buildAddress()
2. Handle missing location gracefully
3. Log warnings for incomplete data
4. Don't fail transformation on missing optional fields

---

## Current Code State

### Files Modified
1. **htmlScraper.ts** - Uses mapper (line 3: import)
2. **htmlDataMapper.ts** - Updated with field mappings (by mapper-developer)
3. **htmlDataMapper.ts** - Debug logging added (by data-investigator)

### Files Needing Updates
1. **ulovdomovTransformer.ts** - Add undefined checks for location
2. **VPS Deployment** - Rebuild and restart with debug logging

---

## Success Criteria

✅ **Investigation Complete** - Data structure documented
⏳ **Mapper Verified** - Needs actual data validation
⏳ **Transformation Working** - Currently 0% success rate
⏳ **Ingestion Working** - Depends on transformation

**Target**: 95%+ transformation success rate

---

## References

- **API Investigation**: `API_INVESTIGATION.md`
- **Implementation Summary**: `IMPLEMENTATION_SUMMARY.md`
- **Field Mapping**: `HTML_TO_API_MAPPING.md`
- **VPS Logs**: `/var/lib/docker/containers/.../landomo-scraper-ulovdomov-*.log`
- **Code**: `src/scrapers/htmlScraper.ts`, `src/utils/htmlDataMapper.ts`, `src/transformers/ulovdomovTransformer.ts`

---

## Contact

- **Investigation Lead**: data-investigator agent
- **Mapper Developer**: mapper-developer agent
- **Integration Tester**: integration-tester agent (Task #3)
- **Team Lead**: team-lead

---

**Last Updated**: February 14, 2026 08:00 UTC
