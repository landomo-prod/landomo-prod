import express from 'express';
import { ScrapeRunTracker } from '@landomo/core';
import { ListingsScraper, scrapeWithChecksums, scrapeAllTwoPhase } from './scrapers/listingsScraper';
import { IngestAdapter } from './adapters/ingestAdapter';
import { transformBytyToStandard } from './transformers'; // Use router
import { checkCurlImpersonate } from './utils/curlImpersonate';
import { BytyListing } from './types/bytyTypes';

const app = express();
const PORT = process.env.PORT || 8086;
const PORTAL = 'byty-sk';
const ENABLE_CHECKSUM_MODE = process.env.ENABLE_CHECKSUM_MODE === 'true';

app.use(express.json());

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    scraper: PORTAL,
    version: '2.0.0-checksum',
    checksumMode: ENABLE_CHECKSUM_MODE,
    timestamp: new Date().toISOString()
  });
});

app.post('/scrape', async (req, res) => {
  res.status(202).json({
    status: 'scraping started',
    timestamp: new Date().toISOString()
  });

  runScraper().catch(error => {
    console.error('Scraping failed:', error);
  });
});

async function runScraper() {
  const startTime = Date.now();
  const tracker = new ScrapeRunTracker(PORTAL);
  const runId = await tracker.start();
  console.log(`\n[${new Date().toISOString()}] 🚀 Starting Byty.sk scrape...`);
  console.log(`Mode: ${ENABLE_CHECKSUM_MODE ? 'CHECKSUM' : 'LEGACY'}`);

  try {
    const hasCurl = await checkCurlImpersonate();
    if (!hasCurl) {
      throw new Error('curl-impersonate-chrome is not installed or not in PATH');
    }
    console.log('✅ curl-impersonate-chrome is available');

    const adapter = new IngestAdapter(PORTAL);
    let listings: BytyListing[];
    let stats: any;

    // 2. Fetch listings (two-phase checksum mode or legacy mode)
    if (ENABLE_CHECKSUM_MODE) {
      console.log('\nUsing two-phase checksum scraping (per-page early-stop)...');
      const ingestApiUrl = process.env.INGEST_API_URL || 'http://localhost:3008/api/v1';
      const ingestApiKey = (process.env.INGEST_API_KEY_BYTY_SK || process.env.INGEST_API_KEY || 'dev_key_sk_1').split(',')[0].trim();

      const { ChecksumClient } = await import('@landomo/core');

      const checksumClient = new ChecksumClient(ingestApiUrl, ingestApiKey);
      const result = await scrapeAllTwoPhase(checksumClient, runId ?? undefined, async (batchListings) => {
        const properties = batchListings.map(listing => {
          try {
            return { portalId: listing.id, data: transformBytyToStandard(listing), rawData: listing };
          } catch (error: any) {
            console.error(`Error transforming listing ${listing.id}:`, error.message);
            return null;
          }
        }).filter(p => p !== null) as any[];
        if (properties.length > 0) {
          await adapter.sendProperties(properties);
          console.log(`  Ingested ${properties.length} listings`);
        }
      });
      listings = result.listings;
      stats = result.stats;

      console.log(`\nTwo-Phase Results:`);
      console.log(`  Pages scanned: ${stats.pagesScanned}`);
      console.log(`  Total seen: ${stats.total}`);
      console.log(`  New: ${stats.new}`);
      console.log(`  Changed: ${stats.changed}`);
      console.log(`  Unchanged: ${stats.unchanged}`);

      // Update checksums for ALL seen listings (not just ingested ones)
      // so that unchanged listings get their last_seen_at refreshed.
      if (result.allSeenChecksums.length > 0) {
        console.log('\nUpdating checksums for all seen listings...');
        const CHECKSUM_BATCH_SIZE = 1000;
        for (let i = 0; i < result.allSeenChecksums.length; i += CHECKSUM_BATCH_SIZE) {
          const batch = result.allSeenChecksums.slice(i, i + CHECKSUM_BATCH_SIZE);
          try {
            await checksumClient.updateChecksums(batch, runId ?? undefined);
            console.log(`  Updated ${batch.length} checksums`);
          } catch (error: any) {
            console.error(`  Checksum update batch failed:`, error.message);
          }
          if (i + CHECKSUM_BATCH_SIZE < result.allSeenChecksums.length) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        }
        console.log(`Updated ${result.allSeenChecksums.length} checksums total (all seen listings)`);
      }

      await tracker.complete({
        listings_found: stats.total,
        listings_new: stats.new,
        listings_updated: stats.changed
      });

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`\nTwo-phase scrape completed in ${duration}s`);
      console.log(`  Ingested: ${listings.length} listings`);
      return;
    } else {
      console.log('\n📡 Using legacy mode (scraping all)...');
      const scraper = new ListingsScraper();
      console.log('📡 Fetching listings from Byty.sk (bypassing Imperva WAF)...');
      listings = await scraper.scrapeAll();
    }

    if (listings.length === 0) {
      console.log('⚠️  No listings found');
      await tracker.complete({ listings_found: 0, listings_new: 0, listings_updated: 0 });
      return;
    }

    console.log(`🔄 Transforming ${listings.length} listings...`);
    const properties = listings.map(listing => {
      try {
        return {
          portalId: listing.id,
          data: transformBytyToStandard(listing),
          rawData: listing
        };
      } catch (error: any) {
        console.error(`Error transforming listing ${listing.id}:`, error.message);
        return null;
      }
    }).filter(p => p !== null) as any[];

    console.log(`✅ Successfully transformed ${properties.length} listings`);

    const batchSize = 100;
    for (let i = 0; i < properties.length; i += batchSize) {
      const batch = properties.slice(i, i + batchSize);
      console.log(`📤 Sending batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(properties.length / batchSize)} (${batch.length} properties)...`);

      try {
        await adapter.sendProperties(batch);
      } catch (error: any) {
        console.error(`❌ Failed to send batch:`, error.message);
      }

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

app.listen(PORT, () => {
  console.log(`\n🚀 Byty.sk scraper running`);
  console.log(`   Port: ${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/health`);
  console.log(`   Trigger: POST http://localhost:${PORT}/scrape`);
  console.log(`\nWaiting for scrape triggers...\n`);
});

process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('\nSIGINT received, shutting down gracefully...');
  process.exit(0);
});
