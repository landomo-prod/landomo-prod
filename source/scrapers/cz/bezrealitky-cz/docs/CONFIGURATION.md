# BezRealitky Configuration

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `8102` | Express server port |
| `ENABLE_CHECKSUM_MODE` | `false` | Set to `'true'` to enable checksum-based deduplication (80-90% ingestion reduction) |
| `INGEST_API_URL` | `http://cz-ingest:3000` | Ingest service base URL |
| `INGEST_API_KEY` | `dev_key_cz_1` | API key for ingest service authentication |
| `INGEST_API_KEY_BEZREALITKY` | (falls back to `INGEST_API_KEY`) | Portal-specific API key override |
| `MAX_RETRIES` | `3` | Maximum retry attempts for failed ingest API calls |
| `INITIAL_RETRY_DELAY` | `1000` | Initial retry delay in milliseconds (doubles each attempt) |
| `INGEST_TIMEOUT` | `60000` | Ingest API request timeout in milliseconds |

## Docker Configuration

**Dockerfile:** `Dockerfile` in scraper root
**Service name:** `cz-bezrealitky`
**Internal port:** 8102
**Network:** `cz-network`

## Scraping Parameters (Hardcoded)

| Parameter | Value | Location |
|---|---|---|
| Items per page | 60 | `listingsScraper.ts:226` |
| Concurrent pages | 20 | `listingsScraper.ts:227` |
| Inter-batch delay | 500ms | `listingsScraper.ts:291` |
| Inter-category delay | 500ms | `listingsScraper.ts:209` |
| GraphQL request timeout | 30,000ms | `listingsScraper.ts:329` |
| GraphQL API URL | `https://api.bezrealitky.cz/graphql/` | `listingsScraper.ts:7` |
| Locale | `CS` | `listingsScraper.ts:313` |
| Sort order | `TIMEORDER_DESC` | `listingsScraper.ts:310` |

## Offer Types Scraped

- `PRODEJ` (sale)
- `PRONAJEM` (rent)

## Estate Types Scraped

- `BYT` (apartments)
- `DUM` (houses)
- `POZEMEK` (land)
- `GARAZ` (garages)
- `KANCELAR` (offices)
- `NEBYTOVY_PROSTOR` (non-residential)
- `REKREACNI_OBJEKT` (recreational)
