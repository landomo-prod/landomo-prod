import { HousePropertyTierI } from '@landomo/core';
import { HybelListingDetail } from '../../types/hybelTypes';

/**
 * Transform a parsed hybel.no listing detail into a HousePropertyTierI.
 *
 * Covers: enebolig (detached house), rekkehus (terraced house),
 * tomannsbolig (semi-detached), and other house types.
 */
export function transformHouse(detail: HybelListingDetail): HousePropertyTierI {
  // For houses, rooms - 1 ≈ bedrooms
  let bedrooms = detail.bedrooms;
  if (bedrooms === null && detail.rooms !== null) {
    bedrooms = Math.max(0, detail.rooms - 1);
  }
  bedrooms = bedrooms ?? 0;

  // Build location
  const location: HousePropertyTierI['location'] = {
    country: 'Norway',
    city: detail.city || extractCity(detail.address),
    postal_code: detail.postalCode ?? undefined,
    address: detail.address || undefined,
    ...(detail.lat !== null && detail.lng !== null
      ? { coordinates: { lat: detail.lat, lon: detail.lng } }
      : {}),
  };

  // Build media
  const media = detail.images.length > 0
    ? { images: detail.images.map((url, i) => ({ url, order: i })) }
    : undefined;

  const deposit = detail.deposit ?? undefined;

  return {
    property_category: 'house',
    status: 'active',

    title: detail.title || `${detail.housingTypeRaw} ${detail.address}`,
    description: detail.description ?? undefined,

    price: detail.monthlyRent ?? 0,
    currency: 'NOK',
    transaction_type: 'rent',

    location,

    bedrooms,
    sqm_living: detail.sqm ?? 0,
    sqm_plot: 0, // Not available on hybel.no

    has_garden: detail.hasGarden,
    has_garage: detail.hasGarage,
    has_parking: detail.hasParking,
    has_basement: detail.hasBasement,

    furnished: detail.hasFurnished ? 'furnished' : undefined,
    deposit,
    available_from: detail.availableFrom ?? undefined,

    media,
    images: detail.images.length > 0 ? detail.images : undefined,
    features: buildFeaturesList(detail),

    source_url: detail.url,
    source_platform: 'hybel-no',
    portal_id: `hybel-no-${detail.id}`,

    country_specific: {
      hybel_id: detail.id,
      housing_type_raw: detail.housingTypeRaw,
      boligtype: detail.boligtype,
      lease_type: detail.leaseType,
      utilities_included: detail.utilitiesIncluded.length > 0 ? detail.utilitiesIncluded : null,
      has_broadband: detail.hasBroadband,
      has_washing_machine: detail.hasWashingMachine,
      has_dishwasher: detail.hasDishwasher,
      has_white_goods: detail.hasWhiteGoods,
      is_premium: detail.isPremium,
    },
  };
}

function extractCity(address: string): string {
  const parts = address.split(',');
  return parts.length > 1 ? parts[parts.length - 1].trim() : address.trim();
}

function buildFeaturesList(detail: HybelListingDetail): string[] {
  const features: string[] = [];
  if (detail.hasBroadband) features.push('Bredbånd');
  if (detail.hasWashingMachine) features.push('Vaskemaskin');
  if (detail.hasDishwasher) features.push('Oppvaskmaskin');
  if (detail.hasWhiteGoods) features.push('Hvitevarer');
  if (detail.hasFurnished) features.push('Møblert');
  if (detail.hasFireplace) features.push('Peis/Ildsted');
  if (detail.hasBalcony) features.push('Balkong');
  if (detail.hasTerrace) features.push('Terrasse');
  if (detail.hasParking) features.push('Parkering');
  if (detail.hasElevator) features.push('Heis');
  if (detail.hasGarden) features.push('Hage');
  if (detail.hasGarage) features.push('Garasje');
  if (detail.hasBasement) features.push('Kjeller');
  if (detail.utilitiesIncluded.length > 0) {
    features.push(`Inkludert: ${detail.utilitiesIncluded.join(', ')}`);
  }
  return features;
}
