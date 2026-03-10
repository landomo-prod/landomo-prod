/**
 * Bazos Checksum Extractor
 *
 * Generates checksums from Bazos listing titles to prevent
 * redundant LLM extractions on unchanged listings.
 *
 * Key difference from other scrapers:
 * - Bazos only has title text (no description in API response)
 * - LLM extraction is costly ($0.000634/listing)
 * - Checksum prevents re-extraction when title unchanged
 */

import { ChecksumFields, createListingChecksum, ListingChecksum } from '@landomo/core';
import { BazosAd } from '../types/bazosTypes';

/**
 * Extract checksum fields from Bazos listing
 *
 * Only uses title since that's all we have for LLM extraction
 */
export function extractBazosChecksumFields(listing: BazosAd): ChecksumFields {
  return {
    title: listing.title ?? null,
    // Note: Bazos API doesn't provide description in list endpoint
    // LLM extracts all property details from title alone
  };
}

/**
 * Create checksum for single Bazos listing
 *
 * @param listing - Bazos ad from API
 * @returns Checksum object with portal_id and hash
 * @throws Error if listing.id is missing
 */
export function createBazosChecksum(listing: BazosAd): ListingChecksum {
  const portalId = listing.id;

  if (!portalId) {
    throw new Error('Bazos listing missing id field');
  }

  return createListingChecksum(
    'bazos',
    portalId,
    listing,
    extractBazosChecksumFields
  );
}

/**
 * Batch create checksums for multiple Bazos listings
 *
 * @param listings - Array of Bazos ads
 * @returns Array of checksums
 */
export function batchCreateBazosChecksums(listings: BazosAd[]): ListingChecksum[] {
  return listings
    .filter(listing => listing.id) // Skip listings without ID
    .map(createBazosChecksum);
}
