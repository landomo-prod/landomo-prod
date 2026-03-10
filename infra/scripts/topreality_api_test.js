const https = require('https');
const http = require('http');
const fs = require('fs');

// Test the discovered API endpoints

console.log('🧪 Testing TopReality.sk API endpoints...\n');

const endpoints = [
    {
        name: 'Search Location Autocomplete',
        url: 'https://www.topreality.sk/user/new_estate/searchAjax.php',
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'X-Requested-With': 'XMLHttpRequest',
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            'Accept': '*/*',
            'Referer': 'https://www.topreality.sk/hladanie/'
        },
        body: 'query=Bratislava&items='
    },
    {
        name: 'Total Properties Count',
        url: 'https://www.topreality.sk/ajax.php?form=0&searchType=string&vymera_od=0&vymera_do=0&page=estate&fromForm=1',
        method: 'GET',
        headers: {
            'X-Requested-With': 'XMLHttpRequest',
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            'Referer': 'https://www.topreality.sk/hladanie/'
        }
    },
    {
        name: 'Virtual Properties Count',
        url: 'https://www.topreality.sk/ajaxVirtual.php?form=0&searchType=string&vymera_od=0&vymera_do=0&page=estate&fromForm=1',
        method: 'GET',
        headers: {
            'X-Requested-With': 'XMLHttpRequest',
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            'Referer': 'https://www.topreality.sk/hladanie/'
        }
    },
    {
        name: 'Search with Filters (Bratislava)',
        url: 'https://www.topreality.sk/ajax.php?form=1&searchType=string&obec=c100-Bratislavský+kraj&typ_ponuky=0&typ_nehnutelnosti=0&vymera_od=0&vymera_do=0&page=estate&fromForm=1',
        method: 'GET',
        headers: {
            'X-Requested-With': 'XMLHttpRequest',
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            'Referer': 'https://www.topreality.sk/hladanie/'
        }
    }
];

async function testEndpoint(endpoint) {
    return new Promise((resolve) => {
        const url = new URL(endpoint.url);
        const options = {
            hostname: url.hostname,
            port: url.protocol === 'https:' ? 443 : 80,
            path: url.pathname + url.search,
            method: endpoint.method,
            headers: endpoint.headers
        };

        const client = url.protocol === 'https:' ? https : http;

        console.log(`\n📡 Testing: ${endpoint.name}`);
        console.log(`   URL: ${endpoint.url}`);
        console.log(`   Method: ${endpoint.method}`);

        const req = client.request(options, (res) => {
            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                console.log(`   Status: ${res.statusCode}`);
                console.log(`   Response Length: ${data.length} bytes`);

                try {
                    const parsed = JSON.parse(data);
                    console.log(`   ✅ Valid JSON response`);
                    console.log(`   Preview:`, JSON.stringify(parsed).substring(0, 200));

                    // Save response
                    fs.writeFileSync(
                        `./topreality_analysis/api_test_${endpoint.name.replace(/\s+/g, '_')}.json`,
                        JSON.stringify({ endpoint, response: parsed }, null, 2)
                    );
                } catch (e) {
                    console.log(`   Response Type: Plain text/HTML`);
                    console.log(`   Preview:`, data.substring(0, 200));

                    fs.writeFileSync(
                        `./topreality_analysis/api_test_${endpoint.name.replace(/\s+/g, '_')}.txt`,
                        data
                    );
                }

                resolve();
            });
        });

        req.on('error', (error) => {
            console.log(`   ❌ Error:`, error.message);
            resolve();
        });

        if (endpoint.body) {
            req.write(endpoint.body);
        }

        req.end();
    });
}

async function runTests() {
    for (const endpoint of endpoints) {
        await testEndpoint(endpoint);
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1s between requests
    }

    console.log('\n\n✅ All API tests complete!');
    console.log('📁 Results saved to ./topreality_analysis/');
}

runTests().catch(console.error);
