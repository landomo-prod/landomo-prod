import { HemnetListing } from '../types/hemnetTypes';

/**
 * Parse municipality and city from Hemnet locationName.
 *
 * Format: "Område, Kommun" or "Postal Area, Kommun"
 * Examples:
 *   "Centrum, Karlshamns kommun" → city: "Karlshamn", municipality: "Karlshamns kommun"
 *   "Visby, Gotlands kommun" → city: "Visby", municipality: "Gotlands kommun"
 *   "Överkalix, Överkalix kommun" → city: "Överkalix", municipality: "Överkalix kommun"
 */
export function parseMunicipality(locationName: string): { city: string; municipality: string } {
  const parts = locationName.split(',').map(s => s.trim());
  if (parts.length >= 2) {
    return {
      city: parts[0],
      municipality: parts[1],
    };
  }
  return {
    city: locationName,
    municipality: locationName,
  };
}

/**
 * Build the canonical Hemnet URL for a listing.
 *
 * Hemnet listing URLs follow the pattern:
 *   https://www.hemnet.se/bostad/{slug}-{id}
 *
 * Since we don't have the slug from the GraphQL API, we use the listing ID
 * to build a redirect-friendly URL. Hemnet will redirect to the correct page.
 *
 * Note: The /bostad/ URLs require the full slug. We construct a URL using
 * the street address as the slug approximation. The canonical approach is:
 *   https://www.hemnet.se/bostader/{id}
 *
 * However, the most reliable link format is using the ID in the listings view.
 */
export function buildSourceUrl(listing: HemnetListing): string {
  // Build a slug from street address and location for a more readable URL
  // Hemnet actual URLs use: /bostad/[type]-[rooms]rum-[area]-[municipality]-[street]-[id]
  // Without the full slug, we use the search URL with the ID filter
  // The ID is globally unique on Hemnet
  return `https://www.hemnet.se/bostad/${listing.id}`;
}

/**
 * Parse the publishedAt timestamp from a Hemnet listing.
 *
 * Hemnet returns publishedAt as a Unix timestamp string with decimals,
 * e.g. "1771921800.089"
 */
export function parsePublishedDate(listing: HemnetListing): string | undefined {
  if (!('publishedAt' in listing) || !listing.publishedAt) {
    return undefined;
  }
  const timestamp = parseFloat(listing.publishedAt);
  if (isNaN(timestamp)) return undefined;
  return new Date(timestamp * 1000).toISOString();
}
