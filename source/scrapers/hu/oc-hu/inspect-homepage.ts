/**
 * Inspect OC.hu homepage to find correct URL structure
 */
import { fetchWithBrowserTLS } from './src/utils/cycleTLS';
import * as cheerio from 'cheerio';
import * as fs from 'fs';

async function inspect() {
  console.log('🔍 Inspecting OC.hu homepage...\n');

  try {
    const html = await fetchWithBrowserTLS('https://oc.hu', {
      browser: 'chrome',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });

    // Save to file for inspection
    fs.writeFileSync('/tmp/oc-hu-homepage.html', html);
    console.log('✅ Saved homepage to /tmp/oc-hu-homepage.html\n');

    // Parse with Cheerio
    const $ = cheerio.load(html);

    // Look for search/listing links
    console.log('🔗 Finding listing links...\n');

    const listingLinks = new Set<string>();

    $('a[href*="ingatlan"]').each((i, el) => {
      const href = $(el).attr('href');
      if (href && (href.includes('elado') || href.includes('kiado') || href.includes('lakas') || href.includes('lista'))) {
        listingLinks.add(href);
      }
    });

    console.log('Found listing URL patterns:');
    Array.from(listingLinks).slice(0, 10).forEach(link => {
      console.log(`   ${link}`);
    });

    // Check for any search forms
    console.log('\n📝 Search forms:');
    $('form[action*="ingatlan"], form[action*="search"], form[action*="kereses"]').each((i, el) => {
      const action = $(el).attr('action');
      const method = $(el).attr('method');
      console.log(`   Form ${i + 1}: ${action} (${method})`);
    });

  } catch (error: any) {
    console.error('\n❌ Failed:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

inspect();
