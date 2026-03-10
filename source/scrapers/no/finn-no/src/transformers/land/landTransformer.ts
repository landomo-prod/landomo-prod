import { LandPropertyTierI, PropertyLocation } from '@landomo/core';
import { FinnListing } from '../../types/finnTypes';
import { extractPlotSqm, extractPrice, extractImages, buildSourceUrl, extractFeatures } from '../shared';

/**
 * Transform a finn.no listing to LandPropertyTierI
 *
 * Norwegian land types: Tomter, Fritidstomt
 * Search key: SEARCH_ID_REALESTATE_PLOTS
 */
export function transformFinnLand(
  listing: FinnListing,
  offerType: 'sale' | 'rent'
): LandPropertyTierI {
  const title = listing.heading || 'Ukjent';
  const { price, currency } = extractPrice(listing, offerType);

  // Location
  const location = {
    address: listing.location || '',
    city: extractCity(listing.location),
    region: listing.local_area_name,
    country: 'Norway',
    coordinates: listing.coordinates
      ? { lat: listing.coordinates.lat, lon: listing.coordinates.lon }
      : undefined,
  } as PropertyLocation;

  // Plot area — the primary field for land listings
  // For plots, finn.no uses area_plot.size (seen: 38492 m² for example listing)
  const area_plot_sqm = extractPlotSqm(listing);

  // Images
  const images = extractImages(listing);

  // Source info
  const source_url = buildSourceUrl(listing);
  const portal_id = `finn-no-${listing.ad_id}`;

  // Published date
  const published_date = listing.timestamp
    ? new Date(listing.timestamp).toISOString()
    : undefined;

  const features = extractFeatures(listing);

  // Ownership type
  const ownershipRaw = listing.owner_type_description || '';

  return {
    property_category: 'land' as const,

    title,
    price,
    currency,
    transaction_type: offerType,

    location,

    country_specific: {
      no_ownership_type: ownershipRaw || undefined,
      no_search_key: listing.main_search_key,
    },

    // Land-specific required field
    area_plot_sqm,

    // Optional
    published_date,

    images,
    media: {
      images,
    },

    features,

    source_url,
    source_platform: 'finn-no',
    portal_id,
    status: 'active' as const,
  };
}

function extractCity(location: string | undefined): string {
  if (!location) return 'Ukjent';
  const parts = location.split(',').map(p => p.trim());
  for (let i = parts.length - 1; i >= 0; i--) {
    const part = parts[i];
    if (part && !/^\d/.test(part)) {
      return part;
    }
  }
  return parts[parts.length - 1] || 'Ukjent';
}
