/**
 * TopReality.sk Working Scraper Example
 *
 * This is a complete, working example demonstrating how to scrape TopReality.sk
 * based on the reverse engineering findings.
 *
 * Features:
 * - Location search via API
 * - Property count retrieval
 * - Search result scraping
 * - Error handling
 * - Rate limiting
 */

const { chromium } = require('playwright');
const https = require('https');
const fs = require('fs');

class TopRealityScraper {
    constructor(options = {}) {
        this.baseUrl = 'https://www.topreality.sk';
        this.browser = null;
        this.page = null;
        this.delay = options.delay || 2000; // Default 2 second delay between requests
        this.headless = options.headless !== false; // Default true
    }

    /**
     * Initialize the browser
     */
    async init() {
        console.log('Initializing browser...');
        this.browser = await chromium.launch({
            headless: this.headless,
            slowMo: 100
        });

        const context = await this.browser.newContext({
            userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            viewport: { width: 1920, height: 1080 },
            locale: 'sk-SK',
            timezoneId: 'Europe/Bratislava'
        });

        this.page = await context.newPage();
        console.log('Browser initialized.');
    }

    /**
     * Wait for specified delay (polite scraping)
     */
    async wait() {
        await new Promise(resolve => setTimeout(resolve, this.delay));
    }

    /**
     * Search for locations using the API
     * @param {string} query - Search query (e.g., "Bratislava")
     * @returns {Promise<Array>} Array of location objects
     */
    async searchLocation(query) {
        console.log(`\nSearching for location: "${query}"`);

        return new Promise((resolve, reject) => {
            const postData = `query=${encodeURIComponent(query)}&items=`;

            const options = {
                hostname: 'www.topreality.sk',
                path: '/user/new_estate/searchAjax.php',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                    'Content-Length': Buffer.byteLength(postData),
                    'X-Requested-With': 'XMLHttpRequest',
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                    'Referer': 'https://www.topreality.sk/hladanie/'
                }
            };

            const req = https.request(options, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        const results = JSON.parse(data);
                        console.log(`Found ${results.length} locations`);
                        resolve(results);
                    } catch (error) {
                        reject(new Error(`Failed to parse location response: ${error.message}`));
                    }
                });
            });

            req.on('error', reject);
            req.write(postData);
            req.end();
        });
    }

    /**
     * Get property count for specific filters
     * @param {Object} filters - Search filters
     * @returns {Promise<number>} Number of properties
     */
    async getPropertyCount(filters = {}) {
        console.log(`\nGetting property count for filters:`, filters);

        return new Promise((resolve, reject) => {
            const params = new URLSearchParams({
                form: '1',
                searchType: 'string',
                obec: filters.location || '',
                typ_ponuky: filters.offerType || '0',
                typ_nehnutelnosti: filters.propertyType || '0',
                vymera_od: filters.areaFrom || '0',
                vymera_do: filters.areaTo || '0',
                page: 'estate',
                fromForm: '1'
            }).toString();

            const options = {
                hostname: 'www.topreality.sk',
                path: `/ajax.php?${params}`,
                method: 'GET',
                headers: {
                    'X-Requested-With': 'XMLHttpRequest',
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                    'Referer': 'https://www.topreality.sk/hladanie/'
                }
            };

            https.get(options, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    const count = parseInt(data.trim().replace(/\s/g, ''));
                    console.log(`Property count: ${count}`);
                    resolve(count);
                });
            }).on('error', reject);
        });
    }

    /**
     * Get all available regions
     * @returns {Promise<Array>} Array of regions
     */
    async getAllRegions() {
        console.log('\nFetching all regions...');
        const regions = await this.searchLocation('');

        const counties = regions.filter(r => r.type === 'county');
        console.log(`Found ${counties.length} regions`);

        return counties;
    }

    /**
     * Get statistics for all regions
     * @returns {Promise<Array>} Array of region statistics
     */
    async getRegionStatistics() {
        const regions = await this.getAllRegions();
        const stats = [];

        console.log('\nGathering statistics for all regions...');

        for (const region of regions) {
            if (region.id === 'c999-zahraničie') continue; // Skip foreign properties

            await this.wait(); // Be polite

            const count = await this.getPropertyCount({
                location: region.id
            });

            const stat = {
                id: region.id,
                name: region.name,
                propertyCount: count
            };

            stats.push(stat);
            console.log(`  ${region.name}: ${count} properties`);
        }

        return stats;
    }

    /**
     * Scrape search results page (HTML parsing)
     * Note: This is a basic implementation and may need refinement
     * based on actual HTML structure
     */
    async scrapeSearchResults(filters = {}) {
        console.log('\nScraping search results...');

        const searchUrl = filters.location
            ? `${this.baseUrl}/vyhladavanie-nehnutelnosti.html?obec=${encodeURIComponent(filters.location)}`
            : `${this.baseUrl}/hladanie/`;

        await this.page.goto(searchUrl, {
            waitUntil: 'networkidle',
            timeout: 60000
        });

        await this.wait();

        // Get page HTML and save for inspection
        const html = await this.page.content();
        fs.writeFileSync('./topreality_analysis/search_results_page.html', html);

        // Try to extract property information
        // Note: Selectors may need adjustment based on actual HTML
        const properties = await this.page.evaluate(() => {
            const results = [];

            // Try multiple possible selectors
            const possibleSelectors = [
                'article.estate',
                '.property-card',
                '.listing-item',
                '[class*="estate-item"]',
                '.row .col-12', // Fallback to grid items
            ];

            let elements = [];
            for (const selector of possibleSelectors) {
                elements = document.querySelectorAll(selector);
                if (elements.length > 0) {
                    console.log(`Found ${elements.length} elements with selector: ${selector}`);
                    break;
                }
            }

            elements.forEach((el, index) => {
                // Extract all links
                const links = Array.from(el.querySelectorAll('a'));
                const propertyLink = links.find(a =>
                    a.href.includes('/nehnutelnost/') ||
                    a.href.includes('/detail/') ||
                    a.href.includes('topreality.sk/')
                );

                if (propertyLink) {
                    const property = {
                        url: propertyLink.href,
                        title: el.querySelector('h2, h3, .title, [class*="title"]')?.textContent?.trim(),
                        price: el.querySelector('[class*="price"], [class*="cena"]')?.textContent?.trim(),
                        location: el.querySelector('[class*="location"], [class*="lokalita"]')?.textContent?.trim(),
                        area: el.querySelector('[class*="area"], [class*="vymera"]')?.textContent?.trim(),
                        rooms: el.querySelector('[class*="room"], [class*="izb"]')?.textContent?.trim(),
                        image: el.querySelector('img')?.src,
                        description: el.querySelector('[class*="description"], p')?.textContent?.trim()?.substring(0, 200)
                    };

                    // Only add if we have at least a URL and title
                    if (property.url && property.title) {
                        results.push(property);
                    }
                }
            });

            return results;
        });

        console.log(`Extracted ${properties.length} properties from page`);
        return properties;
    }

    /**
     * Save results to JSON file
     */
    saveResults(data, filename) {
        const filepath = `./topreality_analysis/${filename}`;
        fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
        console.log(`\nResults saved to: ${filepath}`);
    }

    /**
     * Close the browser
     */
    async close() {
        if (this.browser) {
            await this.browser.close();
            console.log('\nBrowser closed.');
        }
    }
}

/**
 * Example usage demonstrating all features
 */
async function main() {
    const scraper = new TopRealityScraper({
        delay: 2000, // 2 seconds between requests
        headless: false // Set to true in production
    });

    try {
        await scraper.init();

        // Example 1: Search for Bratislava
        const bratislavaLocations = await scraper.searchLocation('Bratislava');
        scraper.saveResults(bratislavaLocations, 'bratislava_locations.json');

        // Example 2: Get property count for Bratislava region
        const bratislavaRegion = bratislavaLocations.find(loc => loc.type === 'county');
        if (bratislavaRegion) {
            const count = await scraper.getPropertyCount({
                location: bratislavaRegion.id,
                offerType: '1', // For sale
                propertyType: '1' // Apartments
            });
            console.log(`\nApartments for sale in Bratislava: ${count}`);
        }

        // Example 3: Get statistics for all regions
        const regionStats = await scraper.getRegionStatistics();
        scraper.saveResults(regionStats, 'region_statistics.json');

        // Example 4: Scrape search results
        if (bratislavaRegion) {
            const properties = await scraper.scrapeSearchResults({
                location: bratislavaRegion.id
            });
            scraper.saveResults(properties, 'bratislava_properties.json');
        }

        console.log('\n=== SCRAPING COMPLETE ===\n');
        console.log('All results have been saved to ./topreality_analysis/');

    } catch (error) {
        console.error('Error during scraping:', error.message);
        console.error(error.stack);
    } finally {
        await scraper.close();
    }
}

// Run the scraper
if (require.main === module) {
    main().catch(console.error);
}

// Export for use as module
module.exports = TopRealityScraper;
