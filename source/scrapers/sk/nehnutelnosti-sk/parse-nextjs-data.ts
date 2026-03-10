/**
 * Parse Next.js App Router data from Nehnuteľnosti.sk
 */
import { chromium } from 'playwright';
import * as fs from 'fs';

async function parseData() {
  console.log('🔍 Parsing Next.js App Router data...\n');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1920, height: 1080 },
    locale: 'sk-SK',
    timezoneId: 'Europe/Bratislava'
  });

  const page = await context.newPage();

  try {
    const url = 'https://www.nehnutelnosti.sk/bratislavsky-kraj/byty/predaj/';
    console.log(`Navigating to: ${url}\n`);

    await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(5000);

    // Extract all script tags with self.__next_f.push
    const scripts = await page.evaluate(() => {
      const scriptElements = Array.from(document.querySelectorAll('script'));
      return scriptElements
        .map(s => s.textContent || '')
        .filter(text => text.includes('self.__next_f.push'));
    });

    console.log(`Found ${scripts.length} Next.js data scripts\n`);

    // Combine all the data
    let allData: any[] = [];
    scripts.forEach(script => {
      // Extract JSON data from self.__next_f.push calls
      const matches = script.match(/self\.__next_f\.push\(\[(.*?)\]\)/gs);
      if (matches) {
        matches.forEach(match => {
          try {
            // Extract the array content
            const content = match.match(/\[\s*\d+\s*,\s*"(.*)"\s*\]/s);
            if (content && content[1]) {
              // Unescape the JSON string
              const jsonStr = content[1]
                .replace(/\\"/g, '"')
                .replace(/\\n/g, '\n')
                .replace(/\\r/g, '\r')
                .replace(/\\t/g, '\t')
                .replace(/\\\\/g, '\\');

              if (jsonStr.includes('advertisements')) {
                allData.push(jsonStr);
              }
            }
          } catch (e) {
            // Skip invalid JSON
          }
        });
      }
    });

    console.log(`Extracted ${allData.length} data chunks with 'advertisements'\n`);

    // Save raw data
    fs.writeFileSync('nehnutelnosti-raw-data.json', JSON.stringify(allData, null, 2));
    console.log('✅ Raw data saved to nehnutelnosti-raw-data.json\n');

    // Try to parse and find listings
    allData.forEach((chunk, idx) => {
      if (chunk.includes('"items":')) {
        console.log(`\n📋 Chunk ${idx + 1} contains "items":`);
        console.log(chunk.substring(0, 1000));

        // Try to extract just the advertisements object
        try {
          const advertisementsMatch = chunk.match(/"advertisements":\{[^}]*?"items":\[(.*?)\]/s);
          if (advertisementsMatch) {
            console.log('\n✅ Found items array!');
            const itemsStr = advertisementsMatch[0];
            console.log('Sample:', itemsStr.substring(0, 500));
          }
        } catch (e) {
          console.log('Could not extract items');
        }
      }
    });

  } catch (error: any) {
    console.error('❌ Error:', error.message);
  } finally {
    await browser.close();
  }
}

parseData();
