import { DiscoveredListing } from './fetchData';
import crypto from 'crypto';

export interface ChecksumEntry {
  portalId: string;
  checksum: string;
}

function createChecksum(listing: DiscoveredListing): string {
  const raw = listing.raw;
  const key = [
    raw.id,
    raw.price,
    raw.surface,
    raw.bedrooms,
    raw.title?.slice(0, 100),
  ].join('|');

  return crypto.createHash('md5').update(key).digest('hex');
}

export function batchCreateChecksums(listings: DiscoveredListing[]): ChecksumEntry[] {
  return listings.map(listing => ({
    portalId: `immotop-${listing.id}`,
    checksum: createChecksum(listing),
  }));
}
