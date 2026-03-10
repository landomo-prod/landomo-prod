#!/usr/bin/env node

/**
 * Hostinger API Helper Script
 * Manage domains and DNS records for Landomo VPS deployment
 */

const https = require('https');

const API_TOKEN = 'Pl3yChdocskCnJWJ6Z9atKRVrBUJVXhrRpETLBcl2d9a7e76';
const BASE_URL = 'developers.hostinger.com';
const VPS_IP = '187.77.70.123';

/**
 * Make an API request to Hostinger
 */
function apiRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: BASE_URL,
      path: path,
      method: method,
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`,
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let body = '';

      res.on('data', (chunk) => {
        body += chunk;
      });

      res.on('end', () => {
        try {
          const response = JSON.parse(body);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(response);
          } else {
            reject(new Error(`API Error ${res.statusCode}: ${JSON.stringify(response)}`));
          }
        } catch (e) {
          reject(new Error(`Failed to parse response: ${body}`));
        }
      });
    });

    req.on('error', reject);

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

/**
 * List all domains in portfolio
 */
async function listDomains() {
  console.log('📋 Fetching domain portfolio...\n');
  const response = await apiRequest('GET', '/api/domains/v1/portfolio');

  if (response.data && response.data.length > 0) {
    console.log('Your domains:');
    response.data.forEach((domain, index) => {
      console.log(`  ${index + 1}. ${domain.domain}`);
      console.log(`     Status: ${domain.status}`);
      console.log(`     Expires: ${domain.expires_at || 'N/A'}`);
      console.log();
    });
  } else {
    console.log('No domains found in portfolio.');
  }

  return response.data || [];
}

/**
 * Get DNS records for a domain
 */
async function getDnsRecords(domain) {
  console.log(`🔍 Fetching DNS records for ${domain}...\n`);
  const response = await apiRequest('GET', `/api/dns/v1/zones/${domain}`);

  if (response.data && response.data.records) {
    console.log('Current DNS records:');
    response.data.records.forEach(record => {
      console.log(`  ${record.type.padEnd(6)} ${record.name.padEnd(30)} → ${record.content}`);
    });
    console.log();
  }

  return response.data;
}

/**
 * Add or update DNS A records to point to VPS
 */
async function configureDnsForVps(domain, subdomains = []) {
  console.log(`⚙️  Configuring DNS for ${domain} → ${VPS_IP}\n`);

  // Get existing records
  const zone = await getDnsRecords(domain);
  const existingRecords = zone.records || [];

  // Filter out A records we're going to replace
  const recordsToKeep = existingRecords.filter(record => {
    if (record.type !== 'A') return true;
    if (record.name === '@' || record.name === domain) return false;
    return !subdomains.some(sub => record.name === sub || record.name === `${sub}.${domain}`);
  });

  // Add new A records
  const newRecords = [
    // Root domain
    {
      type: 'A',
      name: '@',
      content: VPS_IP,
      ttl: 3600
    },
    // Subdomains
    ...subdomains.map(sub => ({
      type: 'A',
      name: sub,
      content: VPS_IP,
      ttl: 3600
    }))
  ];

  const allRecords = [...recordsToKeep, ...newRecords];

  console.log('New DNS configuration:');
  newRecords.forEach(record => {
    const displayName = record.name === '@' ? domain : `${record.name}.${domain}`;
    console.log(`  ✓ ${record.type.padEnd(6)} ${displayName.padEnd(35)} → ${record.content}`);
  });
  console.log();

  // Update DNS zone
  const response = await apiRequest('PUT', `/api/dns/v1/zones/${domain}`, {
    records: allRecords,
    overwrite: true
  });

  console.log('✅ DNS records updated successfully!\n');
  console.log('Note: DNS propagation may take up to 48 hours, but usually completes within minutes.');

  return response;
}

/**
 * Main CLI
 */
async function main() {
  const command = process.argv[2];
  const arg1 = process.argv[3];
  const arg2 = process.argv[4];

  try {
    switch (command) {
      case 'list':
        await listDomains();
        break;

      case 'dns':
        if (!arg1) {
          console.error('Usage: node hostinger-api.js dns <domain>');
          process.exit(1);
        }
        await getDnsRecords(arg1);
        break;

      case 'configure':
        if (!arg1) {
          console.error('Usage: node hostinger-api.js configure <domain> [subdomains]');
          console.error('Example: node hostinger-api.js configure landomo.com czech,slovakia,api');
          process.exit(1);
        }
        const subdomains = arg2 ? arg2.split(',') : [];
        await configureDnsForVps(arg1, subdomains);
        break;

      case 'setup-landomo':
        // Convenience command for Landomo deployment
        if (!arg1) {
          console.error('Usage: node hostinger-api.js setup-landomo <domain>');
          console.error('Example: node hostinger-api.js setup-landomo landomo.com');
          process.exit(1);
        }
        console.log('🚀 Setting up Landomo DNS configuration...\n');
        await configureDnsForVps(arg1, [
          'czech',      // czech.landomo.com → Czech ingest API
          'slovakia',   // slovakia.landomo.com → Slovakia ingest API
          'api',        // api.landomo.com → Search API (future)
          'www'         // www.landomo.com → Frontend (future)
        ]);
        console.log('\n📊 Service URLs:');
        console.log(`  Czech Ingest:    http://czech.${arg1}:3006`);
        console.log(`  Slovakia Ingest: http://slovakia.${arg1}:3008`);
        console.log(`  Root:            http://${arg1}`);
        break;

      default:
        console.log('Hostinger API Helper');
        console.log('\nUsage:');
        console.log('  node hostinger-api.js list                              List all domains');
        console.log('  node hostinger-api.js dns <domain>                      Show DNS records');
        console.log('  node hostinger-api.js configure <domain> <subdomains>   Configure DNS to VPS');
        console.log('  node hostinger-api.js setup-landomo <domain>            Quick Landomo setup');
        console.log('\nExamples:');
        console.log('  node hostinger-api.js list');
        console.log('  node hostinger-api.js dns landomo.com');
        console.log('  node hostinger-api.js configure landomo.com czech,slovakia');
        console.log('  node hostinger-api.js setup-landomo landomo.com');
        process.exit(0);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  listDomains,
  getDnsRecords,
  configureDnsForVps
};
