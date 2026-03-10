import puppeteer from 'puppeteer';

async function captureGraphQLRequests() {
  console.log('Launching browser...');
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  // Capture network requests
  const graphqlRequests: any[] = [];

  page.on('request', request => {
    if (request.url().includes('/graphql')) {
      const postData = request.postData();
      if (postData) {
        try {
          const parsed = JSON.parse(postData);
          graphqlRequests.push({
            url: request.url(),
            method: request.method(),
            headers: request.headers(),
            postData: parsed
          });
        } catch (e) {
          console.error('Failed to parse GraphQL request:', e);
        }
      }
    }
  });

  console.log('Navigating to Realingo...');
  await page.goto('https://www.realingo.cz/prodej/byty', {
    waitUntil: 'networkidle2',
    timeout: 60000
  });

  console.log('\n=== Captured GraphQL Requests ===\n');

  if (graphqlRequests.length === 0) {
    console.log('No GraphQL requests captured.');
  } else {
    graphqlRequests.forEach((req, idx) => {
      console.log(`\n--- Request ${idx + 1} ---`);
      console.log('URL:', req.url);
      console.log('Method:', req.method);
      console.log('\nQuery:');
      console.log(req.postData.query);
      console.log('\nVariables:');
      console.log(JSON.stringify(req.postData.variables, null, 2));
    });
  }

  await browser.close();
}

captureGraphQLRequests().catch(console.error);
