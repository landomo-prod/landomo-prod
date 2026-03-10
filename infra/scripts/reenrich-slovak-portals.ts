/**
 * reenrich-slovak-portals.ts
 *
 * Audits active Slovak portal listings for missing key fields and writes
 * per-portal JSON report files containing the portal_ids and source_urls
 * of listings that need re-enrichment.
 *
 * Usage:
 *   npx ts-node scripts/reenrich-slovak-portals.ts [options]
 *
 * Options:
 *   --portal   nehnutelnosti-sk | reality-sk | topreality-sk | all  (default: all)
 *   --limit    max listings to inspect per portal                    (default: 1000)
 *   --dry-run  print summary to stdout only, do not write JSON files
 *
 * Environment variables:
 *   DB_HOST       postgres host          (default: localhost)
 *   DB_PORT       postgres port          (default: 5432)
 *   DB_NAME       database name          (default: landomo_slovakia)
 *   DB_USER       postgres user          (default: landomo)
 *   DB_PASSWORD   postgres password      (required)
 */

import { Pool, PoolClient } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MissingRecord {
  portal_id: string;
  source_url: string;
  property_category: string;
  missing_fields: string[];
}

interface PortalReport {
  portal: string;
  generated_at: string;
  total_inspected: number;
  total_missing: number;
  records: MissingRecord[];
}

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

const VALID_PORTALS = ['nehnutelnosti-sk', 'reality-sk', 'topreality-sk'] as const;
type PortalName = typeof VALID_PORTALS[number];

function parseArgs(): { portals: PortalName[]; limit: number; dryRun: boolean } {
  const args = process.argv.slice(2);

  let portalArg = 'all';
  let limit = 1000;
  let dryRun = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--portal' && args[i + 1]) {
      portalArg = args[++i];
    } else if (args[i] === '--limit' && args[i + 1]) {
      limit = parseInt(args[++i], 10);
      if (isNaN(limit) || limit <= 0) {
        console.error('--limit must be a positive integer');
        process.exit(1);
      }
    } else if (args[i] === '--dry-run') {
      dryRun = true;
    }
  }

  let portals: PortalName[];
  if (portalArg === 'all') {
    portals = [...VALID_PORTALS];
  } else if ((VALID_PORTALS as readonly string[]).includes(portalArg)) {
    portals = [portalArg as PortalName];
  } else {
    console.error(`Unknown portal "${portalArg}". Valid values: ${VALID_PORTALS.join(', ')}, all`);
    process.exit(1);
  }

  return { portals, limit, dryRun };
}

// ---------------------------------------------------------------------------
// DB helpers
// ---------------------------------------------------------------------------

function buildPool(): Pool {
  return new Pool({
    host:     process.env.DB_HOST     ?? 'localhost',
    port:     parseInt(process.env.DB_PORT ?? '5432', 10),
    database: process.env.DB_NAME     ?? 'landomo_slovakia',
    user:     process.env.DB_USER     ?? 'landomo',
    password: process.env.DB_PASSWORD,
  });
}

/**
 * Queries one partition table for active listings from a given portal that are
 * missing at least one of the key fields. Returns a flat list of MissingRecord.
 *
 * The `requiredFieldExprs` map provides field labels → SQL NULL/empty checks.
 */
async function queryMissingRecords(
  client: PoolClient,
  table: string,
  portal: PortalName,
  category: string,
  requiredFieldExprs: Record<string, string>,
  limit: number,
): Promise<MissingRecord[]> {

  // Build a CASE-based column for each checked field so we can label gaps.
  // We select them as boolean flags and reconstruct missing_fields in JS.
  const flagSelects = Object.entries(requiredFieldExprs)
    .map(([label, expr]) => `(${expr}) AS flag_${label.replace(/-/g, '_')}`)
    .join(',\n    ');

  const sql = `
    SELECT
      portal_id,
      source_url,
      ${flagSelects}
    FROM ${table}
    WHERE status = 'active'
      AND source_platform = $1
      AND (
        -- missing description
        description IS NULL OR description = '' OR LENGTH(description) < 50
        -- missing images
        OR images IS NULL OR images::text = '[]' OR images::text = '{}'
        -- missing agent contact
        OR portal_metadata IS NULL OR portal_metadata::text = '{}'
      )
    ORDER BY portal_id
    LIMIT $2
  `;

  const result = await client.query<Record<string, unknown>>(sql, [portal, limit]);

  const fieldLabels = Object.keys(requiredFieldExprs);

  return result.rows.map((row) => {
    const missing_fields: string[] = fieldLabels.filter(
      (label) => row[`flag_${label.replace(/-/g, '_')}`] === true,
    );

    return {
      portal_id:         String(row['portal_id']),
      source_url:        String(row['source_url'] ?? ''),
      property_category: category,
      missing_fields,
    };
  });
}

// ---------------------------------------------------------------------------
// Field expressions per category
// (true = field IS missing / bad)
// ---------------------------------------------------------------------------

const APARTMENT_MISSING: Record<string, string> = {
  'description':        "description IS NULL OR description = '' OR LENGTH(description) < 50",
  'images':             "images IS NULL OR images::text = '[]' OR images::text = '{}'",
  'agent-contact':      "portal_metadata IS NULL OR portal_metadata::text = '{}'",
  'apt_bedrooms':       'apt_bedrooms IS NULL',
  'apt_sqm':            'apt_sqm IS NULL OR apt_sqm = 0',
  'coordinates':        "(country_specific->>'lat') IS NULL AND (country_specific->>'lon') IS NULL",
};

const HOUSE_MISSING: Record<string, string> = {
  'description':        "description IS NULL OR description = '' OR LENGTH(description) < 50",
  'images':             "images IS NULL OR images::text = '[]' OR images::text = '{}'",
  'agent-contact':      "portal_metadata IS NULL OR portal_metadata::text = '{}'",
  'house_bedrooms':     'house_bedrooms IS NULL',
  'house_sqm_living':   'house_sqm_living IS NULL OR house_sqm_living = 0',
  'coordinates':        "(country_specific->>'lat') IS NULL AND (country_specific->>'lon') IS NULL",
};

const LAND_MISSING: Record<string, string> = {
  'description':           "description IS NULL OR description = '' OR LENGTH(description) < 50",
  'images':                "images IS NULL OR images::text = '[]' OR images::text = '{}'",
  'agent-contact':         "portal_metadata IS NULL OR portal_metadata::text = '{}'",
  'land_area_plot_sqm':    'land_area_plot_sqm IS NULL OR land_area_plot_sqm = 0',
  'coordinates':           "(country_specific->>'lat') IS NULL AND (country_specific->>'lon') IS NULL",
};

const COMMERCIAL_MISSING: Record<string, string> = {
  'description':        "description IS NULL OR description = '' OR LENGTH(description) < 50",
  'images':             "images IS NULL OR images::text = '[]' OR images::text = '{}'",
  'agent-contact':      "portal_metadata IS NULL OR portal_metadata::text = '{}'",
  'comm_sqm_total':     'comm_sqm_total IS NULL OR comm_sqm_total = 0',
  'coordinates':        "(country_specific->>'lat') IS NULL AND (country_specific->>'lon') IS NULL",
};

// ---------------------------------------------------------------------------
// Core: audit one portal across all category partitions
// ---------------------------------------------------------------------------

async function auditPortal(
  client: PoolClient,
  portal: PortalName,
  limitPerTable: number,
): Promise<PortalReport> {

  console.log(`\n  Auditing portal: ${portal} (limit ${limitPerTable} per category table)`);

  const allRecords: MissingRecord[] = [];

  const tables: Array<{
    table:  string;
    cat:    string;
    fields: Record<string, string>;
  }> = [
    { table: 'properties_apartment', cat: 'apartment', fields: APARTMENT_MISSING },
    { table: 'properties_house',     cat: 'house',     fields: HOUSE_MISSING     },
    { table: 'properties_land',      cat: 'land',      fields: LAND_MISSING      },
    { table: 'properties_commercial',cat: 'commercial', fields: COMMERCIAL_MISSING },
  ];

  for (const { table, cat, fields } of tables) {
    process.stdout.write(`    ${table} ... `);
    try {
      const records = await queryMissingRecords(client, table, portal, cat, fields, limitPerTable);
      console.log(`${records.length} missing`);
      allRecords.push(...records);
    } catch (err) {
      // Table may not exist in this DB if the partition was never created.
      console.log(`skipped (${(err as Error).message.split('\n')[0]})`);
    }
  }

  return {
    portal,
    generated_at:    new Date().toISOString(),
    total_inspected: limitPerTable * tables.length,
    total_missing:   allRecords.length,
    records:         allRecords,
  };
}

// ---------------------------------------------------------------------------
// Write report
// ---------------------------------------------------------------------------

function writeReport(report: PortalReport, outputDir: string): string {
  const filename = `missing-${report.portal}.json`;
  const filepath = path.join(outputDir, filename);
  fs.writeFileSync(filepath, JSON.stringify(report, null, 2), 'utf8');
  return filepath;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const { portals, limit, dryRun } = parseArgs();

  console.log('='.repeat(60));
  console.log('Landomo Slovak Portal Re-enrichment Audit');
  console.log('='.repeat(60));
  console.log(`Portals  : ${portals.join(', ')}`);
  console.log(`Limit    : ${limit} per category table`);
  console.log(`Dry run  : ${dryRun}`);
  console.log(`DB       : ${process.env.DB_USER ?? 'landomo'}@${process.env.DB_HOST ?? 'localhost'}:${process.env.DB_PORT ?? '5432'}/${process.env.DB_NAME ?? 'landomo_slovakia'}`);
  console.log('');

  const pool = buildPool();
  const client = await pool.connect();

  const outputDir = path.resolve(__dirname, '..', 'scripts');
  const summaryRows: Array<{ portal: string; total_missing: number; filepath: string }> = [];

  try {
    for (let i = 0; i < portals.length; i++) {
      const portal = portals[i];
      console.log(`[${i + 1}/${portals.length}] Processing ${portal}`);

      const report = await auditPortal(client, portal, limit);

      if (dryRun) {
        console.log(`  DRY RUN: would write ${report.total_missing} records to missing-${portal}.json`);
        summaryRows.push({ portal, total_missing: report.total_missing, filepath: '(dry-run)' });
      } else {
        const filepath = writeReport(report, outputDir);
        console.log(`  Written: ${filepath} (${report.total_missing} records)`);
        summaryRows.push({ portal, total_missing: report.total_missing, filepath });
      }

      // Rate limiting between portals (500ms)
      if (i < portals.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }
  } finally {
    client.release();
    await pool.end();
  }

  // Print final summary
  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  for (const row of summaryRows) {
    console.log(`  ${row.portal.padEnd(25)} ${String(row.total_missing).padStart(6)} listings need re-enrichment`);
    if (!dryRun) {
      console.log(`    -> ${row.filepath}`);
    }
  }
  const total = summaryRows.reduce((acc, r) => acc + r.total_missing, 0);
  console.log('');
  console.log(`  Total listings to re-enrich: ${total}`);
  console.log('');
  console.log('Next steps:');
  console.log('  1. Review the generated missing-{portal}.json files');
  console.log('  2. Share them with portal scraper operators');
  console.log('  3. Or feed source_urls back into the scraper for a targeted re-fetch');
  console.log('='.repeat(60));
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
