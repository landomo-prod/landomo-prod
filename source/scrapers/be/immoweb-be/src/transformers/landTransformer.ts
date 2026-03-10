import { LandPropertyTierI } from '@landomo/core';

export function transformLand(raw: any, transactionType: string): LandPropertyTierI {
  const prop = raw.property || raw;
  const trans = raw.transaction || {};
  const loc = prop.location || {};
  const price = transactionType === 'sale'
    ? (trans.sale?.price ?? prop.price ?? 0)
    : (trans.rental?.monthlyRentalPrice ?? prop.price ?? 0);

  return {
    property_category: 'land',
    title: prop.title || `Land in ${loc.locality || 'Belgium'}`,
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
    area_plot_sqm: prop.landSurface ?? prop.netHabitableSurface ?? 0,
    zoning: mapZoning(prop.landType),
    building_permit: prop.hasBuildingPermit,
    description: prop.description,
    images: prop.media?.pictures?.map((p: any) => p.url) ?? raw.media?.pictures?.map((p: any) => p.url),
    published_date: raw.publication?.creationDate,
    source_url: `https://www.immoweb.be/en/classified/${raw.id}`,
    source_platform: 'immoweb',
    portal_id: `immoweb-${raw.id}`,
    status: 'active',
  };
}

function mapZoning(landType?: string): LandPropertyTierI['zoning'] {
  if (!landType) return undefined;
  const t = landType.toLowerCase();
  if (t.includes('building') || t.includes('residential')) return 'residential';
  if (t.includes('commercial')) return 'commercial';
  if (t.includes('agricultural') || t.includes('farm')) return 'agricultural';
  if (t.includes('industrial')) return 'industrial';
  if (t.includes('recreational')) return 'recreational';
  return 'mixed';
}
