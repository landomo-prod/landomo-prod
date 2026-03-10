import { CommercialPropertyTierI, PropertyLocation } from '@landomo/core';
import { FinnListing } from '../../types/finnTypes';
import { extractSqm, extractPrice, extractImages, buildSourceUrl, extractFeatures } from '../shared';

/**
 * Transform a finn.no listing to CommercialPropertyTierI
 *
 * Norwegian commercial types: Garasje/Parkering, Næringseiendom, Næringsbygg
 */
export function transformFinnCommercial(
  listing: FinnListing,
  offerType: 'sale' | 'rent'
): CommercialPropertyTierI {
  const title = listing.heading || 'Ukjent';
  const { price, currency } = extractPrice(listing, offerType);
  const transaction_type = offerType;

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

  // Area
  const sqm_total = extractSqm(listing);

  // Amenities — minimal info from search results
  const headingLower = (listing.heading || '').toLowerCase();
  const propType = (listing.property_type_description || '').toLowerCase();
  const has_elevator = headingLower.includes('heis');
  const has_parking =
    propType.includes('parkering') ||
    propType.includes('garasje') ||
    headingLower.includes('parkering') ||
    headingLower.includes('garasje');
  const has_bathrooms = false; // Not available in search results

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

  return {
    property_category: 'commercial' as const,

    title,
    price,
    currency,
    transaction_type,

    location,

    country_specific: {
      no_ownership_type: listing.owner_type_description || undefined,
      no_search_key: listing.main_search_key,
    },

    // Commercial-specific required fields
    sqm_total,
    has_elevator,
    has_parking,
    has_bathrooms,

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
