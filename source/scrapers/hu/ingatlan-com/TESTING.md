# Quick Testing Guide - Ingatlan.com Scraper

## Prerequisites

```bash
cd /Users/samuelseidel/Development/landomo-world/scrapers/Hungary/ingatlan-com/
npm install
```

## 1. Unit Tests (Recommended)

Test all Hungarian value mappings and data transformations:

```bash
npx ts-node test-scraper.ts
```

**Expected Output**:
```
🧪 Starting Comprehensive Ingatlan.com Scraper Tests
======================================================================

📋 TEST 1: Disposition Normalizers
✅ normalizeDisposition: 1-szobás variants
✅ normalizeDisposition: 2-6 rooms
...

📊 Test Summary
Total Tests:  48
Passed:       48 ✅
Failed:       0 ❌
Success Rate: 100.0%

🎉 All tests passed!
```

## 2. Build Test

Verify TypeScript compilation:

```bash
npm run build
```

**Expected Output**:
```
> @landomo/scraper-ingatlan-com@1.0.0 build
> tsc

(No errors)
```

## 3. Server Test

### Start Server
```bash
# Default port 8086
npm start

# Custom port
PORT=8087 npm start
```

### Test Health Endpoint
```bash
curl http://localhost:8087/health
```

**Expected**:
```json
{
  "status": "healthy",
  "scraper": "ingatlan-com",
  "version": "1.0.0",
  "country": "Hungary",
  "timestamp": "2026-02-07T..."
}
```

### Test Scrape Endpoint (Dry Run)
```bash
curl -X POST http://localhost:8087/scrape \
  -H "Content-Type: application/json" \
  -d '{"maxRegions": 0, "maxPages": 1}'
```

**Expected**:
```json
{
  "status": "scraping started",
  "config": {
    "maxRegions": "all",
    "maxPages": 1,
    "mode": "web"
  },
  "timestamp": "2026-02-07T..."
}
```

## 4. Manual Testing with Mock Data

Create a test file `test-manual.ts`:

```typescript
import { transformIngatlanToStandard } from './src/transformers/ingatlanTransformer';
import { IngatlanListing } from './src/types/ingatlanTypes';

const mockListing: IngatlanListing = {
  id: 'test-123',
  title: '2-szobás lakás Budapest',
  price: 45000000,
  currency: 'HUF',
  location: 'Budapest, V. kerület',
  propertyType: 'lakás',
  transactionType: 'eladó',
  url: 'https://ingatlan.com/test',
  area: 65,
  rooms: 2,
  disposition: '2-szobás',
  condition: 'felújított',
  ownership: 'tulajdon',
  furnished: 'bútorozott'
};

const result = transformIngatlanToStandard(mockListing);
console.log(JSON.stringify(result, null, 2));
```

Run:
```bash
npx ts-node test-manual.ts
```

## 5. Test Individual Normalizers

```typescript
import {
  normalizeDisposition,
  normalizeOwnership,
  normalizeCondition
} from './src/shared/hungarian-value-mappings';

console.log(normalizeDisposition('3 szobás'));      // "3-szobás"
console.log(normalizeOwnership('tulajdon'));        // "tulajdon"
console.log(normalizeCondition('felújított'));      // "felújított"
```

## Test Checklist

Before deploying:

- [ ] Unit tests pass: `npx ts-node test-scraper.ts`
- [ ] Build succeeds: `npm run build`
- [ ] Server starts: `npm start`
- [ ] Health endpoint responds: `curl localhost:8087/health`
- [ ] Scrape endpoint responds: `curl -X POST localhost:8087/scrape ...`
- [ ] No TypeScript errors
- [ ] All dependencies installed

## Common Issues

### Port Already in Use
```bash
# Find process on port 8087
lsof -ti:8087

# Kill process
kill $(lsof -ti:8087)
```

### Module Not Found
```bash
# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

### Build Errors
```bash
# Clean and rebuild
npm run clean
npm run build
```

## Performance Benchmarks

- **Unit tests**: < 1 second
- **Build time**: < 2 seconds
- **Server startup**: < 1 second
- **Health check response**: < 50ms

## Test Coverage

- ✅ Disposition normalizers: 7 tests
- ✅ Ownership normalizers: 5 tests
- ✅ Condition normalizers: 9 tests
- ✅ Furnished normalizers: 3 tests
- ✅ Heating normalizers: 7 tests
- ✅ Energy rating normalizers: 3 tests
- ✅ Construction normalizers: 4 tests
- ✅ Data transformation: 3 tests
- ✅ Edge cases: 4 tests
- ✅ Validation helpers: 3 tests

**Total**: 48 tests, 100% pass rate
