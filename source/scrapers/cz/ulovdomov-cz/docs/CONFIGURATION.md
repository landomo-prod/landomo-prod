# UlovDomov Configuration

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `8102` | Express server port |
| `INGEST_API_URL` | `http://cz-ingest:3000` | Ingest service base URL |
| `INGEST_API_KEY` | `dev_key_cz_1` | API key for ingest service authentication |
| `INGEST_API_KEY_ULOVDOMOV` | (falls back to `INGEST_API_KEY`) | Portal-specific API key override |

## Docker Configuration

**Dockerfile:** `Dockerfile` in scraper root
**Service name:** `cz-ulovdomov`
**Internal port:** 8102
**Network:** `cz-network`

## Scraping Parameters (Hardcoded)

| Parameter | Value | Location |
|---|---|---|
| Items per page | 100 | `listingsScraper.ts:101` |
| Inter-page delay | 300ms | `listingsScraper.ts:130` |
| Request timeout | 30,000ms | `listingsScraper.ts:23` |
| Sorting | `latest` | `listingsScraper.ts:70` |
| Checksum batch size | 5,000 | `threePhaseOrchestrator.ts:9` |
| Ingest batch size | 50 | `threePhaseOrchestrator.ts:10` |
| API base URL | `https://ud.api.ulovdomov.cz/v1` | `listingsScraper.ts:18` |

## CZ Bounding Box (Required in all requests)

```json
{
  "northEast": { "lat": 51.06, "lng": 18.87 },
  "southWest": { "lat": 48.55, "lng": 12.09 }
}
```

## Offer Types Scraped

- `sale`
- `rent`
- `coliving`

## Property Types Returned by API

- `flat` (apartments)
- `house` (houses)
- `room` (rooms, treated as apartments)
- `land` (land plots)
- `commercial` (commercial properties)

## Notes

- Unlike BezRealitky, there is no `ENABLE_CHECKSUM_MODE` toggle -- checksum mode is always active
- The three-phase orchestrator is the only scraping mode
- No user agent rotation (single hardcoded User-Agent)
- No retry logic in the ingest adapter (simpler implementation)
