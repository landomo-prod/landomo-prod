/**
 * Migration Script: Add ScrapeRunTracker to all scrapers
 *
 * Finds all scraper index.ts files and adds ScrapeRunTracker lifecycle
 * tracking (start/complete/fail) using string-based transformations.
 *
 * Usage: npx tsx scripts/migrate-scraper-tracking.ts [--dry-run]
 */

import * as fs from 'fs';
import * as path from 'path';

const SCRAPERS_DIR = path.resolve(__dirname, '..', 'scrapers');
const DRY_RUN = process.argv.includes('--dry-run');

interface MigrationResult {
  file: string;
  portal: string;
  status: 'migrated' | 'already-migrated' | 'skipped' | 'error';
  reason?: string;
}

function findPortalConst(content: string): string | null {
  // Match: const PORTAL = 'some-portal';
  const match = content.match(/const\s+PORTAL\s*=\s*['"]([^'"]+)['"]/);
  return match ? match[1] : null;
}

function isFullyMigrated(content: string): boolean {
  return content.includes('tracker.start()');
}

function hasImport(content: string): boolean {
  return content.includes("import { ScrapeRunTracker } from '@landomo/core'");
}

function addImport(content: string): string {
  // Insert after the first import line (import express from 'express';)
  const firstImportEnd = content.indexOf('\n', content.indexOf('import '));
  if (firstImportEnd === -1) return content;

  return (
    content.slice(0, firstImportEnd + 1) +
    "import { ScrapeRunTracker } from '@landomo/core';\n" +
    content.slice(firstImportEnd + 1)
  );
}

function addTrackerCalls(content: string): { content: string; success: boolean; reason?: string } {
  let result = content;

  // 1. Add tracker init + start after "const startTime = Date.now();"
  const startTimePattern = '  const startTime = Date.now();\n';
  const startTimeIdx = result.indexOf(startTimePattern);
  if (startTimeIdx === -1) {
    return { content, success: false, reason: 'Could not find "const startTime = Date.now();"' };
  }

  const afterStartTime = startTimeIdx + startTimePattern.length;
  result =
    result.slice(0, afterStartTime) +
    '  const tracker = new ScrapeRunTracker(PORTAL);\n' +
    '  await tracker.start();\n' +
    result.slice(afterStartTime);

  // 2. Add tracker.complete() for early return on empty listings
  //    Pattern: "if (listings.length === 0) {\n      console.log(...);\n      return;\n    }"
  const emptyListingsPattern = /if \(listings\.length === 0\) \{\n\s+console\.log\([^)]+\);\n\s+return;\n\s+\}/;
  const emptyMatch = result.match(emptyListingsPattern);
  if (emptyMatch && emptyMatch.index !== undefined) {
    const oldBlock = emptyMatch[0];
    // Replace the "return;" with tracker.complete() + return
    const newBlock = oldBlock.replace(
      /return;\n/,
      'await tracker.complete({ listings_found: 0, listings_new: 0, listings_updated: 0 });\n      return;\n'
    );
    result = result.replace(oldBlock, newBlock);
  }

  // 3. Add tracker.complete() after the batch loop, before the duration log
  //    Anchor: the line "    const duration = ((Date.now() - startTime)"
  const durationPattern = '\n    const duration = ((Date.now() - startTime)';
  const durationIdx = result.indexOf(durationPattern);
  if (durationIdx === -1) {
    return { content, success: false, reason: 'Could not find duration calculation line' };
  }

  result =
    result.slice(0, durationIdx) +
    '\n\n    await tracker.complete({ listings_found: listings.length, listings_new: 0, listings_updated: 0 });' +
    result.slice(durationIdx);

  // 4. Add tracker.fail() in the catch block, before the error log
  //    Anchor: "} catch (error: any) {\n    console.error("
  //    We need to insert "await tracker.fail();\n" before the console.error
  const catchPattern = /\} catch \(error: any\) \{\n(\s+)console\.error\('❌ Scrape failed/;
  const catchMatch = result.match(catchPattern);
  if (catchMatch && catchMatch.index !== undefined) {
    const indent = catchMatch[1]; // preserve indentation
    const insertPos = catchMatch.index + '} catch (error: any) {\n'.length;
    result =
      result.slice(0, insertPos) +
      indent + 'await tracker.fail();\n' +
      result.slice(insertPos);
  } else {
    return { content, success: false, reason: 'Could not find catch block pattern' };
  }

  return { content: result, success: true };
}

async function main() {
  console.log(`\nScrapeRunTracker Migration Script`);
  console.log(`=================================`);
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no files will be modified)' : 'LIVE'}`);
  console.log(`Scrapers dir: ${SCRAPERS_DIR}\n`);

  // Find all scraper index.ts files: scrapers/<Country>/<portal>/src/index.ts
  const files: string[] = [];
  for (const country of fs.readdirSync(SCRAPERS_DIR)) {
    const countryDir = path.join(SCRAPERS_DIR, country);
    if (!fs.statSync(countryDir).isDirectory()) continue;
    for (const portal of fs.readdirSync(countryDir)) {
      const indexFile = path.join(countryDir, portal, 'src', 'index.ts');
      if (fs.existsSync(indexFile)) {
        files.push(indexFile);
      }
    }
  }

  if (files.length === 0) {
    console.log('No scraper files found.');
    return;
  }

  console.log(`Found ${files.length} scraper files.\n`);

  const results: MigrationResult[] = [];

  for (const file of files.sort()) {
    const relativePath = path.relative(SCRAPERS_DIR, file);
    const content = fs.readFileSync(file, 'utf-8');
    const portal = findPortalConst(content);

    if (!portal) {
      results.push({ file: relativePath, portal: '?', status: 'skipped', reason: 'No PORTAL constant found' });
      continue;
    }

    // Check if fully migrated (has tracker.start())
    if (isFullyMigrated(content)) {
      results.push({ file: relativePath, portal, status: 'already-migrated' });
      continue;
    }

    // Check if runScraper function exists
    if (!content.includes('async function runScraper')) {
      results.push({ file: relativePath, portal, status: 'skipped', reason: 'No runScraper function found' });
      continue;
    }

    // Step 1: Ensure import exists
    let modified = hasImport(content) ? content : addImport(content);

    // Step 2: Add tracker calls
    const { content: finalContent, success, reason } = addTrackerCalls(modified);

    if (!success) {
      results.push({ file: relativePath, portal, status: 'error', reason });
      continue;
    }

    // Write file
    if (!DRY_RUN) {
      fs.writeFileSync(file, finalContent, 'utf-8');
    }

    results.push({ file: relativePath, portal, status: 'migrated' });
  }

  // Report
  console.log('\nResults:');
  console.log('--------');

  const migrated = results.filter(r => r.status === 'migrated');
  const alreadyMigrated = results.filter(r => r.status === 'already-migrated');
  const skipped = results.filter(r => r.status === 'skipped');
  const errors = results.filter(r => r.status === 'error');

  if (migrated.length > 0) {
    console.log(`\n${DRY_RUN ? 'Would migrate' : 'Migrated'} (${migrated.length}):`);
    for (const r of migrated) {
      console.log(`  + ${r.portal} (${r.file})`);
    }
  }

  if (alreadyMigrated.length > 0) {
    console.log(`\nAlready migrated (${alreadyMigrated.length}):`);
    for (const r of alreadyMigrated) {
      console.log(`  = ${r.portal} (${r.file})`);
    }
  }

  if (skipped.length > 0) {
    console.log(`\nSkipped (${skipped.length}):`);
    for (const r of skipped) {
      console.log(`  - ${r.portal}: ${r.reason} (${r.file})`);
    }
  }

  if (errors.length > 0) {
    console.log(`\nErrors (${errors.length}):`);
    for (const r of errors) {
      console.log(`  ! ${r.portal}: ${r.reason} (${r.file})`);
    }
  }

  console.log(`\nSummary: ${migrated.length} migrated, ${alreadyMigrated.length} already done, ${skipped.length} skipped, ${errors.length} errors`);

  if (errors.length > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Migration script failed:', err);
  process.exit(1);
});
