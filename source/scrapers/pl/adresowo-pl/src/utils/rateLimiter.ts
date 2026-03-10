interface RateLimitConfig {
  requestsPerWindow: number;
  windowMs: number;
}

class RateLimiter {
  private requests: number[] = [];
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig) {
    this.config = config;
  }

  async throttle(): Promise<void> {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;

    this.requests = this.requests.filter((time) => time > windowStart);

    if (this.requests.length >= this.config.requestsPerWindow) {
      const oldestRequest = this.requests[0];
      const waitTime = oldestRequest + this.config.windowMs - now + 100;

      if (waitTime > 0) {
        await new Promise((resolve) => setTimeout(resolve, waitTime));
        return this.throttle();
      }
    }

    this.requests.push(now);
  }

  getStatus() {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;
    const activeRequests = this.requests.filter((time) => time > windowStart);

    return {
      requests: activeRequests.length,
      limit: this.config.requestsPerWindow,
      remaining: this.config.requestsPerWindow - activeRequests.length,
    };
  }
}

// Conservative rate limit for HTML scraping: 60 requests per minute
export const adresowoRateLimiter = new RateLimiter({
  requestsPerWindow: parseInt(process.env.RATE_LIMIT_REQUESTS || '60'),
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000'),
});

export { RateLimiter };
