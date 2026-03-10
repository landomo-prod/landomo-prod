import express from 'express';
import { ScrapeRunTracker, createLogger, setupScraperMetrics, scraperMetrics } from '@landomo/core';
import { scrapeAllListings, ScrapedPage } from './scrapers/listingsScraper';
import { transformCard } from './transformers';
import { sendBatch, PropertyPayload } from './adapters/ingestAdapter';
import { detectCategory } from './utils/categoryDetector';

const app = express();
const PORT = parseInt(process.env.PORT || '8233', 10);
const PORTAL = 'oikotie';
const COUNTRY = 'finland';

const log = createLogger({ service: 'tori-fi-scraper', portal: PORTAL, country: COUNTRY });

const BATCH_SIZE = parseInt(process.env.BATCH_SIZE || '500', 10);

app.use(express.json());
setupScraperMetrics(app as any, PORTAL);

app.get('/health', (_req, res) => {
  res.json({
    status: 'healthy',
    scraper: PORTAL,
    country: COUNTRY,
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

app.post('/scrape', async (_req, res) => {
  res.status(202).json({
    status: 'scraping started',
    portal: PORTAL,
    timestamp: new Date().toISOString(),
  });

  runScraper().catch(error => {
    log.error({ err: error }, 'Scraping failed');
  });
});

async function runScraper(): Promise<void> {
  const startTime = Date.now();
  const tracker = new ScrapeRunTracker(PORTAL);
  const runId = await tracker.start();

  scraperMetrics.scrapeRunActive.set({ portal: PORTAL }, 1);
  log.info({ runId, batchSize: BATCH_SIZE }, 'Starting Oikotie scrape');

  // Buffer for batching listings before sending to ingest
  const buffer: PropertyPayload[] = [];
  let listingsFound = 0;
  let listingsSent = 0;
  let errors = 0;

  async function flushBuffer(force = false): Promise<void> {
    if (buffer.length === 0) return;
    if (!force && buffer.length < BATCH_SIZE) return;

    const batch = buffer.splice(0, BATCH_SIZE);
    try {
      await sendBatch(batch);
      listingsSent += batch.length;
      log.debug({ sent: batch.length, total: listingsSent }, 'Batch ingested');
    } catch (err) {
      errors += batch.length;
      log.error({ err, batchSize: batch.length }, 'Batch ingest failed');
    }
  }

  try {
    const result = await scrapeAllListings(async (page: ScrapedPage) => {
      for (const card of page.cards) {
        try {
          const transformed = transformCard(card);
          const category = detectCategory(card);

          scraperMetrics.propertiesScraped.inc(
            { portal: PORTAL, category, result: 'success' },
            1
          );

          buffer.push({
            portalId: String(card.cardId),
            data: transformed,
            rawData: card,
          });

          listingsFound++;
        } catch (err) {
          errors++;
          scraperMetrics.propertiesScraped.inc(
            { portal: PORTAL, category: 'unknown', result: 'error' },
            1
          );
          log.warn({ err, cardId: card.cardId }, 'Failed to transform card');
        }
      }

      // Flush whenever we have a full batch
      while (buffer.length >= BATCH_SIZE) {
        await flushBuffer(false);
      }

      log.info(
        {
          cardType: page.cardType,
          offset: page.offset,
          found: page.found,
          buffered: buffer.length,
          sent: listingsSent,
        },
        'Page processed'
      );
    });

    // Flush remaining items
    while (buffer.length > 0) {
      await flushBuffer(true);
    }

    const durationSec = (Date.now() - startTime) / 1000;
    scraperMetrics.scrapeDuration.observe({ portal: PORTAL, category: 'all' }, durationSec);
    scraperMetrics.scrapeRuns.inc({ portal: PORTAL, status: 'success' });
    scraperMetrics.scrapeRunActive.set({ portal: PORTAL }, 0);

    await tracker.complete({
      listings_found: listingsFound,
      listings_new: listingsSent,
      listings_updated: 0,
    });

    log.info(
      {
        durationMin: (durationSec / 60).toFixed(2),
        listingsFound,
        listingsSent,
        errors,
        byCardType: result.totalByCardType,
      },
      'Scrape completed successfully'
    );
  } catch (err: any) {
    await tracker.fail();
    scraperMetrics.scrapeRuns.inc({ portal: PORTAL, status: 'failure' });
    scraperMetrics.scrapeRunActive.set({ portal: PORTAL }, 0);
    log.error({ err }, 'Scrape run failed');
    throw err;
  }
}

app.listen(PORT, '0.0.0.0', () => {
  log.info({ port: PORT, portal: PORTAL, country: COUNTRY }, 'Tori-fi (Oikotie) scraper running');
});

process.on('SIGTERM', () => {
  log.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  log.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});
