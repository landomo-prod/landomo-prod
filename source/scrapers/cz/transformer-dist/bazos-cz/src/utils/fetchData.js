"use strict";
/**
 * Bazos API Fetch Utilities
 * Handles API calls with proper headers, rate limiting, and error handling
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BazosApiFetcher = void 0;
exports.fetchSectionData = fetchSectionData;
const axios_1 = __importDefault(require("axios"));
const userAgents_1 = require("./userAgents");
class BazosApiFetcher {
    constructor(options) {
        this.baseUrls = {
            'cz': 'https://www.bazos.cz',
            'sk': 'https://www.bazos.sk',
            'pl': 'https://www.bazos.pl',
            'at': 'https://www.bazos.at',
        };
        this.lastRequestTime = 0;
        this.delayMs = 500; // Default delay between requests
        this.delayMs = options?.delayMs || 500;
        this.client = axios_1.default.create({
            timeout: 10000,
            headers: {
                'User-Agent': options?.userAgent || (0, userAgents_1.getRandomUserAgent)(),
                'Accept-Encoding': 'gzip, deflate, br',
                'Connection': 'keep-alive',
            }
        });
    }
    async rateLimitDelay() {
        const now = Date.now();
        const timeSinceLastRequest = now - this.lastRequestTime;
        const delayNeeded = Math.max(0, this.delayMs - timeSinceLastRequest);
        if (delayNeeded > 0) {
            await new Promise(resolve => setTimeout(resolve, delayNeeded));
        }
        this.lastRequestTime = Date.now();
    }
    getBaseUrl(country) {
        return this.baseUrls[country] || this.baseUrls['cz'];
    }
    async fetchAds(country = 'cz', options = {}) {
        const defaults = {
            offset: 0,
            limit: 20,
            ...options
        };
        const params = new URLSearchParams();
        params.append('offset', defaults.offset.toString());
        params.append('limit', defaults.limit.toString());
        if (defaults.section)
            params.append('section', defaults.section);
        if (defaults.query)
            params.append('query', defaults.query);
        if (defaults.price_from)
            params.append('price_from', defaults.price_from.toString());
        if (defaults.price_to)
            params.append('price_to', defaults.price_to.toString());
        if (defaults.sort)
            params.append('sort', defaults.sort);
        const url = `${this.getBaseUrl(country)}/api/v1/ads.php?${params.toString()}`;
        try {
            await this.rateLimitDelay();
            const response = await this.client.get(url);
            return Array.isArray(response.data) ? response.data : [];
        }
        catch (error) {
            console.error(`Error fetching ads from ${country}:`, error.message);
            throw error;
        }
    }
    async fetchCategories(country = 'cz') {
        const url = `${this.getBaseUrl(country)}/api/v1/categories.php`;
        try {
            await this.rateLimitDelay();
            const response = await this.client.get(url);
            return Array.isArray(response.data) ? response.data : [];
        }
        catch (error) {
            console.error(`Error fetching categories from ${country}:`, error.message);
            throw error;
        }
    }
    async searchZip(country = 'cz', query) {
        const url = `${this.getBaseUrl(country)}/api/v1/zip.php?query=${encodeURIComponent(query)}`;
        try {
            await this.rateLimitDelay();
            const response = await this.client.get(url);
            return Array.isArray(response.data) ? response.data : [];
        }
        catch (error) {
            console.error(`Error searching zip codes in ${country}:`, error.message);
            throw error;
        }
    }
    async fetchAdDetail(country = 'cz', adId) {
        const url = `${this.getBaseUrl(country)}/api/v1/ad-detail-2.php?ad_id=${adId}`;
        try {
            await this.rateLimitDelay();
            const response = await this.client.get(url);
            return response.data || null;
        }
        catch (error) {
            console.error(`Error fetching ad detail ${adId}:`, error.message);
            return null;
        }
    }
}
exports.BazosApiFetcher = BazosApiFetcher;
/**
 * Fetch all ads from a section with pagination
 * Respects the 20-unit pagination increment requirement
 */
async function fetchSectionData(country, section, options = {}) {
    const fetcher = new BazosApiFetcher({
        userAgent: options.userAgent,
        delayMs: options.delayMs || 1000
    });
    const allAds = [];
    const maxPages = options.maxPages || 10000; // Default to high limit (stops naturally when no more results)
    for (let pageNumber = 0; pageNumber < maxPages; pageNumber++) {
        const offset = pageNumber * 20; // CRITICAL: Must increment by 20
        try {
            const pageAds = await fetcher.fetchAds(country, {
                offset,
                limit: 20,
                section
            });
            if (!pageAds || pageAds.length === 0) {
                console.log(`No more ads found at offset ${offset}`);
                break;
            }
            allAds.push(...pageAds);
            console.log(`✓ Section ${section}, Page ${pageNumber + 1}: ${pageAds.length} ads (total: ${allAds.length})`);
            // Call progress callback
            if (options.onProgress) {
                await options.onProgress(pageAds, pageNumber + 1);
            }
            // Stop if we found fewer ads than requested (end of results)
            if (pageAds.length < 20) {
                console.log(`Reached end of results (got ${pageAds.length} < 20 requested)`);
                break;
            }
        }
        catch (error) {
            console.error(`Error fetching page ${pageNumber + 1}:`, error);
            // Continue with next page on error
        }
    }
    return allAds;
}
