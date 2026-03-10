const puppeteer = require('puppeteer');

(async () => {
  console.log('Launching browser...');
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  
  // Store GraphQL requests
  const graphqlRequests = [];
  
  // Intercept network requests
  await page.setRequestInterception(true);
  page.on('request', (request) => {
    if (request.url().includes('graphql')) {
      const postData = request.postData();
      console.log('\n=== GraphQL Request Captured ===');
      console.log('URL:', request.url());
      console.log('Method:', request.method());
      console.log('Headers:', JSON.stringify(request.headers(), null, 2));
      console.log('Payload:', postData);
      
      if (postData) {
        try {
          const payload = JSON.parse(postData);
          graphqlRequests.push({
            url: request.url(),
            payload: payload,
            headers: request.headers()
          });
        } catch (e) {
          console.log('Could not parse payload:', e.message);
        }
      }
    }
    request.continue();
  });

  console.log('Navigating to realingo.cz...');
  await page.goto('https://www.realingo.cz/prodej/byty', {
    waitUntil: 'networkidle2',
    timeout: 60000
  });

  console.log('Waiting for listings to load...');
  await page.waitForTimeout(5000);

  console.log('\n=== All GraphQL Requests ===');
  console.log(JSON.stringify(graphqlRequests, null, 2));

  // Save to file
  const fs = require('fs');
  fs.writeFileSync('graphql-requests.json', JSON.stringify(graphqlRequests, null, 2));
  console.log('\nSaved to graphql-requests.json');

  await browser.close();
})();
