const puppeteer = require('puppeteer');
const fs = require('fs');

async function inspectRealityCz() {
  console.log('Launching browser...');
  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    console.log('Navigating to reality.cz...');
    const url = 'https://www.reality.cz/prodej/byty/Ceska-republika/';
    await page.goto(url, { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });

    await page.waitForTimeout(3000);

    console.log('Getting page HTML...');
    const html = await page.content();
    
    fs.writeFileSync('reality-full-page.html', html);
    console.log('✓ Saved full HTML to reality-full-page.html');

    const analysis = await page.evaluate(() => {
      const results = {
        possibleContainers: [],
        linkPatterns: [],
        dataAttributes: [],
        classPatterns: []
      };

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

        Array.from(el.attributes).forEach(attr => {
          if (attr.name.startsWith('data-')) {
            if (!results.dataAttributes.includes(attr.name)) {
              results.dataAttributes.push(attr.name);
            }
          }
        });
      });

      const links = document.querySelectorAll('a[href]');
      links.forEach(link => {
        const href = link.href;
        if (href.includes('reality.cz') && (href.includes('/prodej/') || href.includes('/L00-') || href.includes('/428-'))) {
          const pattern = href.replace(/[0-9]+/g, 'X');
          if (!results.linkPatterns.includes(pattern)) {
            results.linkPatterns.push(pattern);
          }
        }
      });

      const repeatedSelectors = {};
      allElements.forEach(el => {
        if (el.className && typeof el.className === 'string') {
          const selector = el.tagName.toLowerCase() + '.' + el.className.split(' ')[0];
          repeatedSelectors[selector] = (repeatedSelectors[selector] || 0) + 1;
        }
      });

      Object.entries(repeatedSelectors).forEach(([selector, count]) => {
        if (count >= 5 && count <= 100) {
          results.possibleContainers.push({ selector, count });
        }
      });

      return results;
    });

    console.log('\nPossible container selectors (appearing 5-100 times):');
    analysis.possibleContainers.forEach(item => {
      console.log(`  ${item.selector}: ${item.count} instances`);
    });

    console.log('\nRelevant class patterns found:');
    analysis.classPatterns.slice(0, 20).forEach(cls => {
      console.log(`  ${cls}`);
    });

    console.log('\nData attributes found:');
    analysis.dataAttributes.slice(0, 15).forEach(attr => {
      console.log(`  ${attr}`);
    });

    console.log('\nLink patterns found:');
    analysis.linkPatterns.slice(0, 10).forEach(pattern => {
      console.log(`  ${pattern}`);
    });

    fs.writeFileSync('reality-analysis.json', JSON.stringify(analysis, null, 2));
    console.log('\n✓ Saved analysis to reality-analysis.json');

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
