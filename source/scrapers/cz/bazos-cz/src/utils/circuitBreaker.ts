/**
 * Circuit Breaker
 *
 * Prevents cascading failures by tracking success/failure rates and
 * "tripping" (aborting) operations when failure rate exceeds threshold.
 *
 * Use case: Abort scrape if >30% of extractions/validations fail to
 * prevent mass ingestion of bad data.
 *
 * States:
 * - Closed: Normal operation, tracking successes and failures
 * - Open: Tripped, all operations should be aborted
 * - (Optional) Half-Open: Testing if service recovered
 */

export interface CircuitBreakerConfig {
  threshold: number;       // Failure rate threshold (0.0-1.0, e.g., 0.30 = 30%)
  minSamples: number;      // Minimum samples before checking threshold
  resetTimeoutMs?: number; // Optional: auto-reset after this duration
  name?: string;           // Optional: name for logging
}

export class CircuitBreaker {
  private successes: number = 0;
  private failures: number = 0;
  private tripped: boolean = false;
  private config: CircuitBreakerConfig;
  private resetTimer?: NodeJS.Timeout;

  constructor(config: CircuitBreakerConfig) {
    this.config = {
      threshold: config.threshold,
      minSamples: config.minSamples,
      resetTimeoutMs: config.resetTimeoutMs,
      name: config.name || 'CircuitBreaker',
    };

    console.log(`[${this.config.name}] Initialized`);
    console.log(`  Threshold: ${(this.config.threshold * 100).toFixed(0)}%`);
    console.log(`  Min samples: ${this.config.minSamples}`);
    console.log(`  Auto-reset: ${this.config.resetTimeoutMs ? `${this.config.resetTimeoutMs}ms` : 'disabled'}`);
  }

  /**
   * Record a successful operation
   */
  public recordSuccess(): void {
    this.successes++;
  }

  /**
   * Record a failed operation
   * Checks if circuit should trip after each failure
   */
  public recordFailure(): void {
    this.failures++;

    // Check if we should trip
    if (this.shouldTrip()) {
      this.trip();
    }
  }

  /**
   * Check if circuit breaker should trip based on current stats
   *
   * @returns true if should trip, false otherwise
   */
  private shouldTrip(): boolean {
    const total = this.successes + this.failures;

    // Need minimum samples before checking threshold
    if (total < this.config.minSamples) {
      return false;
    }

    const failureRate = this.failures / total;
    return failureRate > this.config.threshold;
  }

  /**
   * Trip the circuit breaker (open state)
   * All operations should be aborted after this
   */
  private trip(): void {
    if (!this.tripped) {
      this.tripped = true;

      const failureRate = this.getFailureRate();
      console.error(`[${this.config.name}] TRIPPED!`);
      console.error(`  Failure rate: ${failureRate.toFixed(1)}% (threshold: ${(this.config.threshold * 100).toFixed(0)}%)`);
      console.error(`  Stats: ${this.failures} failures / ${this.getTotal()} total`);

      // Optional: Auto-reset after timeout
      if (this.config.resetTimeoutMs) {
        console.log(`[${this.config.name}] Will auto-reset in ${this.config.resetTimeoutMs}ms`);

        this.resetTimer = setTimeout(() => {
          console.log(`[${this.config.name}] Auto-reset triggered`);
          this.reset();
        }, this.config.resetTimeoutMs);
      }
    }
  }

  /**
   * Check if circuit is tripped
   *
   * @returns true if tripped (operations should abort), false otherwise
   */
  public isTripped(): boolean {
    return this.tripped;
  }

  /**
   * Alias for isTripped() - clearer intent for aborting operations
   *
   * @returns true if should abort, false if can continue
   */
  public shouldAbort(): boolean {
    return this.isTripped();
  }

  /**
   * Get current failure rate as percentage
   *
   * @returns Failure rate (0-100)
   */
  public getFailureRate(): number {
    const total = this.successes + this.failures;
    if (total === 0) return 0;
    return (this.failures / total) * 100;
  }

  /**
   * Get total number of samples
   *
   * @returns Total successes + failures
   */
  public getTotal(): number {
    return this.successes + this.failures;
  }

  /**
   * Get current statistics
   *
   * @returns Stats object
   */
  public getStats() {
    return {
      successes: this.successes,
      failures: this.failures,
      total: this.getTotal(),
      failureRate: this.getFailureRate().toFixed(1) + '%',
      tripped: this.tripped,
      threshold: (this.config.threshold * 100).toFixed(0) + '%',
      minSamples: this.config.minSamples,
    };
  }

  /**
   * Reset circuit breaker to initial state
   * Clears all stats and un-trips
   */
  public reset(): void {
    // Clear auto-reset timer if exists
    if (this.resetTimer) {
      clearTimeout(this.resetTimer);
      this.resetTimer = undefined;
    }

    this.successes = 0;
    this.failures = 0;
    this.tripped = false;

    console.log(`[${this.config.name}] Reset to initial state`);
  }

  /**
   * Manually trip the circuit (for testing or emergency stop)
   */
  public forceTrip(): void {
    this.tripped = true;
    console.warn(`[${this.config.name}] Manually tripped`);
  }

  /**
   * Manually close the circuit (for testing or recovery)
   */
  public forceClose(): void {
    this.tripped = false;
    console.log(`[${this.config.name}] Manually closed`);
  }
}

/**
 * Create circuit breaker from environment variables
 *
 * @param name - Name for the circuit breaker
 * @param defaultThreshold - Default threshold if not set in env
 * @param defaultMinSamples - Default min samples if not set in env
 * @returns Circuit breaker instance
 */
export function createCircuitBreaker(
  name: string,
  defaultThreshold: number = 0.30,
  defaultMinSamples: number = 10
): CircuitBreaker {
  const threshold = process.env.CIRCUIT_BREAKER_THRESHOLD
    ? parseFloat(process.env.CIRCUIT_BREAKER_THRESHOLD)
    : defaultThreshold;

  const minSamples = process.env.CIRCUIT_BREAKER_MIN_SAMPLES
    ? parseInt(process.env.CIRCUIT_BREAKER_MIN_SAMPLES, 10)
    : defaultMinSamples;

  const resetTimeoutMs = process.env.CIRCUIT_BREAKER_RESET_TIMEOUT_MS
    ? parseInt(process.env.CIRCUIT_BREAKER_RESET_TIMEOUT_MS, 10)
    : undefined;

  return new CircuitBreaker({
    name,
    threshold,
    minSamples,
    resetTimeoutMs,
  });
}
