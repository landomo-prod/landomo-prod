import { ApartmentPropertyTierI } from '@landomo/core';
import { HybelListingDetail } from '../../types/hybelTypes';

/**
 * Transform a parsed hybel.no listing detail into an ApartmentPropertyTierI.
 *
 * Covers: leilighet (apartment), hybel (bedsit/studio), rom i bofellesskap (room in shared flat),
 * and all other types that are not classified as houses.
 */
export function transformApartment(detail: HybelListingDetail): ApartmentPropertyTierI {
  // Infer bedrooms from rooms if not directly specified
  // For rooms in shared flats: 1 bedroom = 1 room rented
  let bedrooms = detail.bedrooms;
  if (bedrooms === null && detail.rooms !== null) {
    // "3 roms leilighet" = 2 bedrooms + 1 living room
    // "Rom i bofellesskap" with 1 rom = 0 true bedrooms (studio-style)
    const isSharedFlat = /bofellesskap|rom\s*i/i.test(detail.housingTypeRaw);
    bedrooms = isSharedFlat ? 0 : Math.max(0, detail.rooms - 1);
  }
  bedrooms = bedrooms ?? 0;

  // Build location
  const location: ApartmentPropertyTierI['location'] = {
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

  // Available-from: ISO date string
  const availableFrom = detail.availableFrom ?? undefined;

  // Deposit in NOK
  const deposit = detail.deposit ?? undefined;

  return {
    property_category: 'apartment',
    status: 'active',

    title: detail.title || `${detail.housingTypeRaw} ${detail.address}`,
    description: detail.description ?? undefined,

    price: detail.monthlyRent ?? 0,
    currency: 'NOK',
    transaction_type: 'rent',

    location,

    bedrooms,
    sqm: detail.sqm ?? 0,
    rooms: detail.rooms ?? undefined,
    floor: detail.floor ?? undefined,

    has_elevator: detail.hasElevator,
    has_balcony: detail.hasBalcony,
    has_parking: detail.hasParking,
    has_basement: detail.hasBasement,
    has_terrace: detail.hasTerrace,
    has_garage: detail.hasGarage,

    furnished: detail.hasFurnished ? 'furnished' : undefined,
    deposit,
    available_from: availableFrom,

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
