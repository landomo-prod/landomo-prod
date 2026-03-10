import { ChecksumClient } from '@landomo/core';
import { ListingsScraper } from '../scrapers/listingsScraper';
import { batchCreateEnalquilerChecksums } from '../utils/checksumExtractor';
import { addDetailJobs } from '../queue/detailQueue';
import { EnalquilerSearchConfig } from '../types/enalquilerTypes';
import { SPANISH_PROVINCES, PROPERTY_TYPES } from '../utils/fetchData';

export interface PhaseStats {
  phase1: { categoriesProcessed: number; totalListings: number; durationMs: number };
  phase2: { totalChecked: number; new: number; changed: number; unchanged: number; savingsPercent: number; durationMs: number };
  phase3: { queued: number; durationMs: number };
}

function buildSearchConfigs(): EnalquilerSearchConfig[] {
  const configs: EnalquilerSearchConfig[] = [];

  // Parse province override from env
  const provinceEnv = process.env.ENALQUILER_PROVINCES;
  const selectedProvinces = provinceEnv
    ? provinceEnv.split(',').map(p => p.trim()).filter(Boolean)
    : SPANISH_PROVINCES.map(p => p.slug);

  const provinces = SPANISH_PROVINCES.filter(p => selectedProvinces.includes(p.slug));

  for (const province of provinces) {
    for (const propType of PROPERTY_TYPES) {
      configs.push({
        propertyType: propType.typeSlug,
        estateTypeId: propType.typeId,
        province: province.slug,
        provinceDisplay: province.display,
      });
    }
  }

  return configs;
}

export async function runThreePhaseScrape(scrapeRunId?: string): Promise<PhaseStats> {
  const stats: PhaseStats = {
    phase1: { categoriesProcessed: 0, totalListings: 0, durationMs: 0 },
    phase2: { totalChecked: 0, new: 0, changed: 0, unchanged: 0, savingsPercent: 0, durationMs: 0 },
    phase3: { queued: 0, durationMs: 0 },
  };

  const checksumClient = new ChecksumClient(
    process.env.INGEST_API_URL || 'http://localhost:3000',
    process.env.INGEST_API_KEY || ''
  );

  const configs = buildSearchConfigs();
  console.log(JSON.stringify({
    level: 'info', service: 'enalquiler-scraper',
    msg: 'Starting three-phase scrape', configs: configs.length,
  }));

  const phase1Start = Date.now();

  for (const config of configs) {
    const label = `${config.propertyType}/${config.province}`;
    console.log(JSON.stringify({
      level: 'info', service: 'enalquiler-scraper',
      msg: 'Processing config', config: label,
    }));

    // Phase 1: Fetch listing IDs/summary data from search pages
    const scraper = new ListingsScraper([config]);
    const listings = await scraper.scrapeAll();
    stats.phase1.categoriesProcessed++;
    stats.phase1.totalListings += listings.length;

    if (listings.length === 0) continue;

    // Phase 2: Compare checksums to find new/changed listings
    const phase2Start = Date.now();
    const checksums = batchCreateEnalquilerChecksums(listings);

    let comparison;
    try {
      comparison = await checksumClient.compareChecksumsInBatches(
        checksums, scrapeRunId, 5000,
        (current, total) => {
          if (current % 1000 === 0) {
            console.log(JSON.stringify({
              level: 'info', service: 'enalquiler-scraper',
              msg: 'Checksum progress', config: label, current, total,
            }));
          }
        }
      );
    } catch (error: any) {
      console.error(JSON.stringify({
        level: 'error', service: 'enalquiler-scraper',
        msg: 'Checksum comparison failed', config: label, err: error.message,
      }));
      // Fall back to queueing all listings
      await addDetailJobs(listings);
      stats.phase3.queued += listings.length;
      continue;
    }

    stats.phase2.totalChecked += comparison.total;
    stats.phase2.new += comparison.new;
    stats.phase2.changed += comparison.changed;
    stats.phase2.unchanged += comparison.unchanged;
    stats.phase2.durationMs += Date.now() - phase2Start;

    // Store updated checksums
    try {
      await checksumClient.updateChecksums(checksums, scrapeRunId);
    } catch (error: any) {
      console.error(JSON.stringify({
        level: 'error', service: 'enalquiler-scraper',
        msg: 'Failed to store checksums', config: label, err: error.message,
      }));
    }

    // Phase 3: Queue detail fetch jobs for new and changed listings only
    const phase3Start = Date.now();
    const toFetchIds = new Set(
      comparison.results.filter(r => r.status !== 'unchanged').map(r => r.portalId)
    );
    const toFetch = listings.filter(l => toFetchIds.has(l.id));

    if (toFetch.length > 0) {
      await addDetailJobs(toFetch);
    }

    stats.phase3.queued += toFetch.length;
    stats.phase3.durationMs += Date.now() - phase3Start;

    console.log(JSON.stringify({
      level: 'info', service: 'enalquiler-scraper',
      msg: 'Config processed', config: label,
      new: comparison.new, changed: comparison.changed,
      unchanged: comparison.unchanged, queued: toFetch.length,
    }));
  }

  stats.phase1.durationMs = Date.now() - phase1Start;
  stats.phase2.savingsPercent = stats.phase2.totalChecked > 0
    ? Math.round((stats.phase2.unchanged / stats.phase2.totalChecked) * 100)
    : 0;

  console.log(JSON.stringify({
    level: 'info', service: 'enalquiler-scraper',
    msg: 'Three-phase complete', ...stats,
  }));
  return stats;
}
