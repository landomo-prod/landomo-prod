# Circuit Breaker

The scheduler implements a per-scraper circuit breaker pattern to prevent repeatedly triggering failing scrapers. Defined in `src/scraper-status.ts`.

## States

```
CLOSED (normal) --[consecutive failures >= threshold]--> OPEN (blocked)
OPEN --[reset timeout elapsed]--> HALF-OPEN (test one request)
HALF-OPEN --[success]--> CLOSED
HALF-OPEN --[failure]--> OPEN
```

In practice, the implementation uses a single `circuitBreakerOpen` boolean. When a trigger succeeds while the breaker is open (auto-reset period passed, allowing one attempt), the breaker closes.

## Configuration

| Setting | Default | Env Var |
|---------|---------|---------|
| Failure threshold | 5 consecutive failures | `SCHEDULER_CB_THRESHOLD` |
| Reset timeout | 1 hour (3600000ms) | `SCHEDULER_CB_RESET_MS` |
| Run timeout | 30 minutes (1800000ms) | `SCHEDULER_RUN_TIMEOUT_MS` |

## How It Works

### Opening the Circuit Breaker

Each scraper tracks its `consecutiveFailures` count. When a trigger fails (after all retries exhausted), the count increments. When it reaches the threshold (default 5), the circuit breaker opens:

```
Trigger fails -> consecutiveFailures++ -> if >= 5 -> circuitBreakerOpen = true
```

While open, all trigger attempts for that scraper are immediately skipped with reason: `circuit breaker open (N consecutive failures, opened at <timestamp>)`.

### Auto-Reset

On every `shouldSkip()` check, the scheduler checks whether `CIRCUIT_BREAKER_RESET_MS` has elapsed since the breaker opened. If so, the breaker resets:

- `circuitBreakerOpen = false`
- `circuitBreakerOpenedAt = null`
- `consecutiveFailures = 0`

This allows the next trigger attempt to proceed (half-open test).

### Closing on Success

If a trigger succeeds while the breaker was open (after auto-reset), it fully closes:

- `circuitBreakerOpen = false`
- `circuitBreakerOpenedAt = null`
- `consecutiveFailures = 0`

## Run Deduplication

The circuit breaker module also handles run deduplication via the `runInProgress` flag. If a scraper's previous run is still in progress, new triggers are skipped with reason: `previous run still in progress`.

### Stuck Run Detection

If `runInProgress` has been true for longer than `RUN_TIMEOUT_MS` (default 30 minutes), the run is automatically marked as no longer in progress. This prevents a stuck/crashed scraper from permanently blocking future triggers.

## ScraperStatus Fields

Each scraper tracks the following state:

| Field | Type | Description |
|-------|------|-------------|
| `lastSuccess` | `string \| null` | ISO timestamp of last successful trigger |
| `lastFailure` | `string \| null` | ISO timestamp of last failed trigger |
| `consecutiveFailures` | `number` | Count of failures since last success |
| `circuitBreakerOpen` | `boolean` | Whether the breaker is currently open |
| `circuitBreakerOpenedAt` | `string \| null` | ISO timestamp when breaker opened |
| `runInProgress` | `boolean` | Whether a trigger is currently in flight |
| `runStartedAt` | `string \| null` | ISO timestamp when current run started |
| `lastError` | `string \| null` | Error message from last failure |

State is held in memory (not persisted). A scheduler restart resets all circuit breakers.

## Monitoring

Circuit breaker status is visible via the HTTP API:

- `GET /api/v1/scheduler/status` -- shows `circuitBreakerOpen` and `consecutiveFailures` per scraper
- `GET /api/v1/scheduler/health` -- includes `recentFailures` (failures in last hour)
