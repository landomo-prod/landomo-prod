/**
 * Analyze OC.hu to determine their data delivery approach
 */
import { chromium } from 'playwright';
import * as fs from 'fs';

async function analyzeOC() {
  console.log('🔍 Analyzing OC.hu data delivery approach...\n');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    locale: 'hu-HU'
  });

  const page = await context.newPage();

  // Track all network requests
  const allRequests: any[] = [];

  page.on('request', request => {
    allRequests.push({
      url: request.url(),
      method: request.method(),
      resourceType: request.resourceType(),
      postData: request.postData()
    });
  });

  try {
    console.log('🌐 Navigating to OC.hu listings page...\n');
    await page.goto('https://oc.hu/ingatlanok/lista/ertekesites:elado', {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    console.log('⏳ Waiting for page to load...\n');
    await page.waitForTimeout(3000);

    // Check if property data is in the HTML
    console.log('🔎 Analyzing page structure...\n');

    // Look for JSON-LD structured data
    const jsonLd = await page.evaluate(() => {
      const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
      return scripts.map(s => s.textContent);
    });

    if (jsonLd.length > 0) {
      console.log(`✅ Found ${jsonLd.length} JSON-LD script(s)`);
      jsonLd.forEach((json, i) => {
        if (json && json.length < 1000) {
          console.log(`   Script ${i + 1}: ${json.substring(0, 200)}`);
        } else if (json) {
          console.log(`   Script ${i + 1}: ${json.substring(0, 200)}... (${json.length} chars)`);
        }
      });
      console.log('');
    }

    // Look for inline JavaScript data
    const inlineData = await page.evaluate(() => {
      const scripts = Array.from(document.querySelectorAll('script:not([src])'));
      const dataScripts = scripts.filter(s => {
        const text = s.textContent || '';
        return text.includes('window.') || text.includes('var ') && (
          text.includes('properties') ||
          text.includes('listings') ||
          text.includes('ingatlan')
        );
      });
      return dataScripts.map(s => {
        const text = s.textContent || '';
        return text.substring(0, 500);
      });
    });

    if (inlineData.length > 0) {
      console.log(`✅ Found ${inlineData.length} inline script(s) with potential data`);
      inlineData.slice(0, 3).forEach((data, i) => {
        console.log(`\n   Script ${i + 1}:`);
        console.log(`   ${data}...`);
      });
      console.log('');
    }

    // Check for property listings in the DOM
    const propertyCards = await page.evaluate(() => {
      // Common selectors for property cards
      const selectors = [
        '[data-property-id]',
        '[data-ad-id]',
        '[data-listing-id]',
        '.property-card',
        '.listing-card',
        '.ingatlan',
        'article',
        '[itemtype*="schema.org"]'
      ];

      for (const selector of selectors) {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
          return {
            selector,
            count: elements.length,
            sampleHtml: elements[0]?.outerHTML.substring(0, 500)
          };
        }
      }

      return null;
    });

    if (propertyCards) {
      console.log(`✅ Found ${propertyCards.count} property elements using selector: ${propertyCards.selector}`);
      console.log(`   Sample HTML: ${propertyCards.sampleHtml}...`);
      console.log('');
    }

    // Try pagination - click next page if it exists
    console.log('🔄 Looking for pagination...\n');

    const nextPageButton = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('a, button'));
      const nextBtn = buttons.find(btn => {
        const text = btn.textContent?.toLowerCase() || '';
        return text.includes('következő') ||
               text.includes('next') ||
               text.includes('tovább') ||
               btn.getAttribute('href')?.includes('page=2') ||
               btn.getAttribute('href')?.includes('oldal=2');
      });
      return nextBtn ? {
        text: nextBtn.textContent,
        href: nextBtn.getAttribute('href'),
        onclick: nextBtn.getAttribute('onclick')
      } : null;
    });

    if (nextPageButton) {
      console.log('✅ Found pagination button:');
      console.log(`   Text: ${nextPageButton.text}`);
      console.log(`   Href: ${nextPageButton.href || 'N/A'}`);
      console.log(`   OnClick: ${nextPageButton.onclick || 'N/A'}`);
      console.log('');
    }

    // Analyze network requests
    console.log('📊 Network Request Summary:');
    const requestsByType = allRequests.reduce((acc: any, req) => {
      acc[req.resourceType] = (acc[req.resourceType] || 0) + 1;
      return acc;
    }, {});

    Object.entries(requestsByType).forEach(([type, count]) => {
      console.log(`   ${type}: ${count}`);
    });

    // Check for XHR/Fetch requests
    const ajaxRequests = allRequests.filter(r =>
      r.resourceType === 'xhr' || r.resourceType === 'fetch'
    );

    if (ajaxRequests.length > 0) {
      console.log(`\n⚠️  Found ${ajaxRequests.length} XHR/Fetch request(s):`);
      ajaxRequests.forEach((req, i) => {
        console.log(`\n   ${i + 1}. ${req.method} ${req.url}`);
        if (req.postData) {
          console.log(`      POST Data: ${req.postData.substring(0, 200)}`);
        }
      });
    } else {
      console.log('\n✅ No XHR/Fetch requests - likely server-side rendering');
    }

    console.log('\n' + '='.repeat(80));
    console.log('CONCLUSION:');
    console.log('='.repeat(80));

    if (ajaxRequests.length > 0) {
      console.log('OC.hu uses client-side API calls - we can intercept them');
    } else if (propertyCards && propertyCards.count > 0) {
      console.log('OC.hu uses server-side rendering - HTML scraping required');
      console.log(`Property data is embedded in HTML using selector: ${propertyCards.selector}`);
    } else {
      console.log('Could not determine data delivery method - needs manual investigation');
    }

  } catch (error: any) {
    console.error(`\n❌ Error: ${error.message}`);
  } finally {
    await browser.close();
  }
}

analyzeOC();
