import { ChecksumClient } from '@landomo/core';
import { scrapeAll, launchBrowser, fetchDetailPage } from '../scrapers/listingsScraper';
import { batchCreateImmobiliareChecksums } from '../utils/checksumExtractor';
import { transformImmobiliareToStandard } from '../transformers/immobiliareTransformer';
import { IngestAdapter } from '../adapters/ingestAdapter';
import { ImmobiliareResult, SearchConfig } from '../types/immobiliareTypes';

const INGEST_BATCH_SIZE = 100;

function log(level: string, msg: string, extra?: Record<string, unknown>): void {
  console.log(JSON.stringify({ level, service: 'immobiliare-scraper', msg, ...extra }));
}

export interface PhaseStats {
  phase1: { totalListings: number; durationMs: number };
  phase2: { totalChecked: number; new: number; changed: number; unchanged: number; savingsPercent: number; durationMs: number };
  phase3: { ingested: number; durationMs: number };
}

/**
 * Simplified Three-Phase Orchestrator (no BullMQ, runs locally)
 *
 * For each page of search results:
 *   Phase 1: Playwright fetches the page → ImmobiliareResult[]
 *   Phase 2: Compare checksums with VPS API → identify new / changed
 *   Phase 3: Transform new/changed → POST to VPS bulk-ingest immediately
 *
 * All three phases happen inline, one page at a time.
 */
export async function runThreePhaseScrape(scrapeRunId?: string): Promise<PhaseStats> {
  const stats: PhaseStats = {
    phase1: { totalListings: 0, durationMs: 0 },
    phase2: { totalChecked: 0, new: 0, changed: 0, unchanged: 0, savingsPercent: 0, durationMs: 0 },
    phase3: { ingested: 0, durationMs: 0 },
  };

  const ingestApiUrl = process.env.INGEST_API_URL || 'http://46.225.167.44:3007';
  const ingestApiKey = process.env.INGEST_API_KEY_IMMOBILIARE_IT || process.env.INGEST_API_KEY || 'italy_63anzfHjb1E18vbuQt8lWx8w';

  const checksumClient = new ChecksumClient(ingestApiUrl, ingestApiKey);
  const adapter = new IngestAdapter('immobiliare.it');

  const startTime = Date.now();
  log('info', 'Three-phase scrape started', { ingestApiUrl });

  // Pending ingest buffer – flushed whenever it reaches INGEST_BATCH_SIZE
  let ingestBuffer: Array<{ portalId: string; data: any; rawData: any }> = [];

  async function flushIngestBuffer(): Promise<void> {
    if (ingestBuffer.length === 0) return;
    const batch = ingestBuffer.splice(0, ingestBuffer.length);
    try {
      await adapter.sendProperties(batch);
      stats.phase3.ingested += batch.length;
      log('info', 'Ingest batch sent', { count: batch.length, totalIngested: stats.phase3.ingested });
    } catch (err: any) {
      log('error', 'Ingest batch failed', { count: batch.length, err: err.message });
    }
  }

  /**
   * Called by scrapeAll for every page of results.
   * Runs phases 2 & 3 inline before returning so scraping stays rate-limited.
   */
  const onBatch = async (page: ImmobiliareResult[], config: SearchConfig): Promise<void> => {
    stats.phase1.totalListings += page.length;

    // ---- Phase 2: checksum comparison ----
    const p2Start = Date.now();
    const checksums = batchCreateImmobiliareChecksums(page);

    let comparison: Awaited<ReturnType<typeof checksumClient.compareChecksumsInBatches>>;
    try {
      comparison = await checksumClient.compareChecksumsInBatches(checksums, scrapeRunId);
    } catch (err: any) {
      log('warn', 'Checksum compare failed – treating all as new', {
        region: config.region,
        category: config.category,
        err: err.message,
      });
      // Treat all as new on checksum failure so we never lose data
      comparison = {
        scrapeRunId: scrapeRunId || '',
        total: page.length,
        new: page.length,
        changed: 0,
        unchanged: 0,
        results: page.map(r => ({ portalId: String(r.realEstate.id), status: 'new' as const, newHash: '' })),
      };
    }

    stats.phase2.totalChecked += comparison.total;
    stats.phase2.new += comparison.new;
    stats.phase2.changed += comparison.changed;
    stats.phase2.unchanged += comparison.unchanged;
    stats.phase2.durationMs += Date.now() - p2Start;

    // Fire-and-forget checksum update (mark as seen)
    checksumClient.updateChecksums(checksums, scrapeRunId).catch(() => {});

    // ---- Phase 3: fetch detail pages + transform + ingest ----
    const p3Start = Date.now();
    const changedIds = new Set(
      comparison.results
        .filter(r => r.status !== 'unchanged')
        .map(r => r.portalId),
    );

    const toIngest = page.filter(r => changedIds.has(String(r.realEstate.id)));

    // Reuse the already-open browser context for detail page fetches
    const context = await launchBrowser();

    for (const result of toIngest) {
      try {
        // Fetch full detail page – fall back to search result data on failure
        let enriched: ImmobiliareResult = result;
        try {
          const detail = await fetchDetailPage(context, result.realEstate.id);
          if (detail) {
            enriched = detail;
          } else {
            log('warn', 'Detail page returned null – using search data', { id: result.realEstate.id });
          }
        } catch (detailErr: any) {
          log('warn', 'Detail fetch threw – using search data', { id: result.realEstate.id, err: detailErr.message });
        }

        // Small delay between detail fetches to respect rate limits
        await new Promise(resolve => setTimeout(resolve, 800 + Math.random() * 700));

        const transformed = transformImmobiliareToStandard(enriched, config);
        ingestBuffer.push({
          portalId: `immobiliare-it-${result.realEstate.id}`,
          data: transformed,
          rawData: enriched,
        });
      } catch (err: any) {
        log('error', 'Transform failed', { id: result.realEstate?.id, err: err.message });
      }
    }

    if (ingestBuffer.length >= INGEST_BATCH_SIZE) {
      await flushIngestBuffer();
    }

    stats.phase3.durationMs += Date.now() - p3Start;

    log('info', 'Batch processed', {
      category: config.category,
      contract: config.contract,
      region: config.region,
      total: page.length,
      new: comparison.new,
      changed: comparison.changed,
      unchanged: comparison.unchanged,
      detailFetched: toIngest.length,
      bufferSize: ingestBuffer.length,
    });
  };

  // ---- Phase 1: Playwright scraping ----
  await scrapeAll(onBatch);

  // Flush any remaining items in the buffer
  await flushIngestBuffer();

  stats.phase1.durationMs = Date.now() - startTime;
  stats.phase2.savingsPercent =
    stats.phase2.totalChecked > 0
      ? Math.round((stats.phase2.unchanged / stats.phase2.totalChecked) * 100)
      : 0;

  log('info', 'Three-phase scrape complete', {
    totalListings: stats.phase1.totalListings,
    new: stats.phase2.new,
    changed: stats.phase2.changed,
    unchanged: stats.phase2.unchanged,
    savingsPercent: stats.phase2.savingsPercent,
    ingested: stats.phase3.ingested,
    durationMs: stats.phase1.durationMs,
  });

  return stats;
}

export function printThreePhaseSummary(stats: PhaseStats): void {
  console.log(JSON.stringify({
    level: 'info',
    service: 'immobiliare-scraper',
    msg: 'Scrape summary',
    phase1_listings: stats.phase1.totalListings,
    phase1_ms: stats.phase1.durationMs,
    phase2_new: stats.phase2.new,
    phase2_changed: stats.phase2.changed,
    phase2_unchanged: stats.phase2.unchanged,
    phase2_savings_pct: stats.phase2.savingsPercent,
    phase3_ingested: stats.phase3.ingested,
    total_ms: stats.phase1.durationMs,
  }));
}
