/**
 * Fotocasa detail scraper
 *
 * Fotocasa search API returns most fields needed for transformation.
 * The detail page is only needed for extra features (otherFeaturesCount).
 * For now, we skip detail fetching and use search data directly.
 * This can be enhanced later if more detail is needed.
 */

import { FotocasaListing } from '../types/fotocasaTypes';

export interface DetailResult {
  listing: FotocasaListing;
  hasDetailData: boolean;
}

/**
 * For Fotocasa, search results contain enough data for transformation.
 * This function is a passthrough that can be enhanced to fetch detail pages.
 */
export function processListing(listing: FotocasaListing): DetailResult {
  return {
    listing,
    hasDetailData: false,
  };
}
