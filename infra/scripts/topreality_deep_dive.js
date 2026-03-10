const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const outputDir = './topreality_analysis';

async function deepDiveAPI() {
    console.log('🔍 Deep diving into TopReality.sk API...\n');

    const browser = await chromium.launch({
        headless: false,
        slowMo: 50
    });

    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        viewport: { width: 1920, height: 1080 },
        locale: 'sk-SK',
        timezoneId: 'Europe/Bratislava'
    });

    const page = await context.newPage();

    const apiCalls = [];

    // Intercept and log all network traffic
    page.on('request', request => {
        const url = request.url();
        if (url.includes('topreality.sk') && !url.includes('privacy') &&
            (request.resourceType() === 'xhr' || request.resourceType() === 'fetch')) {
            console.log('📤 REQUEST:', request.method(), url);
            console.log('   Headers:', JSON.stringify(request.headers(), null, 2));
            if (request.postData()) {
                console.log('   POST Data:', request.postData());
            }
        }
    });

    page.on('response', async response => {
        const url = response.url();
        if (url.includes('topreality.sk') && !url.includes('privacy') &&
            (response.request().resourceType() === 'xhr' || response.request().resourceType() === 'fetch')) {
            try {
                const body = await response.text();
                let parsed = body;
                try {
                    parsed = JSON.parse(body);
                } catch (e) {}

                const apiCall = {
                    timestamp: new Date().toISOString(),
                    method: response.request().method(),
                    url: url,
                    status: response.status(),
                    requestHeaders: response.request().headers(),
                    postData: response.request().postData(),
                    responseHeaders: response.headers(),
                    responseBody: parsed
                };

                apiCalls.push(apiCall);

                console.log('📥 RESPONSE:', response.status(), url);
                console.log('   Body preview:', typeof parsed === 'string' ?
                    parsed.substring(0, 200) : JSON.stringify(parsed).substring(0, 200));
                console.log('');

                // Save individual response
                const filename = `api_call_${Date.now()}.json`;
                fs.writeFileSync(
                    path.join(outputDir, filename),
                    JSON.stringify(apiCall, null, 2)
                );
            } catch (error) {
                console.log('❌ Error processing response:', error.message);
            }
        }
    });

    try {
        // Step 1: Go directly to search page
        console.log('📍 Step 1: Navigating to search page...\n');
        await page.goto('https://www.topreality.sk/hladanie', {
            waitUntil: 'networkidle',
            timeout: 60000
        });
        await page.waitForTimeout(3000);

        // Step 2: Try to find and interact with property type filter
        console.log('📍 Step 2: Looking for property type filters...\n');

        // Look for "Byty" (apartments) filter
        try {
            const apartmentButton = await page.$('a:has-text("Byty"), button:has-text("Byty"), [data-type="byt"]');
            if (apartmentButton) {
                console.log('🏠 Clicking on apartment filter...');
                await apartmentButton.click();
                await page.waitForTimeout(3000);
            }
        } catch (e) {
            console.log('⚠️  Could not find apartment filter');
        }

        // Step 3: Try to trigger search for Bratislava
        console.log('📍 Step 3: Searching for Bratislava properties...\n');

        // Look for location input
        const locationInputs = await page.$$('input[placeholder*="lokalit"], input[name*="location"], input[id*="location"]');
        if (locationInputs.length > 0) {
            console.log('📍 Found location input, entering Bratislava...');
            await locationInputs[0].click();
            await locationInputs[0].fill('Bratislava');
            await page.waitForTimeout(2000);

            // Wait for autocomplete
            const suggestionExists = await page.$('div[class*="suggest"], ul[class*="autocomplete"], div[class*="dropdown"]');
            if (suggestionExists) {
                console.log('✅ Autocomplete appeared, selecting first option...');
                await page.keyboard.press('ArrowDown');
                await page.keyboard.press('Enter');
                await page.waitForTimeout(2000);
            }
        }

        // Step 4: Scroll to load more results
        console.log('📍 Step 4: Scrolling to load more results...\n');
        for (let i = 0; i < 5; i++) {
            await page.evaluate(() => window.scrollBy(0, 1000));
            await page.waitForTimeout(1500);
        }

        // Step 5: Try pagination
        console.log('📍 Step 5: Looking for pagination...\n');
        const nextPageLinks = await page.$$('a:has-text("Ďalšia"), a:has-text("Next"), a[rel="next"], button:has-text("Ďalšia")');
        if (nextPageLinks.length > 0) {
            console.log('➡️  Clicking next page...');
            await nextPageLinks[0].click();
            await page.waitForTimeout(3000);
        }

        // Step 6: Try to open property details
        console.log('📍 Step 6: Opening property detail page...\n');

        // Look for property cards/links
        const propertyLinks = await page.evaluate(() => {
            const links = Array.from(document.querySelectorAll('a'));
            return links
                .filter(link => {
                    const href = link.href || '';
                    return href.includes('/nehnutelnost/') || href.includes('/detail/') ||
                           href.includes('/byt/') || href.includes('/reality/');
                })
                .map(link => link.href)
                .slice(0, 3);
        });

        console.log('🏡 Found property links:', propertyLinks);

        if (propertyLinks.length > 0) {
            console.log('🔍 Opening first property detail...');
            await page.goto(propertyLinks[0], {
                waitUntil: 'networkidle',
                timeout: 60000
            });
            await page.waitForTimeout(3000);
        }

        // Wait for any final requests
        await page.waitForTimeout(5000);

    } catch (error) {
        console.error('❌ Error:', error.message);
    }

    // Save all collected API calls
    console.log('\n💾 Saving collected API calls...');

    fs.writeFileSync(
        path.join(outputDir, 'deep_dive_api_calls.json'),
        JSON.stringify(apiCalls, null, 2)
    );

    console.log(`✅ Saved ${apiCalls.length} API calls to deep_dive_api_calls.json`);

    await browser.close();
}

deepDiveAPI().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
