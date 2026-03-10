import { FinnListing } from '../types/finnTypes';

/**
 * Shared utility functions for all finn.no transformers
 */

/**
 * Extract the primary living area in m² from a listing.
 * Finn.no uses either `area_range` (for most listings) or `area` (rare).
 * area_range.size_from === size_to when it's an exact measurement.
 */
export function extractSqm(listing: FinnListing): number {
  if (listing.area_range && listing.area_range.size_from > 0) {
    // Use average if it's a real range, otherwise use the single value
    return listing.area_range.size_to > 0
      ? Math.round((listing.area_range.size_from + listing.area_range.size_to) / 2)
      : listing.area_range.size_from;
  }
  if (listing.area && listing.area.size > 0) {
    return listing.area.size;
  }
  return 0;
}

/**
 * Extract plot/land area in m² from a listing.
 * Finn.no uses `area_plot` for this.
 */
export function extractPlotSqm(listing: FinnListing): number {
  if (listing.area_plot && listing.area_plot.size > 0) {
    return listing.area_plot.size;
  }
  return 0;
}

/**
 * Extract price and currency from a listing.
 * For sale listings: use price_suggestion (asking price).
 * For rent listings: use price_suggestion (monthly rent).
 * Falls back to price_total (includes shared debt).
 */
export function extractPrice(
  listing: FinnListing,
  offerType: 'sale' | 'rent'
): { price: number; currency: string } {
  // price_suggestion is the asking price for sale / monthly rent for lettings
  if (listing.price_suggestion && listing.price_suggestion.amount > 0) {
    return {
      price: listing.price_suggestion.amount,
      currency: listing.price_suggestion.currency_code || 'NOK',
    };
  }
  // Fallback to total price (includes shared debt for condos)
  if (listing.price_total && listing.price_total.amount > 0) {
    return {
      price: listing.price_total.amount,
      currency: listing.price_total.currency_code || 'NOK',
    };
  }
  return { price: 0, currency: 'NOK' };
}

/**
 * Extract all image URLs from a listing.
 */
export function extractImages(listing: FinnListing): string[] {
  if (listing.image_urls && listing.image_urls.length > 0) {
    return listing.image_urls;
  }
  if (listing.image?.url) {
    return [listing.image.url];
  }
  return [];
}

/**
 * Build canonical source URL for a listing.
 * Finn.no provides canonical_url directly in the API response.
 */
export function buildSourceUrl(listing: FinnListing): string {
  if (listing.canonical_url) {
    return listing.canonical_url;
  }
  return `https://www.finn.no/realestate/homes/ad.html?finnkode=${listing.ad_id}`;
}

/**
 * Map finn.no furnished_state (Norwegian) to TierI furnished values.
 * Values observed: "Møblert", "Delvis møblert", "Umøblert"
 */
export function extractFurnished(
  furnishedState: string | undefined
): 'furnished' | 'partially_furnished' | 'not_furnished' | undefined {
  if (!furnishedState) return undefined;
  const lower = furnishedState.toLowerCase();
  if (lower.includes('delvis')) return 'partially_furnished';
  if (lower.includes('umøblert')) return 'not_furnished';
  if (lower.includes('møblert')) return 'furnished';
  return undefined;
}

/**
 * Extract feature tags from a listing (from flags and heading keywords).
 */
export function extractFeatures(listing: FinnListing): string[] {
  const features: string[] = [];
  const heading = (listing.heading || '').toLowerCase();
  const flags = listing.flags || [];

  // From API flags
  if (flags.includes('coming_for_sale')) features.push('coming_for_sale');
  if (flags.includes('private')) features.push('private_seller');

  // From heading keywords
  if (heading.includes('balkong')) features.push('balcony');
  if (heading.includes('terrasse')) features.push('terrace');
  if (heading.includes('heis')) features.push('elevator');
  if (heading.includes('garasje')) features.push('garage');
  if (heading.includes('parkering')) features.push('parking');
  if (heading.includes('kjeller')) features.push('basement');
  if (heading.includes('hage')) features.push('garden');
  if (heading.includes('ny')) features.push('new_build');
  if (heading.includes('nybygg')) features.push('new_build');

  return [...new Set(features)]; // deduplicate
}
