/**
 * YIMBA.sk Real Estate Portal Scraper
 *
 * This scraper extracts real estate development project data from YIMBA.sk
 * YIMBA is an architectural/urban development information portal in Slovakia
 *
 * Key Findings:
 * - Backend: Fat-Free Framework (PHP)
 * - CDN: Cloudflare
 * - Data Format: JSON API available
 * - No authentication required
 * - No rate limiting observed
 * - robots.txt allows scraping
 */

const https = require('https');
const { chromium } = require('playwright'); // Optional: for detail pages

class YimbaScraper {
    constructor() {
        this.baseUrl = 'https://www.yimba.sk';
        this.headers = {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            'Accept': 'application/json, text/html, */*',
            'X-Requested-With': 'XMLHttpRequest',
            'Referer': 'https://www.yimba.sk/'
        };
    }

    /**
     * Get all projects with filtering options
     *
     * @param {Object} options - Filter options
     * @param {string|string[]} options.status - Project status: 1=Planning, 2=Under Construction, 3=Completed, 4=Cancelled
     * @param {string} options.sort - Sort field: 'name', 'date', etc.
     * @param {string} options.order - Sort order: 'asc' or 'desc'
     * @param {boolean} options.archive - Include archived projects (0 or 1)
     * @returns {Promise<Array>} Array of project objects
     */
    async getProjects(options = {}) {
        const {
            status = [1, 2, 3, 4], // All statuses by default
            sort = 'name',
            order = 'asc',
            archive = 0
        } = options;

        const statusParam = Array.isArray(status) ? status.join(',') : status;
        const url = `${this.baseUrl}/projekty/status/${statusParam}/zoradenie/${sort}/${order}/archive/${archive}?format=json`;

        console.log(`Fetching projects: ${url}`);

        return new Promise((resolve, reject) => {
            https.get(url, { headers: this.headers }, (res) => {
                let data = '';

                res.on('data', (chunk) => {
                    data += chunk;
                });

                res.on('end', () => {
                    try {
                        const projects = JSON.parse(data);
                        console.log(`Retrieved ${projects.length} projects`);
                        resolve(projects);
                    } catch (error) {
                        reject(new Error(`Failed to parse JSON: ${error.message}`));
                    }
                });
            }).on('error', reject);
        });
    }

    /**
     * Get projects by specific status
     * Status codes:
     * 1 = Planning/Proposed
     * 2 = Under Construction
     * 3 = Completed
     * 4 = Cancelled/Stopped
     */
    async getProjectsByStatus(status) {
        return this.getProjects({ status });
    }

    /**
     * Get project detail page HTML
     * Note: Detail data is embedded in HTML, not available as JSON API
     *
     * @param {string} slug - Project slug (e.g., 'ahoj-park')
     * @returns {Promise<string>} HTML content
     */
    async getProjectDetail(slug) {
        const url = `${this.baseUrl}/${slug}`;

        return new Promise((resolve, reject) => {
            https.get(url, { headers: this.headers }, (res) => {
                let data = '';

                res.on('data', (chunk) => {
                    data += chunk;
                });

                res.on('end', () => {
                    resolve(data);
                });
            }).on('error', reject);
        });
    }

    /**
     * Get project detail using headless browser (for dynamic content)
     * This is more resource-intensive but captures all data including lazy-loaded content
     *
     * @param {string} slug - Project slug
     * @returns {Promise<Object>} Extracted project data
     */
    async getProjectDetailDynamic(slug) {
        const browser = await chromium.launch({ headless: true });
        const page = await browser.newPage();

        try {
            await page.goto(`${this.baseUrl}/${slug}`, {
                waitUntil: 'domcontentloaded',
                timeout: 30000
            });

            // Extract data from the page
            const data = await page.evaluate(() => {
                const title = document.querySelector('h1')?.textContent?.trim();
                const description = document.querySelector('.project-description, .description')?.textContent?.trim();

                // Extract images
                const images = Array.from(document.querySelectorAll('img[src*="/upload/"]'))
                    .map(img => img.src);

                // Extract metadata
                const metaElements = document.querySelectorAll('.project-meta, .meta-item');
                const metadata = {};
                metaElements.forEach(el => {
                    const label = el.querySelector('.label, dt')?.textContent?.trim();
                    const value = el.querySelector('.value, dd')?.textContent?.trim();
                    if (label && value) {
                        metadata[label] = value;
                    }
                });

                return {
                    title,
                    description,
                    images,
                    metadata,
                    url: window.location.href
                };
            });

            await browser.close();
            return data;
        } catch (error) {
            await browser.close();
            throw error;
        }
    }

    /**
     * Search projects by keyword
     * Note: YIMBA doesn't expose a JSON search API, so this searches through all projects
     *
     * @param {string} keyword - Search keyword
     * @returns {Promise<Array>} Matching projects
     */
    async searchProjects(keyword) {
        const allProjects = await this.getProjects();
        const lowerKeyword = keyword.toLowerCase();

        return allProjects.filter(project =>
            project.name.toLowerCase().includes(lowerKeyword) ||
            (project.slug && project.slug.toLowerCase().includes(lowerKeyword))
        );
    }

    /**
     * Get statistics about projects
     */
    async getStatistics() {
        const allProjects = await this.getProjects();

        const stats = {
            total: allProjects.length,
            byStatus: {
                planning: 0,
                construction: 0,
                completed: 0,
                cancelled: 0
            }
        };

        allProjects.forEach(project => {
            const status = parseInt(project.status);
            switch (status) {
                case 1: stats.byStatus.planning++; break;
                case 2: stats.byStatus.construction++; break;
                case 3: stats.byStatus.completed++; break;
                case 4: stats.byStatus.cancelled++; break;
            }
        });

        return stats;
    }

    /**
     * Helper method to introduce delay between requests (good practice)
     */
    async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Example usage
async function main() {
    const scraper = new YimbaScraper();

    try {
        // 1. Get all projects
        console.log('\n=== Fetching all projects ===');
        const allProjects = await scraper.getProjects();
        console.log(`Total projects: ${allProjects.length}`);
        console.log('First project:', allProjects[0]);

        // 2. Get only projects under construction
        console.log('\n=== Projects under construction ===');
        const underConstruction = await scraper.getProjectsByStatus(2);
        console.log(`Under construction: ${underConstruction.length}`);

        // 3. Search for specific projects
        console.log('\n=== Searching for apartments (byty) ===');
        const apartments = await scraper.searchProjects('byt');
        console.log(`Found ${apartments.length} apartment projects`);
        if (apartments.length > 0) {
            console.log('Example:', apartments[0]);
        }

        // 4. Get statistics
        console.log('\n=== Project Statistics ===');
        const stats = await scraper.getStatistics();
        console.log(stats);

        // 5. Get project detail (HTML)
        console.log('\n=== Fetching project detail ===');
        const detailHtml = await scraper.getProjectDetail('ahoj-park');
        console.log(`Detail HTML length: ${detailHtml.length} characters`);

        // Uncomment to use dynamic scraping with Playwright
        // const detailData = await scraper.getProjectDetailDynamic('ahoj-park');
        // console.log('Detail data:', detailData);

    } catch (error) {
        console.error('Error:', error.message);
    }
}

// Run if executed directly
if (require.main === module) {
    main();
}

module.exports = YimbaScraper;
