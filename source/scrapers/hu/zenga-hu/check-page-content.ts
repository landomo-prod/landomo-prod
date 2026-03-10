import { chromium } from 'playwright';

async function checkPage() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  console.log('Loading page...');
  await page.goto('https://www.zenga.hu/budapest+elado+lakas', { 
    waitUntil: 'networkidle' 
  });
  
  await page.waitForTimeout(5000);
  
  // Check page content
  const content = await page.evaluate(() => {
    return {
      title: document.title,
      bodyText: document.body.textContent?.substring(0, 500),
      h1: document.querySelector('h1')?.textContent,
      h2: Array.from(document.querySelectorAll('h2')).map(h => h.textContent).slice(0, 3),
      links: Array.from(document.querySelectorAll('a')).filter(a => 
        a.href.includes('/i/') || a.textContent?.toLowerCase().includes('lakás') ||
        a.textContent?.toLowerCase().includes('ház')
      ).slice(0, 10).map(a => ({
        text: a.textContent?.substring(0, 50),
        href: a.href
      }))
    };
  });
  
  console.log('Page content:', JSON.stringify(content, null, 2));
  
  await page.waitForTimeout(3000);
  await browser.close();
}

checkPage().catch(console.error);
