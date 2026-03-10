#!/usr/bin/env ts-node

/**
 * Find the correct URLs for immodirekt.at listings
 */

import { chromium } from 'playwright';

async function findCorrectURLs() {
  console.log('Finding correct URLs for immodirekt.at...\n');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    locale: 'de-AT',
    viewport: { width: 1920, height: 1080 }
  });

  const page = await context.newPage();

  try {
    // Try the homepage first
    console.log('1. Trying homepage...');
    await page.goto('https://www.immodirekt.at', {
      waitUntil: 'networkidle',
      timeout: 60000
    });
    await page.waitForTimeout(3000);

    // Look for search links
    const searchLinks = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a[href]'));
      return links
        .map(a => ({
          text: (a as HTMLAnchorElement).textContent?.trim() || '',
          href: (a as HTMLAnchorElement).href
        }))
        .filter(l =>
          l.text.toLowerCase().includes('wohnung') ||
          l.text.toLowerCase().includes('haus') ||
          l.text.toLowerCase().includes('kaufen') ||
          l.text.toLowerCase().includes('mieten') ||
          l.text.toLowerCase().includes('suchen') ||
          l.href.includes('wohnung') ||
          l.href.includes('haus') ||
          l.href.includes('kaufen') ||
          l.href.includes('mieten')
        );
    });

    console.log('\nFound these search-related links:');
    searchLinks.slice(0, 20).forEach((link, index) => {
      console.log(`  ${index + 1}. ${link.text} -> ${link.href}`);
    });

    // Try Austria-wide search
    console.log('\n2. Trying Austria-wide search...');
    await page.goto('https://www.immodirekt.at/immobilien/oesterreich', {
      waitUntil: 'networkidle',
      timeout: 60000
    });
    await page.waitForTimeout(3000);

    const pageTitle = await page.title();
    console.log(`   Page title: ${pageTitle}`);

    const textContent = await page.evaluate(() => document.body.innerText.substring(0, 500));
    console.log(`   Page content: ${textContent.substring(0, 200)}`);

    // Check window state for properties
    const stateData = await page.evaluate(() => {
      return (window as any).__INITIAL_STATE__;
    });

    if (stateData && stateData.properties) {
      console.log(`   Properties in state: ${JSON.stringify(stateData.properties, null, 2).substring(0, 500)}`);
    }

    // Try clicking on search button
    console.log('\n3. Looking for search functionality...');
    await page.goto('https://www.immodirekt.at', {
      waitUntil: 'networkidle',
      timeout: 60000
    });
    await page.waitForTimeout(2000);

    // Try to find and click "Immobilien suchen"
    const searchButton = await page.$('text=Immobilien suchen');
    if (searchButton) {
      console.log('   Found "Immobilien suchen" button, clicking...');
      await searchButton.click();
      await page.waitForTimeout(3000);

      const newUrl = page.url();
      console.log(`   New URL: ${newUrl}`);

      const newState = await page.evaluate(() => {
        return (window as any).__INITIAL_STATE__;
      });

      if (newState && newState.properties) {
        console.log(`   Properties in new state: ${JSON.stringify(newState.properties, null, 2).substring(0, 500)}`);
      }

      // Check for form inputs
      const formData = await page.evaluate(() => {
        const inputs: any[] = [];
        document.querySelectorAll('select, input[type="text"]').forEach(el => {
          const elem = el as HTMLInputElement | HTMLSelectElement;
          inputs.push({
            tag: elem.tagName,
            name: elem.name || elem.id,
            value: elem.value,
            placeholder: (elem as HTMLInputElement).placeholder
          });
        });
        return inputs.slice(0, 10);
      });

      console.log('\n   Form inputs found:');
      formData.forEach(input => {
        console.log(`     - ${input.tag}: ${input.name} = "${input.value}" (${input.placeholder})`);
      });
    }

  } catch (error: any) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }
}

findCorrectURLs().catch(console.error);
