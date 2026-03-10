/**
 * Bazos Listings Scraper
 * Scrapes listings from Bazos across multiple countries and sections
 */

import { fetchSectionData, BazosApiFetcher } from '../utils/fetchData';
import { getRandomUserAgent } from '../utils/userAgents';
import { BazosAd, ScraperStats, BazosScraperConfig } from '../types/bazosTypes';

/**
 * Real Estate Section Code
 */
const REAL_ESTATE_SECTION = 'RE'; // Reality/Real Estate

const BAZOS_SECTIONS: Record<string, string> = {
  'RE': 'Reality',        // Real Estate (primary focus)
};

export class ListingsScraper {
  private countries: string[];
  private sections: string[];
  private maxPages: number;
  private delayMs: number;

  constructor(config?: BazosScraperConfig) {
    this.countries = config?.countries || ['cz'];
    this.sections = config?.sections || Object.keys(BAZOS_SECTIONS);
    // Use environment variable or config, default to 10000 (effectively unlimited - fetchSectionData stops when no more results)
    this.maxPages = config?.maxPages || parseInt(process.env.MAX_PAGES || '10000', 10);
    this.delayMs = config?.delayMs || 1000;
  }

  /**
   * Scrape all configured sections from all countries
   */
  async scrapeAll(): Promise<Array<BazosAd & { _country: string; _section: string }>> {
    console.log(`Starting Bazos scrape...`);
    console.log(`  Countries: ${this.countries.join(', ')}`);
    console.log(`  Sections: ${this.sections.slice(0, 5).join(', ')}${this.sections.length > 5 ? '...' : ''}`);

    const allListings: Array<BazosAd & { _country: string; _section: string }> = [];
    const stats: ScraperStats = {
      totalProcessed: 0,
      newListings: 0,
      sections: {},
      countries: {},
      errors: 0
    };

    // Process each country
    for (const country of this.countries) {
      console.log(`\n📍 Scraping ${country.toUpperCase()}...`);
      stats.countries[country] = 0;

      // Process each section
      for (const section of this.sections) {
        try {
          const sectionListings = await fetchSectionData(
            country,
            section,
            {
              userAgent: getRandomUserAgent(),
              maxPages: this.maxPages,
              delayMs: this.delayMs,
            }
          );

          if (sectionListings.length > 0) {
            // Add country and section metadata
            const enrichedListings = sectionListings.map(ad => ({
              ...ad,
              _country: country,
              _section: section
            }));

            allListings.push(...enrichedListings);
            stats.totalProcessed += sectionListings.length;
            stats.sections[section] = (stats.sections[section] || 0) + sectionListings.length;
            stats.countries[country] += sectionListings.length;

            console.log(`  ✓ ${BAZOS_SECTIONS[section] || section}: ${sectionListings.length} listings`);
          }
        } catch (error: any) {
          console.error(`  ✗ ${BAZOS_SECTIONS[section] || section}: ${error.message}`);
          stats.errors++;
        }
      }
    }

    console.log(`\n✅ Scraping complete:`);
    console.log(`   Total listings: ${stats.totalProcessed}`);
    console.log(`   Errors: ${stats.errors}`);

    return allListings;
  }

  /**
   * Scrape a specific country and section
   */
  async scrapeCountrySection(
    country: string,
    section: string,
    maxPages?: number
  ): Promise<BazosAd[]> {
    console.log(`Scraping ${country.toUpperCase()} - ${BAZOS_SECTIONS[section] || section}...`);

    const listings = await fetchSectionData(
      country,
      section,
      {
        userAgent: getRandomUserAgent(),
        maxPages: maxPages || this.maxPages,
        delayMs: this.delayMs,
      }
    );

    console.log(`Found ${listings.length} listings`);
    return listings;
  }

  /**
   * Get available sections (Real Estate only)
   */
  getSections(): Record<string, string> {
    return { 'RE': 'Real Estate' };
  }

  /**
   * Get available countries
   */
  getCountries(): string[] {
    return ['cz', 'sk', 'pl', 'at'];
  }
}

/**
 * Scrape all listings with checksum-based change detection
 *
 * Prevents costly LLM re-extractions by comparing checksums.
 * Only returns listings with new or changed titles.
 *
 * @param ingestApiUrl - URL of ingest service
 * @param ingestApiKey - API key for ingest service
 * @param scrapeRunId - Optional scrape run ID for tracking
 * @returns Listings that need LLM extraction + stats
 */
export async function scrapeWithChecksums(
  ingestApiUrl: string,
  ingestApiKey: string,
  scrapeRunId?: string
): Promise<{
  listings: Array<BazosAd & { _country: string; _section: string }>;
  allListings: Array<BazosAd & { _country: string; _section: string }>;
  stats: {
    total: number;
    new: number;
    changed: number;
    unchanged: number;
    savingsPercent: number;
  };
}> {
  const { batchCreateBazosChecksums } = await import('../utils/checksumExtractor');
  const { ChecksumClient } = await import('@landomo/core');

  // 1. Fetch all listings from Bazos API (same as before)
  const scraper = new ListingsScraper();
  const rawListings = await scraper.scrapeAll();

  if (rawListings.length === 0) {
    return {
      listings: [],
      allListings: [],
      stats: { total: 0, new: 0, changed: 0, unchanged: 0, savingsPercent: 0 }
    };
  }

  // 1.5. Deduplicate listings by ID (Bazos sometimes returns duplicates across pages)
  const seenListingIds = new Set<string>();
  const allListings = rawListings.filter(listing => {
    if (seenListingIds.has(listing.id)) {
      return false;
    }
    seenListingIds.add(listing.id);
    return true;
  });

  if (rawListings.length !== allListings.length) {
    console.log(`🔧 Deduplicated: ${rawListings.length} → ${allListings.length} listings (removed ${rawListings.length - allListings.length} duplicates)`);
  }

  // 2. Generate checksums for all listings
  console.log(`🔐 Generating checksums for ${allListings.length} listings...`);
  const checksums = batchCreateBazosChecksums(allListings);

  // 3. Compare checksums against database
  console.log(`📊 Comparing checksums with database...`);
  const checksumClient = new ChecksumClient(ingestApiUrl, ingestApiKey);
  const comparison = await checksumClient.compareChecksums(checksums);

  // 4. Filter to only new/changed listings (need LLM extraction)
  const needsExtraction = allListings.filter(listing => {
    const result = comparison.results.find(r => r.portalId === listing.id);
    return result && result.status !== 'unchanged';
  });

  // 5. Calculate stats
  const stats = {
    total: allListings.length,
    new: comparison.results.filter(r => r.status === 'new').length,
    changed: comparison.results.filter(r => r.status === 'changed').length,
    unchanged: comparison.results.filter(r => r.status === 'unchanged').length,
    savingsPercent: Math.round(
      (comparison.results.filter(r => r.status === 'unchanged').length / allListings.length) * 100
    )
  };

  console.log(`📊 Checksum Results:`);
  console.log(`   Total: ${stats.total}`);
  console.log(`   New: ${stats.new}`);
  console.log(`   Changed: ${stats.changed}`);
  console.log(`   Unchanged: ${stats.unchanged} (skip LLM extraction)`);
  console.log(`   LLM Cost Savings: ${stats.savingsPercent}% (~$${(stats.unchanged * 0.000634).toFixed(4)})`);

  // 6. Update checksums for future comparisons (in chunks to avoid 500 errors)
  console.log(`💾 Updating checksums...`);
  const CHUNK_SIZE = 500; // Update checksums in batches of 500
  for (let i = 0; i < checksums.length; i += CHUNK_SIZE) {
    const chunk = checksums.slice(i, i + CHUNK_SIZE);
    console.log(`   Updating chunk ${Math.floor(i / CHUNK_SIZE) + 1}/${Math.ceil(checksums.length / CHUNK_SIZE)} (${chunk.length} checksums)...`);
    await checksumClient.updateChecksums(chunk, scrapeRunId);
  }
  console.log(`✅ All checksums updated`);

  return {
    listings: needsExtraction,
    allListings,
    stats
  };
}
