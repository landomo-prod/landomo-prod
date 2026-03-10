const playwright = require('playwright');
const fs = require('fs');

async function captureImmoScout24API() {
    const browser = await playwright.chromium.launch({
        headless: false,
        args: ['--disable-blink-features=AutomationControlled']
    });

    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        viewport: { width: 1920, height: 1080 },
        locale: 'de-DE'
    });

    const page = await context.newPage();

    const apiCalls = [];
    const allRequests = [];

    // Capture all network requests
    page.on('request', request => {
        const url = request.url();
        allRequests.push({
            url: url,
            method: request.method(),
            headers: request.headers(),
            postData: request.postData(),
            resourceType: request.resourceType()
        });

        // Capture API calls specifically
        if (url.includes('/api/') ||
            url.includes('search') ||
            url.includes('expose') ||
            url.includes('properties') ||
            url.includes('.json')) {
            console.log(`[API] ${request.method()} ${url}`);
        }
    });

    page.on('response', async response => {
        const url = response.url();

        if (url.includes('/api/') ||
            url.includes('search') ||
            url.includes('expose') ||
            url.includes('properties') ||
            url.includes('.json')) {

            try {
                const contentType = response.headers()['content-type'] || '';
                let responseData = null;

                if (contentType.includes('application/json')) {
                    responseData = await response.json();
                } else {
                    responseData = await response.text();
                }

                apiCalls.push({
                    url: url,
                    method: response.request().method(),
                    status: response.status(),
                    headers: response.headers(),
                    request: {
                        url: response.request().url(),
                        headers: response.request().headers(),
                        postData: response.request().postData()
                    },
                    response: responseData
                });

                console.log(`[RESPONSE] ${response.status()} ${url}`);
            } catch (error) {
                console.error(`Error capturing response for ${url}:`, error.message);
            }
        }
    });

    try {
        console.log('Navigating to ImmobilienScout24...');
        await page.goto('https://www.immobilienscout24.de/', {
            waitUntil: 'networkidle',
            timeout: 60000
        });

        console.log('Waiting for page to load...');
        await page.waitForTimeout(3000);

        // Try to search for properties
        console.log('Attempting to perform a search...');

        // Look for search button or link
        try {
            const searchLink = await page.locator('a[href*="wohnung-mieten"]').first();
            if (await searchLink.isVisible()) {
                console.log('Clicking on apartment search link...');
                await searchLink.click();
                await page.waitForTimeout(5000);
            }
        } catch (e) {
            console.log('Could not find search link, trying alternative approach...');
        }

        // Wait for any additional API calls
        console.log('Waiting for additional network activity...');
        await page.waitForTimeout(5000);

        // Save captured data
        const timestamp = new Date().toISOString().replace(/:/g, '-');

        fs.writeFileSync(
            `/Users/samuelseidel/Development/landomo-world/immoscout24_api_calls_${timestamp}.json`,
            JSON.stringify(apiCalls, null, 2)
        );

        fs.writeFileSync(
            `/Users/samuelseidel/Development/landomo-world/immoscout24_all_requests_${timestamp}.json`,
            JSON.stringify(allRequests, null, 2)
        );

        console.log(`\n=== SUMMARY ===`);
        console.log(`Total requests captured: ${allRequests.length}`);
        console.log(`API calls captured: ${apiCalls.length}`);
        console.log(`\nAPI endpoints found:`);

        const uniqueEndpoints = [...new Set(apiCalls.map(call => {
            const url = new URL(call.url);
            return url.origin + url.pathname;
        }))];

        uniqueEndpoints.forEach(endpoint => console.log(`  - ${endpoint}`));

    } catch (error) {
        console.error('Error during scraping:', error);
    } finally {
        console.log('\nPress Ctrl+C to close the browser...');
        // Keep browser open for manual inspection
        await page.waitForTimeout(300000); // 5 minutes
        await browser.close();
    }
}

captureImmoScout24API().catch(console.error);
