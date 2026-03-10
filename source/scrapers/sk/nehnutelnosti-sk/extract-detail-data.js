const fs = require('fs');

const html = fs.readFileSync('/tmp/detail-final.html', 'utf8');

console.log('📄 File size:', (html.length / 1024).toFixed(1), 'KB\n');

// Search for Next.js data
const scripts = html.match(/<script[^>]*>.*?<\/script>/gs) || [];
console.log('Found', scripts.length, 'script tags\n');

let foundData = false;

for (const script of scripts) {
  if (script.includes('self.__next_f.push') && script.length > 1000) {
    // Look for advertisement/parameters data
    if (script.includes('advertisement') || script.includes('parameters')) {
      console.log('✅ Found large Next.js script with advertisement/parameters data');
      console.log('Script size:', (script.length / 1024).toFixed(1), 'KB\n');

      // Extract specific values
      const patterns = {
        'Room Count': /"totalRoomsCount":\s*(\d+)/,
        'Condition': /"realEstateState":\s*"([^"]*)"/,
        'Area': /"area":\s*([\d.]+)/,
        'Transaction': /"transaction":\s*"([^"]*)"/,
        'Construction': /"construction[^"]*":\s*"([^"]*)"/i,
        'Heating': /"heating[^"]*":\s*"([^"]*)"/i,
        'Ownership': /"ownership[^"]*":\s*"([^"]*)"/i,
        'Energy': /"energy[^"]*":\s*"([^"]*)"/i,
      };

      console.log('🔍 Extracted Fields:\n');

      for (const [name, pattern] of Object.entries(patterns)) {
        const match = script.match(pattern);
        if (match) {
          console.log(`  ${name.padEnd(20)}: ${match[1]}`);
          foundData = true;
        }
      }

      // Show first 2000 chars of script
      console.log('\n📋 Script preview (first 2000 chars):\n');
      console.log(script.substring(0, 2000));

      break;
    }
  }
}

if (!foundData) {
  console.log('❌ No detailed parameter data found');
  console.log('\nLet me search for ANY mention of room/izb:');

  const roomMatches = html.match(/[^<>]{0,50}(room|izb|konštru|vykur)[^<>]{0,50}/gi);
  if (roomMatches) {
    roomMatches.slice(0, 10).forEach(m => console.log('  -', m.trim()));
  }
}
