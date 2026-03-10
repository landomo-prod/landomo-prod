"use strict";
/**
 * Token bucket rate limiter to respect portal's rate limits
 * Prevents overwhelming sreality.cz API with too many concurrent requests
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.RateLimiter = exports.srealityRateLimiter = void 0;
class RateLimiter {
    constructor(config) {
        this.requests = [];
        this.config = config;
    }
    /**
     * Wait if necessary to respect rate limits
     * Call this before making any API request
     */
    async throttle() {
        const now = Date.now();
        const windowStart = now - this.config.windowMs;
        // Remove requests outside the current window
        this.requests = this.requests.filter((time) => time > windowStart);
        // If we've hit the limit, wait
        if (this.requests.length >= this.config.requestsPerWindow) {
            const oldestRequest = this.requests[0];
            const waitTime = oldestRequest + this.config.windowMs - now + 100; // +100ms buffer
            if (waitTime > 0) {
                console.log(JSON.stringify({ level: 'info', service: 'sreality-scraper', msg: 'Rate limit reached, waiting', waitTimeMs: waitTime }));
                await sleep(waitTime);
                return this.throttle(); // Recursive check after waiting
            }
        }
        // Record this request
        this.requests.push(now);
    }
    /**
     * Get current rate limit status
     */
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
exports.RateLimiter = RateLimiter;
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
// Configure rate limiter for SReality
// Default: 20000 requests per 60 seconds (maximum speed test)
exports.srealityRateLimiter = new RateLimiter({
    requestsPerWindow: parseInt(process.env.RATE_LIMIT_REQUESTS || '20000'),
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000'),
});
