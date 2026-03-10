const https = require('https');

// Test the main projects API endpoint
async function testYimbaAPI() {
    console.log('=== YIMBA API Testing ===\n');

    // Base endpoint discovered
    const baseUrl = 'https://www.yimba.sk/projekty/status/1,2,3,4/zoradenie/name/asc/archive/0?format=json';

    console.log('1. Testing main projects endpoint:');
    console.log(`URL: ${baseUrl}\n`);

    await makeRequest(baseUrl);

    // Test variations
    console.log('\n2. Testing with different status filters:');
    await makeRequest('https://www.yimba.sk/projekty/status/1/zoradenie/name/asc/archive/0?format=json');

    console.log('\n3. Testing different sorting:');
    await makeRequest('https://www.yimba.sk/projekty/status/1,2,3,4/zoradenie/name/desc/archive/0?format=json');

    console.log('\n4. Testing project detail endpoint:');
    // Try to get detail for a specific project
    await makeRequest('https://www.yimba.sk/projekt/ahoj-park?format=json');

    console.log('\n5. Testing potential search endpoint:');
    await makeRequest('https://www.yimba.sk/hladaj?q=byt&format=json');
}

function makeRequest(url) {
    return new Promise((resolve, reject) => {
        https.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                'Accept': 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
                'Referer': 'https://www.yimba.sk/'
            }
        }, (res) => {
            let data = '';

            console.log(`Status: ${res.statusCode}`);
            console.log(`Headers:`, res.headers);

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                try {
                    if (res.statusCode === 200 && data) {
                        const json = JSON.parse(data);
                        console.log(`Response type: ${Array.isArray(json) ? 'Array' : 'Object'}`);
                        console.log(`Items count: ${Array.isArray(json) ? json.length : 'N/A'}`);
                        console.log('Sample data:', JSON.stringify(json).substring(0, 500));
                    } else {
                        console.log('Response:', data.substring(0, 500));
                    }
                } catch (e) {
                    console.log('Error parsing JSON:', e.message);
                    console.log('Raw data:', data.substring(0, 500));
                }
                resolve();
            });
        }).on('error', (err) => {
            console.error('Request error:', err.message);
            resolve();
        });
    });
}

testYimbaAPI().catch(console.error);
