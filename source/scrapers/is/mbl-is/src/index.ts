import express from 'express';
import { ScrapeRunTracker } from '@landomo/core';
import { scrapeSales, scrapeRentals } from './scrapers/listingsScraper';
import { IngestAdapter, PropertyPayload } from './adapters/ingestAdapter';
import { transformSaleListing, transformRentalListing } from './transformers';
import { MblSaleListing, MblRentalListing } from './types/mblTypes';

const app = express();
const PORT = parseInt(process.env.PORT || '8301', 10);
const PORTAL = 'mbl-is';
const BATCH_SIZE = 500;

app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({
    status: 'healthy',
    scraper: PORTAL,
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

app.post('/scrape', async (_req, res) => {
  res.status(202).json({ status: 'scraping started', timestamp: new Date().toISOString() });

  runScraper().catch(err => {
    console.error(JSON.stringify({
      level: 'error',
      service: 'mbl-scraper',
      msg: 'Scraping failed',
      err: err.message,
    }));
  });
});

async function runScraper(): Promise<void> {
  const startTime = Date.now();
  const tracker = new ScrapeRunTracker(PORTAL);
  const runId = await tracker.start();

  console.log(JSON.stringify({
    level: 'info',
    service: 'mbl-scraper',
    msg: 'Starting mbl.is scrape',
    portal: PORTAL,
    runId,
  }));

  const adapter = new IngestAdapter(PORTAL);
  let totalFound = 0;
  let totalTransformed = 0;
  let totalSent = 0;
  let pendingBatch: PropertyPayload[] = [];

  const flushBatch = async (force = false): Promise<void> => {
    if (pendingBatch.length === 0) return;
    if (!force && pendingBatch.length < BATCH_SIZE) return;

    const toSend = pendingBatch.splice(0, BATCH_SIZE);

    console.log(JSON.stringify({
      level: 'info',
      service: 'mbl-scraper',
      msg: 'Sending batch to ingest',
      count: toSend.length,
      totalSent,
    }));

    await adapter.sendProperties(toSend, runId ?? undefined);
    totalSent += toSend.length;
  };

  try {
    // --- Sales ---
    const onSalesBatch = async (listings: MblSaleListing[]): Promise<void> => {
      totalFound += listings.length;

      for (const listing of listings) {
        try {
          const transformed = transformSaleListing(listing);
          pendingBatch.push({
            portalId: `mbl-sale-${listing.eign_id}`,
            data: transformed,
            rawData: listing,
          });
          totalTransformed++;
        } catch (err: any) {
          console.error(JSON.stringify({
            level: 'error',
            service: 'mbl-scraper',
            msg: 'Sale transform failed',
            eignId: listing.eign_id,
            tegEign: listing.teg_eign,
            err: err.message,
          }));
        }
      }

      while (pendingBatch.length >= BATCH_SIZE) {
        await flushBatch();
      }
    };

    await scrapeSales(onSalesBatch);

    // --- Rentals ---
    const onRentalsBatch = async (listings: MblRentalListing[]): Promise<void> => {
      totalFound += listings.length;

      for (const listing of listings) {
        try {
          const transformed = transformRentalListing(listing);
          pendingBatch.push({
            portalId: `mbl-rental-${listing.id}`,
            data: transformed,
            rawData: listing,
          });
          totalTransformed++;
        } catch (err: any) {
          console.error(JSON.stringify({
            level: 'error',
            service: 'mbl-scraper',
            msg: 'Rental transform failed',
            id: listing.id,
            err: err.message,
          }));
        }
      }

      while (pendingBatch.length >= BATCH_SIZE) {
        await flushBatch();
      }
    };

    await scrapeRentals(onRentalsBatch);

    // Flush any remaining
    if (pendingBatch.length > 0) {
      console.log(JSON.stringify({
        level: 'info',
        service: 'mbl-scraper',
        msg: 'Flushing remaining batch',
        count: pendingBatch.length,
      }));

      const remaining = [...pendingBatch];
      pendingBatch = [];

      for (let i = 0; i < remaining.length; i += BATCH_SIZE) {
        const chunk = remaining.slice(i, i + BATCH_SIZE);
        await adapter.sendProperties(chunk, runId ?? undefined);
        totalSent += chunk.length;
      }
    }

    await tracker.complete({
      listings_found: totalFound,
      listings_new: totalTransformed,
      listings_updated: 0,
    });

    const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log(JSON.stringify({
      level: 'info',
      service: 'mbl-scraper',
      msg: 'Scrape completed successfully',
      durationSec,
      totalFound,
      totalTransformed,
      totalSent,
    }));
  } catch (err: any) {
    await tracker.fail();

    console.error(JSON.stringify({
      level: 'error',
      service: 'mbl-scraper',
      msg: 'Scrape failed',
      err: err.message,
    }));

    throw err;
  }
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(JSON.stringify({
    level: 'info',
    service: 'mbl-scraper',
    msg: 'mbl-is scraper running',
    port: PORT,
    portal: PORTAL,
  }));
});

process.on('SIGTERM', () => {
  console.log(JSON.stringify({ level: 'info', service: 'mbl-scraper', msg: 'SIGTERM received, shutting down' }));
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log(JSON.stringify({ level: 'info', service: 'mbl-scraper', msg: 'SIGINT received, shutting down' }));
  process.exit(0);
});
