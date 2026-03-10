/**
 * Verify we're extracting both devProjectsInitial and results arrays
 */
import { chromium } from 'playwright';

async function verify() {
  console.log('🔍 Verifying extraction of both data sources...\n');

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

    const result = await page.evaluate(() => {
      const counts = {
        devProjects: 0,
        regularListings: 0,
        totalUnique: 0,
        devProjectIds: [] as string[],
        regularListingIds: [] as string[]
      };

      const scripts = Array.from(document.querySelectorAll('script'));
      const nextScripts = scripts
        .map(s => s.textContent || '')
        .filter(text => text.includes('self.__next_f.push'));

      const allListings: any[] = [];

      for (const script of nextScripts) {
        const hasResults = script.includes('\\"results\\":[');
        const hasDevProjects = script.includes('\\"devProjectsInitial\\":[');

        if (!hasResults && !hasDevProjects) continue;

        const matches = script.match(/self\.__next_f\.push\(\[[\s\S]*?\]\)/g);
        if (!matches) continue;

        for (const match of matches) {
          try {
            const arrayMatch = match.match(/\[\s*(\d+)\s*,\s*"([\s\S]*)"\s*\]/);
            if (!arrayMatch || !arrayMatch[2]) continue;

            let jsonStr = arrayMatch[2];

            // Unescape
            jsonStr = jsonStr.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) =>
              String.fromCharCode(parseInt(hex, 16))
            );
            jsonStr = jsonStr.replace(/\\"/g, '"');
            jsonStr = jsonStr.replace(/\\n/g, '\n');
            jsonStr = jsonStr.replace(/\\r/g, '\r');
            jsonStr = jsonStr.replace(/\\t/g, '\t');
            jsonStr = jsonStr.replace(/\\\\\"/g, '"');
            jsonStr = jsonStr.replace(/\\\\\\\\/g, '\\\\');

            // Extract devProjectsInitial
            if (jsonStr.includes('"devProjectsInitial":[')) {
              const devStart = jsonStr.indexOf('"devProjectsInitial":[');
              if (devStart !== -1) {
                let depth = 0;
                let inString = false;
                let escape = false;
                let arrayStart = devStart + '"devProjectsInitial":['.length;
                let arrayEnd = -1;

                for (let i = arrayStart; i < jsonStr.length; i++) {
                  const char = jsonStr[i];
                  if (escape) { escape = false; continue; }
                  if (char === '\\') { escape = true; continue; }
                  if (char === '"' && !escape) { inString = !inString; continue; }

                  if (!inString) {
                    if (char === '[' || char === '{') depth++;
                    if (char === ']' || char === '}') depth--;
                    if (depth < 0) { arrayEnd = i; break; }
                  }
                }

                if (arrayEnd !== -1) {
                  try {
                    const devStr = '[' + jsonStr.substring(arrayStart, arrayEnd) + ']';
                    const devProjects = JSON.parse(devStr);

                    devProjects.forEach((project: any) => {
                      if (project.id) {
                        counts.devProjects++;
                        counts.devProjectIds.push(project.id);
                        allListings.push({ id: project.id, type: 'devProject' });
                      }
                    });
                  } catch (e) {}
                }
              }
            }

            // Extract results
            if (jsonStr.includes('"results":[')) {
              const resultsStart = jsonStr.indexOf('"results":[');
              if (resultsStart !== -1) {
                let depth = 0;
                let inString = false;
                let escape = false;
                let arrayStart = resultsStart + '"results":['.length;
                let arrayEnd = -1;

                for (let i = arrayStart; i < jsonStr.length; i++) {
                  const char = jsonStr[i];
                  if (escape) { escape = false; continue; }
                  if (char === '\\') { escape = true; continue; }
                  if (char === '"' && !escape) { inString = !inString; continue; }

                  if (!inString) {
                    if (char === '[' || char === '{') depth++;
                    if (char === ']' || char === '}') depth--;
                    if (depth < 0) { arrayEnd = i; break; }
                  }
                }

                if (arrayEnd !== -1) {
                  try {
                    const resultsStr = '[' + jsonStr.substring(arrayStart, arrayEnd) + ']';
                    const results = JSON.parse(resultsStr);

                    results.forEach((result: any) => {
                      if (result.advertisement && result.advertisement.id) {
                        counts.regularListings++;
                        counts.regularListingIds.push(result.advertisement.id);
                        allListings.push({ id: result.advertisement.id, type: 'regular' });
                      }
                    });
                  } catch (e) {}
                }
              }
            }
          } catch (e) {
            continue;
          }
        }
      }

      // Count unique
      const uniqueIds = new Set(allListings.map(l => l.id));
      counts.totalUnique = uniqueIds.size;

      return counts;
    });

    console.log('Extraction Results:');
    console.log(`- Dev Projects: ${result.devProjects}`);
    console.log(`- Regular Listings: ${result.regularListings}`);
    console.log(`- Total Unique: ${result.totalUnique}`);
    console.log(`\nDev Project IDs: ${result.devProjectIds.slice(0, 5).join(', ')}${result.devProjectIds.length > 5 ? '...' : ''}`);
    console.log(`Regular Listing IDs: ${result.regularListingIds.slice(0, 5).join(', ')}${result.regularListingIds.length > 5 ? '...' : ''}`);

  } catch (error: any) {
    console.error('❌ Error:', error.message);
  } finally {
    await browser.close();
  }
}

verify();
