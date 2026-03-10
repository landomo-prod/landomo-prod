import { DiscoveredListing } from './fetchData';
import crypto from 'crypto';

export interface ChecksumEntry {
  portal: string;
  portalId: string;
  contentHash: string;
}

/**
 * Create a checksum from listing data to detect changes
 */
function createChecksum(listing: DiscoveredListing): string {
  const raw = listing.raw;
  const key = [
    raw.id,
    raw.prices?.min,
    raw.prices?.max,
    raw.status,
    raw.surfaces?.min,
    raw.bedrooms,
    raw.description?.slice(0, 100),
  ].join('|');

  return crypto.createHash('md5').update(key).digest('hex');
}

export function batchCreateChecksums(listings: DiscoveredListing[]): ChecksumEntry[] {
  return listings.map(listing => ({
    portal: 'athome',
    portalId: `athome-${listing.id}`,
    contentHash: createChecksum(listing),
  }));
}
