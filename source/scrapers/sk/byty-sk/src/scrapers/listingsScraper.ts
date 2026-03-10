import * as cheerio from 'cheerio';
import { fetchWithBrowserTLS, closeCycleTLS } from '../utils/cycleTLS';
import { getRandomUserAgent } from '../utils/userAgents';
import { BytyListing } from '../types/bytyTypes';

/**
 * Byty.sk Listings Scraper
 * Uses CycleTLS (browser TLS fingerprinting) to bypass Imperva WAF
 */
export class ListingsScraper {
  private baseUrl = 'https://www.byty.sk';

  // Room filters to avoid hitting 600 page limit
  private roomFilters = [
    { label: '1-room', value: '1' },
    { label: '2-room', value: '2' },
    { label: '3-room', value: '3' },
    { label: '4-room', value: '4' },
    { label: '5-room', value: '5' },
    { label: '6+-room', value: '6' }
  ];

  /**
   * Scrape all listings from Byty.sk
   * PARALLEL MODE with ROOM FILTERING to avoid 600 page limit
   */
  async scrapeAll(concurrency: number = 2): Promise<BytyListing[]> {
    console.log(`Starting Byty.sk scrape with room filters (${concurrency} concurrent)...`);
    const allListings: BytyListing[] = [];

    try {
      // Generate all combinations WITH room filters
      const searches: Array<{category: string; type: string; roomFilter?: any}> = [];

      // ALL estate categories to scrape everything
      const categories = [
        { category: 'byty', type: 'predaj' },
        { category: 'byty', type: 'prenajom' },
        { category: 'domy', type: 'predaj' },
        { category: 'domy', type: 'prenajom' },
        { category: 'pozemky', type: 'predaj' },
        { category: 'pozemky', type: 'prenajom' }
      ];

      for (const cat of categories) {
        // Use room filters to avoid 600 page limit
        for (const roomFilter of this.roomFilters) {
          searches.push({ ...cat, roomFilter });
        }
      }

      console.log(`\nTotal search combinations: ${searches.length}`);
      console.log(`This avoids hitting the 600 page limit!\n`);

      // Process searches in parallel batches
      const batches = this.chunkArray(searches, concurrency);

      for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
        const batch = batches[batchIdx];
        console.log(`\nBatch ${batchIdx + 1}/${batches.length} (${batch.length} searches)...`);

        const results = await Promise.allSettled(
          batch.map(async (search) => {
            try {
              const label = search.roomFilter
                ? `${search.category}/${search.type}/${search.roomFilter.label}`
                : `${search.category}/${search.type}`;
              console.log(`[${label}] Starting...`);

              const listings = await this.scrapeCategory(search.category, search.type, Infinity, search.roomFilter);
              console.log(`[${label}] ✅ ${listings.length} listings`);
              return listings;
            } catch (error: any) {
              const label = search.roomFilter
                ? `${search.category}/${search.type}/${search.roomFilter.label}`
                : `${search.category}/${search.type}`;
              console.error(`[${label}] ❌ ${error.message}`);
              return [];
            }
          })
        );

        // Collect results
        for (const result of results) {
          if (result.status === 'fulfilled') {
            allListings.push(...result.value);
          }
        }

        // Small delay between batches
        if (batchIdx < batches.length - 1) {
          await this.delay(1000);
        }
      }

      // Remove duplicates by ID
      const uniqueListings = Array.from(
        new Map(allListings.map(item => [item.id, item])).values()
      );

      console.log(`\n✅ Total unique listings: ${uniqueListings.length} (filtered from ${allListings.length})`);
      return uniqueListings;
    } finally {
      // Cleanup CycleTLS instance
      await closeCycleTLS();
    }
  }

  /**
   * Chunk array into batches
   */
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  /**
   * Scrape a single page and return extracted listings
   * Used by two-phase scraping for per-page checksum comparison
   */
  async scrapePage(
    category: string,
    type: string,
    page: number,
    roomFilter?: any
  ): Promise<{ listings: BytyListing[]; hasNextPage: boolean }> {
    let url: string;
    if (page === 1) {
      url = roomFilter
        ? `${this.baseUrl}/ponuka/${type}?p[rooms]=${roomFilter.value}`
        : `${this.baseUrl}/ponuka/${type}`;
    } else {
      url = roomFilter
        ? `${this.baseUrl}/ponuka/${type}/?p[rooms]=${roomFilter.value}&p[page]=${page}`
        : `${this.baseUrl}/ponuka/${type}/?p[page]=${page}`;
    }

    const html = await fetchWithBrowserTLS(url, {
      browser: 'chrome',
      userAgent: getRandomUserAgent()
    });

    const $: cheerio.CheerioAPI = cheerio.load(html);
    const listings = this.extractListingsFromHTML($, category, type);

    const hasNextPage = listings.length > 0 && (
      $('a.next.s[href*="page"]').length > 0 ||
      $('link[rel="next"]').length > 0
    );

    return { listings, hasNextPage };
  }

  /**
   * Scrape a specific category with optional room filter
   */
  private async scrapeCategory(
    category: string,
    type: string,
    maxPages: number = Infinity,
    roomFilter?: any
  ): Promise<BytyListing[]> {
    const allListings: BytyListing[] = [];

    for (let page = 1; page <= maxPages; page++) {
      try {
        // Build URL with room filter if provided
        let url: string;
        if (page === 1) {
          url = roomFilter
            ? `${this.baseUrl}/ponuka/${type}?p[rooms]=${roomFilter.value}`
            : `${this.baseUrl}/ponuka/${type}`;
        } else {
          url = roomFilter
            ? `${this.baseUrl}/ponuka/${type}/?p[rooms]=${roomFilter.value}&p[page]=${page}`
            : `${this.baseUrl}/ponuka/${type}/?p[page]=${page}`;
        }

        console.log(`    Fetching page ${page}...`);

        // Fetch HTML using CycleTLS (browser TLS fingerprinting)
        const html = await fetchWithBrowserTLS(url, {
          browser: 'chrome',
          userAgent: getRandomUserAgent()
        });

        // Parse HTML
        const $: cheerio.CheerioAPI = cheerio.load(html);
        const listings = this.extractListingsFromHTML($, category, type);

        if (listings.length === 0) {
          console.log(`    No more listings on page ${page}`);
          break;
        }

        allListings.push(...listings);
        console.log(`    Page ${page}: ${listings.length} listings`);

        // Check for next page
        const hasNextPage = $('a.next.s[href*="page"]').length > 0 ||
                          $('link[rel="next"]').length > 0;
        if (!hasNextPage) {
          break;
        }

        // Reduced delay (speed optimized, but mindful of WAF)
        await this.delay(1000 + Math.random() * 1000); // 1-2 seconds
      } catch (error: any) {
        console.error(`    Error on page ${page}:`, error.message);
        break;
      }
    }

    return allListings;
  }

  /**
   * Extract listings from HTML
   */
  private extractListingsFromHTML(
    $: cheerio.CheerioAPI,
    category: string,
    type: string
  ): BytyListing[] {
    const listings: BytyListing[] = [];

    // Byty.sk uses div.inzerat for listings
    const listingElements = $('.inzerat');

    if (listingElements.length === 0) {
      console.warn('    No .inzerat elements found');
      return listings;
    }

    listingElements.each((index, element) => {
      try {
        const $el = $(element);

        // Extract ID
        const id = $el.attr('id')?.replace('i', '') || `byty-${Date.now()}-${index}`;

        // Extract title and URL
        const titleEl = $el.find('h2 a').first();
        const title = titleEl.text().trim();
        const url = titleEl.attr('href');

        if (!title || !url) {
          return; // Skip
        }

        const fullUrl = url.startsWith('http') ? url : `${this.baseUrl}${url}`;

        // Extract price
        const priceEl = $el.find('.price.cena .tlste').first();
        const priceText = priceEl.text().trim();
        const price = this.parsePrice(priceText);

        // Extract location
        const locationEl = $el.find('.locationText').first();
        const location = locationEl.text().trim().replace(/\s+/g, ' ');

        // Extract details from condition-info
        const details: string[] = [];
        $el.find('.condition-info span').each((i, span) => {
          details.push($(span).text().trim());
        });

        // Extract area from details
        const areaMatch = details.join(' ').match(/(\d+)\s*m²/);
        const area = areaMatch ? parseInt(areaMatch[1]) : undefined;

        // Extract description
        const description = $el.find('.advertisement-content-p').text().trim() || undefined;

        // Extract date
        const date = $el.find('.date').text().trim() || undefined;

        // Extract image
        const imgEl = $el.find('.advertPhoto img').first();
        const imageUrl = imgEl.attr('src') || imgEl.attr('data-src') || undefined;

        listings.push({
          id,
          title,
          price,
          currency: '€',
          location,
          propertyType: category,
          transactionType: type,
          url: fullUrl,
          area,
          description,
          imageUrl,
          date,
          details
        });
      } catch (error: any) {
        console.error(`    Error extracting listing ${index}:`, error.message);
      }
    });

    return listings;
  }

  /**
   * Parse price from string
   */
  private parsePrice(priceText: string): number {
    if (!priceText) return 0;

    const cleaned = priceText
      .replace(/\s/g, '')
      .replace(/€/g, '')
      .replace(/,/g, '');

    const price = parseFloat(cleaned);
    return isNaN(price) ? 0 : price;
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Two-phase scraping: scan ALL pages with per-page checksum comparison.
 * Phase 1: For each search combo, fetch all pages sequentially. Compare checksums per page.
 *          Buffer only new/changed listings.
 * Phase 2 (handled by caller): Transform + ingest only buffered listings, then update checksums.
 */
export async function scrapeAllTwoPhase(
  checksumClient: any,
  scrapeRunId?: string,
  onBatch?: (listings: BytyListing[]) => Promise<void>
): Promise<{
  listings: BytyListing[];
  allSeenChecksums: any[];
  stats: {
    total: number;
    new: number;
    changed: number;
    unchanged: number;
    pagesScanned: number;
  };
}> {
  const { batchCreateBytyChecksums } = await import('../utils/checksumExtractor');

  console.log('\nStarting two-phase scrape (full scan, skip unchanged)...');

  const scraper = new ListingsScraper();

  const categories = [
    { category: 'byty', type: 'predaj' },
    { category: 'byty', type: 'prenajom' },
    { category: 'domy', type: 'predaj' },
    { category: 'domy', type: 'prenajom' },
    { category: 'pozemky', type: 'predaj' },
    { category: 'pozemky', type: 'prenajom' }
  ];

  const roomFilters = [
    { label: '1-room', value: '1' },
    { label: '2-room', value: '2' },
    { label: '3-room', value: '3' },
    { label: '4-room', value: '4' },
    { label: '5-room', value: '5' },
    { label: '6+-room', value: '6' }
  ];

  const searches: Array<{ category: string; type: string; roomFilter: any }> = [];
  for (const cat of categories) {
    for (const roomFilter of roomFilters) {
      searches.push({ ...cat, roomFilter });
    }
  }

  console.log(`Total search combinations: ${searches.length}`);

  const bufferedListings: BytyListing[] = [];
  const allSeenChecksums: any[] = [];
  let totalNew = 0;
  let totalChanged = 0;
  let totalUnchanged = 0;
  let pagesScanned = 0;

  for (const search of searches) {
    const label = `${search.category}/${search.type}/${search.roomFilter.label}`;
    console.log(`\n[${label}] Scanning...`);

    let page = 1;
    const comboBuffered: BytyListing[] = [];

    while (true) {
      try {
        console.log(`  [${label}] Page ${page}...`);
        const { listings: pageListings, hasNextPage } = await scraper.scrapePage(
          search.category,
          search.type,
          page,
          search.roomFilter
        );
        pagesScanned++;

        if (pageListings.length === 0) {
          console.log(`  [${label}] No listings on page ${page}, stopping`);
          break;
        }

        // Compare checksums for this page
        const pageChecksums = batchCreateBytyChecksums(pageListings);

        // Accumulate all seen checksums (for last_seen_at refresh of unchanged listings)
        allSeenChecksums.push(...pageChecksums);

        let comparison: any;
        try {
          comparison = await checksumClient.compareChecksums(pageChecksums, scrapeRunId);
        } catch (err: any) {
          console.warn(`  [${label}] Checksum compare failed on page ${page}: ${err.message}, buffering all`);
          comboBuffered.push(...pageListings);
          if (!hasNextPage) break;
          page++;
          await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 1000));
          continue;
        }

        totalNew += comparison.new;
        totalChanged += comparison.changed;
        totalUnchanged += comparison.unchanged;

        console.log(`  [${label}] Page ${page}: new=${comparison.new}, changed=${comparison.changed}, unchanged=${comparison.unchanged}`);

        // Ingest only new/changed per page immediately
        const changedIds = new Set(
          comparison.results
            .filter((r: any) => r.status !== 'unchanged')
            .map((r: any) => r.portalId)
        );
        const pageChanged = pageListings.filter(l => changedIds.has(l.id));
        if (pageChanged.length > 0) {
          if (onBatch) {
            await onBatch(pageChanged);
          } else {
            comboBuffered.push(...pageChanged);
          }
        }

        if (!hasNextPage) {
          break;
        }

        page++;
        await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 1000));
      } catch (error: any) {
        console.error(`  [${label}] Error on page ${page}: ${error.message}`);
        break;
      }
    }

    if (!onBatch && comboBuffered.length > 0) {
      bufferedListings.push(...comboBuffered);
    }
  }

  await closeCycleTLS();

  // Deduplicate buffered listings by ID
  const uniqueListings = Array.from(
    new Map(bufferedListings.map(item => [item.id, item])).values()
  );

  const totalSeen = totalNew + totalChanged + totalUnchanged;
  console.log(`\nTwo-phase scan complete:`);
  console.log(`  Pages scanned: ${pagesScanned}`);
  console.log(`  Total listings seen: ${totalSeen}`);
  console.log(`  New: ${totalNew}, Changed: ${totalChanged}, Unchanged: ${totalUnchanged}`);
  console.log(`  Buffered for ingestion: ${uniqueListings.length}`);

  return {
    listings: uniqueListings,
    allSeenChecksums,
    stats: {
      total: totalSeen,
      new: totalNew,
      changed: totalChanged,
      unchanged: totalUnchanged,
      pagesScanned
    }
  };
}

/**
 * Scrape with checksum-based change detection
 * Returns only new or changed listings based on ChecksumClient comparison
 */
export async function scrapeWithChecksums(
  ingestApiUrl: string,
  ingestApiKey: string,
  scrapeRunId?: string
): Promise<{
  listings: BytyListing[];
  stats: {
    total: number;
    new: number;
    changed: number;
    unchanged: number;
    savingsPercent: number;
  };
}> {
  const { ChecksumClient } = await import('@landomo/core');
  const { batchCreateBytyChecksums } = await import('../utils/checksumExtractor');

  console.log('\n🔍 Starting checksum-based scrape...');

  const scraper = new ListingsScraper();

  // Scrape all listings
  const allListings = await scraper.scrapeAll(2); // 2 concurrent searches
  console.log(`\n📊 Scraped ${allListings.length} total listings`);

  // Create checksums
  const checksums = batchCreateBytyChecksums(allListings);
  console.log(`\n🔐 Created ${checksums.length} checksums`);

  // Compare with database in batches to avoid payload size issues
  const checksumClient = new ChecksumClient(ingestApiUrl, ingestApiKey);
  const CHECKSUM_BATCH_SIZE = 1000; // Batch size for checksum comparison
  let totalNew = 0;
  let totalChanged = 0;
  let totalUnchanged = 0;
  const allResults: any[] = [];

  console.log(`\n🔄 Comparing checksums in batches of ${CHECKSUM_BATCH_SIZE}...`);
  for (let i = 0; i < checksums.length; i += CHECKSUM_BATCH_SIZE) {
    const batch = checksums.slice(i, i + CHECKSUM_BATCH_SIZE);
    const batchNum = Math.floor(i / CHECKSUM_BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(checksums.length / CHECKSUM_BATCH_SIZE);

    console.log(`  Batch ${batchNum}/${totalBatches}: comparing ${batch.length} checksums...`);

    try {
      const comparison = await checksumClient.compareChecksums(batch, scrapeRunId);
      totalNew += comparison.new;
      totalChanged += comparison.changed;
      totalUnchanged += comparison.unchanged;
      allResults.push(...comparison.results);

      console.log(`    ✓ New: ${comparison.new}, Changed: ${comparison.changed}, Unchanged: ${comparison.unchanged}`);
    } catch (error: any) {
      console.error(`    ✗ Batch ${batchNum} failed:`, error.message);
      // Continue with next batch even if one fails
    }

    // Small delay between batches
    if (i + CHECKSUM_BATCH_SIZE < checksums.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  console.log(`\n✅ Checksum comparison complete:`);
  console.log(`  - New: ${totalNew}`);
  console.log(`  - Changed: ${totalChanged}`);
  console.log(`  - Unchanged: ${totalUnchanged}`);

  // Filter to only new/changed listings
  const changedPortalIds = new Set(
    allResults
      .filter((r: any) => r.status === 'new' || r.status === 'changed')
      .map((r: any) => r.portalId)
  );

  const filteredListings = allListings.filter(listing => changedPortalIds.has(listing.id));

  console.log(`\n💾 Filtered to ${filteredListings.length} listings needing ingestion`);

  // Update checksums in batches
  console.log('\n🔄 Updating checksums...');
  const updatedChecksums = batchCreateBytyChecksums(filteredListings);

  for (let i = 0; i < updatedChecksums.length; i += CHECKSUM_BATCH_SIZE) {
    const batch = updatedChecksums.slice(i, i + CHECKSUM_BATCH_SIZE);
    const batchNum = Math.floor(i / CHECKSUM_BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(updatedChecksums.length / CHECKSUM_BATCH_SIZE);

    console.log(`  Batch ${batchNum}/${totalBatches}: Updating ${batch.length} checksums...`);

    try {
      await checksumClient.updateChecksums(batch, scrapeRunId);
      console.log(`    ✓ Updated ${batch.length} checksums`);
    } catch (error: any) {
      console.error(`    ✗ Batch ${batchNum} failed:`, error.message);
      // Continue with next batch even if one fails
    }

    // Small delay between batches
    if (i + CHECKSUM_BATCH_SIZE < updatedChecksums.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  const savingsPercent = Math.round((totalUnchanged / allListings.length) * 100);

  console.log(`\n🎉 Checksum mode complete:`);
  console.log(`  Total scraped: ${allListings.length}`);
  console.log(`  Bandwidth savings: ${savingsPercent}% (${totalUnchanged} unchanged listings skipped)`);
  console.log(`  Returning ${filteredListings.length} listings for ingestion`);

  return {
    listings: filteredListings,
    stats: {
      total: allListings.length,
      new: totalNew,
      changed: totalChanged,
      unchanged: totalUnchanged,
      savingsPercent
    }
  };
}
