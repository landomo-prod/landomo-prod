const { chromium } = require('playwright');
const fs = require('fs');

async function analyzeYimba() {
    const browser = await chromium.launch({
        headless: false,
        slowMo: 500
    });
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });
    const page = await context.newPage();

    const apiCalls = [];
    const responses = {};

    // Capture all network requests
    page.on('request', request => {
        const url = request.url();
        const method = request.method();
        const resourceType = request.resourceType();

        // Log API calls (XHR, Fetch)
        if (resourceType === 'xhr' || resourceType === 'fetch') {
            console.log(`\n[REQUEST] ${method} ${url}`);
            console.log('Headers:', request.headers());

            const postData = request.postData();
            if (postData) {
                console.log('Post Data:', postData);
            }

            apiCalls.push({
                url,
                method,
                headers: request.headers(),
                postData: postData,
                resourceType
            });
        }
    });

    // Capture all responses
    page.on('response', async response => {
        const url = response.url();
        const status = response.status();
        const resourceType = response.request().resourceType();

        if (resourceType === 'xhr' || resourceType === 'fetch') {
            console.log(`\n[RESPONSE] ${status} ${url}`);

            try {
                const contentType = response.headers()['content-type'] || '';
                if (contentType.includes('application/json')) {
                    const body = await response.json();
                    console.log('Response Body (first 500 chars):', JSON.stringify(body).substring(0, 500));

                    responses[url] = {
                        status,
                        headers: response.headers(),
                        body
                    };
                }
            } catch (e) {
                console.log('Could not parse response:', e.message);
            }
        }
    });

    try {
        console.log('\n=== Navigating to YIMBA homepage ===');
        await page.goto('https://www.yimba.sk', { waitUntil: 'networkidle' });
        await page.waitForTimeout(2000);

        console.log('\n=== Looking for apartment listings ===');
        // Try to find and click on apartment listings
        const apartmentLinks = [
            'a[href*="byty"]',
            'a[href*="prenajom"]',
            'a[href*="predaj"]',
            'text=Byty',
            'text=Prenájom',
            'text=Predaj'
        ];

        let clicked = false;
        for (const selector of apartmentLinks) {
            try {
                const element = await page.locator(selector).first();
                if (await element.count() > 0) {
                    console.log(`Found element: ${selector}`);
                    await element.click();
                    clicked = true;
                    break;
                }
            } catch (e) {
                // Try next selector
            }
        }

        if (!clicked) {
            console.log('Trying direct navigation to listings page...');
            await page.goto('https://www.yimba.sk/byty', { waitUntil: 'networkidle' });
        }

        await page.waitForTimeout(3000);

        console.log('\n=== Scrolling to load more content ===');
        // Scroll to trigger lazy loading
        for (let i = 0; i < 3; i++) {
            await page.evaluate(() => window.scrollBy(0, window.innerHeight));
            await page.waitForTimeout(1000);
        }

        console.log('\n=== Looking for filters or search ===');
        // Try to interact with filters
        const filterSelectors = [
            'input[type="text"]',
            'select',
            'button[type="submit"]'
        ];

        for (const selector of filterSelectors) {
            const count = await page.locator(selector).count();
            if (count > 0) {
                console.log(`Found ${count} elements matching: ${selector}`);
            }
        }

        // Try to click on a property to see detail API
        console.log('\n=== Trying to open property detail ===');
        const propertyLinks = await page.locator('a[href*="detail"], a[href*="id"], .property-card a, .listing-item a').all();
        if (propertyLinks.length > 0) {
            console.log(`Found ${propertyLinks.length} property links`);
            await propertyLinks[0].click();
            await page.waitForTimeout(3000);
        }

        // Save all captured data
        const report = {
            timestamp: new Date().toISOString(),
            totalApiCalls: apiCalls.length,
            apiCalls,
            responses: Object.keys(responses).map(url => ({
                url,
                ...responses[url]
            }))
        };

        fs.writeFileSync(
            '/Users/samuelseidel/Development/landomo-world/yimba_api_capture.json',
            JSON.stringify(report, null, 2)
        );

        console.log('\n=== SUMMARY ===');
        console.log(`Total API calls captured: ${apiCalls.length}`);
        console.log(`Total responses captured: ${Object.keys(responses).length}`);
        console.log('\nAPI endpoints found:');
        apiCalls.forEach(call => {
            console.log(`  ${call.method} ${call.url}`);
        });

        console.log('\nData saved to: yimba_api_capture.json');

        // Take a screenshot
        await page.screenshot({
            path: '/Users/samuelseidel/Development/landomo-world/yimba_screenshot.png',
            fullPage: true
        });
        console.log('Screenshot saved to: yimba_screenshot.png');

    } catch (error) {
        console.error('Error during analysis:', error);
    }

    await page.waitForTimeout(2000);
    await browser.close();
}

analyzeYimba().catch(console.error);
