import { PropertyLocation, PropertyMedia } from '@landomo/core';
import { KMListing, KMImage } from '../types/kiinteistomaailmaTypes';

const KM_IMAGE_BASE = 'https://www.kiinteistomaailma.fi/km/images';

/**
 * Build a canonical portal ID for a listing.
 * Format: "kiinteistomaailma-{key}"
 */
export function buildPortalId(listing: KMListing): string {
  return `kiinteistomaailma-${listing.key}`;
}

/**
 * Build a PropertyLocation from a KMListing.
 * Coordinates from API are [longitude, latitude] per GeoJSON convention.
 */
export function buildLocation(listing: KMListing): PropertyLocation {
  const [longitude, latitude] = listing.location.coordinates;
  return {
    address: listing.address,
    city: listing.city,
    region: listing.district || listing.municipality || undefined,
    country: 'Finland',
    postal_code: listing.postcode,
    coordinates:
      latitude !== undefined && longitude !== undefined
        ? { lat: latitude, lon: longitude }
        : undefined,
  };
}

/**
 * Build a full image URL from a KMImage.
 * Image URL pattern: https://www.kiinteistomaailma.fi/km/images{path}/{name}
 */
export function buildImageUrl(image: KMImage): string {
  return `${KM_IMAGE_BASE}${image.path}/${image.name}`;
}

/**
 * Build a PropertyMedia object from listing images.
 */
export function buildMedia(listing: KMListing): PropertyMedia {
  const images: string[] = listing.images
    .filter(img => img.type === 'MAIN' || img.type === 'NORMAL')
    .map(img => buildImageUrl(img));

  const floorPlanImage = listing.images.find(img => img.type === 'GROUND_PLAN');

  return {
    images,
    floor_plan_url: floorPlanImage ? buildImageUrl(floorPlanImage) : undefined,
    video_tour_url: listing.videoPresentationUrl || undefined,
  };
}

/**
 * Build a plain string[] of image URLs for the deprecated images field on TierI types.
 */
export function buildImageUrls(listing: KMListing): string[] {
  return listing.images
    .filter(img => img.type === 'MAIN' || img.type === 'NORMAL')
    .map(img => buildImageUrl(img));
}

/**
 * Build the listing title string.
 */
export function buildTitle(listing: KMListing, typeName: string): string {
  const parts: string[] = [];

  if (typeName) parts.push(typeName);
  if (listing.roomTypes) parts.push(listing.roomTypes);
  if (listing.livingArea) parts.push(`${listing.livingArea} m²`);
  parts.push(listing.district || listing.city);

  return parts.join(', ') || `Kiinteistömaailma ${listing.key}`;
}

/**
 * Extract the price to use for a listing.
 * For sales: use salesPriceUnencumbered (debt-free price) when available,
 * falling back to salesPrice (which may be lower due to housing company debt).
 * For rentals: use rentInfo.rentPerMonth.
 */
export function resolvePrice(listing: KMListing): number | undefined {
  if (listing.rental && listing.rentInfo) {
    return listing.rentInfo.rentPerMonth;
  }
  return listing.salesPriceUnencumbered ?? listing.salesPrice ?? undefined;
}

/**
 * Derive bedrooms from roomAmount.
 * Finnish roomAmount counts all rooms; bedrooms ≈ rooms - 1 (subtracting kitchen/living).
 * This is an approximation for Finnish convention ("3h + k" = 3 rooms, ~2 bedrooms).
 */
export function deriveBedrooms(roomAmount: number | null): number | undefined {
  if (roomAmount === null || roomAmount === undefined) return undefined;
  return Math.max(0, roomAmount - 1);
}

/**
 * Build feature tags from listing metadata.
 */
export function buildFeatures(listing: KMListing): string[] {
  const features: string[] = [];
  if (listing.newConstruction) features.push('new_construction');
  if (listing.onlineOffer) features.push('online_offer');
  if (listing.valueListing) features.push('value_listing');
  if (listing.openHouses.length > 0) features.push('viewing_scheduled');
  if (listing.videoPresentationUrl) features.push('video_tour');
  return features;
}
