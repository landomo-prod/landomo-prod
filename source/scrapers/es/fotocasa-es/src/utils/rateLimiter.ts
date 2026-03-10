/**
 * Rate limiter for Fotocasa API requests
 * Enforces minimum delay between requests with exponential backoff on 429
 */

export class RateLimiter {
  private lastRequestTime = 0;
  private minDelayMs: number;
  private backoffMultiplier = 1;
  private maxBackoffMultiplier = 32;

  constructor(minDelayMs: number = 200) {
    this.minDelayMs = minDelayMs;
  }

  async throttle(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    const requiredDelay = this.minDelayMs * this.backoffMultiplier;

    if (elapsed < requiredDelay) {
      await new Promise(resolve => setTimeout(resolve, requiredDelay - elapsed));
    }

    this.lastRequestTime = Date.now();
  }

  onSuccess(): void {
    // Gradually reduce backoff on success
    if (this.backoffMultiplier > 1) {
      this.backoffMultiplier = Math.max(1, this.backoffMultiplier / 2);
    }
  }

  onRateLimit(): void {
    // Exponential backoff on 429
    this.backoffMultiplier = Math.min(this.maxBackoffMultiplier, this.backoffMultiplier * 2);
    console.log(JSON.stringify({
      level: 'warn',
      service: 'fotocasa-scraper',
      msg: 'Rate limited, increasing backoff',
      backoffMultiplier: this.backoffMultiplier,
      effectiveDelay: this.minDelayMs * this.backoffMultiplier,
    }));
  }
}

export const fotocasaRateLimiter = new RateLimiter(200);
