# Scheduler Configuration

All configuration is via environment variables. Every setting has a sensible default.

## Core Settings

| Variable | Default | Description |
|----------|---------|-------------|
| `ENABLE_HTTP_TRIGGERS` | `false` | Enable HTTP API for manual triggers and status |
| `SCHEDULER_PORT` | `9000` | HTTP server port (when HTTP triggers enabled) |
| `HEALTH_CHECK_TIMEOUT` | `5000` | Timeout (ms) for pre-trigger scraper health check |
| `LOG_LEVEL` | `info` | Pino log level: trace, debug, info, warn, error, fatal |

## Retry Settings

| Variable | Default | Description |
|----------|---------|-------------|
| `SCHEDULER_MAX_RETRIES` | `3` | Max retry attempts per trigger |
| `SCHEDULER_INITIAL_DELAY_MS` | `5000` | Initial backoff delay in ms |
| `SCHEDULER_MAX_DELAY_MS` | `60000` | Maximum backoff delay in ms |

## Circuit Breaker Settings

| Variable | Default | Description |
|----------|---------|-------------|
| `SCHEDULER_CB_THRESHOLD` | `5` | Consecutive failures before opening circuit breaker |
| `SCHEDULER_CB_RESET_MS` | `3600000` (1h) | Time before circuit breaker auto-resets |
| `SCHEDULER_RUN_TIMEOUT_MS` | `1800000` (30m) | Time before a stuck run is auto-cleared |

## Concurrency Settings

| Variable | Default | Description |
|----------|---------|-------------|
| `MAX_CONCURRENT_SCRAPERS` | `10` | Maximum scrapers running simultaneously (global) |
| `PER_COUNTRY_CONCURRENT_LIMIT` | `3` | Maximum scrapers per country running simultaneously |

## Backpressure Settings

| Variable | Default | Description |
|----------|---------|-------------|
| `QUEUE_DEPTH_THRESHOLD` | `5000` | BullMQ queue depth that triggers backpressure |
| `REDIS_HOST` | `localhost` | Redis host for queue monitoring |
| `REDIS_PORT` | `6379` | Redis port for queue monitoring |
| `REDIS_PASSWORD` | (none) | Redis password for queue monitoring |

## Per-Scraper Overrides

Each scraper's URL, schedule, and enabled state can be overridden. Pattern: `{SCRAPER_NAME}_{SETTING}`.

### Czech Republic

| Variable | Default |
|----------|---------|
| `SREALITY_URL` | `http://scraper-sreality:8102/scrape` |
| `SREALITY_SCHEDULE` | `0 */3 * * *` |
| `SREALITY_ENABLED` | `true` (set to `false` to disable) |
| `BEZREALITKY_URL` | `http://scraper-bezrealitky:8103/scrape` |
| `BEZREALITKY_SCHEDULE` | `10 */3 * * *` |
| `BEZREALITKY_ENABLED` | `true` |
| `REALITY_URL` | `http://scraper-reality:8104/scrape` |
| `REALITY_SCHEDULE` | `20 */4 * * *` |
| `REALITY_ENABLED` | `true` |
| `IDNES_REALITY_URL` | `http://scraper-idnes-reality:8105/scrape` |
| `IDNES_REALITY_SCHEDULE` | `30 */4 * * *` |
| `IDNES_REALITY_ENABLED` | `true` |
| `REALINGO_URL` | `http://scraper-realingo:8106/scrape` |
| `REALINGO_SCHEDULE` | `40 */4 * * *` |
| `REALINGO_ENABLED` | `true` |
| `ULOVDOMOV_URL` | `http://scraper-ulovdomov:8107/scrape` |
| `ULOVDOMOV_SCHEDULE` | `50 */4 * * *` |
| `ULOVDOMOV_ENABLED` | `true` |

### Germany

| Variable | Default |
|----------|---------|
| `IMMOBILIENSCOUT24_DE_URL` | `http://scraper-immobilienscout24-de:8092/scrape` |
| `IMMOBILIENSCOUT24_DE_SCHEDULE` | `0 */3 * * *` |
| `IMMOBILIENSCOUT24_DE_ENABLED` | `true` |
| `IMMONET_DE_URL` | `http://scraper-immonet-de:8093/scrape` |
| `IMMONET_DE_SCHEDULE` | `12 */3 * * *` |
| `IMMONET_DE_ENABLED` | `true` |
| `IMMOWELT_DE_URL` | `http://scraper-immowelt-de:8094/scrape` |
| `IMMOWELT_DE_SCHEDULE` | `24 */3 * * *` |
| `IMMOWELT_DE_ENABLED` | `true` |
| `KLEINANZEIGEN_DE_URL` | `http://scraper-kleinanzeigen-de:8095/scrape` |
| `KLEINANZEIGEN_DE_SCHEDULE` | `36 */4 * * *` |
| `KLEINANZEIGEN_DE_ENABLED` | `true` |
| `WG_GESUCHT_DE_URL` | `http://scraper-wg-gesucht-de:8096/scrape` |
| `WG_GESUCHT_DE_SCHEDULE` | `48 */4 * * *` |
| `WG_GESUCHT_DE_ENABLED` | `true` |

### Austria

| Variable | Default |
|----------|---------|
| `WILLHABEN_AT_URL` | `http://scraper-willhaben-at:8097/scrape` |
| `WILLHABEN_AT_SCHEDULE` | `5 */3 * * *` |
| `WILLHABEN_AT_ENABLED` | `true` |
| `IMMOBILIENSCOUT24_AT_URL` | `http://scraper-immobilienscout24-at:8098/scrape` |
| `IMMOBILIENSCOUT24_AT_SCHEDULE` | `15 */3 * * *` |
| `IMMOBILIENSCOUT24_AT_ENABLED` | `true` |
| `WOHNNET_AT_URL` | `http://scraper-wohnnet-at:8099/scrape` |
| `WOHNNET_AT_SCHEDULE` | `25 */4 * * *` |
| `WOHNNET_AT_ENABLED` | `true` |
| `IMMOWELT_AT_URL` | `http://scraper-immowelt-at:8100/scrape` |
| `IMMOWELT_AT_SCHEDULE` | `35 */4 * * *` |
| `IMMOWELT_AT_ENABLED` | `true` |
| `IMMODIREKT_AT_URL` | `http://scraper-immodirekt-at:8101/scrape` |
| `IMMODIREKT_AT_SCHEDULE` | `45 */4 * * *` |
| `IMMODIREKT_AT_ENABLED` | `true` |

### Slovakia

| Variable | Default |
|----------|---------|
| `NEHNUTELNOSTI_SK_URL` | `http://scraper-nehnutelnosti-sk:8082/scrape` |
| `NEHNUTELNOSTI_SK_SCHEDULE` | `2 */3 * * *` |
| `NEHNUTELNOSTI_SK_ENABLED` | `true` |
| `REALITY_SK_URL` | `http://scraper-reality-sk:8084/scrape` |
| `REALITY_SK_SCHEDULE` | `17 */4 * * *` |
| `REALITY_SK_ENABLED` | `true` |
| `TOPREALITY_SK_URL` | `http://scraper-topreality-sk:8085/scrape` |
| `TOPREALITY_SK_SCHEDULE` | `32 */4 * * *` |
| `TOPREALITY_SK_ENABLED` | `true` |
| `BYTY_SK_URL` | `http://scraper-byty-sk:8086/scrape` |
| `BYTY_SK_SCHEDULE` | `47 */4 * * *` |
| `BYTY_SK_ENABLED` | `true` |

### Hungary

| Variable | Default |
|----------|---------|
| `INGATLAN_COM_URL` | `http://scraper-ingatlan-com:8087/scrape` |
| `INGATLAN_COM_SCHEDULE` | `7 */3 * * *` |
| `INGATLAN_COM_ENABLED` | `true` |
| `OC_HU_URL` | `http://scraper-oc-hu:8088/scrape` |
| `OC_HU_SCHEDULE` | `22 */4 * * *` |
| `OC_HU_ENABLED` | `true` |
| `DH_HU_URL` | `http://scraper-dh-hu:8089/scrape` |
| `DH_HU_SCHEDULE` | `37 */4 * * *` |
| `DH_HU_ENABLED` | `true` |
| `ZENGA_HU_URL` | `http://scraper-zenga-hu:8090/scrape` |
| `ZENGA_HU_SCHEDULE` | `52 */4 * * *` |
| `ZENGA_HU_ENABLED` | `true` |
| `INGATLANNET_HU_URL` | `http://scraper-ingatlannet-hu:8091/scrape` |
| `INGATLANNET_HU_SCHEDULE` | `57 */4 * * *` |
| `INGATLANNET_HU_ENABLED` | `true` |
