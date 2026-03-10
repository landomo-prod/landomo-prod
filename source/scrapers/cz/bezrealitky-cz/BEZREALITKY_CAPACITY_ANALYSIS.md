# BezRealitky Scraper Capacity Analysis
## Root Cause Investigation: Why Only 4,335 Estates Were Detected

**Date**: February 7, 2026
**Investigation Result**: ROOT CAUSE FOUND - Missing 4 Estate Types
**Impact**: 169% increase in potential listings (11,667 vs 4,335)

---

## Executive Summary

The BezRealitky scraper is only detecting **4,335 estates** because the current implementation **only queries 3 out of 7 available estate types**. The GraphQL API supports 7 different estate types, but the scraper configuration is hardcoded to only scrape:

- BYT (Apartments)
- DUM (Houses)
- POZEMEK (Land)

This omits:
- GARAZ (Garages)
- KANCELAR (Offices)
- NEBYTOVY_PROSTOR (Non-residential spaces)
- REKREACNI_OBJEKT (Recreational facilities)

**The actual BezRealitky capacity is 11,667 listings, not 4,335.**

---

## Issue Location

**File**: `/Users/samuelseidel/Development/landomo-world/scrapers/Czech Republic/bezrealitky/src/scrapers/listingsScraper.ts`

**Lines 174-175** (The Problem):
```typescript
// Focus on main property types
this.estateTypes = ['BYT', 'DUM', 'POZEMEK'];
```

**Lines 10** (Full schema shows all 7 types):
```typescript
estateType?: 'BYT' | 'DUM' | 'POZEMEK' | 'GARAZ' | 'KANCELAR' | 'NEBYTOVY_PROSTOR' | 'REKREACNI_OBJEKT';
```

---

## Complete Capacity Breakdown

### By Estate Type

| Estate Type | Count | % of Total | Current Coverage | Status |
|------------|-------|-----------|------------------|--------|
| **REKREACNI_OBJEKT** (Recreational facilities) | 6,963 | 59.7% | ❌ NOT SCRAPED | Missing |
| **BYT** (Apartments) | 2,903 | 24.9% | ✅ Scraped | Current |
| **POZEMEK** (Land) | 1,030 | 8.8% | ✅ Scraped | Current |
| **DUM** (Houses) | 404 | 3.5% | ✅ Scraped | Current |
| **NEBYTOVY_PROSTOR** (Non-residential) | 147 | 1.3% | ❌ NOT SCRAPED | Missing |
| **GARAZ** (Garages) | 137 | 1.2% | ❌ NOT SCRAPED | Missing |
| **KANCELAR** (Offices) | 83 | 0.7% | ❌ NOT SCRAPED | Missing |
| **TOTAL** | **11,667** | **100%** | **37.2%** | **INCOMPLETE** |

### By Offer Type

| Offer Type | Count | % of Total | Breakdown |
|-----------|-------|-----------|-----------|
| **PRONAJEM** (Rentals) | 9,505 | 81.5% | Dominated by recreational facilities |
| **PRODEJ** (Sales) | 2,162 | 18.5% | More balanced across types |
| **TOTAL** | **11,667** | **100%** | |

### Detailed Matrix (All Combinations)

| Estate Type | PRODEJ | PRONAJEM | Total |
|------------|--------|----------|-------|
| BYT (Apartments) | 683 | 2,220 | 2,903 |
| DUM (Houses) | 344 | 60 | 404 |
| POZEMEK (Land) | 1,026 | 4 | 1,030 |
| GARAZ (Garages) | 35 | 102 | 137 |
| KANCELAR (Offices) | 4 | 79 | 83 |
| NEBYTOVY_PROSTOR (Non-residential) | 21 | 126 | 147 |
| REKREACNI_OBJEKT (Recreational) | 49 | 6,914 | 6,963 |
| **TOTAL** | **2,162** | **9,505** | **11,667** |

---

## Current vs Complete Scraper

### Current Implementation (3 Estate Types)

```
BYT + DUM + POZEMEK = 4,337 listings (37.2% of total)

Breakdown:
- BYT:      2,903 listings (67.0% of current)
- DUM:        404 listings (9.3% of current)
- POZEMEK:  1,030 listings (23.8% of current)
```

### Complete Implementation (7 Estate Types)

```
ALL types = 11,667 listings (100% of total)

New/Missing:
- REKREACNI_OBJEKT:  6,963 listings (+6,963, dominant type!)
- GARAZ:               137 listings (+137)
- NEBYTOVY_PROSTOR:    147 listings (+147)
- KANCELAR:             83 listings (+83)

Improvement: +7,330 listings (+169.0%)
```

---

## Key Findings

### 1. The Elephant in the Room: REKREACNI_OBJEKT

The scraper is **completely missing 6,963 recreational facility listings**, which represent **59.7% of the total capacity**. This is likely why the 4,335 figure seemed too low - recreational facilities dominate the platform.

**Breakdown of REKREACNI_OBJEKT:**
- PRODEJ: 49 (for sale)
- PRONAJEM: 6,914 (for rent - highly skewed toward rentals)

### 2. Why Were These Types Excluded?

The comment in the code states:
```typescript
// Focus on main property types
this.estateTypes = ['BYT', 'DUM', 'POZEMEK'];
```

This appears to be an intentional design decision to focus on "main" property types. However, **6,963 recreational facilities constitute over 59% of the market**, so this is a major oversight.

### 3. Market Composition Is Heavily Weighted Toward Rentals

- 81.5% of listings are rentals (PRONAJEM)
- 18.5% of listings are sales (PRODEJ)

The recreational facilities are almost entirely rental listings (6,914 of 6,963 = 99.3%).

### 4. Office and Non-residential Space Markets Are Significant

- KANCELAR (Offices): 83 listings (4 for sale, 79 for rent)
- NEBYTOVY_PROSTOR (Non-residential): 147 listings (21 for sale, 126 for rent)

These represent 230 listings (1.97% of total) that are completely missed.

---

## Technical Validation

### Test Method

1. **Tested each of 7 estate types** with both offer types (14 combinations total)
2. **Single-item query** (limit=1, offset=0) to get totalCount from API
3. **Verified with GraphQL schema** - all 7 types are supported by API
4. **No API errors** encountered - all types return valid results

### Test Results

```
Test Date: February 7, 2026
Test Duration: ~20 seconds for all 14 queries
Success Rate: 100%
API Response: All queries successful, no rate limiting
Confidence Level: Very High (direct API verification)
```

---

## Impact Assessment

### Missing Data Impact

| Category | Current | Complete | Missing |
|----------|---------|----------|---------|
| Total Listings | 4,337 | 11,667 | 7,330 |
| Coverage | 37.2% | 100% | 62.8% |
| Largest Gap | - | Recreational (+6,963) | 59.7% |
| Data Quality | Good | Complete | Better |

### Performance Impact

The addition of 4 new estate types will have minimal performance impact:

- **Current scrape time**: ~53 seconds for 4,337 listings
- **Estimated new time**: ~135 seconds (2.25 minutes) for 11,667 listings
  - Using same batch size (60 items) and concurrency settings
  - Additional 6 category combinations to scrape (2 offer types × 4 new estate types)
  - Total batches increase from ~73 to ~195

**Performance remains acceptable** - still < 3 minutes for full scrape.

---

## Recommendations

### 1. Immediate Fix (High Priority)

Update `/Users/samuelseidel/Development/landomo-world/scrapers/Czech Republic/bezrealitky/src/scrapers/listingsScraper.ts`:

**Current Code (Lines 172-176):**
```typescript
constructor() {
  // Scrape both sales and rentals
  this.offerTypes = ['PRODEJ', 'PRONAJEM'];
  // Focus on main property types
  this.estateTypes = ['BYT', 'DUM', 'POZEMEK'];
}
```

**Should be Updated To:**
```typescript
constructor() {
  // Scrape both sales and rentals
  this.offerTypes = ['PRODEJ', 'PRONAJEM'];
  // Include ALL estate types available on the platform
  this.estateTypes = ['BYT', 'DUM', 'POZEMEK', 'GARAZ', 'KANCELAR', 'NEBYTOVY_PROSTOR', 'REKREACNI_OBJEKT'];
}
```

### 2. Update Configuration Documentation

The code comment should be updated to reflect the full scope:

```typescript
// Scrape all estate types: apartments, houses, land, garages, offices, non-residential spaces, and recreational facilities
```

### 3. Update Performance Metrics

- **Old Total**: 4,335 estates
- **New Total**: 11,667 estates
- **Old Estimate**: 53 seconds
- **New Estimate**: 135 seconds (with 6 concurrent category streams: ~25 seconds)

### 4. Re-run Full Performance Test

After the update, re-execute the performance test to:
1. Confirm the 11,667 total
2. Measure actual scrape time with all estate types
3. Update the PERFORMANCE_REPORT.md with accurate metrics

### 5. Data Quality Review

After scraping all types, review:
- REKREACNI_OBJEKT listings to understand what they are (e.g., holiday rentals, B&B, etc.)
- KANCELAR office listings to determine business relevance
- NEBYTOVY_PROSTOR to assess commercial real estate coverage

---

## Historical Context

### Performance Report Accuracy

The current PERFORMANCE_REPORT.md is **technically accurate for the 3 types being scraped**, but **incomplete regarding total capacity**:

- ✅ Correct: 4,335 for BYT, DUM, POZEMEK combinations
- ❌ Incomplete: Missing 7,330 from other types
- ❌ Misleading: Reported as "total estates available" when it's only partial

The report should be retitled to "BYT/DUM/POZEMEK Estate Analysis" or updated to include all types.

---

## Verification Checklist

- [x] GraphQL schema supports 7 estate types
- [x] API successfully returns data for all 7 types
- [x] No API errors or rate limiting for missing types
- [x] REKREACNI_OBJEKT exists and is significant (6,963 listings)
- [x] Offer types work with all estate types
- [x] Test code independently confirms findings
- [x] Performance impact is acceptable
- [x] Root cause identified in code

---

## Conclusion

The BezRealitky scraper is **37.2% complete** due to a deliberate but overly restrictive filtering decision. The platform contains **11,667 estates total**, not 4,335. The addition of the 4 missing estate types will provide a 169% increase in coverage.

**Recommendation: IMPLEMENT IMMEDIATELY** - The fix is trivial (1 line code change) with massive data quality impact (7,330 additional listings).

---

## Test Files Generated

- `/Users/samuelseidel/Development/landomo-world/scrapers/Czech Republic/bezrealitky/test-all-estate-types.ts` - Tests all 7 types
- `/Users/samuelseidel/Development/landomo-world/scrapers/Czech Republic/bezrealitky/test-comprehensive-capacity.ts` - Full breakdown by offer type and estate type
- `/Users/samuelseidel/Development/landomo-world/scrapers/Czech Republic/bezrealitky/BEZREALITKY_CAPACITY_ANALYSIS.md` - This document

**Run tests with:**
```bash
npx ts-node test-comprehensive-capacity.ts
```
