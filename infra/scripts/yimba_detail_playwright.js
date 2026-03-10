const { chromium } = require('playwright');
const fs = require('fs');

async function captureDetailPage() {
    const browser = await chromium.launch({ headless: false });
    const page = await browser.newPage();

    const apiCalls = [];

    // Capture API calls
    page.on('request', request => {
        const url = request.url();
        const resourceType = request.resourceType();

        if (resourceType === 'xhr' || resourceType === 'fetch') {
            console.log(`[REQUEST] ${request.method()} ${url}`);
            apiCalls.push({
                method: request.method(),
                url,
                headers: request.headers()
            });
        }
    });

    page.on('response', async response => {
        const url = response.url();
        const resourceType = response.request().resourceType();

        if (resourceType === 'xhr' || resourceType === 'fetch') {
            console.log(`[RESPONSE] ${response.status()} ${url}`);
            try {
                if (response.headers()['content-type']?.includes('json')) {
                    const body = await response.json();
                    console.log('Body preview:', JSON.stringify(body).substring(0, 300));
                }
            } catch (e) {
                // Ignore
            }
        }
    });

    console.log('Navigating to project detail page...');
    await page.goto('https://www.yimba.sk/ahoj-park', { waitUntil: 'networkidle' });

    await page.waitForTimeout(3000);

    console.log(`\n\nCaptured ${apiCalls.length} API calls`);
    apiCalls.forEach(call => {
        console.log(`  ${call.method} ${call.url}`);
    });

    fs.writeFileSync(
        '/Users/samuelseidel/Development/landomo-world/yimba_detail_api.json',
        JSON.stringify(apiCalls, null, 2)
    );

    await page.screenshot({
        path: '/Users/samuelseidel/Development/landomo-world/yimba_detail_screenshot.png',
        fullPage: true
    });

    await browser.close();
}

captureDetailPage().catch(console.error);
