export interface ScraperStatus {
  lastSuccess: string | null;
  lastFailure: string | null;
  consecutiveFailures: number;
  circuitBreakerOpen: boolean;
  circuitBreakerOpenedAt: string | null;
  runInProgress: boolean;
  runStartedAt: string | null;
  lastError: string | null;
}

const CIRCUIT_BREAKER_THRESHOLD = Number(process.env.SCHEDULER_CB_THRESHOLD) || 5;
const CIRCUIT_BREAKER_RESET_MS = Number(process.env.SCHEDULER_CB_RESET_MS) || 60 * 60 * 1000; // 1 hour
const RUN_TIMEOUT_MS = Number(process.env.SCHEDULER_RUN_TIMEOUT_MS) || 30 * 60 * 1000; // 30 minutes

const statusMap = new Map<string, ScraperStatus>();

function getOrCreate(scraperName: string): ScraperStatus {
  let status = statusMap.get(scraperName);
  if (!status) {
    status = {
      lastSuccess: null,
      lastFailure: null,
      consecutiveFailures: 0,
      circuitBreakerOpen: false,
      circuitBreakerOpenedAt: null,
      runInProgress: false,
      runStartedAt: null,
      lastError: null,
    };
    statusMap.set(scraperName, status);
  }
  return status;
}

/**
 * Check if the circuit breaker should auto-reset (after CIRCUIT_BREAKER_RESET_MS).
 */
function checkCircuitBreakerReset(status: ScraperStatus): void {
  if (
    status.circuitBreakerOpen &&
    status.circuitBreakerOpenedAt
  ) {
    const elapsed = Date.now() - new Date(status.circuitBreakerOpenedAt).getTime();
    if (elapsed >= CIRCUIT_BREAKER_RESET_MS) {
      status.circuitBreakerOpen = false;
      status.circuitBreakerOpenedAt = null;
      status.consecutiveFailures = 0;
    }
  }
}

/**
 * Check if a timed-out run should be marked as stuck.
 */
function checkRunTimeout(status: ScraperStatus): void {
  if (
    status.runInProgress &&
    status.runStartedAt
  ) {
    const elapsed = Date.now() - new Date(status.runStartedAt).getTime();
    if (elapsed >= RUN_TIMEOUT_MS) {
      status.runInProgress = false;
      status.runStartedAt = null;
    }
  }
}

/**
 * Returns true if the scraper should be skipped this cycle.
 * Reason string is returned for logging, or null if it can proceed.
 */
export function shouldSkip(scraperName: string): string | null {
  const status = getOrCreate(scraperName);
  checkCircuitBreakerReset(status);
  checkRunTimeout(status);

  if (status.circuitBreakerOpen) {
    return `circuit breaker open (${status.consecutiveFailures} consecutive failures, opened at ${status.circuitBreakerOpenedAt})`;
  }

  if (status.runInProgress) {
    return `previous run still in progress (started at ${status.runStartedAt})`;
  }

  return null;
}

/**
 * Mark a scraper run as started.
 */
export function markRunStarted(scraperName: string): void {
  const status = getOrCreate(scraperName);
  status.runInProgress = true;
  status.runStartedAt = new Date().toISOString();
}

/**
 * Mark a scraper run as completed successfully.
 */
export function markRunSuccess(scraperName: string): void {
  const status = getOrCreate(scraperName);
  status.runInProgress = false;
  status.runStartedAt = null;
  status.lastSuccess = new Date().toISOString();
  status.consecutiveFailures = 0;
  status.lastError = null;
  // If the circuit breaker was being tested (half-open), close it on success
  if (status.circuitBreakerOpen) {
    status.circuitBreakerOpen = false;
    status.circuitBreakerOpenedAt = null;
  }
}

/**
 * Mark a scraper run as skipped (e.g. 409 already running).
 * Clears runInProgress without touching success/failure counters.
 */
export function markRunSkipped(scraperName: string): void {
  const status = getOrCreate(scraperName);
  status.runInProgress = false;
  status.runStartedAt = null;
}

/**
 * Mark a scraper run as failed. Opens circuit breaker after threshold.
 */
export function markRunFailed(scraperName: string, error: string): void {
  const status = getOrCreate(scraperName);
  status.runInProgress = false;
  status.runStartedAt = null;
  status.lastFailure = new Date().toISOString();
  status.lastError = error;
  status.consecutiveFailures += 1;

  if (status.consecutiveFailures >= CIRCUIT_BREAKER_THRESHOLD && !status.circuitBreakerOpen) {
    status.circuitBreakerOpen = true;
    status.circuitBreakerOpenedAt = new Date().toISOString();
  }
}

/**
 * Get the status of all tracked scrapers.
 */
export function getAllStatuses(): Record<string, ScraperStatus> {
  const result: Record<string, ScraperStatus> = {};
  for (const [name, status] of statusMap) {
    checkCircuitBreakerReset(status);
    checkRunTimeout(status);
    result[name] = { ...status };
  }
  return result;
}

/**
 * Get the status of a single scraper.
 */
export function getStatus(scraperName: string): ScraperStatus {
  const status = getOrCreate(scraperName);
  checkCircuitBreakerReset(status);
  checkRunTimeout(status);
  return { ...status };
}
