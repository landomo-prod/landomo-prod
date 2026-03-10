import { CommercialPropertyTierI } from '@landomo/core';

export function transformCommercial(raw: any, transactionType: string): CommercialPropertyTierI {
  const prop = raw.property || raw;
  const trans = raw.transaction || {};
  const loc = prop.location || {};
  const price = transactionType === 'sale'
    ? (trans.sale?.price ?? prop.price ?? 0)
    : (trans.rental?.monthlyRentalPrice ?? prop.price ?? 0);

  return {
    property_category: 'commercial',
    title: prop.title || `Commercial property in ${loc.locality || 'Belgium'}`,
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
    property_subtype: mapSubtype(prop.subtype || prop.type),
    sqm_total: prop.netHabitableSurface ?? prop.surface ?? 0,
    sqm_plot: prop.landSurface,
    total_floors: prop.building?.floorCount,
    has_elevator: prop.hasLift ?? false,
    has_parking: prop.hasParkingSpace ?? false,
    parking_spaces: (prop.parkingCountIndoor ?? 0) + (prop.parkingCountOutdoor ?? 0) || undefined,
    has_bathrooms: (prop.bathroomCount ?? 0) > 0,
    bathroom_count: prop.bathroomCount,
    year_built: prop.building?.constructionYear,
    condition: mapCondition(prop.building?.condition),
    energy_class: prop.certificates?.epcScore,
    monthly_rent: trans.rental?.monthlyRentalPrice,
    description: prop.description,
    images: prop.media?.pictures?.map((p: any) => p.url) ?? raw.media?.pictures?.map((p: any) => p.url),
    published_date: raw.publication?.creationDate,
    features: [],
    source_url: `https://www.immoweb.be/en/classified/${raw.id}`,
    source_platform: 'immoweb',
    portal_id: `immoweb-${raw.id}`,
    status: 'active',
  };
}

function mapSubtype(type?: string): CommercialPropertyTierI['property_subtype'] {
  if (!type) return undefined;
  const t = type.toLowerCase();
  if (t.includes('office')) return 'office';
  if (t.includes('retail') || t.includes('shop') || t.includes('commerce')) return 'retail';
  if (t.includes('warehouse') || t.includes('storage')) return 'warehouse';
  if (t.includes('industrial')) return 'industrial';
  if (t.includes('hotel')) return 'hotel';
  if (t.includes('restaurant') || t.includes('horeca')) return 'restaurant';
  return 'mixed_use';
}

function mapCondition(condition?: string): CommercialPropertyTierI['condition'] {
  if (!condition) return undefined;
  const c = condition.toLowerCase();
  if (c.includes('new') || c === 'as_new') return 'new';
  if (c.includes('good')) return 'good';
  if (c.includes('renovate') || c === 'to_be_done_up') return 'requires_renovation';
  if (c === 'just_renovated') return 'excellent';
  return 'good';
}
