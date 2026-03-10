# Troubleshooting

> Common issues and their solutions for the ATHome.lu scraper

## API Issues

### ATHome API Returns Empty Data

**Symptom**: Phase 1 completes with 0 listings for a category

**Cause**: Wrong `propertyType` parameter value or API change

**Solution**:

1. Test the API directly:
```bash
curl -s 'https://apigw.prd.athomegroup.lu/api-listings/listings?transactionType=for-sale&propertyType=flat&page=1&pageSize=3' | jq '.data | length'
# Expected: 3
```

2. Verify property type values:
```
flat    = apartments
house   = houses
land    = land/plots
office  = commercial/offices
```

3. Check if API endpoint has changed:
```bash
curl -s -o /dev/null -w "%{http_code}" 'https://apigw.prd.athomegroup.lu/api-listings/listings'
# Expected: 200
```

### API Rate Limiting

**Symptom**: 429 responses or connection timeouts during discovery

**Cause**: Too many concurrent requests to ATHome API

**Solution**:

1. The scraper uses pLimit(3) for discovery and 100-400ms delays for detail fetches
2. If still rate limited, reduce worker concurrency:
```bash
WORKER_CONCURRENCY=20
```

3. Check for 429 errors in logs:
```bash
docker logs lu-athome | grep "429"
```

### API Response Structure Changed

**Symptom**: TypeScript errors or null values in transformed data

**Cause**: ATHome API updated their response format

**Solution**:

1. Fetch a sample listing and inspect:
```bash
curl -s 'https://apigw.prd.athomegroup.lu/api-listings/listings?propertyType=flat&transactionType=for-sale&pageSize=1' | jq '.data[0]'
```

2. Compare with `src/types/rawTypes.ts` interfaces
3. Update interfaces and transformers to match new structure

## Connection Issues

### Redis Connection Failed

**Symptom**: `Error: connect ECONNREFUSED 127.0.0.1:6379`

**Solution**:

1. Check Redis is running:
```bash
redis-cli ping  # Expected: PONG
```

2. In Docker, use service name:
```bash
REDIS_HOST=redis-lu  # NOT localhost
```

### Ingest API Connection Failed

**Symptom**: `AxiosError: Request failed with status code 401`

**Solution**:

1. Check ingest service health:
```bash
curl http://localhost:3018/api/v1/health
```

2. Verify API key matches ingest service configuration

## Data Quality Issues

### Missing Coordinates

**Symptom**: `location.coordinates` is undefined

**Cause**: Some listings don't have `address.pin` in the API response

**Solution**: This is expected for some listings where the agency hasn't provided exact coordinates. The transformer correctly handles this with optional chaining.

### Price Shows 0

**Symptom**: `price: 0` for valid listings

**Cause**: Price range listings where `prices.min` and `prices.max` are both null

**Solution**: Check if the listing is a "price on request" type:
```bash
curl -s 'https://apigw.prd.athomegroup.lu/api-listings/listings/{id}' | jq '.prices'
```

### New Build Projects Not Expanding

**Symptom**: Single listing instead of multiple units for a new build project

**Cause**: The `children` array handling in `fetchAllListingPages`

**Solution**: Check if the listing has children:
```bash
curl -s 'https://apigw.prd.athomegroup.lu/api-listings/listings?propertyType=flat&transactionType=for-sale&pageSize=5' | jq '.data[] | select(.children != null) | {id, availableUnits, childCount: (.children | length)}'
```

## Queue Issues

### Jobs Stuck in Active State

**Symptom**: Jobs show active but never complete

**Solution**:

1. Check queue stats:
```bash
curl http://localhost:8230/health | jq '.queue'
```

2. Restart the scraper:
```bash
docker restart lu-athome
```

### Queue Not Draining

**Symptom**: Waiting count stays high

**Solution**:

1. Verify workers are running:
```bash
curl http://localhost:8230/health | jq '.workers'
# Expected: 50
```

2. Check for repeated failures:
```bash
docker logs lu-athome | grep "Job failed"
```

## Test Results Summary

- ATHome API confirmed working: HTTP 200, returns rich JSON data
- No authentication required
- TypeScript compilation: 0 errors (after initial fixes)
- Key fixes applied: `pin.lng` -> `pin.lon`, `zip_code` -> `postal_code`, `latitude/longitude` -> `coordinates: { lat, lon }`

## Diagnostic Commands

```bash
# Real-time logs
docker logs -f lu-athome

# Check queue state
curl http://localhost:8230/health | jq

# Test API directly
curl -s 'https://apigw.prd.athomegroup.lu/api-listings/listings?propertyType=flat&transactionType=for-sale&pageSize=1' | jq

# Trigger scrape
curl -X POST http://localhost:8230/scrape

# Check DB results
docker exec landomo-lu-postgres psql -U landomo -d landomo_lu -c \
  "SELECT property_category, COUNT(*) FROM properties_new GROUP BY property_category;"
```
