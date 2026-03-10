# Scheduler Jobs

The scheduler uses `node-cron` to trigger scraper containers via HTTP POST. Each scraper has a configurable cron schedule with staggered offsets to prevent thundering herd.

## Scraper Trigger Jobs

Each job sends `POST {scraper_url}/scrape` with a correlation ID header.

### Czech Republic (6 portals)

| Scraper | Default Schedule | Default URL | Port |
|---------|-----------------|-------------|------|
| sreality | `0 */3 * * *` (every 3h) | `http://scraper-sreality:8102/scrape` | 8102 |
| bezrealitky | `10 */3 * * *` (every 3h, +10m) | `http://scraper-bezrealitky:8103/scrape` | 8103 |
| reality | `20 */4 * * *` (every 4h, +20m) | `http://scraper-reality:8104/scrape` | 8104 |
| idnes-reality | `30 */4 * * *` (every 4h, +30m) | `http://scraper-idnes-reality:8105/scrape` | 8105 |
| realingo | `40 */4 * * *` (every 4h, +40m) | `http://scraper-realingo:8106/scrape` | 8106 |
| ulovdomov | `50 */4 * * *` (every 4h, +50m) | `http://scraper-ulovdomov:8107/scrape` | 8107 |

### Germany (5 portals)

| Scraper | Default Schedule | Default URL | Port |
|---------|-----------------|-------------|------|
| immobilienscout24-de | `0 */3 * * *` | `http://scraper-immobilienscout24-de:8092/scrape` | 8092 |
| immonet-de | `12 */3 * * *` | `http://scraper-immonet-de:8093/scrape` | 8093 |
| immowelt-de | `24 */3 * * *` | `http://scraper-immowelt-de:8094/scrape` | 8094 |
| kleinanzeigen-de | `36 */4 * * *` | `http://scraper-kleinanzeigen-de:8095/scrape` | 8095 |
| wg-gesucht-de | `48 */4 * * *` | `http://scraper-wg-gesucht-de:8096/scrape` | 8096 |

### Austria (5 portals)

| Scraper | Default Schedule | Default URL | Port |
|---------|-----------------|-------------|------|
| willhaben-at | `5 */3 * * *` | `http://scraper-willhaben-at:8097/scrape` | 8097 |
| immobilienscout24-at | `15 */3 * * *` | `http://scraper-immobilienscout24-at:8098/scrape` | 8098 |
| wohnnet-at | `25 */4 * * *` | `http://scraper-wohnnet-at:8099/scrape` | 8099 |
| immowelt-at | `35 */4 * * *` | `http://scraper-immowelt-at:8100/scrape` | 8100 |
| immodirekt-at | `45 */4 * * *` | `http://scraper-immodirekt-at:8101/scrape` | 8101 |

### Slovakia (4 portals)

| Scraper | Default Schedule | Default URL | Port |
|---------|-----------------|-------------|------|
| nehnutelnosti-sk | `2 */3 * * *` | `http://scraper-nehnutelnosti-sk:8082/scrape` | 8082 |
| reality-sk | `17 */4 * * *` | `http://scraper-reality-sk:8084/scrape` | 8084 |
| topreality-sk | `32 */4 * * *` | `http://scraper-topreality-sk:8085/scrape` | 8085 |
| byty-sk | `47 */4 * * *` | `http://scraper-byty-sk:8086/scrape` | 8086 |

### Hungary (5 portals)

| Scraper | Default Schedule | Default URL | Port |
|---------|-----------------|-------------|------|
| ingatlan-com | `7 */3 * * *` | `http://scraper-ingatlan-com:8087/scrape` | 8087 |
| oc-hu | `22 */4 * * *` | `http://scraper-oc-hu:8088/scrape` | 8088 |
| dh-hu | `37 */4 * * *` | `http://scraper-dh-hu:8089/scrape` | 8089 |
| zenga-hu | `52 */4 * * *` | `http://scraper-zenga-hu:8090/scrape` | 8090 |
| ingatlannet-hu | `57 */4 * * *` | `http://scraper-ingatlannet-hu:8091/scrape` | 8091 |

## Trigger Lifecycle

For each cron tick or manual trigger:

1. **Shutdown check** -- skip if scheduler is shutting down
2. **Dedup + circuit breaker** (`shouldSkip`) -- skip if run in progress or circuit breaker open
3. **Backpressure check** -- skip if BullMQ queue depth >= threshold (fail-open if Redis unreachable)
4. **Health check** -- `GET /health` on scraper (fail-open: proceeds if health check errors)
5. **Acquire concurrency slot** -- waits if global or per-country limit reached
6. **Mark run started** -- sets `runInProgress = true`
7. **POST /scrape** with retry (exponential backoff, up to 3 retries)
8. **Mark success or failure** -- updates consecutive failure count, opens circuit breaker if threshold reached
9. **Release concurrency slot** -- unblocks waiting triggers

## Retry Configuration

Retries use exponential backoff with jitter. Only retryable errors are retried:

| Error Type | Retryable |
|-----------|-----------|
| Network errors (no response) | Yes |
| 5xx server errors | Yes |
| 408 Request Timeout | Yes |
| 429 Too Many Requests | Yes |
| Other 4xx client errors | No |

Default retry settings (from `src/retry.ts`):

| Setting | Default | Env Var |
|---------|---------|---------|
| Max retries | 3 | `SCHEDULER_MAX_RETRIES` |
| Initial delay | 5000ms | `SCHEDULER_INITIAL_DELAY_MS` |
| Max delay | 60000ms | `SCHEDULER_MAX_DELAY_MS` |
| Jitter | 0.2 (20%) | N/A |

**Backoff formula:** `min(initialDelay * 2^attempt, maxDelay) +/- jitter%`

## Data Payload

The trigger sends an empty JSON body `{}` with headers:

```
Content-Type: application/json
X-Request-ID: <uuid>  (correlation ID for tracing)
```

The scraper container handles the actual scraping logic and sends results to the ingest API independently.
