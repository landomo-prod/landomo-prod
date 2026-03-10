import { HttpScraper } from './src/scrapers/httpScraper';

async function analyze() {
  console.log('📊 Analyzing Nehnutelnosti.sk Real Data\n');
  
  const scraper = new HttpScraper();
  
  // Fetch ONE page of apartments from Bratislava
  const url = 'https://www.nehnutelnosti.sk/bratislavsky-kraj/byty/prenajom/';
  console.log(`Fetching: ${url}\n`);
  
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    }
  });
  
  const html = await response.text();
  const listings: any[] = (scraper as any).extractListingsFromHtml(html);
  
  console.log(`✅ Extracted ${listings.length} listings\n`);
  
  if (listings.length === 0) {
    console.log('❌ No listings found');
    return;
  }
  
  // Analyze first listing in detail
  const first = listings[0];
  console.log('📋 FIRST LISTING COMPLETE STRUCTURE:\n');
  console.log(JSON.stringify(first, null, 2));
  
  console.log('\n\n🔍 FIELD ANALYSIS ACROSS ALL LISTINGS:\n');
  
  // Get all unique keys
  const allKeys = new Set<string>();
  function extractKeys(obj: any, prefix = ''): void {
    for (const key in obj) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      allKeys.add(fullKey);
      
      if (obj[key] && typeof obj[key] === 'object' && !Array.isArray(obj[key])) {
        extractKeys(obj[key], fullKey);
      }
    }
  }
  
  listings.forEach(l => extractKeys(l));
  
  console.log(`Found ${allKeys.size} unique field paths\n`);
  console.log('All Fields:');
  Array.from(allKeys).sort().forEach(k => console.log(`  - ${k}`));
  
  // Analyze key fields
  console.log('\n\n📊 KEY FIELDS POPULATION ANALYSIS:\n');
  
  const keyFields = [
    'disposition', 'rooms', 'bedrooms', 'bathrooms',
    'construction_type', 'condition', 'heating',
    'ownership', 'energy_rating', 'items'
  ];
  
  for (const field of keyFields) {
    const populated = listings.filter(l => l[field] !== undefined && l[field] !== null && l[field] !== '').length;
    const rate = (populated / listings.length * 100).toFixed(1);
    
    // Get unique values
    const values = new Set(listings.filter(l => l[field]).map(l => JSON.stringify(l[field])));
    
    console.log(`${field.padEnd(20)} | ${populated}/${listings.length} (${rate}%) | ${values.size} unique`);
    
    if (values.size > 0 && values.size <= 10) {
      console.log(`  Values: ${Array.from(values).join(', ')}`);
    } else if (values.size > 0) {
      console.log(`  Sample: ${Array.from(values).slice(0, 3).join(', ')}`);
    }
  }
}

analyze().catch(console.error);
