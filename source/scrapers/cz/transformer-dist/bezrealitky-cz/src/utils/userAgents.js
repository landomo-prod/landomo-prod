"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.userAgents = void 0;
exports.getRandomUserAgent = getRandomUserAgent;
/**
 * Pool of user agents for rotation
 * Helps avoid rate limiting and bot detection
 */
exports.userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
];
/**
 * Get a random user agent
 */
function getRandomUserAgent() {
    return exports.userAgents[Math.floor(Math.random() * exports.userAgents.length)];
}
