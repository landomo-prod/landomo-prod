import crypto from 'crypto';

/**
 * Checksum Utility for Change Detection
 *
 * Creates SHA256 hashes of property data to detect changes without fetching full details.
 * Used across all scrapers for consistent checksum generation.
 */

export interface ChecksumFields {
  price?: number | null;
  title?: string | null;
  description?: string | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  sqm?: number | null;
  // Add other fields that should trigger updates when changed
  [key: string]: any;
}

export interface ListingChecksum {
  portal: string;
  portalId: string;
  contentHash: string;
}

/**
 * Generate SHA256 checksum from key property fields
 *
 * @param fields - Object containing fields to hash
 * @returns 64-character SHA256 hash
 *
 * @example
 * const hash = generateChecksum({
 *   price: 5000000,
 *   title: "Byt 3+1",
 *   bedrooms: 3,
 *   sqm: 75
 * });
 */
export function generateChecksum(fields: ChecksumFields): string {
  // Normalize fields to consistent format
  const normalized = {
    price: fields.price ?? null,
    title: (fields.title ?? '').trim().toLowerCase(),
    description: (fields.description ?? '').trim().toLowerCase(),
    bedrooms: fields.bedrooms ?? null,
    bathrooms: fields.bathrooms ?? null,
    sqm: fields.sqm ?? null,
  };

  // Create deterministic JSON string
  const jsonString = JSON.stringify(normalized, Object.keys(normalized).sort());

  // Generate SHA256 hash
  return crypto.createHash('sha256').update(jsonString).digest('hex');
}

/**
 * Extract checksum fields from listing page data
 * This should be implemented by each scraper based on their listing format
 *
 * @example
 * // For SReality listing page data:
 * const fields = extractListingFields(listing);
 * // Returns: { price: 5000000, title: "Byt 3+1", sqm: 75 }
 */
export type ExtractListingFieldsFn = (listing: any) => ChecksumFields;

/**
 * Create checksum from listing page data
 *
 * @param portal - Portal identifier (e.g., 'sreality', 'bezrealitky')
 * @param portalId - Portal-specific listing ID
 * @param listing - Raw listing data from portal
 * @param extractFields - Function to extract checksum fields from listing
 * @returns ListingChecksum object ready to send to API
 *
 * @example
 * const checksum = createListingChecksum(
 *   'sreality',
 *   '12345',
 *   rawListing,
 *   (listing) => ({
 *     price: listing.price_czk?.value_raw,
 *     title: listing.name,
 *     sqm: listing.usable_area
 *   })
 * );
 */
export function createListingChecksum(
  portal: string,
  portalId: string,
  listing: any,
  extractFields: ExtractListingFieldsFn
): ListingChecksum {
  const fields = extractFields(listing);
  const contentHash = generateChecksum(fields);

  return {
    portal,
    portalId,
    contentHash,
  };
}

/**
 * Batch create checksums from multiple listings
 *
 * @example
 * const checksums = batchCreateChecksums(
 *   'sreality',
 *   listings,
 *   (listing) => listing.hash_id.toString(),
 *   (listing) => ({ price: listing.price_czk?.value_raw, title: listing.name })
 * );
 */
export function batchCreateChecksums(
  portal: string,
  listings: any[],
  getPortalId: (listing: any) => string,
  extractFields: ExtractListingFieldsFn
): ListingChecksum[] {
  return listings.map((listing) => {
    const portalId = getPortalId(listing);
    return createListingChecksum(portal, portalId, listing, extractFields);
  });
}
