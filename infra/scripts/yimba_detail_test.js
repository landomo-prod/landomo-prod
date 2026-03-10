const https = require('https');

// Test project detail endpoints
async function testDetailEndpoints() {
    console.log('=== YIMBA Detail API Testing ===\n');

    // Test different patterns for project details
    const projectSlug = 'ahoj-park';
    const projectId = 7;

    const endpoints = [
        `https://www.yimba.sk/projekty/${projectId}?format=json`,
        `https://www.yimba.sk/projekty/${projectSlug}?format=json`,
        `https://www.yimba.sk/projekt/${projectId}?format=json`,
        `https://www.yimba.sk/projekt/${projectSlug}?format=json`,
        `https://www.yimba.sk/api/projekty/${projectId}`,
        `https://www.yimba.sk/api/projekt/${projectSlug}`,
        `https://www.yimba.sk/detail/${projectId}?format=json`,
        `https://www.yimba.sk/${projectSlug}?format=json`,
    ];

    for (const url of endpoints) {
        console.log(`\nTesting: ${url}`);
        await makeRequest(url);
    }
}

function makeRequest(url) {
    return new Promise((resolve) => {
        https.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                'Accept': 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
                'Referer': 'https://www.yimba.sk/projekty'
            }
        }, (res) => {
            let data = '';

            console.log(`  Status: ${res.statusCode}`);

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                try {
                    if (res.statusCode === 200) {
                        if (res.headers['content-type']?.includes('json')) {
                            const json = JSON.parse(data);
                            console.log(`  Success! Type: ${typeof json}`);
                            console.log(`  Sample:`, JSON.stringify(json).substring(0, 300));
                        } else {
                            console.log(`  Not JSON (${res.headers['content-type']})`);
                        }
                    }
                } catch (e) {
                    console.log(`  Error: ${e.message}`);
                }
                resolve();
            });
        }).on('error', (err) => {
            console.error(`  Request error: ${err.message}`);
            resolve();
        });
    });
}

testDetailEndpoints().catch(console.error);
