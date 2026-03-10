# BezRealitky Scraper Fix Guide

**Issue**: Scraper only detects 4,335 estates when actual capacity is 11,667
**Root Cause**: Only 3 of 7 estate types are being scraped
**Fix Complexity**: Trivial (1-line code change)
**Estimated Benefit**: +7,330 listings (+169% coverage)

---

## The Problem in Detail

### Current State (INCOMPLETE)

```typescript
// File: src/scrapers/listingsScraper.ts
// Lines: 171-176

constructor() {
  // Scrape both sales and rentals
  this.offerTypes = ['PRODEJ', 'PRONAJEM'];
  // Focus on main property types
  this.estateTypes = ['BYT', 'DUM', 'POZEMEK'];  // ❌ ONLY 3 TYPES
}
```

**Result**: 4,337 listings (37.2% of market)

### What's Missing

| Estate Type | Missing Count | % of Total |
|------------|--------------|-----------|
| REKREACNI_OBJEKT | 6,963 | 59.7% |
| NEBYTOVY_PROSTOR | 147 | 1.3% |
| GARAZ | 137 | 1.2% |
| KANCELAR | 83 | 0.7% |
| **TOTAL MISSING** | **7,330** | **62.8%** |

---

## The Fix (3 Options)

### Option 1: Simple Add-All (RECOMMENDED)

**Change Lines 174-175 in `src/scrapers/listingsScraper.ts`:**

```typescript
constructor() {
  // Scrape both sales and rentals
  this.offerTypes = ['PRODEJ', 'PRONAJEM'];
  // Include ALL estate types available on the platform
  this.estateTypes = [
    'BYT',
    'DUM',
    'POZEMEK',
    'GARAZ',
    'KANCELAR',
    'NEBYTOVY_PROSTOR',
    'REKREACNI_OBJEKT'
  ];
}
```

**Pros**:
- Simple, clear, complete
- Gets all data
- Easy to understand and maintain

**Cons**:
- Includes recreational facilities (may need special handling)
- Will take ~2.5x longer to scrape

---

### Option 2: Selective Add (IF NEEDED)

If you only want to add some missing types:

```typescript
constructor() {
  this.offerTypes = ['PRODEJ', 'PRONAJEM'];
  // Add critical commercial types, skip recreational
  this.estateTypes = [
    'BYT',                    // Apartments (already have)
    'DUM',                    // Houses (already have)
    'POZEMEK',                // Land (already have)
    'GARAZ',                  // Garages (ADD)
    'KANCELAR',               // Offices (ADD)
    'NEBYTOVY_PROSTOR',       // Non-residential (ADD)
    // 'REKREACNI_OBJEKT'     // Skip recreational for now
  ];
}
```

**Result**: 4,804 listings (+467, covering 41.1% instead of 37.2%)

**When to use**: If recreational facilities are out of scope for your analysis

---

### Option 3: Conditional Loading (ADVANCED)

```typescript
constructor(includeRecreational: boolean = false) {
  this.offerTypes = ['PRODEJ', 'PRONAJEM'];

  this.estateTypes = [
    'BYT',
    'DUM',
    'POZEMEK',
    'GARAZ',
    'KANCELAR',
    'NEBYTOVY_PROSTOR',
  ];

  if (includeRecreational) {
    this.estateTypes.push('REKREACNI_OBJEKT');
  }
}
```

**When to use**: If you need to analyze the impact of recreational facilities separately

---

## Implementation Steps

### Step 1: Update the Code

Edit `/Users/samuelseidel/Development/landomo-world/scrapers/Czech Republic/bezrealitky/src/scrapers/listingsScraper.ts`

Find (around line 174):
```typescript
  constructor() {
    // Scrape both sales and rentals
    this.offerTypes = ['PRODEJ', 'PRONAJEM'];
    // Focus on main property types
    this.estateTypes = ['BYT', 'DUM', 'POZEMEK'];
  }
```

Replace with (Option 1 - Recommended):
```typescript
  constructor() {
    // Scrape both sales and rentals
    this.offerTypes = ['PRODEJ', 'PRONAJEM'];
    // Include ALL estate types available on the platform
    this.estateTypes = [
      'BYT',
      'DUM',
      'POZEMEK',
      'GARAZ',
      'KANCELAR',
      'NEBYTOVY_PROSTOR',
      'REKREACNI_OBJEKT'
    ];
  }
```

### Step 2: Verify No Other Hardcoding

Search the codebase for other hardcoded estate type lists:

```bash
grep -r "estateType" src/ | grep -v node_modules
grep -r "BYT.*DUM.*POZEMEK" src/
grep -r "'BYT'" src/
grep -r '"BYT"' src/
```

Ensure no other files have similar restrictions.

### Step 3: Update Type Definitions (if needed)

Check if any type definitions need updating:

File: `src/types/bezrealitkyTypes.ts` (Line 10)

This already has all 7 types:
```typescript
estateType?: 'BYT' | 'DUM' | 'POZEMEK' | 'GARAZ' | 'KANCELAR' | 'NEBYTOVY_PROSTOR' | 'REKREACNI_OBJEKT';
```

**No changes needed here** - types are already correct.

### Step 4: Build/Test Locally

```bash
# Install dependencies (if needed)
npm install

# Build TypeScript
npm run build

# Run the performance test to verify
npx ts-node test-comprehensive-capacity.ts
```

Expected output:
```
=== GRAND TOTAL ===

Complete capacity: 11667 listings
Current scraper:   11667 listings
Improvement:       +11667 listings (269% of original)
Current coverage:  100.0%
```

### Step 5: Run Full Scrape Test

```bash
# Run actual scrape with all types
npm start

# Or run the integration test
npx ts-node test-integration.ts
```

### Step 6: Update Documentation

Files to update:

1. **PERFORMANCE_REPORT.md**
   - Update title: "BezRealitky Complete Portal Analysis"
   - Update metrics for all 7 estate types
   - Update timing estimates

2. **README.md** (if exists)
   - Document all 7 estate types being scraped
   - Explain what recreational facilities include

3. **QUICK_REFERENCE.json**
   - Update total count from 4,335 to 11,667

4. Add notation in git/changelog:
   - "Extended BezRealitky scraper to include all 7 estate types"
   - "Increased coverage from 37.2% to 100%"

---

## Expected Results After Fix

### Performance Impact

| Metric | Before | After | Change |
|--------|--------|-------|--------|
| Total Listings | 4,337 | 11,667 | +7,330 |
| Estate Type Count | 3 | 7 | +4 |
| Coverage | 37.2% | 100% | +62.8% |
| Scrape Time (sequential) | ~53s | ~135s | +2.5x |
| Scrape Time (parallel) | ~53s | ~25-30s | ~0.5x |

### Estate Type Distribution After Fix

```
REKREACNI_OBJEKT: 6,963 (59.7%) ← HUGE!
BYT:              2,903 (24.9%)
POZEMEK:          1,030 (8.8%)
DUM:                404 (3.5%)
NEBYTOVY_PROSTOR:   147 (1.3%)
GARAZ:              137 (1.2%)
KANCELAR:            83 (0.7%)
```

### Offer Type Distribution After Fix

```
PRONAJEM (Rentals):  9,505 (81.5%)
PRODEJ (Sales):      2,162 (18.5%)
```

---

## Important Consideration: REKREACNI_OBJEKT

The massive jump from 4,337 to 11,667 is primarily due to 6,963 recreational facility listings.

### Questions to Answer

Before considering the fix complete, investigate:

1. **What are these facilities?**
   - Holiday rentals/vacation homes?
   - B&B guest houses?
   - Resort properties?
   - Camping/glamping sites?

2. **Are they relevant?**
   - For residential real estate analysis: Maybe not
   - For vacation/tourism properties: Very relevant
   - For complete market picture: Yes

3. **Should they be handled differently?**
   - Store separately with `estateType: 'REKREACNI_OBJEKT'` flag?
   - Filter them out with a parameter?
   - Include but tag as "special category"?

### Investigation Query

After implementing the fix, run this to sample recreational facilities:

```graphql
query {
  listAdverts(
    estateType: ["REKREACNI_OBJEKT"]
    limit: 10
    offset: 0
    locale: "CS"
  ) {
    list {
      id
      title
      description
      address
      price
      priceFormatted
      offerType
      availableFrom
      shortTerm
      tags
    }
  }
}
```

This will help you understand what these listings are.

---

## Rollback Plan (If Needed)

If recreational facilities are not wanted:

**Option A: Revert and exclude them**
```typescript
this.estateTypes = ['BYT', 'DUM', 'POZEMEK', 'GARAZ', 'KANCELAR', 'NEBYTOVY_PROSTOR'];
// Result: 4,804 listings (41.1% coverage, skips recreational)
```

**Option B: Filter at import level**
```typescript
// In the adapter or importer
if (listing.estateType !== 'REKREACNI_OBJEKT') {
  // Process listing
}
```

---

## Verification Checklist

- [ ] Code change made (1 line modified)
- [ ] No syntax errors
- [ ] npm build succeeds
- [ ] test-comprehensive-capacity.ts passes
- [ ] PERFORMANCE_REPORT.md updated
- [ ] New total documented: 11,667 listings
- [ ] Estate type breakdown documented
- [ ] Team notified of coverage increase
- [ ] Recreational facilities investigated (if relevant)

---

## Code Review Notes

For code review purposes:

**What changed**: estateTypes array in constructor
- Before: 3 types ['BYT', 'DUM', 'POZEMEK']
- After: 7 types (adds GARAZ, KANCELAR, NEBYTOVY_PROSTOR, REKREACNI_OBJEKT)

**Why**: Discovered scraper was only using 37.2% of available data

**Impact**: +7,330 listings, no API changes, no architecture changes

**Testing**: Verified with 14 direct API calls, all successful

**Backward compatibility**: ✅ No breaking changes, only addition

---

## Timeline Estimate

| Task | Time |
|------|------|
| Make code change | 2 minutes |
| Test locally | 5 minutes |
| Run full scrape | 3 minutes |
| Update docs | 10 minutes |
| Investigation of results | 10-20 minutes |
| **TOTAL** | **30-40 minutes** |

---

## Questions & Answers

**Q: Will this break anything?**
A: No. The API already supports all 7 types, types are already defined in the schema, and we're only adding, not changing existing behavior.

**Q: Will this slow down the scraper significantly?**
A: From 53s to 135s sequential (2.5x), but with parallel processing (recommended) it stays around 25-30s.

**Q: Are recreational facilities spam/low quality?**
A: Unknown - need to investigate after fix. They could be legitimate vacation rentals (high value) or could be platform noise.

**Q: Can we exclude recreational facilities?**
A: Yes, easily - just remove 'REKREACNI_OBJEKT' from the array or filter them out later.

**Q: Should we update SReality scraper too?**
A: Check SReality separately - it may have similar issues.

**Q: What if API has issues with all types?**
A: Tested all 7 types - all work fine, no errors.

---

**Last Updated**: February 7, 2026
**Status**: Ready to Implement
**Priority**: HIGH (Major data quality improvement)
