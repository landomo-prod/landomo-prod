const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// Create output directory
const outputDir = './topreality_analysis';
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

async function captureNetworkTraffic() {
    console.log('🚀 Starting TopReality.sk network analysis...\n');

    const browser = await chromium.launch({
        headless: false,
        slowMo: 100
    });

    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        viewport: { width: 1920, height: 1080 },
        locale: 'sk-SK',
        timezoneId: 'Europe/Bratislava'
    });

    const page = await context.newPage();

    // Storage for captured requests/responses
    const apiCalls = [];
    const graphqlCalls = [];
    const xhrCalls = [];

    // Intercept all requests
    page.on('request', request => {
        const url = request.url();
        const method = request.method();
        const resourceType = request.resourceType();

        if (resourceType === 'xhr' || resourceType === 'fetch') {
            const requestInfo = {
                timestamp: new Date().toISOString(),
                url: url,
                method: method,
                headers: request.headers(),
                postData: request.postData(),
                resourceType: resourceType
            };

            xhrCalls.push(requestInfo);

            // Check for GraphQL
            if (url.includes('graphql') || request.postData()?.includes('query')) {
                console.log('📡 GraphQL Request:', url);
                graphqlCalls.push(requestInfo);
            }

            // Check for API endpoints
            if (url.includes('/api/') || url.includes('/v1/') || url.includes('/v2/')) {
                console.log('🔌 API Request:', method, url);
                apiCalls.push(requestInfo);
            }
        }
    });

    // Intercept all responses
    page.on('response', async response => {
        const url = response.url();
        const status = response.status();
        const resourceType = response.request().resourceType();

        if (resourceType === 'xhr' || resourceType === 'fetch') {
            try {
                const headers = response.headers();
                let body = null;

                // Try to get response body
                try {
                    body = await response.text();
                    // Try to parse as JSON
                    try {
                        body = JSON.parse(body);
                    } catch (e) {
                        // Keep as text if not JSON
                    }
                } catch (e) {
                    console.log(`⚠️  Could not read response body for ${url}`);
                }

                const responseInfo = {
                    timestamp: new Date().toISOString(),
                    url: url,
                    status: status,
                    headers: headers,
                    body: body
                };

                // Find matching request and add response
                const matchingCall = xhrCalls.find(call => call.url === url && !call.response);
                if (matchingCall) {
                    matchingCall.response = responseInfo;
                }

                // Log important API responses
                if (url.includes('/api/') || url.includes('graphql') ||
                    (body && typeof body === 'object' && (body.data || body.items || body.results))) {
                    console.log(`✅ API Response [${status}]:`, url.substring(0, 80));

                    // Save significant responses
                    const filename = `response_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.json`;
                    fs.writeFileSync(
                        path.join(outputDir, filename),
                        JSON.stringify({ request: url, response: responseInfo }, null, 2)
                    );
                }
            } catch (error) {
                console.log(`❌ Error processing response: ${error.message}`);
            }
        }
    });

    try {
        // Step 1: Visit homepage
        console.log('\n📍 Step 1: Loading homepage...');
        await page.goto('https://www.topreality.sk', {
            waitUntil: 'networkidle',
            timeout: 60000
        });
        await page.waitForTimeout(3000);

        // Take screenshot
        await page.screenshot({ path: path.join(outputDir, 'screenshot_homepage.png') });
        console.log('📸 Homepage screenshot saved');

        // Step 2: Navigate to apartment listings
        console.log('\n📍 Step 2: Navigating to apartment listings...');

        // Look for apartment/property links
        const apartmentLinks = await page.$$eval('a', links =>
            links
                .filter(link => {
                    const href = link.href || '';
                    const text = link.textContent || '';
                    return href.includes('byt') || href.includes('nehnutelnost') ||
                           text.toLowerCase().includes('byt') || text.toLowerCase().includes('apartm');
                })
                .map(link => ({ href: link.href, text: link.textContent.trim() }))
                .slice(0, 5)
        );

        console.log('🏠 Found apartment links:', apartmentLinks);

        // Try to find search or listings page
        try {
            // Look for common Slovak real estate terms
            const searchButton = await page.$('a[href*="nehnutelnost"], a[href*="byt"], a[href*="predaj"], a[href*="prenajom"]');
            if (searchButton) {
                console.log('🔍 Clicking on property listings...');
                await searchButton.click();
                await page.waitForTimeout(3000);
                await page.screenshot({ path: path.join(outputDir, 'screenshot_listings.png') });
            } else {
                // Try direct URL to listings
                console.log('🔍 Trying direct listings URL...');
                await page.goto('https://www.topreality.sk/hladanie', {
                    waitUntil: 'networkidle',
                    timeout: 60000
                });
                await page.waitForTimeout(3000);
            }
        } catch (e) {
            console.log('⚠️  Navigation error, trying alternative approach...');
        }

        // Step 3: Try to trigger search/filter
        console.log('\n📍 Step 3: Attempting to trigger search...');

        // Look for search input or filter elements
        const searchInputs = await page.$$('input[type="search"], input[name*="search"], input[placeholder*="hľadať"]');
        if (searchInputs.length > 0) {
            console.log('🔎 Found search input, triggering search...');
            await searchInputs[0].type('Bratislava');
            await page.waitForTimeout(2000);

            // Look for search button
            const searchBtn = await page.$('button[type="submit"], button:has-text("Hľadať")');
            if (searchBtn) {
                await searchBtn.click();
                await page.waitForTimeout(5000);
            }
        }

        // Step 4: Scroll to trigger lazy loading
        console.log('\n📍 Step 4: Scrolling to trigger lazy loading...');
        for (let i = 0; i < 3; i++) {
            await page.evaluate(() => window.scrollBy(0, 800));
            await page.waitForTimeout(2000);
        }

        // Step 5: Try pagination
        console.log('\n📍 Step 5: Looking for pagination...');
        const paginationLinks = await page.$$eval('a', links =>
            links
                .filter(link => {
                    const text = link.textContent || '';
                    const href = link.href || '';
                    return text.match(/\d+/) || text.includes('Next') || text.includes('Ďalej') ||
                           href.includes('page') || href.includes('strana');
                })
                .map(link => ({ href: link.href, text: link.textContent.trim() }))
                .slice(0, 5)
        );

        console.log('📄 Pagination links found:', paginationLinks);

        // Step 6: Try to open a property detail
        console.log('\n📍 Step 6: Opening property detail...');
        const propertyLinks = await page.$$eval('a', links =>
            links
                .filter(link => {
                    const href = link.href || '';
                    return href.includes('detail') || href.match(/\/\d+$/);
                })
                .map(link => link.href)
                .filter(href => href.includes('topreality'))
                .slice(0, 1)
        );

        if (propertyLinks.length > 0) {
            console.log('🏡 Opening property detail:', propertyLinks[0]);
            await page.goto(propertyLinks[0], {
                waitUntil: 'networkidle',
                timeout: 60000
            });
            await page.waitForTimeout(3000);
            await page.screenshot({ path: path.join(outputDir, 'screenshot_detail.png') });
        }

        // Wait for any final requests
        await page.waitForTimeout(3000);

    } catch (error) {
        console.error('❌ Error during navigation:', error.message);
    }

    // Save all collected data
    console.log('\n💾 Saving analysis results...');

    fs.writeFileSync(
        path.join(outputDir, 'all_xhr_calls.json'),
        JSON.stringify(xhrCalls, null, 2)
    );

    fs.writeFileSync(
        path.join(outputDir, 'api_calls.json'),
        JSON.stringify(apiCalls, null, 2)
    );

    fs.writeFileSync(
        path.join(outputDir, 'graphql_calls.json'),
        JSON.stringify(graphqlCalls, null, 2)
    );

    // Generate summary report
    const summary = {
        timestamp: new Date().toISOString(),
        totalXHRCalls: xhrCalls.length,
        totalAPICalls: apiCalls.length,
        totalGraphQLCalls: graphqlCalls.length,
        uniqueEndpoints: [...new Set(xhrCalls.map(call => {
            try {
                const url = new URL(call.url);
                return url.origin + url.pathname;
            } catch {
                return call.url;
            }
        }))],
        apiEndpoints: apiCalls.map(call => ({
            method: call.method,
            url: call.url,
            hasAuth: !!call.headers.authorization || !!call.headers['x-api-key']
        }))
    };

    fs.writeFileSync(
        path.join(outputDir, 'summary.json'),
        JSON.stringify(summary, null, 2)
    );

    console.log('\n✅ Analysis complete!');
    console.log(`📊 Total XHR/Fetch calls: ${xhrCalls.length}`);
    console.log(`🔌 API calls detected: ${apiCalls.length}`);
    console.log(`📡 GraphQL calls: ${graphqlCalls.length}`);
    console.log(`📁 Results saved to: ${outputDir}/`);

    await browser.close();
}

// Run the analysis
captureNetworkTraffic().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
