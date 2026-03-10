/**
 * Show Complete Extraction Example
 */

import * as fs from 'fs';
import * as path from 'path';

// Load environment
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  const envFile = fs.readFileSync(envPath, 'utf-8');
  envFile.split('\n').forEach(line => {
    const match = line.match(/^([^=:#]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim();
      if (!process.env[key]) process.env[key] = value;
    }
  });
}

import { getLLMExtractor } from './src/services/bazosLLMExtractor';
import { BazosAd } from './src/types/bazosTypes';

async function main() {
  console.log('='.repeat(100));
  console.log('COMPLETE EXTRACTION EXAMPLE');
  console.log('='.repeat(100));
  console.log();
  
  // Load sample listing
  const samplePath = path.join(__dirname, 'sample-listing.json');
  const listing: BazosAd = JSON.parse(fs.readFileSync(samplePath, 'utf-8'));
  
  console.log('📝 INPUT TEXT:');
  console.log('='.repeat(100));
  console.log();
  console.log('TITLE:');
  console.log(listing.title);
  console.log();
  console.log('DESCRIPTION:');
  console.log(listing.description);
  console.log();
  console.log('='.repeat(100));
  console.log();
  
  // Extract
  const extractor = getLLMExtractor();
  const inputText = `${listing.title}\n\n${listing.description}`;
  
  console.log('⚙️  EXTRACTING WITH LLM (GPT-4.1, temperature 0.2)...');
  console.log();
  
  const result = await extractor.extract(inputText);
  
  console.log('='.repeat(100));
  console.log('📊 EXTRACTED DATA (JSON):');
  console.log('='.repeat(100));
  console.log();
  console.log(JSON.stringify(result.data, null, 2));
  console.log();
  console.log('='.repeat(100));
  console.log();
  
  // Summary
  console.log('📈 EXTRACTION SUMMARY:');
  console.log('-'.repeat(100));
  
  const countFields = (obj: any, prefix = ''): number => {
    let count = 0;
    for (const [key, value] of Object.entries(obj)) {
      if (value === null || value === undefined) continue;
      if (typeof value === 'object' && !Array.isArray(value)) {
        count += countFields(value, prefix ? `${prefix}.${key}` : key);
      } else if (value !== '' && !(typeof value === 'boolean' && value === false)) {
        count++;
      }
    }
    return count;
  };
  
  const totalFields = countFields(result.data);
  
  console.log(`  ✅ Total fields extracted: ${totalFields}`);
  console.log(`  ⏱️  Processing time: ${result.processingTimeMs}ms`);
  console.log(`  🪙 Tokens used: ${result.tokensUsed}`);
  console.log(`  💰 Cost: $${((result.tokensUsed || 0) / 1000 * 0.005).toFixed(6)}`);
  console.log(`  🎯 Confidence: ${result.data.extraction_metadata.confidence}`);
  console.log(`  ⚠️  Warnings: ${result.validation.warnings.length}`);
  console.log();
  console.log('='.repeat(100));
}

main().catch(console.error);
