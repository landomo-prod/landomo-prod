import { chromium } from 'playwright';

/**
 * Diagnostic test to check what's actually on the immowelt.de page
 */
async function diagnosticTest() {
  console.log('\n🔍 Diagnostic Test for Immowelt.de\n');
  console.log('═══════════════════════════════════════\n');

  const browser = await chromium.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
    ]
  });

  try {
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1920, height: 1080 },
      locale: 'de-DE',
      timezoneId: 'Europe/Berlin',
    });

    // Add stealth script
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined
      });
    });

    const page = await context.newPage();

    console.log('🌐 Navigating to immowelt.de...');
    const testUrl = 'https://www.immowelt.de/suche/wohnungen/kaufen';

    await page.goto(testUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });

    // Wait a bit
    await page.waitForTimeout(5000);

    console.log('✓ Page loaded\n');

    // Check for DataDome
    console.log('🔍 Checking for DataDome...');
    const dataDomeCheck = await page.evaluate(() => {
      const bodyText = document.body.textContent || '';
      const hasDataDomeText = bodyText.includes('DataDome') || bodyText.includes('Access denied');
      const hasDataDomeElement = document.querySelector('[id*="datadome"]') !== null;
      const hasCaptcha = bodyText.includes('captcha') || bodyText.includes('CAPTCHA');

      return {
        hasDataDomeText,
        hasDataDomeElement,
        hasCaptcha,
        bodyTextPreview: bodyText.substring(0, 500)
      };
    });

    if (dataDomeCheck.hasDataDomeText || dataDomeCheck.hasDataDomeElement) {
      console.log('❌ DataDome protection detected!');
      console.log(`   Text mentions DataDome: ${dataDomeCheck.hasDataDomeText}`);
      console.log(`   DataDome elements found: ${dataDomeCheck.hasDataDomeElement}`);
    } else {
      console.log('✓ No DataDome blocking detected');
    }

    if (dataDomeCheck.hasCaptcha) {
      console.log('⚠️  CAPTCHA detected on page');
    }

    console.log('\n📄 Body text preview:');
    console.log(dataDomeCheck.bodyTextPreview);
    console.log('\n');

    // Check for __NEXT_DATA__
    console.log('🔍 Checking for __NEXT_DATA__...');
    const nextDataInfo = await page.evaluate(() => {
      const scriptTag = document.querySelector('#__NEXT_DATA__');

      if (!scriptTag) {
        return { exists: false, content: null };
      }

      const content = scriptTag.textContent || '';

      return {
        exists: true,
        length: content.length,
        preview: content.substring(0, 200),
        hasSearchData: content.includes('searchData'),
        hasPageProps: content.includes('pageProps'),
      };
    });

    if (nextDataInfo.exists) {
      console.log('✓ __NEXT_DATA__ found!');
      console.log(`   Length: ${nextDataInfo.length} characters`);
      console.log(`   Has searchData: ${nextDataInfo.hasSearchData}`);
      console.log(`   Has pageProps: ${nextDataInfo.hasPageProps}`);
      console.log('\n   Preview:');
      console.log(`   ${nextDataInfo.preview}...`);
    } else {
      console.log('❌ __NEXT_DATA__ NOT found');
    }

    // Check page structure
    console.log('\n🔍 Page structure...');
    const pageStructure = await page.evaluate(() => {
      const scripts = document.querySelectorAll('script');
      const scriptCount = scripts.length;
      const scriptTypes = Array.from(scripts).map(s => ({
        id: s.id,
        type: s.type,
        src: s.src,
        hasContent: (s.textContent?.length || 0) > 0,
        contentPreview: (s.textContent || '').substring(0, 100)
      }));

      return {
        title: document.title,
        scriptCount,
        hasH1: document.querySelector('h1') !== null,
        mainContentExists: document.querySelector('main') !== null,
        scriptInfo: scriptTypes.slice(0, 10) // First 10 scripts
      };
    });

    console.log(`   Title: ${pageStructure.title}`);
    console.log(`   Scripts: ${pageStructure.scriptCount}`);
    console.log(`   Has h1: ${pageStructure.hasH1}`);
    console.log(`   Has main: ${pageStructure.mainContentExists}`);

    console.log('\n   First 10 scripts:');
    pageStructure.scriptInfo.forEach((script, i) => {
      console.log(`   ${i + 1}. ID: ${script.id || 'none'}, Type: ${script.type || 'text/javascript'}, Has content: ${script.hasContent}`);
      if (script.id) {
        console.log(`      Preview: ${script.contentPreview}`);
      }
    });

    // Take a screenshot
    const screenshotPath = '/tmp/immowelt-diagnostic.png';
    await page.screenshot({ path: screenshotPath, fullPage: false });
    console.log(`\n📸 Screenshot saved to: ${screenshotPath}`);

    // Get HTML content sample
    console.log('\n📝 HTML sample:');
    const htmlSample = await page.content();
    console.log(htmlSample.substring(0, 1000) + '...\n');

  } catch (error: any) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
  } finally {
    await browser.close();
  }

  console.log('═══════════════════════════════════════');
  console.log('✓ Diagnostic complete\n');
}

diagnosticTest();
