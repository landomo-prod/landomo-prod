#!/usr/bin/env npx ts-node
/**
 * Build Value Census — Cross-reference all portal raw values against canonical normalizers.
 *
 * Reads cached distinct-values.json from each scraper, runs values through
 * the shared normalizer functions, and generates VALUE_CENSUS.md.
 *
 * Usage:
 *   cd source/scrapers/cz/census
 *   npx ts-node build-value-census.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  normalizeDisposition,
  normalizeOwnership,
  normalizeCondition,
  normalizeConstructionType,
  normalizeEnergyRating,
  normalizeHeatingType,
  normalizeFurnished,
  CZECH_DISPOSITIONS,
  CZECH_OWNERSHIP_TYPES,
  PROPERTY_CONDITIONS,
  CONSTRUCTION_TYPES,
  ENERGY_RATINGS,
  HEATING_TYPES,
  FURNISHED_STATUSES,
} from '../shared/czech-value-mappings';
import { FIELD_CONFIGS, SCRAPERS, CATEGORY_FIELD_CONFIGS, PropertyCategory, CategoryFieldConfig } from './field-paths';

const BASE = path.resolve(__dirname, '..');

// ---- Types ----

interface FieldReport {
  types: Record<string, number>;
  non_null_count: number;
  null_count: number;
  distinct_count: number;
  all_distinct_values?: string[];
  value_counts?: Record<string, number>;
  sample_values?: any[];
}

interface CategorySection {
  listing_fields?: Record<string, FieldReport>;
  detail_fields?: Record<string, FieldReport>;
}

interface DistinctValuesData {
  meta: { scraper: string; listings_fetched: number; details_fetched: number; timestamp: string };
  listing_fields?: Record<string, FieldReport>;
  detail_fields?: Record<string, FieldReport>;
  /** Per-category sections (added by updated fetch scripts) */
  apartment?: CategorySection;
  house?: CategorySection;
  land?: CategorySection;
  commercial?: CategorySection;
}

interface ValueEntry {
  portal: string;
  rawValue: string;
  count: number;
  normalized: string | undefined;
  status: '✅' | '❌' | '⚠️';
}

// ---- Normalizer lookup ----

const NORMALIZERS: Record<string, (input: string | undefined) => string | undefined> = {
  normalizeDisposition: normalizeDisposition as any,
  normalizeOwnership: normalizeOwnership as any,
  normalizeCondition: normalizeCondition as any,
  normalizeConstructionType: normalizeConstructionType as any,
  normalizeEnergyRating: normalizeEnergyRating as any,
  normalizeHeatingType: normalizeHeatingType as any,
  normalizeFurnished: normalizeFurnished as any,
};

// ---- Load data ----

function loadPortalData(scraper: string): DistinctValuesData | null {
  const filePath = path.join(BASE, scraper, 'src', 'raw_samples', 'distinct-values.json');
  if (!fs.existsSync(filePath)) {
    console.error(`  ⚠️  Missing: ${filePath}`);
    return null;
  }
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch (err: any) {
    console.error(`  ❌ Failed to parse ${filePath}: ${err.message}`);
    return null;
  }
}

// ---- Extract values from a field report ----

function extractValuesFromPath(
  data: DistinctValuesData,
  fieldPath: string,
): { value: string; count: number }[] {
  // fieldPath is like "detail_fields.items[].value" or "listing_fields.disposition"
  const parts = fieldPath.split('.');
  const section = parts[0] as 'listing_fields' | 'detail_fields';
  const remainingPath = parts.slice(1).join('.');

  const fields = data[section];
  if (!fields) return [];

  const report = fields[remainingPath];
  if (!report) return [];

  const results: { value: string; count: number }[] = [];

  if (report.all_distinct_values && report.value_counts) {
    for (const val of report.all_distinct_values) {
      const count = report.value_counts[val] || 1;
      results.push({ value: val, count });
    }
  } else if (report.sample_values) {
    for (const val of report.sample_values) {
      results.push({ value: String(val), count: 1 });
    }
  }

  return results;
}

// ---- Build census for one field ----

function buildFieldCensus(
  fieldKey: string,
  config: typeof FIELD_CONFIGS[string],
  allData: Record<string, DistinctValuesData | null>,
): { entries: ValueEntry[]; coverage: Record<string, { total: number; mapped: number; unmapped: number; missing: boolean }> } {
  const normalizer = NORMALIZERS[config.normalizerName];
  const entries: ValueEntry[] = [];
  const coverage: Record<string, { total: number; mapped: number; unmapped: number; missing: boolean }> = {};

  for (const scraper of SCRAPERS) {
    const portalConfig = config.portals[scraper];
    const data = allData[scraper];

    if (!portalConfig || !data) {
      coverage[scraper] = { total: 0, mapped: 0, unmapped: 0, missing: true };
      continue;
    }

    let totalCount = 0;
    let mappedCount = 0;
    let unmappedCount = 0;
    const seenValues = new Set<string>();

    if (portalConfig.mode === 'direct') {
      for (const fieldPath of portalConfig.paths) {
        const values = extractValuesFromPath(data, fieldPath);
        for (const { value, count } of values) {
          if (seenValues.has(value)) continue;
          seenValues.add(value);

          const normalized = normalizer(value);
          const status = normalized ? '✅' : '❌';

          entries.push({ portal: scraper, rawValue: value, count, normalized, status });
          totalCount += count;
          if (normalized) mappedCount += count;
          else unmappedCount += count;
        }
      }
    }

    coverage[scraper] = {
      total: totalCount,
      mapped: mappedCount,
      unmapped: unmappedCount,
      missing: totalCount === 0,
    };
  }

  return { entries, coverage };
}

// ---- Generate markdown ----

function generateMarkdown(
  allData: Record<string, DistinctValuesData | null>,
): string {
  const lines: string[] = [];

  lines.push('# Czech Portal Value Census');
  lines.push('');
  lines.push(`> Generated: ${new Date().toISOString()}`);
  lines.push(`> Source: \`source/scrapers/cz/census/build-value-census.ts\``);
  lines.push('');

  // Data summary
  lines.push('## Data Sources');
  lines.push('');
  lines.push('| Portal | Listings | Details | Timestamp |');
  lines.push('|--------|----------|---------|-----------|');
  for (const scraper of SCRAPERS) {
    const data = allData[scraper];
    if (data) {
      lines.push(`| ${scraper} | ${data.meta.listings_fetched} | ${data.meta.details_fetched} | ${data.meta.timestamp.slice(0, 10)} |`);
    } else {
      lines.push(`| ${scraper} | ❌ NO DATA | — | — |`);
    }
  }
  lines.push('');

  // Overall coverage matrix
  lines.push('## Overall Coverage Matrix');
  lines.push('');
  lines.push('| Field | ' + SCRAPERS.map(s => s.replace('-cz', '')).join(' | ') + ' |');
  lines.push('|-------|' + SCRAPERS.map(() => '---').join('|') + '|');

  const allResults: Record<string, ReturnType<typeof buildFieldCensus>> = {};
  for (const [fieldKey, config] of Object.entries(FIELD_CONFIGS)) {
    const result = buildFieldCensus(fieldKey, config, allData);
    allResults[fieldKey] = result;

    const cells = SCRAPERS.map(s => {
      const cov = result.coverage[s];
      if (cov.missing) return '⚠️ N/A';
      if (cov.total === 0) return '⚠️ empty';
      const pct = Math.round((cov.mapped / cov.total) * 100);
      return `${pct}%`;
    });
    lines.push(`| **${fieldKey}** | ${cells.join(' | ')} |`);
  }
  lines.push('');

  // Per-field detail sections
  for (const [fieldKey, config] of Object.entries(FIELD_CONFIGS)) {
    const result = allResults[fieldKey];

    lines.push(`---`);
    lines.push('');
    lines.push(`## ${config.label}`);
    lines.push('');
    lines.push(`**Canonical values:** \`${config.canonicalValues.join('`, `')}\``);
    lines.push('');

    // Value table — group by portal, sort by count desc
    const sortedEntries = [...result.entries].sort((a, b) => {
      if (a.portal !== b.portal) return a.portal.localeCompare(b.portal);
      return b.count - a.count;
    });

    if (sortedEntries.length > 0) {
      lines.push('### Raw Values');
      lines.push('');
      lines.push('| Portal | Raw Value | Count | → Normalized | Status |');
      lines.push('|--------|-----------|-------|-------------|--------|');
      for (const entry of sortedEntries) {
        const rawDisplay = entry.rawValue.length > 60
          ? entry.rawValue.slice(0, 57) + '...'
          : entry.rawValue;
        lines.push(`| ${entry.portal.replace('-cz', '')} | \`${rawDisplay}\` | ${entry.count} | ${entry.normalized || '—'} | ${entry.status} |`);
      }
      lines.push('');
    }

    // Coverage summary
    lines.push('### Coverage Summary');
    lines.push('');
    lines.push('| Portal | Total | Mapped | Unmapped | Status |');
    lines.push('|--------|-------|--------|----------|--------|');
    for (const scraper of SCRAPERS) {
      const cov = result.coverage[scraper];
      if (cov.missing) {
        lines.push(`| ${scraper.replace('-cz', '')} | — | — | — | ⚠️ NOT PROVIDED |`);
      } else {
        const pct = cov.total > 0 ? Math.round((cov.mapped / cov.total) * 100) : 0;
        lines.push(`| ${scraper.replace('-cz', '')} | ${cov.total} | ${cov.mapped} | ${cov.unmapped} | ${pct}% |`);
      }
    }
    lines.push('');

    // Action items — unmapped values
    const unmapped = sortedEntries.filter(e => e.status === '❌' && e.count > 1);
    if (unmapped.length > 0) {
      lines.push('### ❌ Action Items (Unmapped Values)');
      lines.push('');
      for (const entry of unmapped) {
        lines.push(`- **${entry.portal.replace('-cz', '')}**: \`${entry.rawValue}\` (${entry.count}× seen) — needs mapping to \`${fieldKey}\``);
      }
      lines.push('');
    }
  }

  return lines.join('\n');
}

// ---- Per-Category Census ----

interface CategoryFieldResult {
  fieldKey: string;
  config: CategoryFieldConfig;
  /** portal → { hasData, sampleCount } */
  availability: Record<string, { hasData: boolean; sampleCount: number }>;
}

/**
 * Extract values from a per-category section of distinct-values.json.
 * The category section mirrors the top-level structure (listing_fields + detail_fields).
 */
function extractValuesFromCategoryPath(
  categoryData: CategorySection,
  fieldPath: string,
): { value: string; count: number }[] {
  const parts = fieldPath.split('.');
  const section = parts[0] as 'listing_fields' | 'detail_fields';
  const remainingPath = parts.slice(1).join('.');

  const fields = categoryData[section];
  if (!fields) return [];

  const report = fields[remainingPath];
  if (!report) return [];

  const results: { value: string; count: number }[] = [];

  if (report.all_distinct_values && report.value_counts) {
    for (const val of report.all_distinct_values) {
      const count = report.value_counts[val] || 1;
      results.push({ value: val, count });
    }
  } else if (report.sample_values) {
    for (const val of report.sample_values) {
      results.push({ value: String(val), count: 1 });
    }
  } else if (report.non_null_count > 0) {
    // Field exists with data but no distinct values enumerated
    results.push({ value: '(present)', count: report.non_null_count });
  }

  return results;
}

/**
 * Build census for category-specific fields.
 * Reads from per-category sections in distinct-values.json.
 */
function buildCategoryFieldCensus(
  allData: Record<string, DistinctValuesData | null>,
): Record<PropertyCategory, CategoryFieldResult[]> {
  const categories: PropertyCategory[] = ['apartment', 'house', 'land', 'commercial'];
  const result: Record<PropertyCategory, CategoryFieldResult[]> = {
    apartment: [],
    house: [],
    land: [],
    commercial: [],
  };

  for (const [fieldKey, config] of Object.entries(CATEGORY_FIELD_CONFIGS)) {
    for (const category of config.categories) {
      const availability: Record<string, { hasData: boolean; sampleCount: number }> = {};

      for (const scraper of SCRAPERS) {
        const portalConfig = config.portals[scraper];
        const data = allData[scraper];
        const categoryData = data?.[category];

        if (!portalConfig || !data) {
          availability[scraper] = { hasData: false, sampleCount: 0 };
          continue;
        }

        // Try per-category section first
        if (categoryData) {
          let totalCount = 0;
          if (portalConfig.mode === 'direct') {
            for (const fieldPath of portalConfig.paths) {
              const values = extractValuesFromCategoryPath(categoryData, fieldPath);
              for (const { count } of values) {
                totalCount += count;
              }
            }
          }
          availability[scraper] = { hasData: totalCount > 0, sampleCount: totalCount };
        } else {
          // Fall back to top-level data (pre-migration compatibility)
          let totalCount = 0;
          if (portalConfig.mode === 'direct') {
            for (const fieldPath of portalConfig.paths) {
              const values = extractValuesFromPath(data, fieldPath);
              for (const { count } of values) {
                totalCount += count;
              }
            }
          }
          availability[scraper] = { hasData: totalCount > 0, sampleCount: totalCount };
        }
      }

      result[category].push({ fieldKey, config, availability });
    }
  }

  return result;
}

/**
 * Generate the per-category section of the markdown report.
 */
function generateCategoryMarkdown(
  allData: Record<string, DistinctValuesData | null>,
): string {
  const lines: string[] = [];
  const categoryResults = buildCategoryFieldCensus(allData);
  const categories: PropertyCategory[] = ['apartment', 'house', 'land', 'commercial'];
  const categoryLabels: Record<PropertyCategory, string> = {
    apartment: 'Apartment',
    house: 'House',
    land: 'Land',
    commercial: 'Commercial',
  };

  lines.push('---');
  lines.push('');
  lines.push('## Per-Category Field Availability');
  lines.push('');
  lines.push('Fields that only apply to specific property categories.');
  lines.push('Data comes from per-category sections of distinct-values.json when available.');
  lines.push('');

  for (const category of categories) {
    const fields = categoryResults[category];
    if (fields.length === 0) continue;

    lines.push(`### ${categoryLabels[category]}`);
    lines.push('');

    // Header
    const portalHeaders = SCRAPERS.map(s => s.replace('-cz', ''));
    lines.push('| Field | ' + portalHeaders.join(' | ') + ' |');
    lines.push('|-------|' + portalHeaders.map(() => '---').join('|') + '|');

    for (const field of fields) {
      const cells = SCRAPERS.map(scraper => {
        const av = field.availability[scraper];
        if (!av) return '---';
        if (!field.config.portals[scraper]) return 'N/A';
        if (av.hasData) return `Y (${av.sampleCount})`;
        return 'empty';
      });
      lines.push(`| **${field.fieldKey}** | ${cells.join(' | ')} |`);
    }
    lines.push('');

    // Show which portals have per-category data available
    const portalsWithCategoryData = SCRAPERS.filter(s => {
      const data = allData[s];
      return data?.[category] !== undefined;
    });
    if (portalsWithCategoryData.length > 0) {
      lines.push(`*Portals with per-category \`${category}\` data: ${portalsWithCategoryData.map(s => s.replace('-cz', '')).join(', ')}*`);
    } else {
      lines.push(`*No portals have per-category \`${category}\` data yet. Using top-level fallback.*`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

// ---- Main ----

async function main() {
  const perCategory = process.argv.includes('--per-category');

  console.log('Building Czech Portal Value Census...\n');

  const allData: Record<string, DistinctValuesData | null> = {};

  for (const scraper of SCRAPERS) {
    console.log(`Loading ${scraper}...`);
    allData[scraper] = loadPortalData(scraper);
  }

  console.log('\nGenerating census report...');
  let markdown = generateMarkdown(allData);

  if (perCategory) {
    console.log('Including per-category field availability...');
    markdown += '\n' + generateCategoryMarkdown(allData);
  }

  const outPath = path.join(BASE, 'VALUE_CENSUS.md');
  fs.writeFileSync(outPath, markdown, 'utf-8');
  console.log(`\n Written: ${outPath}`);
  console.log(`   ${markdown.split('\n').length} lines, ${markdown.length} bytes`);
}

main().catch(console.error);
