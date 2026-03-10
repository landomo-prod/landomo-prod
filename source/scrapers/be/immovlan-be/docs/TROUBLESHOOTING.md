# Troubleshooting

> Common issues and their solutions for the Immovlan scraper

## Connection Issues

### Redis Connection Failed

```bash
REDIS_HOST=redis  # Use service name in Docker
redis-cli ping    # Verify locally
```

### Ingest API Connection Failed

```bash
curl -H "Authorization: Bearer $INGEST_API_KEY" http://localhost:3004/health
```

## Performance Issues

### Slow Scraping

**Diagnosis:**
```bash
curl http://localhost:8212/health | jq '.queue'
```

**Causes:**
1. Anti-bot blocking search pages (check logs for errors)
2. Low worker count: increase `WORKER_CONCURRENCY`
3. HTML fallback mode (only gets IDs, needs more detail fetches)

## Data Quality Issues

### Missing Details from HTML Fallback

If `__NEXT_DATA__` extraction fails and the scraper falls back to `data-property-id` HTML parsing, listings will only have an ID. All other fields require a detail page fetch.

**Solution:** Check if the `__NEXT_DATA__` script tag structure has changed on the Immovlan website.

## Rate Limiting

Immovlan has moderate rate limiting. The scraper uses:
- 500-1500ms delay between page fetches
- 1500ms delay between page batches

If encountering errors, reduce `WORKER_CONCURRENCY` and increase delays.

## Diagnostic Commands

```bash
docker logs -f be-immovlan
curl http://localhost:8212/health | jq
redis-cli LLEN bull:immovlan-details:wait
redis-cli LLEN bull:immovlan-details:failed
```
