const playwright = require('playwright');
const fs = require('fs');

/**
 * ImmoScout24 Austria API Research Script
 *
 * This script captures network traffic from immobilienscout24.at to identify:
 * - API endpoints used by the website
 * - Request/response formats
 * - Authentication mechanisms
 * - Query parameters for searching
 */

async function researchImmoScout24AT() {
    const browser = await playwright.chromium.launch({
        headless: false,
        args: ['--disable-blink-features=AutomationControlled']
    });

    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        viewport: { width: 1920, height: 1080 },
        locale: 'de-AT',
        timezoneId: 'Europe/Vienna'
    });

    const page = await context.newPage();

    // Capture all API requests
    const apiCalls = [];
    const allRequests = [];

    page.on('request', request => {
        const url = request.url();
        allRequests.push({
            url: url,
            method: request.method(),
            headers: request.headers(),
            timestamp: new Date().toISOString()
        });
    });

    page.on('response', async response => {
        const url = response.url();
        const request = response.request();

        // Filter for API calls
        if (url.includes('/api/') || url.includes('psa') || url.includes('property')) {
            try {
                const contentType = response.headers()['content-type'] || '';
                let responseData = null;

                if (contentType.includes('application/json')) {
                    try {
                        responseData = await response.json();
                    } catch (e) {
                        responseData = await response.text();
                    }
                }

                apiCalls.push({
                    url: url,
                    method: request.method(),
                    status: response.status(),
                    headers: response.headers(),
                    requestHeaders: request.headers(),
                    responseData: responseData,
                    timestamp: new Date().toISOString()
                });

                console.log(`[API] ${request.method()} ${url} - Status: ${response.status()}`);
            } catch (error) {
                console.log(`Error processing response for ${url}:`, error.message);
            }
        }
    });

    try {
        console.log('Navigating to ImmoScout24.at...');
        await page.goto('https://www.immobilienscout24.at', {
            waitUntil: 'networkidle',
            timeout: 60000
        });

        console.log('Waiting for page to load...');
        await page.waitForTimeout(3000);

        // Try to search for apartments in Vienna
        console.log('Attempting to search for apartments in Vienna...');

        // Look for search input
        const searchInput = await page.$('input[placeholder*="Ort"], input[name="location"], input[type="search"]').catch(() => null);

        if (searchInput) {
            await searchInput.fill('Wien');
            await page.waitForTimeout(2000);

            // Look for search button or form submit
            const searchButton = await page.$('button[type="submit"], button:has-text("Suchen")').catch(() => null);
            if (searchButton) {
                await searchButton.click();
                await page.waitForTimeout(5000);
            }
        } else {
            // Try direct URL navigation to search results
            console.log('Navigating directly to Vienna search results...');
            await page.goto('https://www.immobilienscout24.at/suche/wohnung/mieten/wien', {
                waitUntil: 'networkidle',
                timeout: 60000
            });
            await page.waitForTimeout(5000);
        }

        // Scroll to trigger lazy loading
        console.log('Scrolling to load more listings...');
        for (let i = 0; i < 3; i++) {
            await page.evaluate(() => window.scrollBy(0, 1000));
            await page.waitForTimeout(2000);
        }

        // Try to click on a property detail
        console.log('Attempting to open property detail...');
        const propertyLink = await page.$('a[href*="/expose/"]').catch(() => null);
        if (propertyLink) {
            await propertyLink.click();
            await page.waitForTimeout(5000);
        }

        console.log('\n=== API RESEARCH COMPLETE ===');
        console.log(`Total requests captured: ${allRequests.length}`);
        console.log(`API calls captured: ${apiCalls.length}`);

        // Save results
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

        fs.writeFileSync(
            `/Users/samuelseidel/Development/landomo-world/immoscout24_at_api_calls_${timestamp}.json`,
            JSON.stringify(apiCalls, null, 2)
        );

        fs.writeFileSync(
            `/Users/samuelseidel/Development/landomo-world/immoscout24_at_all_requests_${timestamp}.json`,
            JSON.stringify(allRequests, null, 2)
        );

        // Print summary of API endpoints found
        console.log('\n=== API ENDPOINTS DISCOVERED ===');
        const uniqueEndpoints = [...new Set(apiCalls.map(call => {
            const url = new URL(call.url);
            return `${call.method} ${url.pathname}`;
        }))];

        uniqueEndpoints.forEach(endpoint => {
            console.log(endpoint);
        });

        // Print authentication headers used
        console.log('\n=== AUTHENTICATION HEADERS ===');
        const authHeaders = apiCalls
            .filter(call => call.requestHeaders.authorization || call.requestHeaders.Authorization)
            .map(call => ({
                endpoint: new URL(call.url).pathname,
                auth: call.requestHeaders.authorization || call.requestHeaders.Authorization
            }));

        if (authHeaders.length > 0) {
            console.log(JSON.stringify(authHeaders, null, 2));
        } else {
            console.log('No authentication headers found (likely unauthenticated API)');
        }

    } catch (error) {
        console.error('Error during research:', error);
    } finally {
        await page.waitForTimeout(5000);
        await browser.close();
    }
}

// Run the research
researchImmoScout24AT().catch(console.error);
