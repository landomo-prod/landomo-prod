import puppeteer from 'puppeteer';
import * as fs from 'fs';

async function inspectRealityCz() {
  console.log('Launching browser...');
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    
    // Set user agent to avoid detection
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    console.log('Navigating to reality.cz...');
    const url = 'https://www.reality.cz/prodej/byty/Ceska-republika/';
    await page.goto(url, { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });

    // Wait a bit for any dynamic content
    await page.waitForTimeout(3000);

    console.log('Getting page HTML...');
    const html = await page.content();
    
    // Save full HTML
    fs.writeFileSync('reality-full-page.html', html);
    console.log('✓ Saved full HTML to reality-full-page.html');

    // Try to find common property listing patterns
    console.log('\n--- Analyzing HTML structure ---\n');
    
    const analysis = await page.evaluate(() => {
      const results: any = {
        possibleContainers: [],
        linkPatterns: [],
        dataAttributes: [],
        classPatterns: []
      };

      // Find elements with "property", "item", "card", "listing", "offer" in class names
      const allElements = document.querySelectorAll('*');
      const classKeywords = ['property', 'item', 'card', 'listing', 'offer', 'advert', 'estate'];
      
      allElements.forEach(el => {
        const classes = el.className;
        if (typeof classes === 'string' && classes) {
          classKeywords.forEach(keyword => {
            if (classes.toLowerCase().includes(keyword)) {
              if (!results.classPatterns.includes(classes)) {
                results.classPatterns.push(classes);
              }
            }
          });
        }

        // Check for data attributes
        Array.from(el.attributes).forEach(attr => {
          if (attr.name.startsWith('data-')) {
            if (!results.dataAttributes.includes(attr.name)) {
              results.dataAttributes.push(attr.name);
            }
          }
        });
      });

      // Find all links that might be property links
      const links = document.querySelectorAll('a[href]');
      links.forEach(link => {
        const href = (link as HTMLAnchorElement).href;
        if (href.includes('reality.cz') && (href.includes('/prodej/') || href.includes('/L00-') || href.includes('/428-'))) {
          const pattern = href.replace(/[0-9]+/g, 'X');
          if (!results.linkPatterns.includes(pattern)) {
            results.linkPatterns.push(pattern);
          }
        }
      });

      // Look for repeated structures (likely listing containers)
      const repeatedSelectors: { [key: string]: number } = {};
      allElements.forEach(el => {
        if (el.className && typeof el.className === 'string') {
          const selector = el.tagName.toLowerCase() + '.' + el.className.split(' ')[0];
          repeatedSelectors[selector] = (repeatedSelectors[selector] || 0) + 1;
        }
      });

      // Find selectors that appear multiple times (likely listing items)
      Object.entries(repeatedSelectors).forEach(([selector, count]) => {
        if (count >= 5 && count <= 100) { // Reasonable range for listings per page
          results.possibleContainers.push({ selector, count });
        }
      });

      return results;
    });

    console.log('Possible container selectors (appearing 5-100 times):');
    analysis.possibleContainers.forEach((item: any) => {
      console.log(`  ${item.selector}: ${item.count} instances`);
    });

    console.log('\nRelevant class patterns found:');
    analysis.classPatterns.slice(0, 20).forEach((cls: string) => {
      console.log(`  ${cls}`);
    });

    console.log('\nData attributes found:');
    analysis.dataAttributes.slice(0, 15).forEach((attr: string) => {
      console.log(`  ${attr}`);
    });

    console.log('\nLink patterns found:');
    analysis.linkPatterns.slice(0, 10).forEach((pattern: string) => {
      console.log(`  ${pattern}`);
    });

    // Save analysis
    fs.writeFileSync('reality-analysis.json', JSON.stringify(analysis, null, 2));
    console.log('\n✓ Saved analysis to reality-analysis.json');

    // Take a screenshot
    await page.screenshot({ path: 'reality-page-screenshot.png', fullPage: true });
    console.log('✓ Saved screenshot to reality-page-screenshot.png');

  } catch (error) {
    console.error('Error:', error);
    throw error;
  } finally {
    await browser.close();
  }
}

inspectRealityCz().catch(console.error);
