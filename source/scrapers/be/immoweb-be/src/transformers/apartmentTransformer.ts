import { ApartmentPropertyTierI } from '@landomo/core';

export function transformApartment(raw: any, transactionType: string): ApartmentPropertyTierI {
  const prop = raw.property || raw;
  const trans = raw.transaction || {};
  const loc = prop.location || {};
  const price = transactionType === 'sale'
    ? (trans.sale?.price ?? prop.price ?? 0)
    : (trans.rental?.monthlyRentalPrice ?? prop.price ?? 0);

  return {
    property_category: 'apartment',
    title: prop.title || `Apartment in ${loc.locality || 'Belgium'}`,
    price,
    currency: 'EUR',
    transaction_type: transactionType === 'sale' ? 'sale' : 'rent',
    location: {
      address: [loc.street, loc.number].filter(Boolean).join(' ') || undefined,
      city: loc.locality || undefined,
      postal_code: loc.postalCode || undefined,
      region: loc.province || loc.region || undefined,
      country: 'BE',
      coordinates: loc.latitude && loc.longitude ? { lat: loc.latitude, lon: loc.longitude } : undefined,
    },
    bedrooms: prop.bedroomCount ?? 0,
    bathrooms: prop.bathroomCount,
    sqm: prop.netHabitableSurface ?? prop.surface ?? 0,
    floor: prop.floor?.toString() ? parseInt(prop.floor) : undefined,
    total_floors: prop.building?.floorCount,
    rooms: prop.roomCount,
    has_elevator: prop.hasLift ?? false,
    has_balcony: prop.hasBalcony ?? false,
    has_parking: prop.hasParkingSpace ?? false,
    parking_spaces: (prop.parkingCountIndoor ?? 0) + (prop.parkingCountOutdoor ?? 0) || undefined,
    has_basement: prop.hasBasement ?? false,
    has_terrace: prop.hasTerrace ?? prop.hasTermassure ?? false,
    terrace_area: prop.terraceSurface,
    has_garage: prop.garageCount ? prop.garageCount > 0 : false,
    garage_count: prop.garageCount,
    year_built: prop.building?.constructionYear,
    condition: mapCondition(prop.building?.condition),
    heating_type: prop.energy?.heatingType,
    energy_class: prop.certificates?.epcScore,
    construction_type: mapConstructionType(prop.building?.condition),
    description: prop.description,
    images: prop.media?.pictures?.map((p: any) => p.url) ?? raw.media?.pictures?.map((p: any) => p.url),
    published_date: raw.publication?.creationDate,
    hoa_fees: trans.rental?.monthlyRentalCosts,
    features: extractFeatures(prop),
    source_url: `https://www.immoweb.be/en/classified/${raw.id}`,
    source_platform: 'immoweb',
    portal_id: `immoweb-${raw.id}`,
    status: 'active',
    country_specific: {
      epc_score: prop.certificates?.epcScore,
      primary_energy_consumption: prop.certificates?.primaryEnergyConsumptionPerSqm,
      facade_count: prop.building?.facadeCount,
      is_newly_built: raw.flags?.isNewlyBuilt,
    },
  };
}

function mapCondition(condition?: string): ApartmentPropertyTierI['condition'] {
  if (!condition) return undefined;
  const c = condition.toLowerCase();
  if (c.includes('new') || c === 'as_new') return 'new';
  if (c.includes('good')) return 'good';
  if (c.includes('renovate') || c === 'to_renovate' || c === 'to_be_done_up') return 'requires_renovation';
  if (c.includes('excellent') || c === 'just_renovated') return 'after_renovation';
  return 'good';
}

function mapConstructionType(condition?: string): ApartmentPropertyTierI['construction_type'] {
  return undefined; // Immoweb doesn't reliably provide this
}

function extractFeatures(prop: any): string[] {
  const features: string[] = [];
  if (prop.hasAirConditioning) features.push('air_conditioning');
  if (prop.hasSwimmingPool) features.push('swimming_pool');
  if (prop.fireplaceExists) features.push('fireplace');
  if (prop.hasDressingRoom) features.push('dressing_room');
  if (prop.kitchen?.type === 'INSTALLED' || prop.kitchen?.type === 'HYPER_EQUIPPED') features.push('equipped_kitchen');
  return features;
}
