import { HousePropertyTierI, PropertyLocation } from '@landomo/core';
import { FinnListing } from '../../types/finnTypes';
import { extractSqm, extractPlotSqm, extractPrice, extractImages, buildSourceUrl, extractFurnished, extractFeatures } from '../shared';

/**
 * Transform a finn.no listing to HousePropertyTierI
 *
 * Norwegian house types: Enebolig, Rekkehus, Tomannsbolig, Hytte, Fritidsbolig
 */
export function transformFinnHouse(
  listing: FinnListing,
  offerType: 'sale' | 'rent'
): HousePropertyTierI {
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

  // Area fields
  const sqm_living = extractSqm(listing);
  const sqm_plot = extractPlotSqm(listing);

  // Bedrooms
  const bedrooms = listing.number_of_bedrooms ?? 0;

  // Amenities from heading heuristics
  const headingLower = (listing.heading || '').toLowerCase();
  const has_garden = sqm_plot > 0 || headingLower.includes('hage') || headingLower.includes('tomt');
  const has_garage = headingLower.includes('garasje');
  const has_parking = has_garage || headingLower.includes('parkering');
  const has_basement = headingLower.includes('kjeller') || headingLower.includes('underetasje');

  // Images
  const images = extractImages(listing);

  // Source info
  const source_url = buildSourceUrl(listing);
  const portal_id = `finn-no-${listing.ad_id}`;

  // Published date
  const published_date = listing.timestamp
    ? new Date(listing.timestamp).toISOString()
    : undefined;

  // Features
  const features = extractFeatures(listing);

  // Ownership type
  const ownershipRaw = listing.owner_type_description || '';

  return {
    property_category: 'house' as const,

    title,
    price,
    currency,
    transaction_type,

    location,

    property_subtype: detectHouseSubtype(listing),

    country_specific: {
      no_ownership_type: ownershipRaw || undefined,
      no_search_key: listing.main_search_key,
    },

    // House-specific required fields
    bedrooms,
    sqm_living,
    sqm_plot,
    has_garden,
    has_garage,
    has_parking,
    has_basement,

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

function detectHouseSubtype(
  listing: FinnListing
): 'villa' | 'detached' | 'semi_detached' | 'townhouse' | 'terraced' | 'cottage' | 'farmhouse' | 'bungalow' | undefined {
  const propType = (listing.property_type_description || '').toLowerCase();
  const searchKey = listing.main_search_key || '';

  if (propType === 'enebolig') return 'detached';
  if (propType === 'tomannsbolig' || propType === 'enebolig, tomannsbolig') return 'semi_detached';
  if (propType === 'rekkehus') return 'townhouse';
  if (
    propType === 'hytte' ||
    propType === 'fritidsbolig' ||
    searchKey === 'SEARCH_ID_REALESTATE_LEISURE_SALE'
  ) {
    return 'cottage';
  }

  return 'detached';
}
