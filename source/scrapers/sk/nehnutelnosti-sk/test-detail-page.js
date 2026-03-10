const axios = require('axios');
const cheerio = require('cheerio');

async function analyzeDetailPage() {
  const url = 'https://www.nehnutelnosti.sk/detail/JuRp6AR21pw';
  console.log('🔍 Fetching detail page:', url);
  console.log('');

  const response = await axios.get(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' }
  });

  const html = response.data;
  const $ = cheerio.load(html);

  console.log(`✅ Page loaded (${(html.length / 1024).toFixed(1)} KB)`);
  console.log('');

  // Extract Next.js embedded data
  let allData = [];

  $('script').each((_, element) => {
    const content = $(element).html() || '';

    if (content.includes('self.__next_f.push') && content.includes('JuRp6AR21pw')) {
      // Try to extract JSON chunks
      const matches = content.match(/self\.__next_f\.push\(\[\s*\d+\s*,\s*"([^"]+)"\s*\]\)/g);

      if (matches) {
        matches.forEach(match => {
          const jsonMatch = match.match(/\[\s*\d+\s*,\s*"(.+)"\s*\]/);
          if (jsonMatch && jsonMatch[1]) {
            try {
              const unescaped = JSON.parse('"' + jsonMatch[1] + '"');

              // Look for specific fields
              if (unescaped.includes('"parameters"')) {
                allData.push(unescaped);
              }
            } catch (e) {
              // Skip invalid JSON
            }
          }
        });
      }
    }
  });

  console.log(`📦 Found ${allData.length} data chunks with "parameters"`);
  console.log('');

  // Analyze the data
  for (const data of allData.slice(0, 3)) {
    // Look for common field patterns
    const fields = {
      'disposition': /dispozícia|disposition|room|izb/i,
      'construction': /konštrukcia|construction|tehla|panel/i,
      'heating': /vykurovanie|heating|ústredné/i,
      'ownership': /vlastníctvo|ownership/i,
      'floor': /podlazie|poschodie|floor/i,
      'energy': /energetick.*trieda|energy.*class/i,
      'bathrooms': /kúpeľn|bathroom|wc/i,
      'balcony': /balkón|balcony/i,
      'parking': /parkovanie|parking|garáž/i
    };

    for (const [name, pattern] of Object.entries(fields)) {
      if (pattern.test(data)) {
        const match = data.match(new RegExp(`["\\\\'](${pattern.source})["\\\\']\s*:\s*["\\\\'\\{]([^"\\\\'}]+)`, 'i'));
        if (match) {
          console.log(`✅ ${name.padEnd(15)}: Found - "${match[2].substring(0, 50)}"`);
        } else {
          console.log(`⚠️  ${name.padEnd(15)}: Pattern matched but couldn't extract value`);
        }
      }
    }
  }

  console.log('\n\n📋 Sample data chunk (first 1000 chars):\n');
  if (allData.length > 0) {
    console.log(allData[0].substring(0, 1000));
  }
}

analyzeDetailPage().catch(err => {
  console.error('Error:', err.message);
});
