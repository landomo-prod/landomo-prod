import { AxiosError } from 'axios';

export interface RetryOptions {
  maxRetries: number;
  initialDelay: number;
  maxDelay: number;
  /** Jitter factor 0-1, e.g. 0.2 means +/-20% */
  jitter: number;
}

export const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxRetries: Number(process.env.SCHEDULER_MAX_RETRIES) || 3,
  initialDelay: Number(process.env.SCHEDULER_INITIAL_DELAY_MS) || 5000,
  maxDelay: Number(process.env.SCHEDULER_MAX_DELAY_MS) || 60000,
  jitter: 0.2,
};

/**
 * Check whether an error is retryable.
 * Network errors and 5xx are retryable; 4xx client errors are not.
 */
export function isRetryableError(error: unknown): boolean {
  if (error instanceof AxiosError) {
    // No response at all means network/timeout error -- retryable
    if (!error.response) return true;
    // 5xx server errors are retryable
    if (error.response.status >= 500) return true;
    // 408 Request Timeout and 429 Too Many Requests are retryable
    if (error.response.status === 408 || error.response.status === 429) return true;
    // All other 4xx errors are not retryable
    return false;
  }
  // Unknown errors are retryable (network issues, DNS failures, etc.)
  return true;
}

/**
 * Calculate delay with exponential backoff and jitter.
 * Formula: min(initialDelay * 2^attempt, maxDelay) +/- jitter%
 */
export function calculateDelay(attempt: number, options: RetryOptions): number {
  const exponentialDelay = Math.min(
    options.initialDelay * Math.pow(2, attempt),
    options.maxDelay
  );
  const jitterRange = exponentialDelay * options.jitter;
  const jitter = (Math.random() * 2 - 1) * jitterRange; // random in [-jitterRange, +jitterRange]
  return Math.max(0, Math.round(exponentialDelay + jitter));
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Execute a function with exponential backoff retry.
 * Only retries on retryable errors (network, 5xx, 408, 429).
 * Non-retryable errors (4xx) are thrown immediately.
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = DEFAULT_RETRY_OPTIONS,
  onRetry?: (attempt: number, delay: number, error: unknown) => void
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= options.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (!isRetryableError(error)) {
        throw error;
      }

      if (attempt < options.maxRetries) {
        const delay = calculateDelay(attempt, options);
        onRetry?.(attempt + 1, delay, error);
        await sleep(delay);
      }
    }
  }

  throw lastError;
}
