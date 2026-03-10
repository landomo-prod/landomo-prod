/**
 * Find Zenga.hu API endpoints from JavaScript bundles
 */
import { fetchWithBrowserTLS } from './src/utils/cycleTLS';
import * as cheerio from 'cheerio';

async function findApi() {
  console.log('🔍 Searching for Zenga.hu API endpoints...\n');

  try {
    const url = 'https://zenga.hu/budapest+elado+lakas';
    const html = await fetchWithBrowserTLS(url, {
      browser: 'chrome',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });

    const $ = cheerio.load(html);

    // Find all script sources
    console.log('📦 JavaScript bundles:\n');
    const scripts: string[] = [];
    $('script[src]').each((i, el) => {
      const src = $(el).attr('src');
      if (src) {
        scripts.push(src.startsWith('http') ? src : `https://zenga.hu${src}`);
        console.log(`   ${src}`);
      }
    });

    // Search for API patterns in HTML
    console.log('\n🔍 API patterns in HTML:\n');
    const apiPatterns = [
      /https?:\/\/[^"'\s]+\/api\/[^"'\s]+/gi,
      /https?:\/\/api\.[^"'\s]+/gi,
      /baseUrl['"]\s*:\s*['"]([^"']+)['"]/gi,
      /apiUrl['"]\s*:\s*['"]([^"']+)['"]/gi,
      /endpoint['"]\s*:\s*['"]([^"']+)['"]/gi,
    ];

    for (const pattern of apiPatterns) {
      const matches = html.matchAll(pattern);
      for (const match of matches) {
        console.log(`   Found: ${match[0]}`);
      }
    }

    // Try common API endpoint patterns
    console.log('\n🧪 Testing common API patterns:\n');
    const apiEndpoints = [
      'https://api.zenga.hu/properties',
      'https://zenga.hu/api/properties',
      'https://zenga.hu/api/listings',
      'https://zenga.hu/api/search',
      'https://api.zenga.hu/search',
      'https://api.zenga.hu/v1/properties',
      'https://graphql.zenga.hu/graphql',
      'https://zenga.hu/graphql',
    ];

    for (const endpoint of apiEndpoints) {
      try {
        const response = await fetchWithBrowserTLS(endpoint, {
          browser: 'chrome',
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          maxRetries: 1
        });

        console.log(`   ✅ ${endpoint} - HTTP 200 (${response.length} chars)`);
        if (response.length < 500) {
          console.log(`      Response: ${response.substring(0, 200)}`);
        }
      } catch (error: any) {
        console.log(`   ❌ ${endpoint} - ${error.message}`);
      }
    }

    // Look for GraphQL endpoints (common in modern Angular apps)
    console.log('\n🔍 Searching for GraphQL references:\n');
    if (html.includes('graphql') || html.includes('GraphQL') || html.includes('apollo')) {
      console.log('   ✅ Found GraphQL references in HTML');
      const graphqlMatches = html.match(/graphql[^"'\s]*/gi);
      if (graphqlMatches) {
        graphqlMatches.forEach(match => console.log(`      ${match}`));
      }
    }

    // Look for API base URLs in scripts
    console.log('\n🔍 Downloading main JavaScript bundle...\n');
    if (scripts.length > 0) {
      const mainScript = scripts.find(s => s.includes('main') || s.includes('runtime')) || scripts[0];
      console.log(`   Fetching: ${mainScript}\n`);

      try {
        const js = await fetchWithBrowserTLS(mainScript, {
          browser: 'chrome',
          maxRetries: 1
        });

        console.log(`   Bundle size: ${js.length} chars`);

        // Search for API URLs in the bundle
        const urlPatterns = [
          /https?:\/\/[a-z0-9.-]+zenga\.hu[^"'\s]*/gi,
          /\/api\/[a-z0-9/-]+/gi,
          /"properties"[^{]*{[^}]*url[^}]*}/gi,
        ];

        console.log('\n   Found URLs in bundle:');
        for (const pattern of urlPatterns) {
          const matches = [...new Set(js.match(pattern) || [])];
          if (matches.length > 0) {
            matches.slice(0, 10).forEach(match => console.log(`      ${match}`));
          }
        }
      } catch (error: any) {
        console.log(`   ❌ Failed to fetch bundle: ${error.message}`);
      }
    }

  } catch (error: any) {
    console.error('\n❌ Failed:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

findApi();
