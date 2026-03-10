import { ApartmentPropertyTierI, PropertyLocation } from '@landomo/core';
import { FinnListing } from '../../types/finnTypes';
import { extractSqm, extractPlotSqm, extractPrice, extractImages, buildSourceUrl, extractFurnished, extractFeatures } from '../shared';

/**
 * Transform a finn.no listing to ApartmentPropertyTierI
 *
 * Norwegian apartment types: Leilighet, Hybel, Rom i bofellesskap
 */
export function transformFinnApartment(
  listing: FinnListing,
  offerType: 'sale' | 'rent'
): ApartmentPropertyTierI {
  const title = listing.heading || 'Ukjent';
  const { price, currency } = extractPrice(listing, offerType);
  const transaction_type = offerType;

  // Location
  const location: PropertyLocation = {
    address: listing.location || '',
    city: extractCity(listing.location),
    region: listing.local_area_name,
    country: 'Norway',
    coordinates: listing.coordinates
      ? { lat: listing.coordinates.lat, lon: listing.coordinates.lon }
      : undefined,
  };

  // Area
  const sqm = extractSqm(listing);

  // Bedrooms
  const bedrooms = listing.number_of_bedrooms ?? 0;

  // Amenities — finn.no search results don't return boolean amenity flags,
  // so we default to false and populate what we can from heading/description heuristics.
  const headingLower = (listing.heading || '').toLowerCase();
  const has_balcony = headingLower.includes('balkong') || headingLower.includes('terrasse');
  const has_elevator = headingLower.includes('heis');
  const has_parking = headingLower.includes('parkering') || headingLower.includes('garasje');
  const has_basement = headingLower.includes('kjeller');

  // Furnished state (rental-specific)
  const furnished = extractFurnished(listing.furnished_state);

  // Ownership type
  const ownershipRaw = listing.owner_type_description || '';
  const ownershipNote = ownershipRaw || undefined;

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

  return {
    property_category: 'apartment' as const,

    title,
    price,
    currency,
    transaction_type,

    location,

    property_subtype: detectApartmentSubtype(listing),

    country_specific: {
      no_ownership_type: ownershipNote,
      no_search_key: listing.main_search_key,
    },

    // Apartment-specific required fields
    bedrooms,
    sqm,
    has_elevator,
    has_balcony,
    has_parking,
    has_basement,

    // Optional enrichment
    furnished,
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

/**
 * Extract city name from finn.no location string
 * Example: "Selsbakkvegen 48 A, Trondheim" → "Trondheim"
 * Example: "Maridalsveien 205, 530, 0469 Oslo, Oslo" → "Oslo"
 */
function extractCity(location: string | undefined): string {
  if (!location) return 'Ukjent';
  const parts = location.split(',').map(p => p.trim());
  // Last non-empty, non-numeric part is typically the city
  for (let i = parts.length - 1; i >= 0; i--) {
    const part = parts[i];
    if (part && !/^\d/.test(part)) {
      return part;
    }
  }
  return parts[parts.length - 1] || 'Ukjent';
}

function detectApartmentSubtype(
  listing: FinnListing
): 'standard' | 'studio' | 'penthouse' | 'loft' | undefined {
  const heading = (listing.heading || '').toLowerCase();
  const propType = (listing.property_type_description || '').toLowerCase();

  if (propType === 'hybel' || listing.number_of_bedrooms === 0) {
    return 'studio';
  }
  if (heading.includes('penthouse')) return 'penthouse';
  if (heading.includes('loft')) return 'loft';

  return 'standard';
}
