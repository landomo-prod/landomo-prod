import express from 'express';
import { ScrapeRunTracker } from '@landomo/core';
import { HttpScraper } from './scrapers/httpScraper';
import { IngestAdapter } from './adapters/ingestAdapter';
import { transformNehnutelnostiToStandard } from './transformers';

const app = express();
const PORT = process.env.PORT || 8082;
const PORTAL = 'nehnutelnosti-sk';

// JSON body parser
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    scraper: PORTAL,
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// Scrape trigger endpoint (called by centralized scheduler)
app.post('/scrape', async (req, res) => {
  // Respond immediately (don't make scheduler wait)
  res.status(202).json({
    status: 'scraping started',
    timestamp: new Date().toISOString()
  });

  // Run scraping asynchronously
  runScraper().catch(error => {
    console.error('Scraping failed:', error);
  });
});

/**
 * Main scraper logic
 */
async function runScraper() {
  const startTime = Date.now();
  const tracker = new ScrapeRunTracker(PORTAL);
  await tracker.start();
  console.log(`\n[${new Date().toISOString()}] Starting Nehnutelnosti.sk scrape...`);

  try {
    // 1. Initialize adapter
    const adapter = new IngestAdapter(PORTAL);

    // 2. Determine scrape mode (checksum vs full)
    const useChecksums = process.env.USE_CHECKSUMS === 'true' || process.env.USE_CHECKSUMS === '1';
    const scraper = new HttpScraper();

    let listings: any[] = [];

    if (useChecksums) {
      console.log('Running in TWO-PHASE CHECKSUM mode (scan → ingest per combo)...');

      const { ChecksumClient } = await import('@landomo/core');
      const { batchCreateNehnutelnostiChecksums } = await import('./utils/checksumExtractor');

      const checksumClient = new ChecksumClient(
        process.env.INGEST_API_URL!,
        (process.env.INGEST_API_KEY_NEHNUTELNOSTI_SK || process.env.INGEST_API_KEY || '').split(',')[0].trim()
      );

      // Detail fetching: enabled by default unless explicitly disabled
      const fetchDetails = process.env.FETCH_DETAILS !== 'false';
      const detailConcurrency = parseInt(process.env.DETAIL_CONCURRENCY || '5', 10);

      const result = await scraper.scrapeAllTwoPhase(
        checksumClient,
        batchCreateNehnutelnostiChecksums,
        undefined,
        async (batchListings) => {
          // Enrich with detail page data (floor, ownership, heating, energy_rating, etc.)
          let enrichedListings = batchListings;
          if (fetchDetails) {
            const enriched = await Promise.all(
              batchListings.map(async (listing, idx) => {
                // Stagger requests to avoid hammering the server
                await new Promise(r => setTimeout(r, Math.floor(idx / detailConcurrency) * 200));
                const detailUrl = listing.url || listing.detail_url;
                if (!detailUrl) return listing;
                try {
                  const adv = await scraper.fetchListingDetail(detailUrl);
                  if (adv) return scraper.enrichListingFromDetail(listing, adv);
                } catch { /* non-fatal */ }
                return listing;
              })
            );
            enrichedListings = enriched;
          }

          const props = enrichedListings.map(listing => {
            try {
              const propertyId = String(listing.id || listing.hash_id || '');
              return { portalId: propertyId, data: transformNehnutelnostiToStandard(listing), rawData: listing };
            } catch (error: any) {
              console.error(`Error transforming listing ${listing.id || listing.hash_id}:`, error.message);
              return null;
            }
          }).filter(p => p !== null) as any[];
          if (props.length > 0) {
            await adapter.sendProperties(props);
            console.log(`   Ingested ${props.length} listings${fetchDetails ? ' (with detail enrichment)' : ''}`);
          }
        }
      );

      // Update checksums for all seen listings
      if (result.allSeenChecksums.length > 0) {
        try {
          const CHECKSUM_BATCH_SIZE = 1000;
          for (let i = 0; i < result.allSeenChecksums.length; i += CHECKSUM_BATCH_SIZE) {
            const batch = result.allSeenChecksums.slice(i, i + CHECKSUM_BATCH_SIZE);
            await checksumClient.updateChecksums(batch);
            if (i + CHECKSUM_BATCH_SIZE < result.allSeenChecksums.length) {
              await new Promise(resolve => setTimeout(resolve, 100));
            }
          }
          console.log(`Updated ${result.allSeenChecksums.length} checksums in DB (all seen listings)`);
        } catch (error: any) {
          console.warn(`Failed to update checksums (non-fatal):`, error.message);
        }
      }

      await tracker.complete({ listings_found: result.stats.total, listings_new: result.stats.new, listings_updated: result.stats.changed });
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`\nScrape completed in ${duration}s`);
      console.log(`   Total seen: ${result.stats.total}`);
      console.log(`   New: ${result.stats.new}, Changed: ${result.stats.changed}, Unchanged: ${result.stats.unchanged}`);
      return;
    }

    // FULL MODE
    console.log('Running in FULL mode (all listings)...');
    listings = await scraper.scrapeAll();

    if (listings.length === 0) {
      console.log('No listings to ingest');
      await tracker.complete({ listings_found: 0, listings_new: 0, listings_updated: 0 });
      return;
    }

    // 3. Transform to standard format
    console.log(`Transforming ${listings.length} listings...`);
    const properties = listings.map(listing => {
      try {
        const propertyId = String(listing.id || listing.hash_id || '');
        return {
          portalId: propertyId,
          data: transformNehnutelnostiToStandard(listing),
          rawData: listing
        };
      } catch (error: any) {
        console.error(`Error transforming listing ${listing.id || listing.hash_id}:`, error.message);
        return null;
      }
    }).filter(p => p !== null) as any[];

    console.log(`Successfully transformed ${properties.length} listings`);

    // 4. Send to ingest API in batches
    const batchSize = 100;
    for (let i = 0; i < properties.length; i += batchSize) {
      const batch = properties.slice(i, i + batchSize);
      console.log(`Sending batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(properties.length / batchSize)} (${batch.length} properties)...`);

      try {
        await adapter.sendProperties(batch);
      } catch (error: any) {
        console.error(`Failed to send batch:`, error.message);
        // Continue with next batch even if one fails
      }

      // Small delay between batches to avoid overwhelming the API
      if (i + batchSize < properties.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    await tracker.complete({ listings_found: listings.length, listings_new: 0, listings_updated: 0 });

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\nScrape completed in ${duration}s`);
    console.log(`   Total listings: ${listings.length}`);
    console.log(`   Transformed: ${properties.length}`);
    console.log(`   Sent to ingest API: ${properties.length}`);


  } catch (error: any) {
    await tracker.fail();
    console.error('Scrape failed:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    throw error;
  }
}

// Scrape detail endpoint: fetch and re-ingest specific listings by URL
app.post('/scrape-detail', async (req, res) => {
  const { urls = [], concurrency = 5 } = req.body;
  if (!Array.isArray(urls) || urls.length === 0) {
    return res.status(400).json({ error: 'urls array required' });
  }

  let succeeded = 0, failed = 0;
  const errors: string[] = [];
  const adapter = new IngestAdapter(PORTAL);
  const scraper = new HttpScraper();

  for (let i = 0; i < urls.length; i += concurrency) {
    const batch = urls.slice(i, i + concurrency);
    await Promise.allSettled(batch.map(async (url: string) => {
      try {
        const detail = await scraper.fetchListingDetail(url);
        if (!detail) throw new Error('Detail fetch returned null');

        const idMatch = url.match(/\/([^\/]+)\/?$/);
        const id = idMatch ? idMatch[1] : url;
        const baseListing = { id, url, title: '', price: 0, currency: '€', location: '', propertyType: 'byty', transactionType: 'predaj' };
        const enriched = scraper.enrichListingFromDetail(baseListing as any, detail);
        const transformed = transformNehnutelnostiToStandard(enriched);

        await adapter.sendProperties([{ portalId: id, data: transformed as any, rawData: enriched }]);
        succeeded++;
      } catch (e: any) {
        failed++;
        errors.push(`${url}: ${e.message}`);
      }
    }));
    if (i + concurrency < urls.length) await new Promise(r => setTimeout(r, 300));
  }

  res.json({ processed: urls.length, succeeded, failed, errors: errors.slice(0, 20) });
});

// Start server
app.listen(PORT, () => {
  console.log(`\nNehnutelnosti.sk scraper running`);
  console.log(`   Port: ${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/health`);
  console.log(`   Trigger: POST http://localhost:${PORT}/scrape`);
  console.log(`\nWaiting for scrape triggers...\n`);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('\nSIGINT received, shutting down gracefully...');
  process.exit(0);
});
