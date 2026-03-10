/**
 * Extract and save unescaped JSON for manual inspection
 */
import { chromium } from 'playwright';
import * as fs from 'fs';

async function extract() {
  console.log('📝 Extracting and saving unescaped JSON...\n');

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
    await page.waitForTimeout(3000);

    const unescapedData = await page.evaluate(() => {
      const scripts = Array.from(document.querySelectorAll('script'));
      const resultsScript = scripts.find(s => s.textContent && s.textContent.includes('\\"results\\":['));

      if (!resultsScript || !resultsScript.textContent) return null;

      // Find the specific push call with results
      const pushCalls = resultsScript.textContent.match(/self\.__next_f\.push\(\[[\s\S]*?\]\)/g);

      if (!pushCalls) return null;

      for (const call of pushCalls) {
        if (!call.includes('\\"results\\":[')) continue;

        // Extract the content
        const match = call.match(/\[\s*\d+\s*,\s*"(.*)"\s*\]/s);
        if (!match) continue;

        let content = match[1];

        // Unescape
        content = content.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) =>
          String.fromCharCode(parseInt(hex, 16))
        );
        content = content.replace(/\\"/g, '"');
        content = content.replace(/\\n/g, '\n');
        content = content.replace(/\\r/g, '\r');
        content = content.replace(/\\t/g, '\t');

        return content;
      }

      return null;
    });

    if (unescapedData) {
      fs.writeFileSync('unescaped-with-results.txt', unescapedData);
      console.log('✅ Saved unescaped data to unescaped-with-results.txt');
      console.log(`File size: ${unescapedData.length} characters`);

      // Find where results array starts and show context
      const resultsIdx = unescapedData.indexOf('"results":[');
      if (resultsIdx !== -1) {
        console.log(`\nResults array starts at position: ${resultsIdx}`);
        console.log('\nContext around start:');
        console.log(unescapedData.substring(resultsIdx - 100, resultsIdx + 500));

        // Find what comes after - look for the next top-level key
        const afterResults = unescapedData.substring(resultsIdx + '"results":['.length);
        const nextKeyMatch = afterResults.match(/\],"([^"]+)":/);
        if (nextKeyMatch) {
          console.log(`\nNext key after results array: "${nextKeyMatch[1]}"`);
        }
      }
    } else {
      console.log('❌ No results data found');
    }

  } catch (error: any) {
    console.error('❌ Error:', error.message);
  } finally {
    await browser.close();
  }
}

extract();
