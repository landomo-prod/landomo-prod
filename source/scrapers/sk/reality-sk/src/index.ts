import express from 'express';
import { ScrapeRunTracker } from '@landomo/core';
import { ListingsScraper, scrapeWithChecksums, scrapeAllTwoPhase, fetchListingDetail, enrichListingFromDetail } from './scrapers/listingsScraper';
import { IngestAdapter } from './adapters/ingestAdapter';
import { transformRealityToStandard } from './transformers';
import { checkCurlImpersonate } from './utils/curlImpersonate';

const app = express();
const PORT = process.env.PORT || 8084;
const PORTAL = 'reality-sk';

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
  const runId = await tracker.start();
  console.log(`\n[${new Date().toISOString()}] 🚀 Starting Reality.sk scrape...`);

  // Check for checksum mode
  const ENABLE_CHECKSUM_MODE = process.env.ENABLE_CHECKSUM_MODE === 'true';
  const ingestApiUrl = process.env.INGEST_API_URL || 'http://ingest-slovakia:3000';
  const ingestApiKey = (process.env.INGEST_API_KEY_REALITY_SK || process.env.INGEST_API_KEY || '').split(',')[0].trim();

  try {
    // Check if curl-impersonate is available
    const hasCurl = await checkCurlImpersonate();
    if (!hasCurl) {
      throw new Error('curl-impersonate-chrome is not installed or not in PATH');
    }
    console.log('✅ curl-impersonate-chrome is available');

    // Two-phase checksum mode: scan pages with early-stop, ingest only new/changed
    if (ENABLE_CHECKSUM_MODE) {
      console.log('Two-phase checksum mode enabled - per-page early-stop');

      const { ChecksumClient } = await import('@landomo/core');
      const checksumClient = new ChecksumClient(ingestApiUrl, ingestApiKey);

      // Detail fetching: enabled by default unless explicitly disabled
      const fetchDetails = process.env.FETCH_DETAILS !== 'false';
      const detailConcurrency = parseInt(process.env.DETAIL_CONCURRENCY || '3', 10);

      const result = await scrapeAllTwoPhase(checksumClient, runId || undefined, async (batchListings) => {
        // Enrich with detail page data if enabled
        let enrichedListings = batchListings;
        if (fetchDetails) {
          const enriched: typeof batchListings = [];
          // Process in chunks to limit concurrency
          for (let i = 0; i < batchListings.length; i += detailConcurrency) {
            const chunk = batchListings.slice(i, i + detailConcurrency);
            const results = await Promise.allSettled(
              chunk.map(async (listing) => {
                if (!listing.url) return listing;
                try {
                  const detail = await fetchListingDetail(listing.url);
                  if (detail) return enrichListingFromDetail(listing, detail);
                } catch { /* non-fatal */ }
                return listing;
              })
            );
            for (const r of results) {
              enriched.push(r.status === 'fulfilled' ? r.value : chunk[0]);
            }
            // Small delay between concurrency chunks
            if (i + detailConcurrency < batchListings.length) {
              await new Promise(resolve => setTimeout(resolve, 300));
            }
          }
          enrichedListings = enriched;
        }

        const props = enrichedListings.map(listing => {
          try {
            return { portalId: listing.id, data: transformRealityToStandard(listing), rawData: listing };
          } catch (error: any) {
            console.error(`Error transforming listing ${listing.id}:`, error.message);
            return null;
          }
        }).filter(p => p !== null) as any[];
        if (props.length > 0) {
          const adapter = new IngestAdapter(PORTAL);
          await adapter.sendProperties(props);
          console.log(`  Ingested ${props.length} listings${fetchDetails ? ' (with detail enrichment)' : ''}`);
        }
      });

      // Ingestion already handled per-combo via onBatch callback above

      // Update checksums for ALL seen listings (not just ingested ones)
      // so that unchanged listings get their last_seen_at refreshed.
      if (result.allSeenChecksums.length > 0) {
        const CHECKSUM_BATCH_SIZE = 1000;
        for (let i = 0; i < result.allSeenChecksums.length; i += CHECKSUM_BATCH_SIZE) {
          const batch = result.allSeenChecksums.slice(i, i + CHECKSUM_BATCH_SIZE);
          try {
            await checksumClient.updateChecksums(batch, runId || undefined);
          } catch (error: any) {
            console.error(`Failed to update checksums batch:`, error.message);
          }
          if (i + CHECKSUM_BATCH_SIZE < result.allSeenChecksums.length) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        }
        console.log(`Updated checksums for ${result.allSeenChecksums.length} listings (all seen)`);
      }

      await tracker.complete({
        listings_found: result.stats.total,
        listings_new: result.stats.new,
        listings_updated: result.stats.changed
      });

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`\nTwo-phase scrape completed in ${duration}s`);
      console.log(`   Total seen: ${result.stats.total}`);
      console.log(`   New: ${result.stats.new}`);
      console.log(`   Changed: ${result.stats.changed}`);
      console.log(`   Unchanged: ${result.stats.unchanged} (skipped)`);
      console.log(`   Pages scanned: ${result.stats.pagesScanned}`);

      return;
    }

    // Legacy mode: scrape all, transform all, send all
    console.log('📋 Legacy mode - processing all listings');
    const scraper = new ListingsScraper();
    const adapter = new IngestAdapter(PORTAL);

    // 2. Fetch listings from Reality.sk
    console.log('📡 Fetching listings from Reality.sk...');
    const listings = await scraper.scrapeAll();

    if (listings.length === 0) {
      console.log('⚠️  No listings found');
      await tracker.complete({ listings_found: 0, listings_new: 0, listings_updated: 0 });
      return;
    }

    // 3. Transform to standard format
    console.log(`🔄 Transforming ${listings.length} listings...`);
    const properties = listings.map(listing => {
      try {
        return {
          portalId: listing.id,
          data: transformRealityToStandard(listing),
          rawData: listing
        };
      } catch (error: any) {
        console.error(`Error transforming listing ${listing.id}:`, error.message);
        return null;
      }
    }).filter(p => p !== null) as any[];

    console.log(`✅ Successfully transformed ${properties.length} listings`);

    // 4. Send to ingest API in batches
    const batchSize = 100;
    for (let i = 0; i < properties.length; i += batchSize) {
      const batch = properties.slice(i, i + batchSize);
      console.log(`📤 Sending batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(properties.length / batchSize)} (${batch.length} properties)...`);

      try {
        await adapter.sendProperties(batch);
      } catch (error: any) {
        console.error(`❌ Failed to send batch:`, error.message);
        // Continue with next batch even if one fails
      }

      // Small delay between batches to avoid overwhelming the API
      if (i + batchSize < properties.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }


    await tracker.complete({ listings_found: listings.length, listings_new: 0, listings_updated: 0 });
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n✅ Scrape completed in ${duration}s`);
    console.log(`   Total listings: ${listings.length}`);
    console.log(`   Transformed: ${properties.length}`);
    console.log(`   Sent to ingest API: ${properties.length}`);

  } catch (error: any) {
    await tracker.fail();
    console.error('❌ Scrape failed:', error.message);
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

  for (let i = 0; i < urls.length; i += concurrency) {
    const batch = urls.slice(i, i + concurrency);
    await Promise.allSettled(batch.map(async (url: string) => {
      try {
        const detail = await fetchListingDetail(url);
        if (!detail) throw new Error('Detail fetch returned null');

        const idMatch = url.match(/\/([^\/]+)\/?$/);
        const id = idMatch ? idMatch[1] : url;
        const baseListing = { id, url, title: '', price: 0, currency: '€', location: '', propertyType: 'byty', transactionType: 'predaj' };
        const enriched = enrichListingFromDetail(baseListing as any, detail);
        const transformed = transformRealityToStandard(enriched);

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
  console.log(`\n🚀 Reality.sk scraper running`);
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
